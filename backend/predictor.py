"""
Predictor — Flood & Landslide Risk Prediction
==============================================
Uses physics-gated ML probabilities:
  1. Fetch live weather from Open-Meteo APIs
  2. Engineer features identically to training
  3. Get calibrated ML probability
  4. Apply physics ceiling — flood requires actual water, landslide requires slope+rain
  5. Return capped, realistic risk percentage
"""

import joblib
import json
import pandas as pd
import numpy as np
import requests
import warnings
warnings.filterwarnings('ignore', category=RuntimeWarning)
from datetime import datetime, timedelta

# ── Paths ─────────────────────────────────────────────────────
FLOOD_MODEL_PATH      = "flood/ml_pipeline/best_model.pkl"
FLOOD_META_PATH       = "flood/ml_pipeline/model_metadata.json"
FLOOD_CONFIG_PATH     = "flood/ml_pipeline/feature_config.json"
LANDSLIDE_MODEL_PATH  = "landslide/ml_pipeline/best_model.pkl"
LANDSLIDE_META_PATH   = "landslide/ml_pipeline/model_metadata.json"
LANDSLIDE_CONFIG_PATH = "landslide/ml_pipeline/feature_config.json"

# ── Load models and configs ───────────────────────────────────
flood_model     = joblib.load(FLOOD_MODEL_PATH)
landslide_model = joblib.load(LANDSLIDE_MODEL_PATH)

with open(FLOOD_META_PATH, 'r') as f:
    flood_meta = json.load(f)
with open(LANDSLIDE_META_PATH, 'r') as f:
    landslide_meta = json.load(f)
with open(FLOOD_CONFIG_PATH, 'r') as f:
    flood_config = json.load(f)
with open(LANDSLIDE_CONFIG_PATH, 'r') as f:
    landslide_config = json.load(f)

print("[Predictor] Models and configs loaded successfully.")


# ── API fetch ─────────────────────────────────────────────────
def fetch_open_meteo(lat: float, lon: float):
    """Fetch weather, elevation, and river discharge from Open-Meteo APIs."""
    end_date   = datetime.now()
    start_date = end_date - timedelta(days=7)
    s_str = start_date.strftime("%Y-%m-%d")
    e_str = end_date.strftime("%Y-%m-%d")

    weather_url = (
        f"https://archive-api.open-meteo.com/v1/archive"
        f"?latitude={lat}&longitude={lon}&start_date={s_str}&end_date={e_str}"
        f"&daily=precipitation_sum,temperature_2m_max,temperature_2m_min,"
        f"relative_humidity_2m_max,wind_speed_10m_max,precipitation_hours,"
        f"et0_fao_evapotranspiration,soil_moisture_0_to_7cm_mean&timezone=auto"
    )
    elev_url      = f"https://api.open-meteo.com/v1/elevation?latitude={lat}&longitude={lon}"
    discharge_url = (
        f"https://flood-api.open-meteo.com/v1/flood"
        f"?latitude={lat}&longitude={lon}"
        f"&daily=river_discharge&start_date={s_str}&end_date={e_str}"
    )

    try:
        w_data = requests.get(weather_url,  timeout=12).json()
        e_data = requests.get(elev_url,     timeout=8).json()
        d_data = requests.get(discharge_url, timeout=8).json()
    except Exception as e:
        raise Exception(f"API fetch failed: {e}")

    if 'daily' not in w_data:
        weather_url2 = weather_url.replace("archive-api", "api").replace("archive", "forecast")
        w_data = requests.get(weather_url2, timeout=12).json()

    daily = w_data.get('daily', {})

    def _get(key, default, idx=-1):
        vals = daily.get(key, [])
        v = vals[idx] if vals and idx < len(vals) else None
        return v if v is not None else default

    def _safe(lst, default=0):
        return [x if x is not None else default for x in lst]

    precip = _safe(daily.get('precipitation_sum', [0]*8))
    today_precip    = precip[-1] if precip else 0
    antecedent_7day = sum(precip[:-1]) if len(precip) > 1 else 0

    disc_list = _safe(d_data.get('daily', {}).get('river_discharge', [0]*8)) \
        if d_data and 'daily' in d_data else [0]*8

    return {
        "rainfall_mm":          float(today_precip),
        "antecedent_7day_mm":   float(antecedent_7day),
        "temp_max_c":           float(_get('temperature_2m_max',            25)),
        "temp_min_c":           float(_get('temperature_2m_min',            15)),
        "humidity_pct":         float(_get('relative_humidity_2m_max',      60)),
        "wind_speed_kmh":       float(_get('wind_speed_10m_max',            10)),
        "precipitation_hours":  float(_get('precipitation_hours',            0)),
        "evapotranspiration_mm":float(_get('et0_fao_evapotranspiration',     3)),
        "soil_moisture":        float(_get('soil_moisture_0_to_7cm_mean',  0.1)),
        "elevation_m":          float(e_data.get('elevation', [100])[0] or 100),
        "river_discharge_m3s":  float(disc_list[-1] if disc_list else 0),
        "flood_nearby":         1 if (disc_list[-1] if disc_list else 0) > 1000 else 0,
        "month":                end_date.month,
        "year":                 end_date.year,
    }


# ── Feature helpers ───────────────────────────────────────────
def _norm_clamp(value, min_v, max_v):
    rng = max_v - min_v
    return max(0.0, min(1.0, (value - min_v) / rng)) if rng > 0 else 0.0


def engineer_flood_features(raw: dict) -> pd.DataFrame:
    """Engineer flood features using saved config — matches training exactly."""
    df = pd.DataFrame([raw])

    bins   = flood_config['rainfall_category_bins']
    labels = flood_config['rainfall_category_labels']
    df['rainfall_category'] = pd.cut(df['rainfall_mm'], bins=bins, labels=labels
                                     ).fillna(0).astype(int)

    season_map = {int(k): v for k, v in flood_config['season_map'].items()}
    df['season'] = df['month'].map(season_map)

    h_bins   = flood_config['humidity_risk_bins']
    h_labels = flood_config['humidity_risk_labels']
    df['humidity_risk'] = pd.cut(df['humidity_pct'], bins=h_bins, labels=h_labels
                                 ).fillna(0).astype(int)

    df['low_elevation']  = (df['elevation_m'] < 100).astype(int)
    df['high_discharge'] = (df['river_discharge_m3s'] > 1000).astype(int)

    for col in ['rainfall_mm', 'river_discharge_m3s']:
        df[f'log_{col}'] = np.log1p(df[col].fillna(0).clip(lower=0))
    df['log_elevation_m'] = np.log1p(df['elevation_m'].fillna(0).clip(lower=0))

    df['rain_humidity_index'] = df['rainfall_mm'] * df['humidity_pct'] / 100
    df['precip_efficiency']   = np.where(
        df['precipitation_hours'] > 0,
        df['rainfall_mm'] / df['precipitation_hours'], 0)
    df['temp_range_c'] = df['temp_max_c'] - df['temp_min_c']

    np_ = flood_config['norm_params']
    df['flood_risk_score'] = round(
        0.30 * _norm_clamp(df['rainfall_mm'].values[0],         np_['rainfall_mm']['min'],         np_['rainfall_mm']['max']) +
        0.20 * _norm_clamp(df['humidity_pct'].values[0],        np_['humidity_pct']['min'],        np_['humidity_pct']['max']) +
        0.20 * _norm_clamp(df['precipitation_hours'].values[0], np_['precipitation_hours']['min'], np_['precipitation_hours']['max']) +
        0.15 * (1.0 - _norm_clamp(df['elevation_m'].values[0], np_['elevation_m']['min'],          np_['elevation_m']['max'])) +
        0.15 * _norm_clamp(df['river_discharge_m3s'].values[0], np_['river_discharge_m3s']['min'], np_['river_discharge_m3s']['max']),
        4)

    feats = flood_meta['features_used']
    for c in feats:
        if c not in df.columns:
            df[c] = 0
    return df[feats].fillna(0)


def engineer_landslide_features(raw: dict) -> pd.DataFrame:
    """Engineer landslide features using saved config — matches training exactly."""
    df = pd.DataFrame([raw])

    df['rainfall_intensity'] = np.where(
        df['precipitation_hours'] > 0,
        df['rainfall_mm'] / df['precipitation_hours'], 0)

    elev_bins   = landslide_config['elevation_cat_bins']
    elev_labels = landslide_config['elevation_cat_labels']
    elev_clipped = df['elevation_m'].clip(lower=0)
    df['elevation_cat'] = pd.cut(elev_clipped, bins=elev_bins, labels=elev_labels
                                 ).fillna(0).astype(int)

    df['slope_proxy'] = np.where(df['elevation_m'] > 0,
                                 np.log1p(df['elevation_m'].clip(lower=0)) / 10, 0)
    df['twi_proxy']   = np.where(df['slope_proxy'] > 0,
                                 df['soil_moisture'].fillna(0) / (df['slope_proxy'] + 0.01), 0)
    df['combined_rain_index'] = (0.6 * df['rainfall_mm'].fillna(0) +
                                 0.4 * df['antecedent_7day_mm'].fillna(0))

    season_map = {int(k): v for k, v in landslide_config['season_map'].items()}
    df['season'] = df['month'].map(season_map)

    df['critical_zone'] = ((df['elevation_m'] > 500) & (df['rainfall_mm'] > 30)).astype(int)

    for col in ['rainfall_mm', 'antecedent_7day_mm']:
        df[f'log_{col}'] = np.log1p(df[col].fillna(0).clip(lower=0))
    df['log_elevation_m'] = np.log1p(df['elevation_m'].fillna(0).clip(lower=0))
    df['temp_range'] = df['temp_max_c'] - df['temp_min_c']

    np_ = landslide_config['norm_params']
    def _n(val, key): return _norm_clamp(val, np_[key]['min'], np_[key]['max'])
    df['landslide_risk_score'] = round(
        0.25 * _n(df['rainfall_mm'].values[0],               'rainfall_mm') +
        0.20 * _n(df['antecedent_7day_mm'].fillna(0).values[0], 'antecedent_7day_mm') +
        0.20 * _n(df['elevation_m'].values[0],                'elevation_m') +
        0.15 * _n(df['humidity_pct'].values[0],               'humidity_pct') +
        0.10 * _n(df['slope_proxy'].values[0],                'slope_proxy') +
        0.10 * _n(df['soil_moisture'].fillna(0).values[0],    'soil_moisture'),
        4)

    feats = landslide_meta['features']
    for c in feats:
        if c not in df.columns:
            df[c] = 0
    return df[feats].fillna(0)


# ── Physics caps ──────────────────────────────────────────────
def _physics_flood_cap(rain, antecedent, discharge, elev):
    """
    Maximum possible flood probability given physical conditions.
    Floods require actual WATER — rain, discharge, or antecedent accumulation.
    Humidity alone CANNOT cause flooding.
    """
    # Each component scaled 0-1
    rain_score = min(1.0, rain / 75.0)            # 75mm = heavy rain
    ante_score = min(1.0, antecedent / 80.0)       # 80mm over 7 days = saturated
    disc_score = min(1.0, discharge / 2000.0)      # 2000 m³/s = flood-level

    # Overall water signal: heavy daily rain alone can cause flash flooding,
    # or high river discharge/antecedent accumulation can cause riverine flooding.
    water_signal = max(rain_score, 0.50 * rain_score + 0.30 * ante_score + 0.20 * disc_score)

    # Highland penalty (water runs off fast, doesn't accumulate)
    if   elev > 1500: water_signal *= 0.45
    elif elev > 800:  water_signal *= 0.70

    # Max flood prob: 8% baseline → 95% at extreme water signal
    return min(0.97, 0.08 + 0.87 * water_signal)


def _physics_landslide_cap(rain, antecedent, elev, soil_moisture):
    """
    Maximum possible landslide probability given physical conditions.
    Landslides require: SLOPE (elevation) AND RAIN AND SATURATED SOIL.
    All three must be present — flat terrain = zero, no rain = near zero.
    """
    # Slope proxy: below 80m = flat, above 350m = potentially very steep.
    # Uses logarithmic scaling consistent with engineered slope features.
    if elev < 80:
        slope_score = 0.0
    else:
        slope_score = min(1.0, np.log1p(elev - 80) / np.log1p(350 - 80))

    # Rain score
    rain_score = min(1.0, rain / 80.0)
    ante_score = min(1.0, antecedent / 120.0)
    rain_combined = 0.6 * rain_score + 0.4 * ante_score

    # Soil saturation
    sm_score = min(1.0, soil_moisture / 0.35)

    # Multiplicative: ALL three must be present
    ls_signal = slope_score * rain_combined * (0.5 + 0.5 * sm_score)

    return min(0.95, 0.04 + 0.91 * ls_signal)



# ── Main prediction ───────────────────────────────────────────
def predict_risk(lat: float, lon: float):
    """
    Predict flood and landslide risk at given coordinates.
    Returns physics-gated, calibrated probability percentages.
    """
    raw = fetch_open_meteo(lat, lon)

    df_flood = engineer_flood_features(raw)
    df_ls    = engineer_landslide_features(raw)

    # ML model probabilities (calibrated)
    flood_ml = float(flood_model.predict_proba(df_flood)[0][1])
    ls_ml    = float(landslide_model.predict_proba(df_ls)[0][1])

    # Physical variables
    rain         = raw["rainfall_mm"]
    antecedent   = raw["antecedent_7day_mm"]
    elev         = raw["elevation_m"]
    discharge    = raw["river_discharge_m3s"]
    humidity     = raw["humidity_pct"]
    soil_moist   = raw["soil_moisture"]
    precip_hours = raw["precipitation_hours"]

    # Physics ceiling: ML cannot exceed what physics allows
    max_flood = _physics_flood_cap(rain, antecedent, discharge, elev)
    max_ls    = _physics_landslide_cap(rain, antecedent, elev, soil_moist)

    flood_prob = min(flood_ml, max_flood)
    ls_prob    = min(ls_ml,    max_ls)

    # Hard overrides for clearly impossible conditions
    total_water = rain + antecedent * 0.5 + discharge * 0.01
    if total_water < 3.0:
        flood_prob = min(flood_prob, 0.08)
        ls_prob    = min(ls_prob,    0.06)

    if elev < 80:
        ls_prob = min(ls_prob, 0.04)   # truly flat — no landslide

    if rain == 0 and antecedent < 2 and humidity < 20:
        flood_prob = min(flood_prob, 0.02)
        ls_prob    = min(ls_prob,    0.02)

    return {
        "coordinates": {"lat": lat, "lon": lon},
        "live_factors": {
            "rainfall_mm":          float(rain),
            "antecedent_7day_mm":   float(antecedent),
            "elevation_m":          float(elev),
            "soil_moisture":        float(soil_moist),
            "river_discharge":      float(discharge),
            "humidity_pct":         float(humidity),
            "precipitation_hours":  float(precip_hours),
        },
        "predictions": {
            "flood_risk_pct":     round(flood_prob * 100, 1),
            "landslide_risk_pct": round(ls_prob    * 100, 1),
        }
    }

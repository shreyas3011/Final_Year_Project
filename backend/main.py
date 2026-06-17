from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from backend.predictor import predict_risk, engineer_flood_features, engineer_landslide_features, \
    flood_model, landslide_model, _physics_flood_cap, _physics_landslide_cap, flood_meta, landslide_meta

app = FastAPI(title="Flood & Landslide Prediction API")

# Allow CORS for the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class LocationRequest(BaseModel):
    lat: float
    lon: float

class ManualRequest(BaseModel):
    # Weather parameters
    rainfall_mm: float = 0.0
    antecedent_7day_mm: float = 0.0
    temp_max_c: float = 25.0
    temp_min_c: float = 15.0
    humidity_pct: float = 60.0
    wind_speed_kmh: float = 10.0
    precipitation_hours: float = 0.0
    evapotranspiration_mm: float = 3.0
    soil_moisture: float = 0.1
    # Terrain & hydrology
    elevation_m: float = 100.0
    river_discharge_m3s: float = 0.0
    flood_nearby: int = 0
    # Time
    month: int = 6
    year: int = 2024

@app.get("/")
def read_root():
    return {"status": "online", "message": "Flood & Landslide Prediction API"}

@app.post("/predict")
def predict(request: LocationRequest):
    try:
        result = predict_risk(request.lat, request.lon)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/predict-manual")
def predict_manual(req: ManualRequest):
    """
    Predict flood & landslide risk from manually supplied parameters.
    Bypasses live API fetch — uses provided values directly.
    """
    try:
        raw = {
            "rainfall_mm":          req.rainfall_mm,
            "antecedent_7day_mm":   req.antecedent_7day_mm,
            "temp_max_c":           req.temp_max_c,
            "temp_min_c":           req.temp_min_c,
            "humidity_pct":         req.humidity_pct,
            "wind_speed_kmh":       req.wind_speed_kmh,
            "precipitation_hours":  req.precipitation_hours,
            "evapotranspiration_mm":req.evapotranspiration_mm,
            "soil_moisture":        req.soil_moisture,
            "elevation_m":          req.elevation_m,
            "river_discharge_m3s":  req.river_discharge_m3s,
            "flood_nearby":         req.flood_nearby,
            "month":                req.month,
            "year":                 req.year,
        }

        df_flood = engineer_flood_features(raw)
        df_ls    = engineer_landslide_features(raw)

        flood_ml = float(flood_model.predict_proba(df_flood)[0][1])
        ls_ml    = float(landslide_model.predict_proba(df_ls)[0][1])

        rain        = raw["rainfall_mm"]
        antecedent  = raw["antecedent_7day_mm"]
        elev        = raw["elevation_m"]
        discharge   = raw["river_discharge_m3s"]
        humidity    = raw["humidity_pct"]
        soil_moist  = raw["soil_moisture"]

        max_flood = _physics_flood_cap(rain, antecedent, discharge, elev)
        max_ls    = _physics_landslide_cap(rain, antecedent, elev, soil_moist)

        flood_prob = min(flood_ml, max_flood)
        ls_prob    = min(ls_ml,    max_ls)

        total_water = rain + antecedent * 0.5 + discharge * 0.01
        if total_water < 3.0:
            flood_prob = min(flood_prob, 0.08)
            ls_prob    = min(ls_prob,    0.06)
        if elev < 80:
            ls_prob = min(ls_prob, 0.04)
        if rain == 0 and antecedent < 2 and humidity < 20:
            flood_prob = min(flood_prob, 0.02)
            ls_prob    = min(ls_prob,    0.02)

        return {
            "raw_ml_probabilities": {
                "flood_ml_pct":     round(flood_ml * 100, 1),
                "landslide_ml_pct": round(ls_ml    * 100, 1),
            },
            "physics_caps": {
                "max_flood_pct":     round(max_flood * 100, 1),
                "max_landslide_pct": round(max_ls    * 100, 1),
            },
            "predictions": {
                "flood_risk_pct":     round(flood_prob * 100, 1),
                "landslide_risk_pct": round(ls_prob    * 100, 1),
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class FloodManualRequest(BaseModel):
    # Raw features
    rainfall_mm: float = 0.0
    temp_max_c: float = 25.0
    temp_min_c: float = 15.0
    humidity_pct: float = 60.0
    wind_speed_kmh: float = 10.0
    precipitation_hours: float = 0.0
    evapotranspiration_mm: float = 3.0
    elevation_m: float = 100.0
    river_discharge_m3s: float = 0.0
    
    # Engineered features used in training
    rainfall_category: int = 0
    season: int = 0
    humidity_risk: int = 0
    low_elevation: int = 0
    high_discharge: int = 0
    log_rainfall_mm: float = 0.0
    log_river_discharge_m3s: float = 0.0
    log_elevation_m: float = 0.0
    rain_humidity_index: float = 0.0
    precip_efficiency: float = 0.0
    temp_range_c: float = 0.0
    flood_risk_score: float = 0.0

@app.post("/predict-flood-manual")
def predict_flood_manual(req: FloodManualRequest):
    try:
        data = {
            "rainfall_mm":          req.rainfall_mm,
            "temp_max_c":           req.temp_max_c,
            "temp_min_c":           req.temp_min_c,
            "humidity_pct":         req.humidity_pct,
            "wind_speed_kmh":       req.wind_speed_kmh,
            "precipitation_hours":  req.precipitation_hours,
            "evapotranspiration_mm":req.evapotranspiration_mm,
            "elevation_m":          req.elevation_m,
            "river_discharge_m3s":  req.river_discharge_m3s,
            "rainfall_category":    req.rainfall_category,
            "season":               req.season,
            "humidity_risk":        req.humidity_risk,
            "low_elevation":        req.low_elevation,
            "high_discharge":       req.high_discharge,
            "log_rainfall_mm":      req.log_rainfall_mm,
            "log_river_discharge_m3s": req.log_river_discharge_m3s,
            "log_elevation_m":      req.log_elevation_m,
            "rain_humidity_index":  req.rain_humidity_index,
            "precip_efficiency":    req.precip_efficiency,
            "temp_range_c":         req.temp_range_c,
            "flood_risk_score":     req.flood_risk_score,
        }
        
        import pandas as pd
        df_flood = pd.DataFrame([data])
        feats = flood_meta['features_used']
        df_flood = df_flood[feats]
        
        flood_ml = float(flood_model.predict_proba(df_flood)[0][1])

        rain       = req.rainfall_mm
        antecedent = 0.0
        discharge  = req.river_discharge_m3s
        elev       = req.elevation_m
        humidity   = req.humidity_pct

        max_flood  = _physics_flood_cap(rain, antecedent, discharge, elev)
        flood_prob = min(flood_ml, max_flood)

        total_water = rain + antecedent * 0.5 + discharge * 0.01
        if total_water < 3.0:
            flood_prob = min(flood_prob, 0.08)
        if rain == 0 and antecedent < 2 and humidity < 20:
            flood_prob = min(flood_prob, 0.02)

        return {
            "raw_ml_probability": round(flood_ml * 100, 1),
            "physics_cap":       round(max_flood * 100, 1),
            "flood_risk_pct":    round(flood_prob * 100, 1),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class LandslideManualRequest(BaseModel):
    # Raw features
    rainfall_mm: float = 0.0
    antecedent_7day_mm: float = 0.0
    temp_max_c: float = 25.0
    temp_min_c: float = 15.0
    humidity_pct: float = 60.0
    wind_speed_kmh: float = 10.0
    precipitation_hours: float = 0.0
    evapotranspiration_mm: float = 3.0
    soil_moisture: float = 0.1
    elevation_m: float = 100.0
    river_discharge_m3s: float = 0.0
    flood_nearby: int = 0
    
    # Engineered features used in training
    rainfall_intensity: float = 0.0
    elevation_cat: int = 0
    slope_proxy: float = 0.0
    twi_proxy: float = 0.0
    combined_rain_index: float = 0.0
    season: int = 0
    critical_zone: int = 0
    log_rainfall_mm: float = 0.0
    log_antecedent_7day_mm: float = 0.0
    log_elevation_m: float = 0.0
    temp_range: float = 0.0
    landslide_risk_score: float = 0.0

@app.post("/predict-landslide-manual")
def predict_landslide_manual(req: LandslideManualRequest):
    try:
        data = {
            "rainfall_mm":          req.rainfall_mm,
            "antecedent_7day_mm":   req.antecedent_7day_mm,
            "temp_max_c":           req.temp_max_c,
            "temp_min_c":           req.temp_min_c,
            "humidity_pct":         req.humidity_pct,
            "wind_speed_kmh":       req.wind_speed_kmh,
            "precipitation_hours":  req.precipitation_hours,
            "evapotranspiration_mm":req.evapotranspiration_mm,
            "soil_moisture":        req.soil_moisture,
            "elevation_m":          req.elevation_m,
            "river_discharge_m3s":  req.river_discharge_m3s,
            "flood_nearby":         req.flood_nearby,
            "rainfall_intensity":   req.rainfall_intensity,
            "elevation_cat":        req.elevation_cat,
            "slope_proxy":          req.slope_proxy,
            "twi_proxy":            req.twi_proxy,
            "combined_rain_index":  req.combined_rain_index,
            "season":               req.season,
            "critical_zone":        req.critical_zone,
            "log_rainfall_mm":      req.log_rainfall_mm,
            "log_antecedent_7day_mm": req.log_antecedent_7day_mm,
            "log_elevation_m":      req.log_elevation_m,
            "temp_range":           req.temp_range,
            "landslide_risk_score": req.landslide_risk_score,
        }

        import pandas as pd
        df_ls = pd.DataFrame([data])
        feats = landslide_meta['features']
        df_ls = df_ls[feats]
        
        ls_ml = float(landslide_model.predict_proba(df_ls)[0][1])

        rain        = req.rainfall_mm
        antecedent  = req.antecedent_7day_mm
        elev        = req.elevation_m
        soil_moist  = req.soil_moisture
        humidity    = req.humidity_pct
        discharge   = req.river_discharge_m3s

        max_ls  = _physics_landslide_cap(rain, antecedent, elev, soil_moist)
        ls_prob = min(ls_ml, max_ls)

        total_water = rain + antecedent * 0.5 + discharge * 0.01
        if total_water < 3.0:
            ls_prob = min(ls_prob, 0.06)
        if elev < 80:
            ls_prob = min(ls_prob, 0.04)
        if rain == 0 and antecedent < 2 and humidity < 20:
            ls_prob = min(ls_prob, 0.02)

        return {
            "raw_ml_probability":  round(ls_ml * 100, 1),
            "physics_cap":         round(max_ls * 100, 1),
            "landslide_risk_pct":  round(ls_prob * 100, 1),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



"""
Generate synthetic "safe" training examples for non-flood/non-landslide locations.

The core problem: the model only saw weather data from GDACS flood event zones.
Normal rain (5-15mm) in a safe city was NEVER in the training data.
This script adds realistic "safe" examples from globally diverse locations.
"""

import pandas as pd
import numpy as np
import requests
from datetime import datetime, timedelta
import time
import os

# ── Safe reference locations (no significant flood/landslide history) ──────────
SAFE_LOCATIONS = [
    # Indian cities with low flood/landslide risk
    ("Pune_Balewadi",        18.574,  73.768, "flood"),
    ("Pune_Hinjewadi",       18.597,  73.738, "flood"),
    ("Jaipur_Center",        26.912,  75.787, "flood"),
    ("Ahmedabad_Center",     23.033,  72.585, "flood"),
    ("Bhopal_Center",        23.259,  77.412, "flood"),
    ("Nagpur_Center",        21.145,  79.089, "flood"),
    ("Indore_Center",        22.719,  75.857, "flood"),
    ("Hyderabad_Suburb",     17.385,  78.486, "flood"),
    ("Bengaluru_Suburb",     12.971,  77.594, "flood"),
    ("Delhi_South",          28.527,  77.211, "flood"),
    ("Chandigarh",           30.733,  76.779, "flood"),
    ("Lucknow_Center",       26.847,  80.947, "flood"),
    ("Patna_Outskirts",      25.614,  85.144, "flood"),
    ("Thar_Desert_1",        26.920,  70.900, "flood"),
    ("Thar_Desert_2",        27.500,  72.000, "flood"),
    ("Rajasthan_Barmer",     25.747,  71.394, "flood"),
    # Global safe cities
    ("Nairobi_Kenya",        -1.286,  36.817, "flood"),
    ("Riyadh_KSA",           24.688,  46.722, "flood"),
    ("Cairo_Egypt",          30.044,  31.236, "flood"),
    ("Phoenix_AZ",           33.448, -112.073, "flood"),
    ("Madrid_Spain",         40.416,  -3.703, "flood"),
    ("Ankara_Turkey",        39.920,  32.854, "flood"),
    ("Lima_Peru",            -12.046, -77.043, "flood"),
    ("Buenos_Aires",         -34.603, -58.381, "flood"),
    ("Calgary_Canada",        51.047, -114.058, "flood"),
    ("Johannesburg_SA",      -26.204,  28.047, "flood"),
    # Flat terrain, low landslide risk
    ("Kolkata_Flat",          22.572,  88.363, "landslide"),
    ("Dhaka_Bangladesh",      23.810,  90.412, "landslide"),
    ("Lagos_Nigeria",          6.524,   3.379, "landslide"),
    ("Amsterdam_NL",           52.370,   4.895, "landslide"),
    ("Warsaw_Poland",          52.229,  21.012, "landslide"),
    ("Chicago_IL",             41.878, -87.630, "landslide"),
    ("Houston_TX",             29.760, -95.369, "landslide"),
    ("Paris_France",           48.857,   2.347, "landslide"),
    ("Melbourne_AU",          -37.814, 144.963, "landslide"),
    ("Guangzhou_CN",           23.129, 113.264, "landslide"),
    ("Pune_Flat_Kharadi",      18.551,  73.940, "landslide"),
    ("Delhi_NCR_Flat",         28.700,  77.100, "landslide"),
    ("Thar_flat_1",            27.000,  71.500, "landslide"),
]

def fetch_7days(lat, lon):
    """Fetch last 7 days of daily weather for a location."""
    end = datetime.now()
    start = end - timedelta(days=8)
    s_str = start.strftime("%Y-%m-%d")
    e_str = end.strftime("%Y-%m-%d")
    
    weather_url = (
        f"https://archive-api.open-meteo.com/v1/archive"
        f"?latitude={lat}&longitude={lon}"
        f"&start_date={s_str}&end_date={e_str}"
        f"&daily=precipitation_sum,temperature_2m_max,temperature_2m_min,"
        f"relative_humidity_2m_max,wind_speed_10m_max,precipitation_hours,"
        f"et0_fao_evapotranspiration,soil_moisture_0_to_7cm_mean"
        f"&timezone=auto"
    )
    elev_url = f"https://api.open-meteo.com/v1/elevation?latitude={lat}&longitude={lon}"
    discharge_url = (
        f"https://flood-api.open-meteo.com/v1/flood"
        f"?latitude={lat}&longitude={lon}"
        f"&daily=river_discharge&start_date={s_str}&end_date={e_str}"
    )
    
    try:
        w = requests.get(weather_url, timeout=12).json()
        e = requests.get(elev_url, timeout=8).json()
        d = requests.get(discharge_url, timeout=8).json()
    except Exception as ex:
        print(f"    API error: {ex}")
        return []
    
    if 'daily' not in w:
        return []
    
    daily = w['daily']
    elev = e.get('elevation', [100])[0] or 100
    disc = d.get('daily', {}).get('river_discharge', []) if 'daily' in d else []
    dates = daily.get('time', [])
    
    rows = []
    precip = [p or 0 for p in daily.get('precipitation_sum', [])]
    
    for i, date in enumerate(dates[1:], 1):  # skip first day (need antecedent)
        antecedent = sum(precip[max(0, i-7):i])
        row = {
            'event_name': f"SAFE_{lat:.2f}_{lon:.2f}_{date}",
            'date': date,
            'latitude': lat,
            'longitude': lon,
            'rainfall_mm': precip[i],
            'antecedent_7day_mm': antecedent,
            'temp_max_c': daily.get('temperature_2m_max', [25]*len(dates))[i] or 25,
            'temp_min_c': daily.get('temperature_2m_min', [15]*len(dates))[i] or 15,
            'humidity_pct': daily.get('relative_humidity_2m_max', [60]*len(dates))[i] or 60,
            'wind_speed_kmh': daily.get('wind_speed_10m_max', [10]*len(dates))[i] or 10,
            'precipitation_hours': daily.get('precipitation_hours', [0]*len(dates))[i] or 0,
            'evapotranspiration_mm': daily.get('et0_fao_evapotranspiration', [3]*len(dates))[i] or 3,
            'soil_moisture': daily.get('soil_moisture_0_to_7cm_mean', [0.1]*len(dates))[i] or 0.1,
            'elevation_m': elev,
            'river_discharge_m3s': disc[i] if i < len(disc) else 0,
            'month': int(date.split('-')[1]),
            'year': int(date.split('-')[0]),
            'flood_occurred': 0,        # SAFE location — no flood
            'landslide_occurred': 0,    # SAFE location — no landslide
        }
        rows.append(row)
    
    return rows


print("=" * 65)
print("  GENERATING SAFE TRAINING EXAMPLES")
print("=" * 65)

flood_safe_rows = []
landslide_safe_rows = []

for name, lat, lon, hazard in SAFE_LOCATIONS:
    print(f"  Fetching {name} ({lat:.2f}, {lon:.2f})...", end=" ", flush=True)
    rows = fetch_7days(lat, lon)
    if rows:
        print(f"{len(rows)} days")
        if hazard == "flood" or True:   # Add to flood dataset
            flood_safe_rows.extend(rows)
        if hazard == "landslide" or True:  # Add to landslide dataset
            landslide_safe_rows.extend(rows)
    else:
        print("FAILED")
    time.sleep(0.3)  # Be kind to the API

print(f"\n  Generated {len(flood_safe_rows)} safe flood examples")
print(f"  Generated {len(landslide_safe_rows)} safe landslide examples")

# ── Append to existing real datasets ────────────────────────────────────────
flood_existing = pd.read_csv("flood/data/flood_real_dataset.csv")
flood_safe_df = pd.DataFrame(flood_safe_rows)

# Keep only columns that exist in flood dataset
flood_cols = flood_existing.columns.tolist()
for c in flood_cols:
    if c not in flood_safe_df.columns:
        flood_safe_df[c] = 0
flood_safe_df = flood_safe_df[flood_cols]

flood_combined = pd.concat([flood_existing, flood_safe_df], ignore_index=True)
flood_combined.to_csv("flood/data/flood_real_dataset.csv", index=False)
print(f"\n  Flood dataset: {len(flood_existing)} → {len(flood_combined)} rows")
print(f"  Class balance: Flood={flood_combined['flood_occurred'].sum()} | "
      f"Safe={( flood_combined['flood_occurred']==0).sum()}")

# ── Landslide dataset ────────────────────────────────────────────────────────
ls_existing = pd.read_csv("landslide/data/landslide_real_dataset.csv")
ls_safe_df = pd.DataFrame(landslide_safe_rows)

ls_cols = ls_existing.columns.tolist()
for c in ls_cols:
    if c not in ls_safe_df.columns:
        ls_safe_df[c] = 0
ls_safe_df = ls_safe_df[ls_cols]

ls_combined = pd.concat([ls_existing, ls_safe_df], ignore_index=True)
ls_combined.to_csv("landslide/data/landslide_real_dataset.csv", index=False)
print(f"  Landslide dataset: {len(ls_existing)} → {len(ls_combined)} rows")
print(f"  Class balance: Landslide={ls_combined['landslide_occurred'].sum()} | "
      f"Safe={(ls_combined['landslide_occurred']==0).sum()}")

print("\n  ✓ Safe examples added successfully!")
print("  Next: run EDA scripts then training scripts to retrain models.")

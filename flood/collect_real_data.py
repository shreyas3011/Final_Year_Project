"""
Real Flood Dataset Collector
=============================
Fetches REAL data from 3 free APIs (no API key needed):
  1. archive-api.open-meteo.com  → Rainfall, Humidity, Temp, Wind, Soil Moisture
  2. api.open-meteo.com/elevation → Elevation (Copernicus DEM, 90m)
  3. flood-api.open-meteo.com    → River Discharge (GloFAS, since 1984)

Strategy:
  - Known real flood events (India + World) with exact dates → label = 1
  - Same locations in dry season / safe months → label = 0
  - Highland / arid / non-flood-prone locations → label = 0
  - For each event, fetch 5 daily rows (window around event date)
  - Final dataset: ~600-800 real rows, 100% API-sourced
"""

import pandas as pd
import time
from datetime import datetime, timedelta
from tqdm import tqdm

# ─────────────────────────────────────────────────────────────
# REAL FLOOD EVENTS — India + World
# Format: (name, lat, lon, flood_start, flood_end, flood=1)
# ─────────────────────────────────────────────────────────────
FLOOD_EVENTS = [
    # ─── INDIA ───────────────────────────────────────────────
    ("Kerala_Flood_2018",         9.50,  76.50, "2018-08-15", "2018-08-20"),
    ("Kerala_Flood_2019",         9.55,  76.52, "2019-08-08", "2019-08-12"),
    ("Patna_Bihar_2019",         25.59,  85.14, "2019-09-28", "2019-10-02"),
    ("Patna_Bihar_2023",         25.61,  85.13, "2023-09-01", "2023-09-05"),
    ("Assam_Brahmaputra_2022",   26.14,  91.74, "2022-06-17", "2022-06-21"),
    ("Assam_Floods_2023",        26.20,  91.75, "2023-07-01", "2023-07-05"),
    ("Mumbai_2005",              19.07,  72.88, "2005-07-26", "2005-07-30"),
    ("Mumbai_2019",              19.08,  72.87, "2019-07-01", "2019-07-05"),
    ("Chennai_2015",             13.08,  80.27, "2015-11-01", "2015-11-05"),
    ("Odisha_Cyclone_2021",      20.29,  85.82, "2021-10-25", "2021-10-29"),
    ("Odisha_Floods_2023",       20.10,  85.70, "2023-08-15", "2023-08-19"),
    ("Uttarakhand_2021",         30.07,  79.40, "2021-10-17", "2021-10-21"),
    ("Uttarakhand_2022",         30.10,  79.45, "2022-10-18", "2022-10-22"),
    ("Sikkim_Flash_2023",        27.33,  88.61, "2023-10-03", "2023-10-07"),
    ("Rajasthan_2022",           26.92,  75.79, "2022-08-11", "2022-08-15"),
    ("Jammu_2023",               32.73,  74.87, "2023-07-08", "2023-07-12"),
    ("Himachal_Pradesh_2023",    31.10,  77.17, "2023-08-14", "2023-08-18"),
    ("Gujarat_Morbi_2022",       22.81,  70.83, "2022-10-29", "2022-11-02"),
    ("Gujarat_Floods_2023",      23.02,  72.57, "2023-09-03", "2023-09-07"),
    ("West_Bengal_2021",         22.57,  88.36, "2021-07-27", "2021-07-31"),
    ("Andhra_Krishna_2022",      16.51,  80.62, "2022-09-19", "2022-09-23"),
    ("Telangana_2022",           17.38,  78.49, "2022-10-12", "2022-10-16"),
    ("Punjab_Floods_2023",       30.90,  75.85, "2023-07-14", "2023-07-18"),
    ("Manipur_2023",             24.82,  93.95, "2023-08-26", "2023-08-30"),
    ("Tripura_2024",             23.83,  91.28, "2024-08-20", "2024-08-24"),
    # ─── WORLD ───────────────────────────────────────────────
    ("Pakistan_Sindh_2022",      27.53,  68.47, "2022-08-25", "2022-08-29"),
    ("Pakistan_Balochistan_2022",29.01,  66.97, "2022-08-20", "2022-08-24"),
    ("Bangladesh_Sylhet_2022",   24.90,  91.87, "2022-06-16", "2022-06-20"),
    ("Bangladesh_Floods_2023",   24.00,  90.50, "2023-08-06", "2023-08-10"),
    ("Nigeria_Anambra_2022",      6.21,   6.69, "2022-10-04", "2022-10-08"),
    ("Germany_Ahr_2021",         50.54,   6.95, "2021-07-14", "2021-07-18"),
    ("China_Henan_2021",         34.75, 113.65, "2021-07-20", "2021-07-24"),
    ("China_Guangdong_2022",     23.13, 113.26, "2022-06-12", "2022-06-16"),
    ("USA_Kentucky_2022",        37.33, -83.17, "2022-07-28", "2022-08-01"),
    ("USA_Vermont_2023",         44.26, -72.58, "2023-07-10", "2023-07-14"),
    ("Australia_NSW_2022",      -30.33, 153.12, "2022-02-26", "2022-03-02"),
    ("Australia_QLD_2022",      -27.47, 153.02, "2022-02-26", "2022-03-02"),
    ("Indonesia_Sumatra_2022",   -2.10, 104.75, "2022-10-30", "2022-11-03"),
    ("Brazil_Petropolis_2022",  -22.51, -43.18, "2022-02-15", "2022-02-19"),
    ("South_Africa_KZN_2022",   -29.85,  31.00, "2022-04-11", "2022-04-15"),
    ("Philippines_2022",         14.10, 121.56, "2022-09-26", "2022-09-30"),
    ("Nepal_Koshi_2023",         26.91,  87.17, "2023-10-04", "2023-10-08"),
    ("Afghanistan_2024",         33.00,  68.50, "2024-05-10", "2024-05-14"),
    ("Canada_BC_2021",           49.10,-121.95, "2021-11-14", "2021-11-18"),
    ("Italy_Emilia_2023",        44.49,  11.34, "2023-05-16", "2023-05-20"),
]

# ─────────────────────────────────────────────────────────────
# NON-FLOOD LOCATIONS — arid/highland/safe zones with dry dates
# ─────────────────────────────────────────────────────────────
NON_FLOOD_EVENTS = [
    # India — dry / highland / desert locations in dry season
    ("Rajasthan_Thar_Desert",    26.92,  70.90, "2023-12-01", "2023-12-05"),
    ("Ladakh_Highland",          34.16,  77.58, "2023-03-01", "2023-03-05"),
    ("Deccan_Plateau_Dry",       17.38,  76.50, "2023-01-10", "2023-01-14"),
    ("Himachal_Dry_Winter",      31.10,  77.17, "2023-01-01", "2023-01-05"),
    ("Gujarat_Coast_Dry",        22.30,  68.97, "2023-02-01", "2023-02-05"),
    ("Andhra_Dry_Season",        15.83,  78.04, "2023-01-15", "2023-01-19"),
    ("Punjab_Dry_Season",        30.90,  75.85, "2023-11-01", "2023-11-05"),
    ("UP_Agra_Dry",              27.17,  78.00, "2023-04-01", "2023-04-05"),
    ("Tamil_Nadu_Interior_Dry",  11.00,  78.00, "2023-04-01", "2023-04-05"),
    ("Jharkhand_Dry",            23.61,  85.28, "2023-03-01", "2023-03-05"),
    # World — arid/safe zones
    ("Sahara_Algeria",           25.00,   3.00, "2023-06-01", "2023-06-05"),
    ("Arabian_Desert_Saudi",     24.68,  46.72, "2023-07-01", "2023-07-05"),
    ("Atacama_Chile",           -24.50, -69.25, "2023-09-01", "2023-09-05"),
    ("Gobi_Mongolia",            43.00, 103.00, "2023-05-01", "2023-05-05"),
    ("Namib_Namibia",           -23.50,  15.00, "2023-08-01", "2023-08-05"),
    ("Colorado_Plateau_USA",     37.00,-111.00, "2023-06-01", "2023-06-05"),
    ("Spain_Meseta_Dry",         40.42,  -3.70, "2023-07-15", "2023-07-19"),
    ("Iran_Central_Dry",         32.00,  53.68, "2023-06-01", "2023-06-05"),
    ("Ethiopia_Highland_Dry",     9.03,  38.74, "2023-01-01", "2023-01-05"),
    ("Australia_Outback",       -25.00, 134.00, "2023-07-01", "2023-07-05"),
    # Same flood locations but in dry months → no flood
    ("Kerala_Dry_Jan",            9.50,  76.50, "2023-01-15", "2023-01-19"),
    ("Patna_Dry_Feb",            25.59,  85.14, "2023-02-10", "2023-02-14"),
    ("Mumbai_Dry_Apr",           19.07,  72.88, "2023-04-01", "2023-04-05"),
    ("Assam_Dry_Nov",            26.14,  91.74, "2023-11-01", "2023-11-05"),
    ("Pakistan_Dry_Nov",         27.53,  68.47, "2022-11-01", "2022-11-05"),
]

# ─────────────────────────────────────────────────────────────
# API FETCH FUNCTIONS
# ─────────────────────────────────────────────────────────────

import subprocess, json as _json, urllib.parse

def _curl(url, retries=3):
    """Reliable API caller using system curl (proven to work on this network)."""
    for attempt in range(retries):
        try:
            result = subprocess.run(
                ["curl", "-s", "--max-time", "30", "--retry", "2", url],
                capture_output=True, text=True, timeout=40
            )
            if result.returncode == 0 and result.stdout.strip():
                return _json.loads(result.stdout)
        except Exception as e:
            if attempt == retries - 1:
                print(f"  curl error ({url[:60]}...): {e}")
        time.sleep(1)
    return None

def fetch_weather(lat, lon, start_date, end_date):
    """Fetch daily weather from Open-Meteo historical archive via curl."""
    params = (
        f"latitude={lat}&longitude={lon}"
        f"&start_date={start_date}&end_date={end_date}"
        f"&daily=precipitation_sum,temperature_2m_max,temperature_2m_min,"
        f"relative_humidity_2m_max,wind_speed_10m_max,"
        f"precipitation_hours,et0_fao_evapotranspiration"
        f"&timezone=auto"
    )
    url = f"https://archive-api.open-meteo.com/v1/archive?{params}"
    data = _curl(url)
    if data and 'daily' in data:
        return data
    return None

def fetch_elevation(lat, lon):
    """Fetch real elevation from Copernicus DEM via curl."""
    url = f"https://api.open-meteo.com/v1/elevation?latitude={lat}&longitude={lon}"
    data = _curl(url)
    if data and 'elevation' in data:
        return data['elevation'][0]
    return None

def fetch_discharge(lat, lon, start_date, end_date):
    """Fetch river discharge from GloFAS via curl."""
    url = (
        f"https://flood-api.open-meteo.com/v1/flood"
        f"?latitude={lat}&longitude={lon}"
        f"&daily=river_discharge"
        f"&start_date={start_date}&end_date={end_date}"
    )
    data = _curl(url)
    if data and 'daily' in data:
        return data
    return None

# ─────────────────────────────────────────────────────────────
# MAIN DATA COLLECTION LOOP
# ─────────────────────────────────────────────────────────────

all_rows = []

def process_events(events, flood_label, label_str):
    print(f"\n{'='*60}")
    print(f"  Collecting {label_str} events ({len(events)} locations)...")
    print(f"{'='*60}")

    for evt in tqdm(events, desc=label_str):
        name, lat, lon, start, end = evt
        
        # Fetch all 3 APIs
        weather  = fetch_weather(lat, lon, start, end)
        elev     = fetch_elevation(lat, lon)
        discharge = fetch_discharge(lat, lon, start, end)
        
        if not weather or 'daily' not in weather:
            print(f"  [SKIP] No weather data for {name}")
            time.sleep(0.5)
            continue
        
        daily = weather['daily']
        n_days = len(daily['time'])

        for i in range(n_days):
            row = {
                'event_name':           name,
                'date':                 daily['time'][i],
                'latitude':             lat,
                'longitude':            lon,
                # Weather
                'rainfall_mm':          daily['precipitation_sum'][i],
                'temp_max_c':           daily['temperature_2m_max'][i],
                'temp_min_c':           daily['temperature_2m_min'][i],
                'humidity_pct':         daily['relative_humidity_2m_max'][i],
                'wind_speed_kmh':       daily['wind_speed_10m_max'][i],
                'precipitation_hours':  daily['precipitation_hours'][i],
                'evapotranspiration_mm':daily['et0_fao_evapotranspiration'][i],
                # Topography
                'elevation_m':          elev,
                # River
                'river_discharge_m3s':  None,
                # Target
                'flood_occurred':       flood_label,
            }
            
            # Fill river discharge if available
            if discharge and 'daily' in discharge:
                disc_list = discharge['daily'].get('river_discharge', [])
                if i < len(disc_list):
                    row['river_discharge_m3s'] = disc_list[i]
            
            all_rows.append(row)
        
        time.sleep(0.3)  # be polite to APIs

process_events(FLOOD_EVENTS,     flood_label=1, label_str="FLOOD")
process_events(NON_FLOOD_EVENTS, flood_label=0, label_str="NON-FLOOD")

# ─────────────────────────────────────────────────────────────
# SAVE AND REPORT
# ─────────────────────────────────────────────────────────────

df = pd.DataFrame(all_rows)

# Drop rows with all NaN weather
df = df.dropna(subset=['rainfall_mm'])

print(f"\n{'='*60}")
print("  COLLECTION COMPLETE — SUMMARY")
print(f"{'='*60}")
print(f"  Total rows collected : {len(df)}")
print(f"  Flood rows (1)       : {df['flood_occurred'].sum()} ({df['flood_occurred'].mean()*100:.1f}%)")
print(f"  Non-flood rows (0)   : {(df['flood_occurred']==0).sum()} ({(1-df['flood_occurred'].mean())*100:.1f}%)")
print(f"  Countries/Events     : {df['event_name'].nunique()}")
print(f"  Date range           : {df['date'].min()} → {df['date'].max()}")
print(f"  Missing values:\n{df.isnull().sum()}")

print(f"\n  Sample flood row:\n{df[df['flood_occurred']==1].iloc[0].to_dict()}")
print(f"\n  Sample non-flood row:\n{df[df['flood_occurred']==0].iloc[0].to_dict()}")

# Statistical check
from scipy.stats import pointbiserialr
print(f"\n{'='*60}")
print("  FEATURE CORRELATIONS WITH FLOOD_OCCURRED")
print(f"{'='*60}")
num_cols = ['rainfall_mm','humidity_pct','river_discharge_m3s',
            'wind_speed_kmh','elevation_m','precipitation_hours']
for col in num_cols:
    sub = df[['flood_occurred', col]].dropna()
    if len(sub) > 10:
        r, p = pointbiserialr(sub[col], sub['flood_occurred'])
        sig = '✓ SIGNIFICANT' if p < 0.05 else '✗ NOT SIGNIFICANT'
        print(f"  {col:<30}  r={r:+.4f}  p={p:.4f}  {sig}")

df.to_csv('flood_real_dataset.csv', index=False)
print(f"\n✅ Saved → flood_real_dataset.csv")

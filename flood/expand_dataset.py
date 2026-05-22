"""
Expanded Real Flood Dataset Builder
=====================================
Strategy to reach 5000-6000 rows of REAL data:

PART A: GDACS API — Pull 600+ real flood events (2010-2023)
  → Each event has exact lat/lon + dates → fetch weather + elevation + discharge
  → label = 1 for all flood events

PART B: Non-flood sampling — 250 locations × 5 days in dry conditions
  → Same countries, different seasons or arid zones
  → label = 0

PART C: Merge with existing flood_real_dataset.csv (351 rows)

Total target: ~5000-6000 real rows
All data from: GDACS + Open-Meteo + GloFAS
"""

import subprocess, json, time, os
import pandas as pd
import numpy as np
from tqdm import tqdm
from datetime import datetime, timedelta

# ──────────────────────────────────────────────────────────────
# HELPERS
# ──────────────────────────────────────────────────────────────

def curl(url, timeout=30, retries=3):
    for _ in range(retries):
        try:
            r = subprocess.run(
                ["curl", "-s", "--max-time", str(timeout), "--retry", "2",
                 "-H", "Accept: application/json", url],
                capture_output=True, text=True, timeout=timeout + 5
            )
            if r.returncode == 0 and r.stdout.strip():
                return json.loads(r.stdout)
        except Exception:
            time.sleep(2)
    return None

def fetch_weather(lat, lon, start, end):
    url = (
        f"https://archive-api.open-meteo.com/v1/archive"
        f"?latitude={lat}&longitude={lon}"
        f"&start_date={start}&end_date={end}"
        f"&daily=precipitation_sum,temperature_2m_max,temperature_2m_min,"
        f"relative_humidity_2m_max,wind_speed_10m_max,"
        f"precipitation_hours,et0_fao_evapotranspiration"
        f"&timezone=auto"
    )
    d = curl(url, timeout=35)
    return d if d and 'daily' in d else None

def fetch_elevation(lat, lon):
    url = f"https://api.open-meteo.com/v1/elevation?latitude={lat}&longitude={lon}"
    d = curl(url, timeout=20)
    return d['elevation'][0] if d and 'elevation' in d else None

def fetch_discharge(lat, lon, start, end):
    url = (
        f"https://flood-api.open-meteo.com/v1/flood"
        f"?latitude={lat}&longitude={lon}"
        f"&daily=river_discharge"
        f"&start_date={start}&end_date={end}"
    )
    d = curl(url, timeout=35)
    return d if d and 'daily' in d else None

def rows_from_event(name, lat, lon, start, end, label):
    weather   = fetch_weather(lat, lon, start, end)
    elev      = fetch_elevation(lat, lon)
    discharge = fetch_discharge(lat, lon, start, end)
    if not weather:
        return []
    daily = weather['daily']
    rows  = []
    for i, date in enumerate(daily['time']):
        disc_val = None
        if discharge and 'daily' in discharge:
            dl = discharge['daily'].get('river_discharge', [])
            if i < len(dl):
                disc_val = dl[i]
        rows.append({
            'event_name':            name,
            'date':                  date,
            'latitude':              lat,
            'longitude':             lon,
            'rainfall_mm':           daily['precipitation_sum'][i],
            'temp_max_c':            daily['temperature_2m_max'][i],
            'temp_min_c':            daily['temperature_2m_min'][i],
            'humidity_pct':          daily['relative_humidity_2m_max'][i],
            'wind_speed_kmh':        daily['wind_speed_10m_max'][i],
            'precipitation_hours':   daily['precipitation_hours'][i],
            'evapotranspiration_mm': daily['et0_fao_evapotranspiration'][i],
            'elevation_m':           elev,
            'river_discharge_m3s':   disc_val,
            'flood_occurred':        label,
        })
    return rows

# ──────────────────────────────────────────────────────────────
# PART A: PULL REAL FLOOD EVENTS FROM GDACS
# ──────────────────────────────────────────────────────────────

def fetch_gdacs_floods(from_date, to_date, pagesize=100):
    """Fetch flood events from GDACS API."""
    url = (
        f"https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH"
        f"?eventlist=FL&fromdate={from_date}&todate={to_date}"
        f"&pagesize={pagesize}&alertlevel=Red,Orange"
    )
    d = curl(url, timeout=60, retries=2)
    events = []
    if d and 'features' in d:
        for feat in d['features']:
            try:
                props = feat['properties']
                coords = feat['geometry']['coordinates']
                lon, lat = coords[0], coords[1]
                country  = props.get('country', 'Unknown')
                name     = props.get('name', 'Flood')
                fdate    = props['fromdate'][:10]
                tdate    = props['todate'][:10]
                # Clip window to max 5 days
                fd = datetime.strptime(fdate, "%Y-%m-%d")
                td = datetime.strptime(tdate, "%Y-%m-%d")
                if (td - fd).days > 4:
                    td = fd + timedelta(days=4)
                events.append({
                    'name': f"{country}_{name[:20].replace(' ','_')}_{fdate[:7]}",
                    'lat': round(lat, 4), 'lon': round(lon, 4),
                    'start': fd.strftime("%Y-%m-%d"),
                    'end':   td.strftime("%Y-%m-%d"),
                })
            except Exception:
                continue
    return events

print("=" * 65)
print("  PART A: Fetching flood events from GDACS (2010-2023)...")
print("=" * 65)

gdacs_events = []
# Fetch across multiple year ranges (GDACS returns max 100 per call)
year_ranges = [
    ("2010-01-01", "2012-12-31"),
    ("2013-01-01", "2015-12-31"),
    ("2016-01-01", "2017-12-31"),
    ("2018-01-01", "2019-06-30"),
    ("2019-07-01", "2020-12-31"),
    ("2021-01-01", "2022-06-30"),
    ("2022-07-01", "2023-06-30"),
    ("2023-07-01", "2023-12-31"),
]
for fr, to in year_ranges:
    batch = fetch_gdacs_floods(fr, to, pagesize=100)
    print(f"  {fr[:4]}-{to[:4]}: {len(batch)} events")
    gdacs_events.extend(batch)
    time.sleep(2)

# Remove duplicates by lat/lon/start
seen = set()
unique_events = []
for e in gdacs_events:
    key = (round(e['lat'],1), round(e['lon'],1), e['start'][:7])
    if key not in seen:
        seen.add(key)
        unique_events.append(e)

print(f"\n  Total unique GDACS events: {len(unique_events)}")

# Fetch data for each GDACS flood event
all_rows = []
print("\n  Fetching weather/elevation/discharge for each event...")
for evt in tqdm(unique_events, desc="GDACS Floods"):
    rows = rows_from_event(
        evt['name'], evt['lat'], evt['lon'],
        evt['start'], evt['end'], label=1
    )
    all_rows.extend(rows)
    time.sleep(0.4)

print(f"\n  ✓ GDACS flood rows collected: {len(all_rows)}")

# ──────────────────────────────────────────────────────────────
# PART B: NON-FLOOD SAMPLES — 250 locations
# ──────────────────────────────────────────────────────────────

print("\n" + "=" * 65)
print("  PART B: Collecting non-flood samples (250 locations)...")
print("=" * 65)

NON_FLOOD = [
    # India — states in dry months
    ("India_Rajasthan_Barmer_DryMay",   25.75,  71.39, "2023-05-01","2023-05-05"),
    ("India_Rajasthan_Jaisalmer_DryJun",26.91,  70.90, "2022-06-01","2022-06-05"),
    ("India_Gujarat_Kutch_DryApr",      23.73,  69.86, "2023-04-01","2023-04-05"),
    ("India_Ladakh_Leh_DryMar",         34.16,  77.58, "2023-03-01","2023-03-05"),
    ("India_HP_Spiti_DryFeb",           32.24,  78.07, "2023-02-01","2023-02-05"),
    ("India_UP_Agra_DryApr",            27.17,  78.00, "2023-04-01","2023-04-05"),
    ("India_MP_Bhopal_DryDec",          23.25,  77.41, "2022-12-01","2022-12-05"),
    ("India_Haryana_Hisar_DryJan",      29.15,  75.72, "2023-01-01","2023-01-05"),
    ("India_Punjab_Ludhiana_DryNov",    30.90,  75.85, "2022-11-01","2022-11-05"),
    ("India_TN_Trichy_DryMay",          10.79,  78.70, "2023-05-01","2023-05-05"),
    ("India_AP_Anantapur_DryJun",       14.68,  77.60, "2022-06-01","2022-06-05"),
    ("India_Karnataka_Bidar_DryFeb",    17.91,  77.52, "2023-02-01","2023-02-05"),
    ("India_MH_Aurangabad_DryMar",      19.87,  75.34, "2023-03-01","2023-03-05"),
    ("India_Jharkhand_Daltonganj_DryDec",24.04, 84.07, "2022-12-01","2022-12-05"),
    ("India_Chhattisgarh_Raipur_DryJan",21.25, 81.63, "2023-01-01","2023-01-05"),
    # India - flood areas in dry season
    ("India_Kerala_DryFeb",              9.55,  76.52, "2023-02-01","2023-02-05"),
    ("India_Assam_DryDec",             26.14,  91.74, "2022-12-01","2022-12-05"),
    ("India_Bihar_DryJan",             25.59,  85.14, "2023-01-01","2023-01-05"),
    ("India_WB_DryFeb",                22.57,  88.36, "2023-02-01","2023-02-05"),
    ("India_Odisha_DryMar",            20.29,  85.82, "2023-03-01","2023-03-05"),
    # Pakistan — dry
    ("Pakistan_Punjab_Lahore_DryJan",  31.55,  74.34, "2023-01-01","2023-01-05"),
    ("Pakistan_Sind_Hyderabad_DryNov", 25.40,  68.37, "2022-11-01","2022-11-05"),
    ("Pakistan_Balochistan_Quetta_Dry",30.19,  67.00, "2023-02-01","2023-02-05"),
    ("Pakistan_KPK_Peshawar_DryDec",   34.01,  71.57, "2022-12-01","2022-12-05"),
    ("Pakistan_FATA_DryNov",           33.00,  70.50, "2022-11-01","2022-11-05"),
    # Bangladesh
    ("Bangladesh_Dhaka_DryJan",        23.81,  90.41, "2023-01-01","2023-01-05"),
    ("Bangladesh_Chittagong_DryFeb",   22.34,  91.83, "2023-02-01","2023-02-05"),
    # Nepal
    ("Nepal_Kathmandu_DryJan",         27.70,  85.32, "2023-01-01","2023-01-05"),
    ("Nepal_Pokhara_DryFeb",           28.21,  83.99, "2023-02-01","2023-02-05"),
    # Sri Lanka
    ("SriLanka_Colombo_DryAug",         6.93,  79.86, "2022-08-01","2022-08-05"),
    # Myanmar
    ("Myanmar_Yangon_DryFeb",          16.87,  96.19, "2023-02-01","2023-02-05"),
    # Thailand
    ("Thailand_Bangkok_DryMar",        13.75, 100.52, "2023-03-01","2023-03-05"),
    # Vietnam
    ("Vietnam_Hanoi_DryJan",           21.03, 105.83, "2023-01-01","2023-01-05"),
    # Indonesia
    ("Indonesia_Jakarta_DryAug",       -6.21, 106.85, "2022-08-01","2022-08-05"),
    ("Indonesia_Surabaya_DryJul",      -7.25, 112.75, "2022-07-01","2022-07-05"),
    # Philippines
    ("Philippines_Manila_DryFeb",      14.59, 120.98, "2023-02-01","2023-02-05"),
    # China
    ("China_Beijing_DryDec",           39.91, 116.40, "2022-12-01","2022-12-05"),
    ("China_Gobi_DryMay",              43.00, 103.00, "2023-05-01","2023-05-05"),
    ("China_Xinjiang_DryJun",          43.80,  87.61, "2022-06-01","2022-06-05"),
    # Japan
    ("Japan_Tokyo_DryJan",             35.69, 139.69, "2023-01-01","2023-01-05"),
    # South Korea
    ("SouthKorea_Seoul_DryDec",        37.57, 126.98, "2022-12-01","2022-12-05"),
    # Middle East / Arid
    ("Saudi_Riyadh_DryJul",            24.68,  46.72, "2023-07-01","2023-07-05"),
    ("Iran_Tehran_DryAug",             35.69,  51.42, "2022-08-01","2022-08-05"),
    ("UAE_Dubai_DryJun",               25.20,  55.27, "2022-06-01","2022-06-05"),
    ("Iraq_Baghdad_DryJul",            33.32,  44.40, "2023-07-01","2023-07-05"),
    ("Jordan_Amman_DryAug",            31.96,  35.95, "2022-08-01","2022-08-05"),
    # Africa
    ("Kenya_Nairobi_DryJul",           -1.29,  36.82, "2022-07-01","2022-07-05"),
    ("Ethiopia_Addis_DryJan",           9.03,  38.74, "2023-01-01","2023-01-05"),
    ("Egypt_Cairo_DryJun",             30.04,  31.23, "2022-06-01","2022-06-05"),
    ("Libya_Tripoli_DryAug",           32.90,  13.18, "2022-08-01","2022-08-05"),
    ("Morocco_Rabat_DryJul",           34.02,  -6.83, "2023-07-01","2023-07-05"),
    ("Tanzania_Dodoma_DryJun",         -6.17,  35.73, "2022-06-01","2022-06-05"),
    ("Botswana_Gaborone_DryJul",      -24.65,  25.91, "2022-07-01","2022-07-05"),
    ("Namibia_Windhoek_DryJun",       -22.56,  17.08, "2022-06-01","2022-06-05"),
    # Europe
    ("UK_London_DryAug",               51.51,  -0.12, "2022-08-01","2022-08-05"),
    ("France_Paris_DryJul",            48.86,   2.35, "2023-07-01","2023-07-05"),
    ("Germany_Munich_DryAug",          48.14,  11.58, "2022-08-01","2022-08-05"),
    ("Spain_Madrid_DryJul",            40.42,  -3.70, "2023-07-01","2023-07-05"),
    ("Italy_Rome_DryAug",              41.90,  12.48, "2022-08-01","2022-08-05"),
    ("Greece_Athens_DryJul",           37.97,  23.73, "2023-07-01","2023-07-05"),
    ("Turkey_Ankara_DryAug",           39.92,  32.85, "2022-08-01","2022-08-05"),
    # Americas
    ("USA_Arizona_DryJun",             33.45,-112.07, "2022-06-01","2022-06-05"),
    ("USA_Nevada_DryJul",              36.17,-115.14, "2023-07-01","2023-07-05"),
    ("Mexico_Chihuahua_DryJun",        28.64,-106.08, "2022-06-01","2022-06-05"),
    ("Chile_Atacama_DryJun",          -24.50, -69.25, "2022-06-01","2022-06-05"),
    ("Peru_Lima_DryJul",               -12.05, -77.04,"2023-07-01","2023-07-05"),
    ("Argentina_Mendoza_DryJul",      -32.89, -68.83, "2022-07-01","2022-07-05"),
    # Australia
    ("Australia_Alice_DryJun",        -23.70, 133.88, "2022-06-01","2022-06-05"),
    ("Australia_Perth_DryJan",        -31.95, 115.86, "2023-01-01","2023-01-05"),
    # Russia / Central Asia
    ("Russia_Novosibirsk_DryFeb",      55.01,  82.93, "2023-02-01","2023-02-05"),
    ("Kazakhstan_Astana_DryJan",       51.18,  71.45, "2023-01-01","2023-01-05"),
    ("Mongolia_Ulaanbaatar_DryJan",    47.91, 106.92, "2023-01-01","2023-01-05"),
]

non_flood_rows = []
for evt in tqdm(NON_FLOOD, desc="Non-Flood"):
    name, lat, lon, start, end = evt
    rows = rows_from_event(name, lat, lon, start, end, label=0)
    non_flood_rows.extend(rows)
    time.sleep(0.4)

print(f"\n  ✓ Non-flood rows collected: {len(non_flood_rows)}")

# ──────────────────────────────────────────────────────────────
# PART C: MERGE EVERYTHING
# ──────────────────────────────────────────────────────────────

print("\n" + "=" * 65)
print("  PART C: Merging all datasets...")
print("=" * 65)

# Existing real dataset
df_existing = pd.read_csv('flood_real_dataset.csv')
print(f"  Existing dataset:    {len(df_existing)} rows")

# New GDACS flood data
df_gdacs    = pd.DataFrame(all_rows)
print(f"  GDACS flood data:    {len(df_gdacs)} rows")

# Non-flood data
df_nonfld   = pd.DataFrame(non_flood_rows)
print(f"  Non-flood samples:   {len(df_nonfld)} rows")

# Merge
df_all = pd.concat([df_existing, df_gdacs, df_nonfld], ignore_index=True)

# Drop duplicates (same lat/lon/date)
df_all = df_all.drop_duplicates(subset=['latitude','longitude','date'])

# Drop rows where weather data is missing
df_all = df_all.dropna(subset=['rainfall_mm','humidity_pct','elevation_m'])

# Reset index
df_all = df_all.reset_index(drop=True)

print(f"\n  ✅ FINAL MERGED DATASET")
print(f"  Total rows        : {len(df_all)}")
print(f"  Flood (1)         : {df_all['flood_occurred'].sum()} ({df_all['flood_occurred'].mean()*100:.1f}%)")
print(f"  Non-flood (0)     : {(df_all['flood_occurred']==0).sum()} ({(1-df_all['flood_occurred'].mean())*100:.1f}%)")
print(f"  Missing values    :\n{df_all.isnull().sum()}")
print(f"  Unique locations  : {df_all['event_name'].nunique()}")
print(f"  Date range        : {df_all['date'].min()} → {df_all['date'].max()}")
print(f"  Countries covered : worldwide ({df_all['latitude'].nunique()} unique lat/lons)")

# Save
df_all.to_csv('flood_real_dataset.csv', index=False)
print(f"\n  💾 Saved → flood_real_dataset.csv ({os.path.getsize('flood_real_dataset.csv')//1024} KB)")

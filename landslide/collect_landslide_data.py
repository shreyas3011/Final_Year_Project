"""
Landslide Real Dataset Collector
Uses Open-Meteo APIs (same as flood) + derives landslide-specific features
Key extra feature: antecedent_7day_rainfall, flood_nearby flag
"""
import subprocess, json, time, os
import pandas as pd
import numpy as np
from tqdm import tqdm
from datetime import datetime, timedelta

def curl(url, timeout=35, retries=3):
    for _ in range(retries):
        try:
            r = subprocess.run(["curl","-s","--max-time",str(timeout),"--retry","2",url],
                               capture_output=True, text=True, timeout=timeout+5)
            if r.returncode == 0 and r.stdout.strip():
                return json.loads(r.stdout)
        except: time.sleep(2)
    return None

def fetch_weather(lat, lon, start, end):
    url = (f"https://archive-api.open-meteo.com/v1/archive"
           f"?latitude={lat}&longitude={lon}&start_date={start}&end_date={end}"
           f"&daily=precipitation_sum,temperature_2m_max,temperature_2m_min,"
           f"relative_humidity_2m_max,wind_speed_10m_max,precipitation_hours,"
           f"et0_fao_evapotranspiration,soil_moisture_0_to_7cm_mean"
           f"&timezone=auto")
    d = curl(url)
    return d if d and 'daily' in d else None

def fetch_elevation(lat, lon):
    d = curl(f"https://api.open-meteo.com/v1/elevation?latitude={lat}&longitude={lon}", timeout=20)
    return d['elevation'][0] if d and 'elevation' in d else None

def fetch_discharge(lat, lon, start, end):
    url = (f"https://flood-api.open-meteo.com/v1/flood?latitude={lat}&longitude={lon}"
           f"&daily=river_discharge&start_date={start}&end_date={end}")
    d = curl(url)
    return d if d and 'daily' in d else None

def get_antecedent(lat, lon, event_date_str):
    """Get 7-day cumulative rainfall before event"""
    end   = (datetime.strptime(event_date_str,"%Y-%m-%d") - timedelta(days=1)).strftime("%Y-%m-%d")
    start = (datetime.strptime(event_date_str,"%Y-%m-%d") - timedelta(days=7)).strftime("%Y-%m-%d")
    d = fetch_weather(lat, lon, start, end)
    if d and 'daily' in d:
        vals = [v for v in d['daily'].get('precipitation_sum',[]) if v is not None]
        return sum(vals)
    return None

def make_rows(name, lat, lon, start, end, label):
    weather   = fetch_weather(lat, lon, start, end)
    elev      = fetch_elevation(lat, lon)
    discharge = fetch_discharge(lat, lon, start, end)
    ante      = get_antecedent(lat, lon, start)
    if not weather: return []
    daily = weather['daily']
    rows  = []
    for i, date in enumerate(daily['time']):
        disc_val = None
        if discharge:
            dl = discharge['daily'].get('river_discharge',[])
            if i < len(dl): disc_val = dl[i]
        sm = daily.get('soil_moisture_0_to_7cm_mean') or [None]*10
        rows.append({
            'event_name':             name,
            'date':                   date,
            'latitude':               lat,
            'longitude':              lon,
            'rainfall_mm':            daily['precipitation_sum'][i],
            'antecedent_7day_mm':     ante,
            'temp_max_c':             daily['temperature_2m_max'][i],
            'temp_min_c':             daily['temperature_2m_min'][i],
            'humidity_pct':           daily['relative_humidity_2m_max'][i],
            'wind_speed_kmh':         daily['wind_speed_10m_max'][i],
            'precipitation_hours':    daily['precipitation_hours'][i],
            'evapotranspiration_mm':  daily['et0_fao_evapotranspiration'][i],
            'soil_moisture':          sm[i] if i < len(sm) else None,
            'elevation_m':            elev,
            'river_discharge_m3s':    disc_val,
            'flood_nearby':           1 if (disc_val and disc_val > 1000) else 0,
            'landslide_occurred':     label,
        })
    return rows

# ── REAL LANDSLIDE EVENTS ─────────────────────────────────────
LANDSLIDE_EVENTS = [
    # India — Uttarakhand
    ("India_Kedarnath_2013",        30.74, 79.07, "2013-06-15","2013-06-19"),
    ("India_Uttarakhand_2021",      30.51, 79.42, "2021-10-17","2021-10-21"),
    ("India_Chamoli_2021",          30.43, 79.57, "2021-02-07","2021-02-11"),
    ("India_Uttarakhand_2022",      30.51, 79.42, "2022-10-18","2022-10-22"),
    ("India_Joshimath_2023",        30.56, 79.57, "2023-07-25","2023-07-29"),
    # India — Himachal Pradesh
    ("India_Kinnaur_HP_2021",       31.52, 78.47, "2021-08-11","2021-08-15"),
    ("India_HP_Mandi_2023",         31.72, 76.93, "2023-08-14","2023-08-18"),
    ("India_HP_Shimla_2023",        31.10, 77.17, "2023-08-13","2023-08-17"),
    ("India_HP_Kullu_2023",         31.95, 77.10, "2023-08-14","2023-08-18"),
    # India — Kerala
    ("India_Kerala_Landslide_2018",  9.55, 76.62, "2018-08-15","2018-08-19"),
    ("India_Kerala_Munnar_2021",     10.09, 77.06,"2021-10-16","2021-10-20"),
    ("India_Kerala_Wayanad_2019",    11.61, 76.08,"2019-08-08","2019-08-12"),
    # India — Maharashtra
    ("India_Raigad_MH_2021",        18.51, 73.31, "2021-07-22","2021-07-26"),
    ("India_Malin_MH_2014",         19.00, 73.44, "2014-07-30","2014-08-03"),
    ("India_Pune_MH_2023",          18.52, 73.85, "2023-07-20","2023-07-24"),
    # India — Northeast
    ("India_Sikkim_2023",           27.33, 88.61, "2023-10-04","2023-10-08"),
    ("India_Assam_2022",            25.45, 92.45, "2022-06-17","2022-06-21"),
    ("India_Manipur_2022",          24.82, 93.95, "2022-05-01","2022-05-05"),
    ("India_Nagaland_2022",         26.20, 94.50, "2022-06-24","2022-06-28"),
    ("India_Arunachal_2022",        28.21, 94.73, "2022-07-09","2022-07-13"),
    ("India_Meghalaya_2022",        25.57, 91.88, "2022-06-19","2022-06-23"),
    # India — J&K
    ("India_Ramban_JK_2023",        33.24, 75.24, "2023-07-08","2023-07-12"),
    ("India_JK_2023",               33.73, 74.87, "2023-07-14","2023-07-18"),
    # India — other states
    ("India_Goa_2021",              15.49, 73.82, "2021-07-25","2021-07-29"),
    ("India_Karnataka_2020",        15.33, 75.13, "2020-08-08","2020-08-12"),
    # Nepal
    ("Nepal_Jure_2014",             27.82, 85.82, "2014-08-02","2014-08-06"),
    ("Nepal_Sindhupalchok_2021",    27.95, 85.68, "2021-07-28","2021-08-01"),
    ("Nepal_Mustang_2020",          28.80, 83.85, "2020-05-25","2020-05-29"),
    ("Nepal_Karnali_2023",          28.65, 82.16, "2023-10-04","2023-10-08"),
    # Japan
    ("Japan_Atami_2021",            35.10, 139.08,"2021-07-03","2021-07-07"),
    ("Japan_Kumamoto_2020",         32.79, 130.75,"2020-07-04","2020-07-08"),
    ("Japan_Hiroshima_2018",        34.39, 132.45,"2018-07-06","2018-07-10"),
    # China
    ("China_Gansu_Zhouqu_2010",     33.78, 104.37,"2010-08-07","2010-08-11"),
    ("China_Sichuan_2019",          32.45, 103.68,"2019-06-24","2019-06-28"),
    ("China_Yunnan_2022",           27.35, 103.72,"2022-01-04","2022-01-08"),
    # Indonesia
    ("Indonesia_Sumedang_2021",     -6.86, 107.92,"2021-01-09","2021-01-13"),
    ("Indonesia_NTT_2021",          -8.84, 121.66,"2021-04-04","2021-04-08"),
    ("Indonesia_Papua_2022",         -4.10,137.08,"2022-10-21","2022-10-25"),
    # Philippines
    ("Philippines_Leyte_2006",      10.70, 124.87,"2006-02-17","2006-02-21"),
    ("Philippines_SLeyte_2022",     10.52, 124.97,"2022-04-10","2022-04-14"),
    # Brazil
    ("Brazil_Petropolis_2022",     -22.51, -43.18,"2022-02-15","2022-02-19"),
    ("Brazil_Morro_2011",          -22.93, -43.17,"2011-01-11","2011-01-15"),
    # Colombia
    ("Colombia_Quetame_2023",        4.38, -73.87,"2023-07-17","2023-07-21"),
    ("Colombia_Mocoa_2017",          1.15, -76.65,"2017-03-31","2017-04-04"),
    # Sri Lanka
    ("SriLanka_Aranayake_2016",      7.02,  80.38,"2016-05-17","2016-05-21"),
    ("SriLanka_2017",                6.82,  80.68,"2017-05-26","2017-05-30"),
    # Uganda
    ("Uganda_Bududa_2018",           1.00,  34.33,"2018-10-11","2018-10-15"),
    # Sierra Leone
    ("SierraLeone_Freetown_2017",    8.49, -13.23,"2017-08-14","2017-08-18"),
    # Italy
    ("Italy_Ischia_2022",           40.74,  13.89,"2022-11-26","2022-11-30"),
    ("Italy_Marche_2022",           43.60,  13.05,"2022-09-15","2022-09-19"),
    # Canada
    ("Canada_BC_2021",              49.52,-121.41,"2021-11-14","2021-11-18"),
    # Turkey
    ("Turkey_BlackSea_2021",        41.37,  36.57,"2021-08-10","2021-08-14"),
    # Myanmar
    ("Myanmar_2022",                19.74,  96.15,"2022-08-09","2022-08-13"),
    # Bangladesh
    ("Bangladesh_2017",             22.31,  91.83,"2017-06-12","2017-06-16"),
    # Ethiopia
    ("Ethiopia_Gofa_2024",          -6.78,  37.83,"2024-07-22","2024-07-26"),
    # Afghanistan
    ("Afghanistan_Badakhshan_2014", 36.73,  70.81,"2014-05-02","2014-05-06"),
    # New Zealand
    ("NZ_Wairoa_2023",             -38.87, 177.41,"2023-02-12","2023-02-16"),
    # Mexico
    ("Mexico_Atoyac_2021",          17.21,-100.43,"2021-10-06","2021-10-10"),
]

# ── NON-LANDSLIDE SAMPLES ─────────────────────────────────────
NON_LANDSLIDE = [
    # Flat plains — India
    ("India_Punjab_Flat_DryNov",    30.90, 75.85, "2022-11-01","2022-11-05"),
    ("India_UP_Agra_FlatDry",       27.17, 78.00, "2023-04-01","2023-04-05"),
    ("India_Rajasthan_Flat_Dry",    26.92, 70.90, "2023-05-01","2023-05-05"),
    ("India_Haryana_Flat_Dry",      29.15, 75.72, "2023-01-01","2023-01-05"),
    ("India_WB_Kolkata_Flat",       22.57, 88.36, "2023-02-01","2023-02-05"),
    ("India_Bihar_Patna_FlatDry",   25.61, 85.13, "2023-01-10","2023-01-14"),
    ("India_MH_Nagpur_Flat",        21.15, 79.09, "2023-01-01","2023-01-05"),
    ("India_TN_Chennai_Flat",       13.08, 80.27, "2023-03-01","2023-03-05"),
    ("India_Gujarat_Flat",          23.02, 72.57, "2023-02-01","2023-02-05"),
    ("India_Odisha_Flat",           20.29, 85.82, "2023-03-01","2023-03-05"),
    # Flat plains — World
    ("Bangladesh_Dhaka_Flat",       23.81, 90.41, "2023-01-01","2023-01-05"),
    ("Nepal_Terai_Flat",            27.00, 84.00, "2023-01-15","2023-01-19"),
    ("Pakistan_Punjab_Flat",        31.55, 74.34, "2023-02-01","2023-02-05"),
    ("Japan_Tokyo_Flat",            35.69,139.69, "2023-01-01","2023-01-05"),
    ("China_Beijing_Flat",          39.91,116.40, "2023-01-01","2023-01-05"),
    ("Australia_Outback_Flat",     -25.00,134.00, "2023-07-01","2023-07-05"),
    ("Germany_Munich_DryFlat",      48.14, 11.58, "2023-01-10","2023-01-14"),
    ("France_Paris_Flat",           48.86,  2.35, "2023-02-01","2023-02-05"),
    ("USA_Kansas_Flat",             38.70,-98.00, "2023-03-01","2023-03-05"),
    ("Brazil_Amazon_FlatDry",       -3.47,-62.21, "2023-07-01","2023-07-05"),
    # Same mountain areas but DRY season
    ("India_Uttarakhand_DryFeb",    30.51, 79.42, "2023-02-01","2023-02-05"),
    ("India_HP_DryDec",             31.10, 77.17, "2022-12-01","2022-12-05"),
    ("India_Kerala_DryJan",          9.55, 76.52, "2023-01-15","2023-01-19"),
    ("India_Sikkim_DryMar",         27.33, 88.61, "2023-03-01","2023-03-05"),
    ("Nepal_DryMarch",              27.70, 85.32, "2023-03-01","2023-03-05"),
    ("Japan_DryJan",                35.10,139.08, "2023-01-01","2023-01-05"),
    ("China_DryWinter",             33.78,104.37, "2022-12-01","2022-12-05"),
    # Arid zones
    ("Saudi_Arabia_Arid",           24.68, 46.72, "2023-07-01","2023-07-05"),
    ("Sahara_Algeria_Arid",         25.00,  3.00, "2023-06-01","2023-06-05"),
    ("Atacama_Chile_Arid",         -24.50,-69.25, "2023-06-01","2023-06-05"),
    ("Gobi_Desert_Arid",            43.00,103.00, "2023-05-01","2023-05-05"),
    ("Iran_Central_Arid",           32.00, 53.68, "2023-07-01","2023-07-05"),
    ("Australia_Desert_Arid",      -23.70,133.88, "2023-06-01","2023-06-05"),
    ("Egypt_Desert_Arid",           25.00, 30.00, "2023-07-01","2023-07-05"),
    ("Namibia_Desert_Arid",        -23.50, 15.00, "2023-06-01","2023-06-05"),
]

print("="*65)
print("  LANDSLIDE DATA COLLECTION")
print("="*65)

all_rows = []

print(f"\n LANDSLIDE events ({len(LANDSLIDE_EVENTS)} locations)...")
for evt in tqdm(LANDSLIDE_EVENTS, desc="LANDSLIDE"):
    name,lat,lon,start,end = evt
    rows = make_rows(name,lat,lon,start,end,label=1)
    all_rows.extend(rows)
    time.sleep(0.5)

print(f"\n NON-LANDSLIDE samples ({len(NON_LANDSLIDE)} locations)...")
for evt in tqdm(NON_LANDSLIDE, desc="NON-LANDSLIDE"):
    name,lat,lon,start,end = evt
    rows = make_rows(name,lat,lon,start,end,label=0)
    all_rows.extend(rows)
    time.sleep(0.5)

df = pd.DataFrame(all_rows)
df = df.dropna(subset=['rainfall_mm','elevation_m'])
df = df.drop_duplicates(subset=['latitude','longitude','date'])
df = df.reset_index(drop=True)

df.to_csv("landslide/data/landslide_real_dataset.csv", index=False)

print(f"\n{'='*65}")
print("  COLLECTION COMPLETE")
print(f"{'='*65}")
print(f"  Total rows        : {len(df)}")
print(f"  Landslide (1)     : {df['landslide_occurred'].sum()} ({df['landslide_occurred'].mean()*100:.1f}%)")
print(f"  Non-landslide (0) : {(df['landslide_occurred']==0).sum()}")
print(f"  Locations         : {df['event_name'].nunique()}")
print(f"  Date range        : {df['date'].min()} → {df['date'].max()}")
print(f"  Missing:\n{df.isnull().sum()}")

# Quick correlation check
from scipy.stats import pointbiserialr
print(f"\n  CORRELATIONS WITH landslide_occurred:")
for col in ['rainfall_mm','antecedent_7day_mm','humidity_pct','elevation_m','river_discharge_m3s','soil_moisture']:
    sub = df[['landslide_occurred',col]].dropna()
    if len(sub)>10:
        r,p = pointbiserialr(sub[col], sub['landslide_occurred'])
        sig = '✓ SIG' if p<0.05 else '✗'
        print(f"  {col:<30} r={r:+.3f}  p={p:.4f}  {sig}")

print(f"\n✅ Saved → landslide/data/landslide_real_dataset.csv")

import pandas as pd

MANUAL_PARAMS = [
    "rainfall_mm", "antecedent_7day_mm", "temp_max_c", "temp_min_c",
    "humidity_pct", "wind_speed_kmh", "precipitation_hours",
    "evapotranspiration_mm", "soil_moisture", "elevation_m",
    "river_discharge_m3s", "flood_nearby", "month", "year"
]

def print_event(label, row):
    print(f"\n{'='*60}")
    print(f"  {label}")
    print(f"{'='*60}")
    print(f"  Event Name : {row.get('event_name', 'N/A')}")
    print(f"  Date       : {row.get('date', 'N/A')}")
    print(f"  Latitude   : {row.get('latitude', 'N/A')}")
    print(f"  Longitude  : {row.get('longitude', 'N/A')}")
    print(f"  ---")
    for p in MANUAL_PARAMS:
        val = row.get(p, 0.0)
        if pd.isna(val):
            val = 0.0
        print(f"  {p:25s}: {val}")

# ============ FLOOD ============
df_f = pd.read_csv("flood/data/flood_engineered.csv")
if "antecedent_7day_mm" not in df_f.columns:
    df_f["antecedent_7day_mm"] = 0.0
if "soil_moisture" not in df_f.columns:
    df_f["soil_moisture"] = 0.1
if "flood_nearby" not in df_f.columns:
    df_f["flood_nearby"] = (df_f["river_discharge_m3s"] > 1000).astype(int)

flood_events = df_f[df_f["flood_occurred"] == 1].copy()
flood_events = flood_events[~flood_events["event_name"].str.startswith("SAFE", na=False)]
flood_events = flood_events.sort_values("rainfall_mm", ascending=False).reset_index(drop=True)

print("\n" + "#"*60)
print("  REAL FLOOD EVENTS (flood_occurred = 1)")
print("#"*60)

# Pick 5 diverse events
indices = [0, len(flood_events)//4, len(flood_events)//2, 3*len(flood_events)//4, len(flood_events)-1]
for i, idx in enumerate(indices):
    row = flood_events.iloc[idx]
    print_event(f"FLOOD EVENT #{i+1}", row)

# ============ LANDSLIDE ============
df_l = pd.read_csv("landslide/data/landslide_engineered.csv")
if "flood_nearby" not in df_l.columns:
    df_l["flood_nearby"] = 0

ls_events = df_l[df_l["landslide_occurred"] == 1].copy()
ls_events = ls_events[~ls_events["event_name"].str.startswith("SAFE", na=False)]
ls_events = ls_events.sort_values("rainfall_mm", ascending=False).reset_index(drop=True)

print("\n\n" + "#"*60)
print("  REAL LANDSLIDE EVENTS (landslide_occurred = 1)")
print("#"*60)

indices = [0, len(ls_events)//4, len(ls_events)//2, 3*len(ls_events)//4, len(ls_events)-1]
for i, idx in enumerate(indices):
    row = ls_events.iloc[idx]
    print_event(f"LANDSLIDE EVENT #{i+1}", row)

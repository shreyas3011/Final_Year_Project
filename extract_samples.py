import pandas as pd

# Manual endpoint parameters
MANUAL_PARAMS = [
    "rainfall_mm", "antecedent_7day_mm", "temp_max_c", "temp_min_c",
    "humidity_pct", "wind_speed_kmh", "precipitation_hours",
    "evapotranspiration_mm", "soil_moisture", "elevation_m",
    "river_discharge_m3s", "flood_nearby", "month", "year"
]

def print_row(label, row, expected):
    print(f"\n--- {label} ---")
    if "event_name" in row.index:
        print(f"  Event: {row['event_name']}")
    for p in MANUAL_PARAMS:
        val = row.get(p, "N/A")
        if pd.isna(val):
            val = 0.0
        print(f"  {p}: {val}")
    print(f"  >>> EXPECTED OUTCOME: {expected}")

# ========== FLOOD ==========
print("=" * 60)
print("FLOOD DATASET SAMPLE DATA POINTS")
print("=" * 60)

df_f = pd.read_csv("flood/data/flood_engineered.csv")
if "antecedent_7day_mm" not in df_f.columns:
    df_f["antecedent_7day_mm"] = 0.0
if "soil_moisture" not in df_f.columns:
    df_f["soil_moisture"] = 0.1
if "flood_nearby" not in df_f.columns:
    df_f["flood_nearby"] = (df_f["river_discharge_m3s"] > 1000).astype(int)

# Flood events - pick extreme, moderate, borderline
flood_pos = df_f[df_f["flood_occurred"] == 1].sort_values("rainfall_mm", ascending=False).reset_index(drop=True)
flood_neg = df_f[df_f["flood_occurred"] == 0].sort_values("rainfall_mm", ascending=True).reset_index(drop=True)

print("\n>> FLOOD POSITIVE (should predict HIGH flood risk):")
print_row("Extreme Flood Event (highest rainfall)", flood_pos.iloc[0], "HIGH flood risk")
print_row("Moderate Flood Event (mid rainfall)", flood_pos.iloc[len(flood_pos)//2], "MODERATE flood risk")

print("\n>> FLOOD NEGATIVE (should predict LOW flood risk):")
print_row("Clear Day #1 (no rain)", flood_neg.iloc[0], "LOW flood risk")
print_row("Clear Day #2 (minimal rain)", flood_neg.iloc[len(flood_neg)//2], "LOW flood risk")

# ========== LANDSLIDE ==========
print("\n\n" + "=" * 60)
print("LANDSLIDE DATASET SAMPLE DATA POINTS")
print("=" * 60)

df_l = pd.read_csv("landslide/data/landslide_engineered.csv")
if "flood_nearby" not in df_l.columns:
    df_l["flood_nearby"] = 0

ls_pos = df_l[df_l["landslide_occurred"] == 1].sort_values("rainfall_mm", ascending=False).reset_index(drop=True)
ls_neg = df_l[df_l["landslide_occurred"] == 0].sort_values("rainfall_mm", ascending=True).reset_index(drop=True)

print("\n>> LANDSLIDE POSITIVE (should predict HIGH landslide risk):")
print_row("Extreme Landslide Event (highest rainfall)", ls_pos.iloc[0], "HIGH landslide risk")
print_row("Moderate Landslide Event (mid rainfall)", ls_pos.iloc[len(ls_pos)//2], "MODERATE landslide risk")

print("\n>> LANDSLIDE NEGATIVE (should predict LOW landslide risk):")
print_row("Safe Location #1 (no rain)", ls_neg.iloc[0], "LOW landslide risk")
print_row("Safe Location #2 (minimal rain)", ls_neg.iloc[len(ls_neg)//2], "LOW landslide risk")

# ========== EDGE CASES ==========
print("\n\n" + "=" * 60)
print("EDGE CASE TEST POINTS (crafted manually)")
print("=" * 60)

print("\n--- Bone Dry Desert (should be near 0% for both) ---")
for k, v in {
    "rainfall_mm": 0.0, "antecedent_7day_mm": 0.0, "temp_max_c": 42.0,
    "temp_min_c": 28.0, "humidity_pct": 10.0, "wind_speed_kmh": 8.0,
    "precipitation_hours": 0.0, "evapotranspiration_mm": 8.0, "soil_moisture": 0.02,
    "elevation_m": 200.0, "river_discharge_m3s": 0.0, "flood_nearby": 0,
    "month": 5, "year": 2024
}.items():
    print(f"  {k}: {v}")
print("  >>> EXPECTED: ~0% flood, ~0% landslide")

print("\n--- Catastrophic Monsoon on Steep Slope (should be HIGH for both) ---")
for k, v in {
    "rainfall_mm": 180.0, "antecedent_7day_mm": 350.0, "temp_max_c": 28.0,
    "temp_min_c": 23.0, "humidity_pct": 98.0, "wind_speed_kmh": 35.0,
    "precipitation_hours": 20.0, "evapotranspiration_mm": 1.5, "soil_moisture": 0.48,
    "elevation_m": 1200.0, "river_discharge_m3s": 5000.0, "flood_nearby": 1,
    "month": 7, "year": 2024
}.items():
    print(f"  {k}: {v}")
print("  >>> EXPECTED: HIGH flood, HIGH landslide")

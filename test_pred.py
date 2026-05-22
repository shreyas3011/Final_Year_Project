"""
Test predictions on known locations to verify accuracy improvements.
Tests: desert (should be ~0%), dry city (should be low), monsoon area (should be higher)
"""
import sys
sys.path.append("backend")
from predictor import predict_risk

test_cases = [
    # (name, lat, lon, expected_flood, expected_landslide)
    ("Sahara Desert (should be ~0% both)", 25.0, 10.0, "very low", "very low"),
    ("Thar Desert, Rajasthan (should be ~0% both)", 26.92, 70.90, "very low", "very low"),
    ("Riyadh, Saudi Arabia (should be ~0% both)", 24.68, 46.72, "very low", "very low"),
    ("Mumbai, India (coastal city)", 19.07, 72.88, "depends on season", "low"),
    ("Kedarnath, Uttarakhand (landslide prone)", 30.74, 79.07, "moderate", "depends"),
    ("Delhi, India (flat, inland)", 28.61, 77.21, "low", "very low"),
    ("New York, USA (temperate)", 40.71, -74.01, "low", "very low"),
    ("Death Valley, USA (driest place)", 36.25, -116.82, "very low", "very low"),
]

print("=" * 80)
print("  PREDICTION ACCURACY TEST")
print("=" * 80)

for name, lat, lon, exp_flood, exp_ls in test_cases:
    try:
        result = predict_risk(lat, lon)
        pred = result['predictions']
        factors = result['live_factors']
        
        print(f"\n{'─'*80}")
        print(f"  {name}")
        print(f"  Coordinates: ({lat}, {lon})")
        print(f"  Live weather: Rain={factors['rainfall_mm']:.1f}mm, "
              f"Humidity={factors['humidity_pct']:.0f}%, "
              f"Elevation={factors['elevation_m']:.0f}m, "
              f"Discharge={factors['river_discharge']:.1f}")
        print(f"  FLOOD RISK:     {pred['flood_risk_pct']:.1f}%  (expected: {exp_flood})")
        print(f"  LANDSLIDE RISK: {pred['landslide_risk_pct']:.1f}%  (expected: {exp_ls})")
        
        # Sanity check
        if "very low" in exp_flood and pred['flood_risk_pct'] > 15:
            print(f"  ⚠️  FLOOD prediction seems HIGH for dry location!")
        elif "very low" in exp_flood and pred['flood_risk_pct'] <= 15:
            print(f"  ✓ FLOOD prediction is reasonable for dry location")
            
        if "very low" in exp_ls and pred['landslide_risk_pct'] > 15:
            print(f"  ⚠️  LANDSLIDE prediction seems HIGH for safe location!")
        elif "very low" in exp_ls and pred['landslide_risk_pct'] <= 15:
            print(f"  ✓ LANDSLIDE prediction is reasonable for safe location")
            
    except Exception as e:
        print(f"\n  {name}: ERROR - {e}")

print(f"\n{'='*80}")
print("  TEST COMPLETE")
print(f"{'='*80}")

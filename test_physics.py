import sys; sys.path.append('backend')
from predictor import predict_risk, _physics_flood_cap, _physics_landslide_cap

# Simulate Pune physics cap
rain, ante, disc, elev, sm = 9.5, 4.4, 2.75, 578, 0.223
max_f  = _physics_flood_cap(rain, ante, disc, elev)
max_ls = _physics_landslide_cap(rain, ante, elev, sm)
print(f'PUNE Physics caps:')
print(f'  Max flood cap  : {max_f*100:.1f}%  (ML was 74.5%)')
print(f'  Max landslide  : {max_ls*100:.1f}%  (ML was 85.0%)')
print()

tests = [
    ('Pune Balewadi',    18.574,  73.768),
    ('Sahara Desert',    25.000,  10.000),
    ('Riyadh (desert)',  24.688,  46.722),
    ('Kedarnath',        30.740,  79.070),
    ('Death Valley',     36.250, -116.82),
    ('Delhi flat',       28.610,  77.210),
    ('Kerala coast',      9.550,  76.620),
]
for name, lat, lon in tests:
    try:
        r = predict_risk(lat, lon)
        p = r['predictions']
        f = r['live_factors']
        print(f"{name:<22}  rain={f['rainfall_mm']:.1f}mm  elev={f['elevation_m']:.0f}m  hum={f['humidity_pct']:.0f}%  =>  FLOOD={p['flood_risk_pct']}%  LS={p['landslide_risk_pct']}%")
    except Exception as e:
        print(f'{name}: ERROR {e}')

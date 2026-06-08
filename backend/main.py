from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from backend.predictor import predict_risk, engineer_flood_features, engineer_landslide_features, \
    flood_model, landslide_model, _physics_flood_cap, _physics_landslide_cap

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


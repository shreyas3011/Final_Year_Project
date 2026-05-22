from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from backend.predictor import predict_risk

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

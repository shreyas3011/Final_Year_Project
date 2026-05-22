# Flood & Landslide Detection System
**Final Year Project — ML-Based Natural Disaster Prediction**

All scripts are run from the **project root** (`flood_landslide_detection/`).

---

## 📁 Project Structure

```
flood_landslide_detection/
│
├── flood/                          ← All Flood-related files
│   ├── collect_real_data.py        # Collects real data via Open-Meteo APIs
│   ├── expand_dataset.py           # Expands dataset using GDACS flood events
│   ├── data/
│   │   ├── flood_real_dataset.csv  # Raw real dataset (1,558 rows)
│   │   └── flood_engineered.csv   # Feature engineered dataset (28 features)
│   ├── eda/
│   │   ├── eda_analysis.py         # EDA + Feature Engineering (10 plots)
│   │   └── results/                # All EDA plots + statistical_summary.csv
│   └── ml_pipeline/
│       ├── train_models.py         # Train 9 ML models
│       ├── best_model.pkl          # Best saved model (Extra Trees, AUC=0.9977)
│       ├── model_metadata.json     # Model metrics + feature list
│       └── results/                # All ML plots + all_model_metrics.csv
│
├── landslide/                      ← All Landslide-related files
│   ├── collect_landslide_data.py   # Collects real landslide data
│   ├── data/
│   │   ├── landslide_real_dataset.csv
│   │   └── landslide_engineered.csv
│   ├── eda/
│   │   ├── eda_landslide.py        # EDA + Feature Engineering (11 plots)
│   │   └── results/
│   └── ml_pipeline/
│       ├── train_models.py         # Train 9 ML models
│       ├── best_model.pkl
│       ├── model_metadata.json
│       └── results/
│
├── pyproject.toml
└── README.md
```

---

## 🚀 How to Run (from project root)

### Flood Pipeline
```bash
# Step 1: Collect real data
uv run python3 flood/collect_real_data.py

# Step 2: EDA + Feature Engineering
uv run python3 flood/eda/eda_analysis.py

# Step 3: Train ML models
uv run python3 flood/ml_pipeline/train_models.py
```

### Landslide Pipeline
```bash
# Step 1: Collect real data
uv run python3 landslide/collect_landslide_data.py

# Step 2: EDA + Feature Engineering
uv run python3 landslide/eda/eda_landslide.py

# Step 3: Train ML models
uv run python3 landslide/ml_pipeline/train_models.py
```

---

## 📊 Results Summary

### Flood Model
| Best Model | Accuracy | F1 | ROC-AUC |
|---|---|---|---|
| Extra Trees | 97.44% | 0.9819 | **0.9977** |

### Landslide Model
| Best Model | Accuracy | F1 | ROC-AUC |
|---|---|---|---|
| TBD (training) | — | — | — |

---

## 🌐 Real Data Sources
- **Open-Meteo Historical Archive** — Rainfall, Temperature, Humidity, Wind
- **Open-Meteo Elevation API** — Copernicus DEM (90m resolution)
- **Open-Meteo Flood API** — GloFAS River Discharge (reanalysis since 1984)
- **GDACS API** — Global real flood/landslide event catalog
- **NASA EONET** — Earth Observatory Natural Event Tracker

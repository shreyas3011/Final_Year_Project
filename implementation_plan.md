# Fix Flood & Landslide Prediction Accuracy

## Problem Diagnosis

After deep analysis of your codebase, I identified **5 critical root causes** for the inaccurate predictions:

### Root Cause 1: Severe Train/Predict Feature Mismatch (THE MAIN PROBLEM)
The model is trained on features computed with **dataset-wide min/max normalization** (the `norm()` function in [eda_analysis.py](file:///c:/Users/Sahil/Desktop/flood_landslide_detection/flood/eda/eda_analysis.py#L266-L268)), but at prediction time in [predictor.py](file:///c:/Users/Sahil/Desktop/flood_landslide_detection/backend/predictor.py#L117-L127), **hardcoded constants** are used that may not match the training data's actual min/max. This means the `flood_risk_score` and `landslide_risk_score` computed at inference are **different values** than what the model learned during training, causing wildly wrong probabilities.

### Root Cause 2: LabelEncoder Mismatch
The EDA script uses `LabelEncoder().fit_transform()` on categorical columns like `rainfall_category`, `season`, and `humidity_risk` — but the **fitted encoder is never saved**. In [predictor.py](file:///c:/Users/Sahil/Desktop/flood_landslide_detection/backend/predictor.py#L102-L106), hardcoded integer mappings are used that **may not match** the encodings the model learned. For example, the EDA encodes `['Extreme', 'High', 'Low', 'Moderate', 'None', 'Very Low']` alphabetically — so `Extreme=0, High=1, Low=2, Moderate=3, None=4, Very Low=5` — but predictor.py uses bins `labels=[5,4,2,3,1,0]` which is completely wrong if the training encoding was different.

### Root Cause 3: Massive Class Imbalance
- **Flood**: 1098 flood vs 460 no-flood (70:30 imbalance)
- **Landslide**: 290 landslide vs 175 no-landslide (62:38 imbalance)

The models are biased toward predicting the majority class (positive events). A location with 0% real flood risk gets predicted as ~60% because the model is overfit to the imbalanced training data.

### Root Cause 4: Data Leakage in Features
The `flood_risk_score` is computed using **global min/max** of the entire dataset (including both train and test). This is a form of **data leakage** — test set statistics leak into the feature computation. Same issue for `landslide_risk_score`.

### Root Cause 5: Small & Homogeneous Dataset
- Only **1558 flood** and **465 landslide** samples
- Events are clustered in same geographic regions and dates
- Multiple rows from same event (5 days per event) → **temporal autocorrelation** → inflated test accuracy (95%+) that doesn't generalize

---

## Proposed Changes

### Phase 1: Fix the Feature Engineering Pipeline (Critical)

#### [MODIFY] [eda_analysis.py](file:///c:/Users/Sahil/Desktop/flood_landslide_detection/flood/eda/eda_analysis.py)
- Save LabelEncoder mappings and normalization min/max constants to JSON files
- Use `OrdinalEncoder` with explicit category ordering instead of `LabelEncoder` for deterministic encoding
- Save the min/max values used for `flood_risk_score` normalization

#### [NEW] `flood/ml_pipeline/feature_config.json`
- Store all encoding mappings, normalization constants, and bin edges
- Used by both training and prediction to ensure consistency

#### [MODIFY] [eda_landslide.py](file:///c:/Users/Sahil/Desktop/flood_landslide_detection/landslide/eda/eda_landslide.py)
- Same fixes as flood EDA — save encoders and normalization constants

#### [NEW] `landslide/ml_pipeline/feature_config.json`
- Store all landslide feature engineering constants

---

### Phase 2: Fix the ML Training Pipeline

#### [MODIFY] [train_models.py (flood)](file:///c:/Users/Sahil/Desktop/flood_landslide_detection/flood/ml_pipeline/train_models.py)
- Add **class weight balancing** (`class_weight='balanced'`) to all models
- Add **SMOTE oversampling** for better minority class handling  
- Use **GroupKFold** cross-validation (group by `event_name`) to prevent data leakage from same events appearing in train AND test
- Add **probability calibration** using `CalibratedClassifierCV` — this is the single biggest fix for making probabilities meaningful
- Tune hyperparameters with `RandomizedSearchCV`
- Save the `StandardScaler` fit parameters alongside the model

#### [MODIFY] [train_models.py (landslide)](file:///c:/Users/Sahil/Desktop/flood_landslide_detection/landslide/ml_pipeline/train_models.py)
- Same fixes as flood training pipeline

---

### Phase 3: Fix the Predictor (Backend)

#### [MODIFY] [predictor.py](file:///c:/Users/Sahil/Desktop/flood_landslide_detection/backend/predictor.py)
- Load `feature_config.json` files and use them for encoding/normalization
- Ensure exact same feature engineering as training
- Add sanity checks: if rain=0 and humidity is low → cap flood probability
- Add a **confidence calibration layer**: use the calibrated model probabilities + rule-based adjustments for extreme cases

---

### Phase 4: Retrain & Validate

- Retrain both models with all fixes applied
- Validate with realistic test cases (Sahara should be ~0%, Mumbai monsoon should be high)
- Compare old vs new predictions

---

## Open Questions

> [!IMPORTANT]
> **Do you want me to also re-collect more training data?** Your current datasets are relatively small (1558 flood, 465 landslide). I can expand them by running the existing data collection scripts to fetch more GDACS events. However, this would take significant time (many API calls). The fixes above should dramatically improve accuracy even without more data.

> [!IMPORTANT]
> **Are there specific locations where you've tested and seen wrong predictions?** For example, you mentioned "0% chance of flood but model predicts 60%". Which exact coordinates did you test? This would help me validate my fix.

## Verification Plan

### Automated Tests
1. **Unit test**: Feed known safe locations (Sahara, Thar Desert) → expect < 10% flood/landslide
2. **Unit test**: Feed known flood-prone locations during monsoon → expect > 50% flood 
3. **Regression test**: Run test_pred.py before and after to show improvement
4. Run ML training and verify test metrics (especially **calibration error** and **Brier score**)

### Manual Verification
- Start the backend server and test via the frontend with various locations
- Test edge cases: ocean coordinates, polar regions, desert locations

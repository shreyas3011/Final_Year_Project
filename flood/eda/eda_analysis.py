"""
EDA + Feature Engineering — Flood Real Dataset
Final Year Project
"""

import pandas as pd
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns
from scipy import stats
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
import warnings
warnings.filterwarnings('ignore')

# ── Config ────────────────────────────────────────────────────
RESULTS = "flood/eda/results"
DATA    = "flood/data/flood_real_dataset.csv"   # includes safe examples
plt.rcParams.update({
    'figure.dpi': 150, 'font.family': 'DejaVu Sans',
    'axes.spines.top': False, 'axes.spines.right': False
})
FLOOD_COLOR   = "#e74c3c"
NOFLD_COLOR   = "#2ecc71"
PALETTE       = [NOFLD_COLOR, FLOOD_COLOR]

def save(fig, name):
    fig.savefig(f"{RESULTS}/{name}.png", bbox_inches='tight', dpi=150)
    plt.close(fig)
    print(f"  ✓ Saved: {name}.png")

# ── Load ─────────────────────────────────────────────────────
df = pd.read_csv(DATA)
df['date'] = pd.to_datetime(df['date'])

print("=" * 60)
print("  FLOOD EDA — STARTING")
print("=" * 60)
print(f"  Shape: {df.shape}")
print(f"  Columns: {list(df.columns)}")
print(f"  Flood: {df['flood_occurred'].sum()} | No-Flood: {(df['flood_occurred']==0).sum()}")

NUM_FEATURES = [
    'rainfall_mm', 'temp_max_c', 'temp_min_c', 'humidity_pct',
    'wind_speed_kmh', 'precipitation_hours', 'evapotranspiration_mm',
    'elevation_m', 'river_discharge_m3s'
]

# ═══════════════════════════════════════════════════════════════
# 1. DATASET OVERVIEW — missing values
# ═══════════════════════════════════════════════════════════════
fig, axes = plt.subplots(1, 2, figsize=(14, 5))
fig.suptitle("1. Dataset Overview", fontsize=14, fontweight='bold')

# Missing values
missing = df.isnull().sum()
missing = missing[missing > 0]
if len(missing):
    missing.plot(kind='barh', ax=axes[0], color='#e67e22')
    axes[0].set_title("Missing Values per Column")
    axes[0].set_xlabel("Count")
else:
    axes[0].text(0.5, 0.5, "No Missing\nValues ✓",
                 ha='center', va='center', fontsize=16, color='green',
                 transform=axes[0].transAxes)
    axes[0].set_title("Missing Values")
    axes[0].axis('off')

# Target distribution
counts = df['flood_occurred'].value_counts()
axes[1].pie(counts, labels=['Flood', 'No Flood'], colors=[FLOOD_COLOR, NOFLD_COLOR],
            autopct='%1.1f%%', startangle=90, textprops={'fontsize': 12})
axes[1].set_title("Target Distribution")
save(fig, "01_dataset_overview")

# ═══════════════════════════════════════════════════════════════
# 2. FEATURE DISTRIBUTIONS (histograms)
# ═══════════════════════════════════════════════════════════════
fig, axes = plt.subplots(3, 3, figsize=(16, 12))
fig.suptitle("2. Feature Distributions (Flood vs No-Flood)", fontsize=14, fontweight='bold')
axes = axes.flatten()
for i, col in enumerate(NUM_FEATURES):
    for label, color, name in [(0, NOFLD_COLOR, 'No Flood'), (1, FLOOD_COLOR, 'Flood')]:
        data = df[df['flood_occurred'] == label][col].dropna()
        axes[i].hist(data, bins=30, alpha=0.6, color=color, label=name, density=True)
    axes[i].set_title(col.replace('_', ' ').title(), fontsize=10)
    axes[i].legend(fontsize=8)
    axes[i].set_xlabel("Value")
    axes[i].set_ylabel("Density")
plt.tight_layout()
save(fig, "02_feature_distributions")

# ═══════════════════════════════════════════════════════════════
# 3. BOXPLOTS — flood vs no flood
# ═══════════════════════════════════════════════════════════════
fig, axes = plt.subplots(3, 3, figsize=(16, 12))
fig.suptitle("3. Boxplots: Flood vs No-Flood", fontsize=14, fontweight='bold')
axes = axes.flatten()
for i, col in enumerate(NUM_FEATURES):
    sub = df[['flood_occurred', col]].dropna()
    sub['Flood'] = sub['flood_occurred'].map({0: 'No Flood', 1: 'Flood'})
    sns.boxplot(data=sub, x='Flood', y=col, palette=PALETTE,
                order=['No Flood', 'Flood'], ax=axes[i])
    axes[i].set_title(col.replace('_', ' ').title(), fontsize=10)
    axes[i].set_xlabel("")
plt.tight_layout()
save(fig, "03_boxplots")

# ═══════════════════════════════════════════════════════════════
# 4. CORRELATION HEATMAP
# ═══════════════════════════════════════════════════════════════
corr_cols = NUM_FEATURES + ['flood_occurred']
corr = df[corr_cols].dropna().corr()
fig, ax = plt.subplots(figsize=(12, 9))
mask = np.triu(np.ones_like(corr, dtype=bool))
sns.heatmap(corr, mask=mask, annot=True, fmt='.2f', cmap='RdYlGn',
            center=0, linewidths=0.5, ax=ax, annot_kws={'size': 9})
ax.set_title("4. Feature Correlation Heatmap", fontsize=14, fontweight='bold')
plt.tight_layout()
save(fig, "04_correlation_heatmap")

# ═══════════════════════════════════════════════════════════════
# 5. POINT-BISERIAL CORRELATION BAR CHART
# ═══════════════════════════════════════════════════════════════
pb_results = {}
for col in NUM_FEATURES:
    sub = df[['flood_occurred', col]].dropna()
    r, p = stats.pointbiserialr(sub[col], sub['flood_occurred'])
    pb_results[col] = {'r': r, 'p': p, 'significant': p < 0.05}

pb_df = pd.DataFrame(pb_results).T.sort_values('r', ascending=True)
fig, ax = plt.subplots(figsize=(10, 6))
colors = [FLOOD_COLOR if r > 0 else NOFLD_COLOR for r in pb_df['r']]
bars = ax.barh(pb_df.index, pb_df['r'], color=colors, edgecolor='white', linewidth=0.5)
ax.axvline(0, color='black', linewidth=0.8, linestyle='--')
for bar, (_, row) in zip(bars, pb_df.iterrows()):
    sig = "***" if row['p'] < 0.001 else "**" if row['p'] < 0.01 else "*" if row['p'] < 0.05 else "ns"
    ax.text(bar.get_width() + 0.005 * np.sign(bar.get_width()),
            bar.get_y() + bar.get_height()/2, sig, va='center', fontsize=9)
ax.set_xlabel("Point-Biserial Correlation (r)")
ax.set_title("5. Feature Correlation with Flood Occurrence", fontsize=14, fontweight='bold')
ax.set_yticklabels([c.replace('_',' ').title() for c in pb_df.index])
plt.tight_layout()
save(fig, "05_pointbiserial_correlation")

# ═══════════════════════════════════════════════════════════════
# 6. GEOGRAPHIC DISTRIBUTION
# ═══════════════════════════════════════════════════════════════
fig, ax = plt.subplots(figsize=(14, 7))
for label, color, marker, name, size in [
    (0, NOFLD_COLOR, 'o', 'No Flood', 20),
    (1, FLOOD_COLOR, '^', 'Flood',    30)
]:
    sub = df[df['flood_occurred'] == label]
    ax.scatter(sub['longitude'], sub['latitude'], c=color, marker=marker,
               s=size, alpha=0.6, label=f"{name} ({len(sub)})", edgecolors='none')
ax.set_xlabel("Longitude")
ax.set_ylabel("Latitude")
ax.set_title("6. Geographic Distribution of Flood vs No-Flood Events", fontsize=14, fontweight='bold')
ax.legend(fontsize=11)
ax.grid(True, alpha=0.2)
plt.tight_layout()
save(fig, "06_geographic_distribution")

# ═══════════════════════════════════════════════════════════════
# 7. TIME ANALYSIS — floods by month & year
# ═══════════════════════════════════════════════════════════════
df['month'] = df['date'].dt.month
df['year']  = df['date'].dt.year

fig, axes = plt.subplots(1, 2, figsize=(14, 5))
fig.suptitle("7. Temporal Analysis", fontsize=14, fontweight='bold')

# Monthly
monthly = df[df['flood_occurred']==1].groupby('month').size()
monthly.index = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
axes[0].bar(monthly.index, monthly.values, color=FLOOD_COLOR, alpha=0.85)
axes[0].set_title("Flood Events by Month")
axes[0].set_ylabel("Number of Flood Records")
axes[0].set_xlabel("Month")

# Yearly
yearly = df.groupby(['year','flood_occurred']).size().unstack(fill_value=0)
yearly.columns = ['No Flood', 'Flood']
yearly.plot(kind='bar', ax=axes[1], color=[NOFLD_COLOR, FLOOD_COLOR],
            alpha=0.85, edgecolor='white')
axes[1].set_title("Records by Year")
axes[1].set_xlabel("Year")
axes[1].set_ylabel("Count")
axes[1].tick_params(axis='x', rotation=45)
axes[1].legend()
plt.tight_layout()
save(fig, "07_temporal_analysis")

# ═══════════════════════════════════════════════════════════════
# 8. VIOLIN PLOTS — key features
# ═══════════════════════════════════════════════════════════════
key_feats = ['rainfall_mm', 'humidity_pct', 'precipitation_hours', 'elevation_m']
fig, axes = plt.subplots(1, 4, figsize=(18, 6))
fig.suptitle("8. Distribution Shape: Key Features (Flood vs No-Flood)", fontsize=14, fontweight='bold')
for i, col in enumerate(key_feats):
    sub = df[['flood_occurred', col]].dropna()
    sub['Flood'] = sub['flood_occurred'].map({0: 'No Flood', 1: 'Flood'})
    sns.violinplot(data=sub, x='Flood', y=col, palette=PALETTE,
                   order=['No Flood', 'Flood'], ax=axes[i], cut=0)
    axes[i].set_title(col.replace('_',' ').title(), fontsize=10)
    axes[i].set_xlabel("")
plt.tight_layout()
save(fig, "08_violin_plots")

# ═══════════════════════════════════════════════════════════════
# 9. FEATURE ENGINEERING
# ═══════════════════════════════════════════════════════════════
print("\n--- Feature Engineering ---")

# ── Encoding mappings (deterministic, no LabelEncoder needed) ──
RAINFALL_CAT_BINS   = [-1, 0, 5, 25, 75, 150, 999]
RAINFALL_CAT_LABELS = [0, 1, 2, 3, 4, 5]  # None=0, VeryLow=1, Low=2, Moderate=3, High=4, Extreme=5
RAINFALL_CAT_NAMES  = ['None','Very Low','Low','Moderate','High','Extreme']

SEASON_MAP = {12:0, 1:0, 2:0, 3:1, 4:1, 5:1, 6:2, 7:2, 8:2, 9:2, 10:3, 11:3}
SEASON_NAMES = {0:'Winter', 1:'Pre-Monsoon', 2:'Monsoon', 3:'Post-Monsoon'}

HUMIDITY_RISK_BINS   = [0, 40, 60, 80, 101]
HUMIDITY_RISK_LABELS = [0, 1, 2, 3]  # Low=0, Moderate=1, High=2, VeryHigh=3
HUMIDITY_RISK_NAMES  = ['Low','Moderate','High','Very High']

def engineer(df):
    df = df.copy()

    # 1. Rainfall category (direct integer encoding)
    df['rainfall_category'] = pd.cut(
        df['rainfall_mm'],
        bins=RAINFALL_CAT_BINS,
        labels=RAINFALL_CAT_LABELS
    ).astype(int)

    # 2. Season (India-centric, direct integer encoding)
    df['season'] = df['month'].map(SEASON_MAP)

    # 3. Humidity risk band (direct integer encoding)
    df['humidity_risk'] = pd.cut(
        df['humidity_pct'],
        bins=HUMIDITY_RISK_BINS,
        labels=HUMIDITY_RISK_LABELS
    ).astype(int)

    # 4. Low elevation flag (< 100m = floodplain zone)
    df['low_elevation'] = (df['elevation_m'] < 100).astype(int)

    # 5. High discharge flag (above 1000 m³/s)
    df['high_discharge'] = (df['river_discharge_m3s'] > 1000).astype(int)

    # 6. Log-transform skewed features
    for col in ['rainfall_mm', 'river_discharge_m3s', 'elevation_m']:
        df[f'log_{col}'] = np.log1p(df[col].fillna(0))

    # 7. Rainfall × Humidity interaction
    df['rain_humidity_index'] = df['rainfall_mm'] * df['humidity_pct'] / 100

    # 8. Precip duration ratio  
    df['precip_efficiency'] = np.where(
        df['precipitation_hours'] > 0,
        df['rainfall_mm'] / df['precipitation_hours'],
        0
    )

    # 9. Temp range
    df['temp_range_c'] = df['temp_max_c'] - df['temp_min_c']

    # 10. Composite flood risk score (weighted sum of normalised features)
    def norm(x):
        rng = x.max() - x.min()
        return (x - x.min()) / rng if rng > 0 else x * 0

    df['flood_risk_score'] = (
        0.30 * norm(df['rainfall_mm']) +
        0.20 * norm(df['humidity_pct']) +
        0.20 * norm(df['precipitation_hours']) +
        0.15 * (1 - norm(df['elevation_m'])) +
        0.15 * norm(df['river_discharge_m3s'].fillna(0))
    ).round(4)

    return df

df_eng = engineer(df)
print(f"  Features before: {len(NUM_FEATURES)}")
print(f"  Features after : {df_eng.shape[1]}")

# Save engineered dataset
df_eng.to_csv("flood/data/flood_engineered.csv", index=False)
print("  ✓ Saved → data/flood_engineered.csv")

# ── Save feature config for predictor consistency ──────────────
import json as _json
feature_config = {
    'rainfall_category_bins': RAINFALL_CAT_BINS,
    'rainfall_category_labels': RAINFALL_CAT_LABELS,
    'season_map': {str(k): v for k, v in SEASON_MAP.items()},
    'humidity_risk_bins': HUMIDITY_RISK_BINS,
    'humidity_risk_labels': HUMIDITY_RISK_LABELS,
    'norm_params': {
        'rainfall_mm': {'min': float(df_eng['rainfall_mm'].min()), 'max': float(df_eng['rainfall_mm'].max())},
        'humidity_pct': {'min': float(df_eng['humidity_pct'].min()), 'max': float(df_eng['humidity_pct'].max())},
        'precipitation_hours': {'min': float(df_eng['precipitation_hours'].min()), 'max': float(df_eng['precipitation_hours'].max())},
        'elevation_m': {'min': float(df_eng['elevation_m'].min()), 'max': float(df_eng['elevation_m'].max())},
        'river_discharge_m3s': {'min': float(df_eng['river_discharge_m3s'].fillna(0).min()), 'max': float(df_eng['river_discharge_m3s'].fillna(0).max())},
    }
}
with open('flood/ml_pipeline/feature_config.json', 'w') as _fc:
    _json.dump(feature_config, _fc, indent=2)
print("  ✓ Saved → flood/ml_pipeline/feature_config.json")

# ═══════════════════════════════════════════════════════════════
# 10. ENGINEERED FEATURES ANALYSIS
# ═══════════════════════════════════════════════════════════════
fig, axes = plt.subplots(2, 3, figsize=(16, 10))
fig.suptitle("9. Engineered Features Analysis", fontsize=14, fontweight='bold')
axes = axes.flatten()

# a. Rainfall category vs flood rate
rc = df_eng.groupby('rainfall_category', observed=True)['flood_occurred'].mean() * 100
rc_labels = [RAINFALL_CAT_NAMES[i] for i in rc.index]
axes[0].bar(rc_labels, rc.values, color=FLOOD_COLOR, alpha=0.85)
axes[0].set_title("Flood Rate by Rainfall Category (%)")
axes[0].set_ylabel("Flood Occurrence (%)")
axes[0].tick_params(axis='x', rotation=20)

# b. Season vs flood rate
sc = df_eng.groupby('season', observed=True)['flood_occurred'].mean() * 100
sc = sc.sort_index()
sc_labels = [SEASON_NAMES.get(i, str(i)) for i in sc.index]
axes[1].bar(sc_labels, sc.values, color='#3498db', alpha=0.85)
axes[1].set_title("Flood Rate by Season (%)")
axes[1].set_ylabel("Flood Occurrence (%)")

# c. Flood risk score distribution
for label, color, name in [(0,NOFLD_COLOR,'No Flood'),(1,FLOOD_COLOR,'Flood')]:
    axes[2].hist(df_eng[df_eng['flood_occurred']==label]['flood_risk_score'],
                 bins=30, alpha=0.65, color=color, label=name, density=True)
axes[2].set_title("Flood Risk Score Distribution")
axes[2].set_xlabel("Risk Score")
axes[2].legend()

# d. Rain × Humidity index
for label, color, name in [(0,NOFLD_COLOR,'No Flood'),(1,FLOOD_COLOR,'Flood')]:
    data = df_eng[df_eng['flood_occurred']==label]['rain_humidity_index']
    axes[3].hist(data.clip(0,300), bins=30, alpha=0.65, color=color, label=name, density=True)
axes[3].set_title("Rain × Humidity Index")
axes[3].set_xlabel("Index Value")
axes[3].legend()

# e. Low elevation flag
le = df_eng.groupby('low_elevation')['flood_occurred'].mean() * 100
axes[4].bar(['> 100m', '< 100m\n(Floodplain)'], le.values,
            color=[NOFLD_COLOR, FLOOD_COLOR], alpha=0.85)
axes[4].set_title("Flood Rate by Elevation Zone (%)")
axes[4].set_ylabel("Flood Occurrence (%)")

# f. Humidity risk band
hr = df_eng.groupby('humidity_risk', observed=True)['flood_occurred'].mean() * 100
hr_labels = [HUMIDITY_RISK_NAMES[i] for i in hr.index]
axes[5].bar(hr_labels, hr.values, color='#9b59b6', alpha=0.85)
axes[5].set_title("Flood Rate by Humidity Risk Band (%)")
axes[5].set_ylabel("Flood Occurrence (%)")

plt.tight_layout()
save(fig, "09_engineered_features")

# ═══════════════════════════════════════════════════════════════
# 10. RANDOM FOREST FEATURE IMPORTANCE
# ═══════════════════════════════════════════════════════════════
print("\n--- Feature Importance (Random Forest) ---")

feat_cols = NUM_FEATURES + [
    'log_rainfall_mm', 'log_river_discharge_m3s', 'log_elevation_m',
    'rain_humidity_index', 'precip_efficiency', 'temp_range_c',
    'flood_risk_score', 'low_elevation', 'high_discharge'
]

X = df_eng[feat_cols].fillna(0)
y = df_eng['flood_occurred']

rf = RandomForestClassifier(n_estimators=200, random_state=42, n_jobs=-1)
rf.fit(X, y)

imp = pd.Series(rf.feature_importances_, index=feat_cols).sort_values(ascending=True)
fig, ax = plt.subplots(figsize=(10, 8))
colors = [FLOOD_COLOR if i >= len(imp)-5 else '#3498db' for i in range(len(imp))]
imp.plot(kind='barh', ax=ax, color=colors, edgecolor='white')
ax.set_title("10. Random Forest Feature Importance", fontsize=14, fontweight='bold')
ax.set_xlabel("Importance Score")
ax.set_yticklabels([c.replace('_',' ').title() for c in imp.index])
ax.axvline(1/len(imp), linestyle='--', color='gray', alpha=0.5, label='Equal importance baseline')
ax.legend()
plt.tight_layout()
save(fig, "10_feature_importance")

# ═══════════════════════════════════════════════════════════════
# 11. STATISTICAL SUMMARY TABLE
# ═══════════════════════════════════════════════════════════════
summary_rows = []
for col in NUM_FEATURES:
    f1 = df[df['flood_occurred']==1][col].dropna()
    f0 = df[df['flood_occurred']==0][col].dropna()
    t_stat, p_val = stats.ttest_ind(f1, f0)
    r, _ = stats.pointbiserialr(df[col].dropna(), df.loc[df[col].notna(),'flood_occurred'])
    summary_rows.append({
        'Feature': col,
        'Flood Mean': round(f1.mean(), 3),
        'No-Flood Mean': round(f0.mean(), 3),
        'Difference': round(f1.mean() - f0.mean(), 3),
        'Corr (r)': round(r, 4),
        'p-value': round(p_val, 6),
        'Significant': '✓' if p_val < 0.05 else '✗'
    })

summary_df = pd.DataFrame(summary_rows)
summary_df.to_csv(f"{RESULTS}/statistical_summary.csv", index=False)
print("\n  ✓ Saved: statistical_summary.csv")
print(summary_df.to_string(index=False))

print("\n" + "=" * 60)
print("  ✅ EDA COMPLETE — All plots saved to eda/results/")
print("=" * 60)
print(f"  Dataset rows   : {len(df)}")
print(f"  Original feats : {len(NUM_FEATURES)}")
print(f"  Engineered feats: {df_eng.shape[1]}")
print(f"  Plots saved    : 10 PNG files + 1 CSV summary")

"""
Landslide EDA + Feature Engineering
"""
import json
import pandas as pd, numpy as np, matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt, seaborn as sns
from scipy import stats
from sklearn.ensemble import RandomForestClassifier
import warnings; warnings.filterwarnings('ignore')

RESULTS = "landslide/eda/results"
DATA    = "landslide/data/landslide_real_dataset.csv"
LC, NC  = "#e74c3c", "#2ecc71"
plt.rcParams.update({'figure.dpi':150,'font.family':'DejaVu Sans',
                     'axes.spines.top':False,'axes.spines.right':False})

def save(fig, name):
    fig.savefig(f"{RESULTS}/{name}.png", bbox_inches='tight', dpi=150)
    plt.close(fig); print(f"  ✓ {name}.png")

df = pd.read_csv(DATA)
df['date'] = pd.to_datetime(df['date'])
df['month'] = df['date'].dt.month
df['year']  = df['date'].dt.year

NUM = ['rainfall_mm','antecedent_7day_mm','temp_max_c','temp_min_c',
       'humidity_pct','wind_speed_kmh','precipitation_hours',
       'evapotranspiration_mm','soil_moisture','elevation_m','river_discharge_m3s']

print("="*60)
print(f"  Landslide EDA | Shape: {df.shape}")
print(f"  Landslide(1): {df['landslide_occurred'].sum()} | No(0): {(df['landslide_occurred']==0).sum()}")

# 1. Overview
fig,axes = plt.subplots(1,2,figsize=(14,5))
fig.suptitle("1. Dataset Overview",fontsize=14,fontweight='bold')
miss = df.isnull().sum(); miss = miss[miss>0]
if len(miss):
    miss.plot(kind='barh',ax=axes[0],color='#e67e22')
    axes[0].set_title("Missing Values")
else:
    axes[0].text(0.5,0.5,"No Missing\nValues ✓",ha='center',va='center',
                 fontsize=16,color='green',transform=axes[0].transAxes)
    axes[0].axis('off')
cnt = df['landslide_occurred'].value_counts()
axes[1].pie(cnt,labels=['Landslide','No Landslide'],colors=[LC,NC],
            autopct='%1.1f%%',startangle=90)
axes[1].set_title("Target Distribution")
save(fig,"01_overview")

# 2. Feature Distributions
NUM_VALID = [c for c in NUM if c in df.columns]
rows_n = (len(NUM_VALID)+2)//3
fig,axes = plt.subplots(rows_n,3,figsize=(16,rows_n*4))
fig.suptitle("2. Feature Distributions (Landslide vs No-Landslide)",fontsize=14,fontweight='bold')
axes = axes.flatten()
for i,col in enumerate(NUM_VALID):
    for lbl,color,nm in [(0,NC,'No Landslide'),(1,LC,'Landslide')]:
        axes[i].hist(df[df['landslide_occurred']==lbl][col].dropna(),
                     bins=30,alpha=0.6,color=color,label=nm,density=True)
    axes[i].set_title(col.replace('_',' ').title(),fontsize=9)
    axes[i].legend(fontsize=7)
for j in range(i+1,len(axes)): axes[j].axis('off')
plt.tight_layout(); save(fig,"02_distributions")

# 3. Boxplots
fig,axes = plt.subplots(rows_n,3,figsize=(16,rows_n*4))
fig.suptitle("3. Boxplots: Landslide vs No-Landslide",fontsize=14,fontweight='bold')
axes = axes.flatten()
for i,col in enumerate(NUM_VALID):
    sub = df[['landslide_occurred',col]].dropna()
    sub['L'] = sub['landslide_occurred'].map({0:'No Landslide',1:'Landslide'})
    sns.boxplot(data=sub,x='L',y=col,palette=[NC,LC],
                order=['No Landslide','Landslide'],ax=axes[i])
    axes[i].set_title(col.replace('_',' ').title(),fontsize=9); axes[i].set_xlabel("")
for j in range(i+1,len(axes)): axes[j].axis('off')
plt.tight_layout(); save(fig,"03_boxplots")

# 4. Correlation Heatmap
corr_cols = NUM_VALID+['landslide_occurred']
corr = df[corr_cols].dropna().corr()
fig,ax = plt.subplots(figsize=(13,10))
sns.heatmap(corr,annot=True,fmt='.2f',cmap='RdYlGn',center=0,
            linewidths=0.5,ax=ax,annot_kws={'size':8},
            mask=np.triu(np.ones_like(corr,dtype=bool)))
ax.set_title("4. Correlation Heatmap",fontsize=14,fontweight='bold')
plt.tight_layout(); save(fig,"04_correlation_heatmap")

# 5. Point-Biserial Correlation
pb = {}
for col in NUM_VALID:
    sub = df[['landslide_occurred',col]].dropna()
    r,p = stats.pointbiserialr(sub[col],sub['landslide_occurred'])
    pb[col] = {'r':r,'p':p}
pb_df = pd.DataFrame(pb).T.sort_values('r',ascending=True)
fig,ax = plt.subplots(figsize=(10,6))
colors = [LC if r>0 else NC for r in pb_df['r']]
bars = ax.barh(pb_df.index,pb_df['r'],color=colors,edgecolor='white')
ax.axvline(0,color='black',lw=0.8,ls='--')
for bar,(_,row) in zip(bars,pb_df.iterrows()):
    sig = "***" if row['p']<0.001 else "**" if row['p']<0.01 else "*" if row['p']<0.05 else "ns"
    ax.text(bar.get_width()+0.005*np.sign(bar.get_width() or 1),
            bar.get_y()+bar.get_height()/2,sig,va='center',fontsize=9)
ax.set_xlabel("Point-Biserial Correlation (r)")
ax.set_title("5. Feature Correlation with Landslide Occurrence",fontsize=14,fontweight='bold')
ax.set_yticklabels([c.replace('_',' ').title() for c in pb_df.index])
plt.tight_layout(); save(fig,"05_correlation_bar")

# 6. Geographic Distribution
fig,ax = plt.subplots(figsize=(14,7))
for lbl,color,mk,nm,sz in [(0,NC,'o','No Landslide',20),(1,LC,'^','Landslide',35)]:
    sub = df[df['landslide_occurred']==lbl]
    ax.scatter(sub['longitude'],sub['latitude'],c=color,marker=mk,
               s=sz,alpha=0.65,label=f"{nm} ({len(sub)})",edgecolors='none')
ax.set_xlabel("Longitude"); ax.set_ylabel("Latitude")
ax.set_title("6. Geographic Distribution",fontsize=14,fontweight='bold')
ax.legend(fontsize=11); ax.grid(True,alpha=0.2)
plt.tight_layout(); save(fig,"06_geographic")

# 7. Temporal — by month & year
fig,axes = plt.subplots(1,2,figsize=(14,5))
fig.suptitle("7. Temporal Analysis",fontsize=14,fontweight='bold')
monthly = df[df['landslide_occurred']==1].groupby('month').size()
mnames  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
axes[0].bar([mnames[m-1] for m in monthly.index],monthly.values,color=LC,alpha=0.85)
axes[0].set_title("Landslides by Month"); axes[0].set_ylabel("Records")
yearly = df.groupby(['year','landslide_occurred']).size().unstack(fill_value=0)
yearly.columns = ['No Landslide','Landslide']
yearly.plot(kind='bar',ax=axes[1],color=[NC,LC],alpha=0.85,edgecolor='white')
axes[1].set_title("Records by Year"); axes[1].tick_params(axis='x',rotation=45)
plt.tight_layout(); save(fig,"07_temporal")

# 8. Elevation vs Rainfall scatter (landslide mechanism)
fig,ax = plt.subplots(figsize=(10,7))
for lbl,color,nm in [(0,NC,'No Landslide'),(1,LC,'Landslide')]:
    sub = df[df['landslide_occurred']==lbl]
    ax.scatter(sub['rainfall_mm'],sub['elevation_m'],c=color,s=25,
               alpha=0.5,label=nm,edgecolors='none')
ax.set_xlabel("Rainfall (mm)"); ax.set_ylabel("Elevation (m)")
ax.set_title("8. Elevation vs Rainfall (Landslide Mechanism)",fontsize=14,fontweight='bold')
ax.legend(); ax.grid(True,alpha=0.2)
plt.tight_layout(); save(fig,"08_elevation_vs_rainfall")

# 9. Antecedent vs Daily Rainfall
fig,ax = plt.subplots(figsize=(10,7))
for lbl,color,nm in [(0,NC,'No Landslide'),(1,LC,'Landslide')]:
    sub = df[df['landslide_occurred']==lbl].dropna(subset=['antecedent_7day_mm'])
    ax.scatter(sub['antecedent_7day_mm'],sub['rainfall_mm'],c=color,s=25,
               alpha=0.5,label=nm,edgecolors='none')
ax.set_xlabel("Antecedent 7-Day Rainfall (mm)")
ax.set_ylabel("Daily Rainfall (mm)")
ax.set_title("9. Antecedent vs Daily Rainfall",fontsize=14,fontweight='bold')
ax.legend(); ax.grid(True,alpha=0.2)
plt.tight_layout(); save(fig,"09_antecedent_vs_daily")

# ── FEATURE ENGINEERING ────────────────────────────────────────
print("\n--- Feature Engineering ---")

def engineer(df):
    df = df.copy()

    # 1. Rainfall intensity
    df['rainfall_intensity'] = np.where(
        df['precipitation_hours']>0,
        df['rainfall_mm']/df['precipitation_hours'], 0)

    # 2. Elevation category
    df['elevation_cat'] = pd.cut(df['elevation_m'],
        bins=[-1,100,500,1500,3000,9999],
        labels=[0,1,2,3,4])
    df['elevation_cat'] = df['elevation_cat'].astype(int)

    # 3. Slope proxy (higher elevation = steeper terrain)
    df['slope_proxy'] = np.where(df['elevation_m']>0,
        np.log1p(df['elevation_m'])/10, 0)

    # 4. TWI proxy: soil_moisture / slope_proxy
    df['twi_proxy'] = np.where(df['slope_proxy']>0,
        df['soil_moisture'].fillna(0) / (df['slope_proxy']+0.01), 0)

    # 5. Combined rainfall index
    df['combined_rain_index'] = (
        0.6*df['rainfall_mm'].fillna(0) +
        0.4*df['antecedent_7day_mm'].fillna(0))

    # 6. Season
    season_map = {12:0, 1:0, 2:0,
                  3:1, 4:1, 5:1,
                  6:2, 7:2, 8:2, 9:2,
                  10:3, 11:3}
    df['season'] = df['month'].map(season_map)

    # 7. High elevation + High rain = critical condition
    df['critical_zone'] = ((df['elevation_m']>500) &
                           (df['rainfall_mm']>30)).astype(int)

    # 8. Log transforms
    for col in ['rainfall_mm','antecedent_7day_mm','elevation_m']:
        df[f'log_{col}'] = np.log1p(df[col].fillna(0))

    # 9. Temp range
    df['temp_range'] = df['temp_max_c'] - df['temp_min_c']

    # 10. Composite landslide risk score
    def norm(x): r=x.max()-x.min(); return (x-x.min())/r if r>0 else x*0
    df['landslide_risk_score'] = (
        0.25*norm(df['rainfall_mm']) +
        0.20*norm(df['antecedent_7day_mm'].fillna(0)) +
        0.20*norm(df['elevation_m']) +
        0.15*norm(df['humidity_pct']) +
        0.10*norm(df['slope_proxy']) +
        0.10*norm(df['soil_moisture'].fillna(0))
    ).round(4)

    return df

df_eng = engineer(df)
print(f"  Features: {len(df.columns)} → {df_eng.shape[1]}")

# Categorical columns already use integer labels — no LabelEncoder needed

df_eng.to_csv("landslide/data/landslide_engineered.csv", index=False)
print("  ✓ Saved → landslide/data/landslide_engineered.csv")

# Save feature configuration for consistent preprocessing
feature_config = {
    'season_map': {str(k): v for k, v in {12:0, 1:0, 2:0, 3:1, 4:1, 5:1, 6:2, 7:2, 8:2, 9:2, 10:3, 11:3}.items()},
    'elevation_cat_bins': [-1, 100, 500, 1500, 3000, 9999],
    'elevation_cat_labels': [0, 1, 2, 3, 4],
    'norm_params': {
        'rainfall_mm': {'min': float(df_eng['rainfall_mm'].min()), 'max': float(df_eng['rainfall_mm'].max())},
        'antecedent_7day_mm': {'min': float(df_eng['antecedent_7day_mm'].fillna(0).min()), 'max': float(df_eng['antecedent_7day_mm'].fillna(0).max())},
        'elevation_m': {'min': float(df_eng['elevation_m'].min()), 'max': float(df_eng['elevation_m'].max())},
        'humidity_pct': {'min': float(df_eng['humidity_pct'].min()), 'max': float(df_eng['humidity_pct'].max())},
        'slope_proxy': {'min': float(df_eng['slope_proxy'].min()), 'max': float(df_eng['slope_proxy'].max())},
        'soil_moisture': {'min': float(df_eng['soil_moisture'].fillna(0).min()), 'max': float(df_eng['soil_moisture'].fillna(0).max())},
    }
}
json.dump(feature_config, open('landslide/ml_pipeline/feature_config.json', 'w'), indent=2)
print("  ✓ Saved → landslide/ml_pipeline/feature_config.json")

# 10. Engineered Features plots
fig,axes = plt.subplots(2,3,figsize=(16,10))
fig.suptitle("10. Engineered Features",fontsize=14,fontweight='bold')
axes = axes.flatten()
# a. Combined rain index
for lbl,color,nm in [(0,NC,'No Landslide'),(1,LC,'Landslide')]:
    axes[0].hist(df_eng[df_eng['landslide_occurred']==lbl]['combined_rain_index'],
                 bins=25,alpha=0.65,color=color,label=nm,density=True)
axes[0].set_title("Combined Rain Index"); axes[0].legend(fontsize=8)
# b. Elevation category vs landslide rate
ec = df_eng.groupby('elevation_cat',observed=True)['landslide_occurred'].mean()*100
axes[1].bar(range(len(ec)),ec.values,color=LC,alpha=0.85)
axes[1].set_title("Landslide Rate by Elevation Cat (%)")
# c. Season vs landslide rate
sc = df_eng.groupby('season',observed=True)['landslide_occurred'].mean()*100
axes[2].bar(sc.index,sc.values,color='#3498db',alpha=0.85)
axes[2].set_title("Landslide Rate by Season (%)"); axes[2].tick_params(axis='x',rotation=20)
# d. Risk score
for lbl,color,nm in [(0,NC,'No Landslide'),(1,LC,'Landslide')]:
    axes[3].hist(df_eng[df_eng['landslide_occurred']==lbl]['landslide_risk_score'],
                 bins=25,alpha=0.65,color=color,label=nm,density=True)
axes[3].set_title("Landslide Risk Score"); axes[3].legend(fontsize=8)
# e. Critical zone flag
cz = df_eng.groupby('critical_zone')['landslide_occurred'].mean()*100
axes[4].bar(['Non-Critical','Critical Zone'],cz.values,color=[NC,LC],alpha=0.85)
axes[4].set_title("Landslide Rate:\nCritical Zone (High Elev + High Rain) %")
# f. Flood nearby flag
fn = df_eng.groupby('flood_nearby')['landslide_occurred'].mean()*100
axes[5].bar(['No Flood\nNearby','Flood\nNearby'],fn.values,color=['#3498db','#e74c3c'],alpha=0.85)
axes[5].set_title("Landslide Rate by\nFlood Nearby Flag (%)")
plt.tight_layout(); save(fig,"10_engineered_features")

# 11. RF Feature Importance
FEAT_COLS = [c for c in df_eng.columns if c not in
             ['event_name','date','landslide_occurred','latitude','longitude']]
X = df_eng[FEAT_COLS].fillna(0)
y = df_eng['landslide_occurred']
rf = RandomForestClassifier(n_estimators=200,random_state=42,n_jobs=-1)
rf.fit(X,y)
imp = pd.Series(rf.feature_importances_,index=FEAT_COLS).sort_values(ascending=True)
fig,ax = plt.subplots(figsize=(10,max(6,len(imp)*0.35)))
colors = [LC if i>=len(imp)-5 else '#3498db' for i in range(len(imp))]
imp.plot(kind='barh',ax=ax,color=colors,edgecolor='white')
ax.set_title("11. Random Forest Feature Importance",fontsize=14,fontweight='bold')
ax.set_xlabel("Importance Score")
ax.set_yticklabels([c.replace('_',' ').title() for c in imp.index],fontsize=8)
plt.tight_layout(); save(fig,"11_feature_importance")

# Save stats table
rows=[]
for col in NUM_VALID:
    f1=df[df['landslide_occurred']==1][col].dropna()
    f0=df[df['landslide_occurred']==0][col].dropna()
    t,p = stats.ttest_ind(f1,f0)
    r,_ = stats.pointbiserialr(df[col].dropna(), df.loc[df[col].notna(),'landslide_occurred'])
    rows.append({'Feature':col,'Landslide_Mean':round(f1.mean(),3),
                 'NoLandslide_Mean':round(f0.mean(),3),'Diff':round(f1.mean()-f0.mean(),3),
                 'r':round(r,4),'p_value':round(p,6),'Sig':'✓' if p<0.05 else '✗'})
stats_df = pd.DataFrame(rows)
stats_df.to_csv(f"{RESULTS}/statistical_summary.csv",index=False)
print(f"\n{stats_df.to_string(index=False)}")
print(f"\n✅ EDA complete — 11 plots saved to {RESULTS}/")

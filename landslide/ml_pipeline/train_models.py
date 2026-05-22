"""
Landslide ML Pipeline — Train multiple models, save best
Same structure as flood ML pipeline
"""
import pandas as pd, numpy as np, matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt, seaborn as sns
import joblib, json, warnings; warnings.filterwarnings('ignore')

from sklearn.model_selection  import cross_val_score, learning_curve, GroupShuffleSplit, GroupKFold
from sklearn.preprocessing    import StandardScaler
from sklearn.pipeline         import Pipeline
from sklearn.metrics          import (accuracy_score, precision_score, recall_score,
                                      f1_score, roc_auc_score, confusion_matrix, roc_curve)
from sklearn.linear_model     import LogisticRegression
from sklearn.neighbors        import KNeighborsClassifier
from sklearn.tree             import DecisionTreeClassifier
from sklearn.ensemble         import RandomForestClassifier, GradientBoostingClassifier, ExtraTreesClassifier
from sklearn.svm              import SVC
from sklearn.naive_bayes      import GaussianNB
from sklearn.calibration      import CalibratedClassifierCV
from xgboost                  import XGBClassifier

RESULTS = "landslide/ml_pipeline/results"
DATA    = "landslide/data/landslide_engineered.csv"
plt.rcParams.update({'figure.dpi':150,'font.family':'DejaVu Sans',
                     'axes.spines.top':False,'axes.spines.right':False})

def save(fig,name):
    fig.savefig(f"{RESULTS}/{name}.png",bbox_inches='tight',dpi=150)
    plt.close(fig); print(f"  ✓ {name}.png")

# Load
df = pd.read_csv(DATA)
DROP = ['event_name','date','landslide_occurred','latitude','longitude','month','year']
FEAT = [c for c in df.columns if c not in DROP]
X = df[FEAT].fillna(0)
y = df['landslide_occurred']
groups = df['event_name']

# GroupShuffleSplit: prevents same event rows from appearing in both train and test
gss = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=42)
train_idx, test_idx = next(gss.split(X, y, groups))
X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]

print("="*65)
print("  LANDSLIDE ML PIPELINE")
print("="*65)
print(f"  Total: {len(X)} | Train: {len(X_train)} | Test: {len(X_test)}")
print(f"  Features: {len(FEAT)} | Landslide: {y.sum()} ({y.mean()*100:.1f}%)")

# Compute scale_pos_weight for XGBoost
spw = float((y_train==0).sum() / (y_train==1).sum())

MODELS = {
    "Logistic Regression":  Pipeline([('sc',StandardScaler()),('m',LogisticRegression(max_iter=1000,random_state=42,class_weight='balanced'))]),
    "K-Nearest Neighbors":  Pipeline([('sc',StandardScaler()),('m',KNeighborsClassifier(n_neighbors=7))]),
    "Decision Tree":        DecisionTreeClassifier(max_depth=8,random_state=42,class_weight='balanced'),
    "Random Forest":        RandomForestClassifier(n_estimators=200,max_depth=12,random_state=42,n_jobs=-1,class_weight='balanced'),
    "Extra Trees":          ExtraTreesClassifier(n_estimators=200,random_state=42,n_jobs=-1,class_weight='balanced'),
    "Gradient Boosting":    GradientBoostingClassifier(n_estimators=200,learning_rate=0.05,max_depth=5,random_state=42),
    "XGBoost":              XGBClassifier(n_estimators=200,learning_rate=0.05,max_depth=5,random_state=42,eval_metric='logloss',verbosity=0,scale_pos_weight=spw),
    "SVM":                  Pipeline([('sc',StandardScaler()),('m',SVC(probability=True,kernel='rbf',random_state=42,class_weight='balanced'))]),
    "Naive Bayes":          GaussianNB(),
}

print("\n--- Training all models ---\n")
cv = GroupKFold(n_splits=5)
train_groups = groups.iloc[train_idx]
results = {}
for name,model in MODELS.items():
    model.fit(X_train,y_train)
    yp  = model.predict(X_test)
    ypr = model.predict_proba(X_test)[:,1]
    cvs = cross_val_score(model,X_train,y_train,cv=cv,scoring='f1',n_jobs=-1,groups=train_groups)
    results[name] = {'model':model,'y_pred':yp,'y_prob':ypr,
                     'accuracy':accuracy_score(y_test,yp),'precision':precision_score(y_test,yp),
                     'recall':recall_score(y_test,yp),'f1':f1_score(y_test,yp),
                     'roc_auc':roc_auc_score(y_test,ypr),
                     'cv_f1_mean':cvs.mean(),'cv_f1_std':cvs.std()}
    print(f"  {name:<25} Acc={results[name]['accuracy']:.4f} F1={results[name]['f1']:.4f} AUC={results[name]['roc_auc']:.4f}")

METRICS = ['accuracy','precision','recall','f1','roc_auc']
comp_df = pd.DataFrame({n:{m:results[n][m] for m in METRICS} for n in results}).T.sort_values('f1',ascending=False)
palette = plt.cm.tab10(np.linspace(0,1,len(results)))

# Plot 1: Model Comparison
fig,ax = plt.subplots(figsize=(14,6))
x,w = np.arange(len(comp_df)),0.15
colors = ['#2ecc71','#3498db','#e74c3c','#f39c12','#9b59b6']
mlabels= ['Accuracy','Precision','Recall','F1','ROC-AUC']
for i,(m,ml) in enumerate(zip(METRICS,mlabels)):
    ax.bar(x+i*w,comp_df[m],w,label=ml,color=colors[i],alpha=0.85,edgecolor='white')
ax.set_xticks(x+w*2); ax.set_xticklabels(comp_df.index,rotation=30,ha='right',fontsize=9)
ax.set_ylim(0,1.12); ax.set_ylabel("Score")
ax.set_title("1. Landslide Model Comparison",fontsize=14,fontweight='bold')
ax.legend(loc='upper right',fontsize=9)
for i,(name,row) in enumerate(comp_df.iterrows()):
    ax.text(i+w*2,row['f1']+0.015,f"{row['f1']:.3f}",ha='center',fontsize=8)
plt.tight_layout(); save(fig,"01_model_comparison")

# Plot 2: CV F1
cv_sorted = sorted(results,key=lambda n:results[n]['cv_f1_mean'],reverse=True)
fig,ax = plt.subplots(figsize=(12,5))
bars = ax.bar(cv_sorted,[results[n]['cv_f1_mean'] for n in cv_sorted],
              yerr=[results[n]['cv_f1_std'] for n in cv_sorted],
              capsize=5,color='#3498db',alpha=0.85,edgecolor='white')
ax.set_ylim(0,1.1); ax.tick_params(axis='x',rotation=30)
ax.set_title("2. 5-Fold Cross-Validation F1",fontsize=14,fontweight='bold')
for bar,n in zip(bars,cv_sorted):
    ax.text(bar.get_x()+bar.get_width()/2,bar.get_height()+0.02,
            f"{results[n]['cv_f1_mean']:.3f}",ha='center',fontsize=9)
plt.tight_layout(); save(fig,"02_cross_validation")

# Plot 3: Confusion Matrices
model_names = list(results.keys())
fig,axes = plt.subplots(3,3,figsize=(16,14))
fig.suptitle("3. Confusion Matrices",fontsize=14,fontweight='bold')
for i,name in enumerate(model_names):
    cm = confusion_matrix(y_test,results[name]['y_pred'])
    sns.heatmap(cm,annot=True,fmt='d',cmap='Blues',ax=axes.flatten()[i],
                xticklabels=['No LS','Landslide'],yticklabels=['No LS','Landslide'],
                linewidths=0.5,cbar=False)
    axes.flatten()[i].set_title(f"{name}\n(Acc={results[name]['accuracy']:.3f})",fontsize=9)
plt.tight_layout(); save(fig,"03_confusion_matrices")

# Plot 4: ROC Curves
fig,ax = plt.subplots(figsize=(10,8))
for (name,res),color in zip(results.items(),palette):
    fpr,tpr,_ = roc_curve(y_test,res['y_prob'])
    ax.plot(fpr,tpr,lw=2,color=color,label=f"{name} (AUC={res['roc_auc']:.3f})")
ax.plot([0,1],[0,1],'k--',lw=1.2,alpha=0.6)
ax.set_xlabel("FPR"); ax.set_ylabel("TPR")
ax.set_title("4. ROC Curves",fontsize=14,fontweight='bold')
ax.legend(loc='lower right',fontsize=9); ax.grid(True,alpha=0.2)
plt.tight_layout(); save(fig,"04_roc_curves")

# Plot 5: Metrics Heatmap
mdf = pd.DataFrame({n:{m:round(results[n][m],4) for m in METRICS} for n in results}).T.sort_values('f1',ascending=False)
fig,ax = plt.subplots(figsize=(10,7))
sns.heatmap(mdf,annot=True,fmt='.4f',cmap='YlOrRd',linewidths=0.5,ax=ax,vmin=0.5,vmax=1.0)
ax.set_title("5. All Metrics Heatmap",fontsize=14,fontweight='bold')
plt.tight_layout(); save(fig,"05_metrics_heatmap")

# Plot 6: Feature Importance (tree models)
tree_m = {n:results[n]['model'] for n in ['Random Forest','Extra Trees','Gradient Boosting','XGBoost']}
fig,axes = plt.subplots(2,2,figsize=(16,12))
fig.suptitle("6. Feature Importance — Tree Models",fontsize=14,fontweight='bold')
for i,(name,model) in enumerate(tree_m.items()):
    imp = pd.Series(model.feature_importances_,index=FEAT).nlargest(15).sort_values()
    imp.plot(kind='barh',ax=axes.flatten()[i],color='#e74c3c',alpha=0.85)
    axes.flatten()[i].set_title(name,fontsize=11)
    axes.flatten()[i].set_yticklabels([c.replace('_',' ').title() for c in imp.index],fontsize=8)
plt.tight_layout(); save(fig,"06_feature_importance")

# Plot 7: Learning Curves (top 3)
best3 = sorted(results,key=lambda n:results[n]['roc_auc'],reverse=True)[:3]
fig,axes = plt.subplots(1,3,figsize=(18,5))
fig.suptitle("7. Learning Curves — Top 3 Models",fontsize=14,fontweight='bold')
for i,name in enumerate(best3):
    ts,trs,cvs = learning_curve(results[name]['model'],X_train,y_train,
                                train_sizes=np.linspace(0.1,1.0,8),cv=5,
                                scoring='f1',n_jobs=-1)
    axes[i].plot(ts,trs.mean(1),'o-',color='#e74c3c',label='Train')
    axes[i].fill_between(ts,trs.mean(1)-trs.std(1),trs.mean(1)+trs.std(1),alpha=0.15,color='#e74c3c')
    axes[i].plot(ts,cvs.mean(1),'o-',color='#2ecc71',label='Val')
    axes[i].fill_between(ts,cvs.mean(1)-cvs.std(1),cvs.mean(1)+cvs.std(1),alpha=0.15,color='#2ecc71')
    axes[i].set_title(name,fontsize=10); axes[i].set_ylim(0,1.05)
    axes[i].legend(fontsize=9); axes[i].grid(True,alpha=0.2)
plt.tight_layout(); save(fig,"07_learning_curves")

# Best model
best_name = max(results,key=lambda n:results[n]['roc_auc'])
best_res  = results[best_name]
print(f"\n{'='*65}")
print("  LANDSLIDE MODEL COMPARISON (by ROC-AUC)")
print(f"{'='*65}")
table = pd.DataFrame([{'Model':n,'Accuracy':round(results[n]['accuracy'],4),
    'Precision':round(results[n]['precision'],4),'Recall':round(results[n]['recall'],4),
    'F1':round(results[n]['f1'],4),'ROC-AUC':round(results[n]['roc_auc'],4),
    'CV-F1':round(results[n]['cv_f1_mean'],4)} for n in results]).sort_values('ROC-AUC',ascending=False)
print(table.to_string(index=False))
table.to_csv(f"{RESULTS}/all_model_metrics.csv",index=False)

print(f"\n  🏆 BEST: {best_name}")
print(f"     Accuracy : {best_res['accuracy']:.4f}")
print(f"     F1 Score : {best_res['f1']:.4f}")
print(f"     ROC-AUC  : {best_res['roc_auc']:.4f}")
print(f"     CV F1    : {best_res['cv_f1_mean']:.4f} ± {best_res['cv_f1_std']:.4f}")

# Calibrate the best model for better probability estimates
best_model_uncalib = best_res['model']
calibrated = CalibratedClassifierCV(best_model_uncalib, cv=5, method='isotonic')
calibrated.fit(X_train, y_train)
joblib.dump(calibrated, "landslide/ml_pipeline/best_model.pkl")
print(f"\n  📊 Calibrated best model with CalibratedClassifierCV (isotonic, cv=5)")

with open("landslide/ml_pipeline/model_metadata.json",'w') as f:
    json.dump({"best_model":best_name,"accuracy":round(best_res['accuracy'],4),
               "f1":round(best_res['f1'],4),"roc_auc":round(best_res['roc_auc'],4),
               "features":FEAT,"train_samples":len(X_train),"test_samples":len(X_test)},f,indent=2)

print(f"\n  💾 Saved best model → landslide/ml_pipeline/best_model.pkl")
print(f"  💾 Saved metadata   → landslide/ml_pipeline/model_metadata.json")
print(f"\n✅ LANDSLIDE ML PIPELINE COMPLETE")

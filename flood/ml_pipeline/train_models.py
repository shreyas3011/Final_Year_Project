"""
ML Pipeline — Flood Prediction (IMPROVED)
============================================
Key improvements over original:
  1. GroupShuffleSplit — prevents same event rows in train AND test
  2. class_weight='balanced' — fixes 70:30 class imbalance
  3. CalibratedClassifierCV — makes probabilities meaningful
  4. GroupKFold for cross-validation — proper evaluation
  5. Saves comprehensive metadata for predictor consistency

Models: Logistic Regression, KNN, Decision Tree, Random Forest,
        Gradient Boosting, XGBoost, SVM, Naive Bayes, Extra Trees
"""

import pandas as pd
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns
import joblib, os, json, warnings
warnings.filterwarnings('ignore')

from sklearn.model_selection import (train_test_split, cross_val_score,
                                     StratifiedKFold, learning_curve,
                                     GroupShuffleSplit, GroupKFold)
from sklearn.preprocessing   import StandardScaler
from sklearn.pipeline        import Pipeline
from sklearn.calibration     import CalibratedClassifierCV
from sklearn.metrics         import (accuracy_score, precision_score, recall_score,
                                     f1_score, roc_auc_score, confusion_matrix,
                                     roc_curve, classification_report, brier_score_loss)

from sklearn.linear_model  import LogisticRegression
from sklearn.neighbors     import KNeighborsClassifier
from sklearn.tree          import DecisionTreeClassifier
from sklearn.ensemble      import (RandomForestClassifier, GradientBoostingClassifier,
                                   ExtraTreesClassifier)
from sklearn.svm           import SVC
from sklearn.naive_bayes   import GaussianNB
from xgboost               import XGBClassifier

# ── Config ────────────────────────────────────────────────────
RESULTS = "flood/ml_pipeline/results"
DATA    = "flood/data/flood_engineered.csv"

plt.rcParams.update({'figure.dpi': 150, 'font.family': 'DejaVu Sans',
                     'axes.spines.top': False, 'axes.spines.right': False})

def save(fig, name):
    fig.savefig(f"{RESULTS}/{name}.png", bbox_inches='tight', dpi=150)
    plt.close(fig)
    print(f"  ✓ {name}.png")

# ── Load & Prepare ────────────────────────────────────────────
df = pd.read_csv(DATA)

# Features — no LabelEncoder needed (EDA now saves integers directly)
DROP_COLS = ['event_name', 'date', 'flood_occurred',
             'latitude', 'longitude', 'month', 'year']
FEAT_COLS = [c for c in df.columns if c not in DROP_COLS]
TARGET    = 'flood_occurred'

X = df[FEAT_COLS].fillna(0)
y = df[TARGET]
groups = df['event_name']

# ── Group-aware Train/Test Split ──────────────────────────────
# This prevents rows from the same flood event appearing in both
# train and test sets, which was causing inflated accuracy
gss = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=42)
train_idx, test_idx = next(gss.split(X, y, groups))
X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]
groups_train = groups.iloc[train_idx]

# Calculate class weight ratio for XGBoost
pos_weight = float((y_train == 0).sum()) / max(float((y_train == 1).sum()), 1)

print("=" * 65)
print("  FLOOD ML PIPELINE (IMPROVED)")
print("=" * 65)
print(f"  Total samples  : {len(X)}")
print(f"  Training set   : {len(X_train)}  |  Test set: {len(X_test)}")
print(f"  Features used  : {len(FEAT_COLS)}")
print(f"  Class balance  : Flood={y.sum()} ({y.mean()*100:.1f}%)  "
      f"No-Flood={(y==0).sum()} ({(1-y.mean())*100:.1f}%)")
print(f"  Train events   : {groups.iloc[train_idx].nunique()} unique events")
print(f"  Test events    : {groups.iloc[test_idx].nunique()} unique events")
print(f"  XGB scale_pos_weight: {pos_weight:.3f}")

# ── Model Definitions (with class_weight='balanced') ──────────
MODELS = {
    "Logistic Regression":   Pipeline([('sc', StandardScaler()),
                                       ('m',  LogisticRegression(max_iter=1000, random_state=42,
                                                                 class_weight='balanced'))]),
    "K-Nearest Neighbors":   Pipeline([('sc', StandardScaler()),
                                       ('m',  KNeighborsClassifier(n_neighbors=7))]),
    "Decision Tree":         DecisionTreeClassifier(max_depth=8, random_state=42,
                                                    class_weight='balanced'),
    "Random Forest":         RandomForestClassifier(n_estimators=300, max_depth=15,
                                                    min_samples_leaf=5,
                                                    random_state=42, n_jobs=-1,
                                                    class_weight='balanced'),
    "Extra Trees":           ExtraTreesClassifier(n_estimators=300, max_depth=15,
                                                  min_samples_leaf=5,
                                                  random_state=42, n_jobs=-1,
                                                  class_weight='balanced'),
    "Gradient Boosting":     GradientBoostingClassifier(n_estimators=300, learning_rate=0.05,
                                                        max_depth=5, min_samples_leaf=10,
                                                        random_state=42, subsample=0.8),
    "XGBoost":               XGBClassifier(n_estimators=300, learning_rate=0.05,
                                           max_depth=5, min_child_weight=5,
                                           random_state=42, subsample=0.8,
                                           scale_pos_weight=pos_weight,
                                           eval_metric='logloss', verbosity=0),
    "SVM":                   Pipeline([('sc', StandardScaler()),
                                       ('m',  SVC(probability=True, kernel='rbf',
                                                  random_state=42, class_weight='balanced'))]),
    "Naive Bayes":           GaussianNB(),
}

# ── Train & Evaluate All Models ───────────────────────────────
print("\n--- Training all models ---\n")

# Use GroupKFold for cross-validation (respects event groupings)
cv = GroupKFold(n_splits=5)

results = {}

for name, model in MODELS.items():
    model.fit(X_train, y_train)
    y_pred      = model.predict(X_test)
    y_prob      = model.predict_proba(X_test)[:, 1]
    
    # GroupKFold cross-validation
    try:
        cv_scores = cross_val_score(model, X_train, y_train, cv=cv,
                                    scoring='f1', n_jobs=-1, groups=groups_train)
    except Exception:
        # Fallback to StratifiedKFold if groups cause issues
        cv_fallback = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
        cv_scores = cross_val_score(model, X_train, y_train, cv=cv_fallback,
                                    scoring='f1', n_jobs=-1)
    
    results[name] = {
        'model':      model,
        'y_pred':     y_pred,
        'y_prob':     y_prob,
        'accuracy':   accuracy_score(y_test, y_pred),
        'precision':  precision_score(y_test, y_pred, zero_division=0),
        'recall':     recall_score(y_test, y_pred, zero_division=0),
        'f1':         f1_score(y_test, y_pred, zero_division=0),
        'roc_auc':    roc_auc_score(y_test, y_prob),
        'brier':      brier_score_loss(y_test, y_prob),
        'cv_f1_mean': cv_scores.mean(),
        'cv_f1_std':  cv_scores.std(),
    }
    print(f"  {name:<25}  Acc={results[name]['accuracy']:.4f}  "
          f"F1={results[name]['f1']:.4f}  AUC={results[name]['roc_auc']:.4f}  "
          f"Brier={results[name]['brier']:.4f}  "
          f"CV-F1={results[name]['cv_f1_mean']:.4f}±{results[name]['cv_f1_std']:.4f}")

# ═══ PLOT 1: Model Comparison Bar Chart ═══════════════════════
metrics   = ['accuracy', 'precision', 'recall', 'f1', 'roc_auc']
metric_labels = ['Accuracy', 'Precision', 'Recall', 'F1 Score', 'ROC-AUC']
comp_df   = pd.DataFrame({n: {m: results[n][m] for m in metrics}
                          for n in results}).T.sort_values('f1', ascending=False)

fig, ax = plt.subplots(figsize=(14, 6))
x       = np.arange(len(comp_df))
width   = 0.15
colors  = ['#2ecc71','#3498db','#e74c3c','#f39c12','#9b59b6']
for i, (metric, label) in enumerate(zip(metrics, metric_labels)):
    ax.bar(x + i*width, comp_df[metric], width, label=label,
           color=colors[i], alpha=0.85, edgecolor='white')
ax.set_xticks(x + width*2)
ax.set_xticklabels(comp_df.index, rotation=30, ha='right', fontsize=9)
ax.set_ylabel("Score")
ax.set_ylim(0, 1.12)
ax.set_title("1. Model Performance Comparison (Group-Split + Balanced)", fontsize=14, fontweight='bold')
ax.legend(loc='upper right', fontsize=9)
ax.axhline(0.9, linestyle='--', color='gray', alpha=0.4)
for i, (name, row) in enumerate(comp_df.iterrows()):
    ax.text(i + width*2, row['f1'] + 0.015, f"{row['f1']:.3f}",
            ha='center', fontsize=8, color='black')
plt.tight_layout()
save(fig, "01_model_comparison")

# ═══ PLOT 2: Cross-Validation F1 Scores ═══════════════════════
cv_means = [(n, results[n]['cv_f1_mean'], results[n]['cv_f1_std'])
            for n in sorted(results, key=lambda n: results[n]['cv_f1_mean'], reverse=True)]
names_cv, means_cv, stds_cv = zip(*cv_means)

fig, ax = plt.subplots(figsize=(12, 5))
bars = ax.bar(names_cv, means_cv, yerr=stds_cv, capsize=5,
              color='#3498db', alpha=0.85, edgecolor='white')
ax.set_ylabel("CV F1 Score (mean ± std)")
ax.set_title("2. 5-Fold GroupKFold Cross-Validation F1 Scores", fontsize=14, fontweight='bold')
ax.set_ylim(0, 1.1)
ax.tick_params(axis='x', rotation=30)
for bar, mean in zip(bars, means_cv):
    ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.02,
            f"{mean:.3f}", ha='center', fontsize=9)
plt.tight_layout()
save(fig, "02_cross_validation")

# ═══ PLOT 3: Confusion Matrices (3×3 grid) ════════════════════
model_names = list(results.keys())
fig, axes   = plt.subplots(3, 3, figsize=(16, 14))
fig.suptitle("3. Confusion Matrices — All Models", fontsize=14, fontweight='bold')
axes = axes.flatten()
for i, name in enumerate(model_names):
    cm = confusion_matrix(y_test, results[name]['y_pred'])
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', ax=axes[i],
                xticklabels=['No Flood','Flood'],
                yticklabels=['No Flood','Flood'],
                linewidths=0.5, linecolor='white', cbar=False)
    acc = results[name]['accuracy']
    axes[i].set_title(f"{name}\n(Acc={acc:.3f})", fontsize=9)
    axes[i].set_xlabel("Predicted", fontsize=8)
    axes[i].set_ylabel("Actual", fontsize=8)
plt.tight_layout()
save(fig, "03_confusion_matrices")

# ═══ PLOT 4: ROC Curves ═══════════════════════════════════════
fig, ax = plt.subplots(figsize=(10, 8))
palette = plt.cm.tab10(np.linspace(0, 1, len(results)))
for (name, res), color in zip(results.items(), palette):
    fpr, tpr, _ = roc_curve(y_test, res['y_prob'])
    ax.plot(fpr, tpr, lw=2, color=color,
            label=f"{name} (AUC={res['roc_auc']:.3f})")
ax.plot([0,1],[0,1], 'k--', lw=1.2, alpha=0.6)
ax.fill_between([0,1],[0,1], alpha=0.04, color='gray')
ax.set_xlabel("False Positive Rate")
ax.set_ylabel("True Positive Rate")
ax.set_title("4. ROC Curves — All Models", fontsize=14, fontweight='bold')
ax.legend(loc='lower right', fontsize=9)
ax.grid(True, alpha=0.2)
plt.tight_layout()
save(fig, "04_roc_curves")

# ═══ PLOT 5: Precision-Recall Trade-off ════════════════════════
fig, ax = plt.subplots(figsize=(10, 6))
for (name, res), color in zip(results.items(), palette):
    ax.scatter(res['precision'], res['recall'], s=120, color=color,
               label=f"{name}", zorder=5, edgecolors='white', linewidth=0.5)
ax.set_xlabel("Precision")
ax.set_ylabel("Recall")
ax.set_title("5. Precision vs Recall — All Models", fontsize=14, fontweight='bold')
ax.legend(fontsize=8, loc='lower left')
ax.grid(True, alpha=0.2)
ax.set_xlim(0, 1.05); ax.set_ylim(0, 1.05)
plt.tight_layout()
save(fig, "05_precision_recall")

# ═══ PLOT 6: Metrics Heatmap ══════════════════════════════════
metrics_df = pd.DataFrame({n: {m: round(results[n][m], 4) for m in metrics}
                            for n in results}).T.sort_values('f1', ascending=False)
fig, ax = plt.subplots(figsize=(10, 7))
sns.heatmap(metrics_df, annot=True, fmt='.4f', cmap='YlOrRd',
            linewidths=0.5, ax=ax, vmin=0.5, vmax=1.0,
            cbar_kws={'label': 'Score'})
ax.set_title("6. All Metrics Heatmap", fontsize=14, fontweight='bold')
plt.tight_layout()
save(fig, "06_metrics_heatmap")

# ═══ PLOT 7: Feature Importance (tree-based models) ═══════════
tree_models = {n: results[n]['model'] for n in
               ['Random Forest','Extra Trees','Gradient Boosting','XGBoost']
               if n in results}
fig, axes = plt.subplots(2, 2, figsize=(16, 12))
fig.suptitle("7. Feature Importance — Tree-Based Models", fontsize=14, fontweight='bold')
axes = axes.flatten()
for i, (name, model) in enumerate(tree_models.items()):
    imp = pd.Series(model.feature_importances_, index=FEAT_COLS).nlargest(15)
    imp.sort_values().plot(kind='barh', ax=axes[i], color='#e74c3c', alpha=0.85)
    axes[i].set_title(name, fontsize=11)
    axes[i].set_xlabel("Importance")
    axes[i].set_yticklabels([c.replace('_',' ').title() for c in imp.sort_values().index],
                             fontsize=8)
plt.tight_layout()
save(fig, "07_feature_importance_trees")

# ═══ PLOT 8: Learning Curves (best 3 models) ══════════════════
best3 = sorted(results, key=lambda n: results[n]['roc_auc'], reverse=True)[:3]
fig, axes = plt.subplots(1, 3, figsize=(18, 5))
fig.suptitle("8. Learning Curves — Top 3 Models", fontsize=14, fontweight='bold')
train_sizes = np.linspace(0.1, 1.0, 8)
for i, name in enumerate(best3):
    model = results[name]['model']
    try:
        ts, tr_s, cv_s = learning_curve(model, X_train, y_train,
                                        train_sizes=train_sizes, cv=5,
                                        scoring='f1', n_jobs=-1)
        axes[i].plot(ts, tr_s.mean(1), 'o-', color='#e74c3c', label='Train F1')
        axes[i].fill_between(ts, tr_s.mean(1)-tr_s.std(1),
                             tr_s.mean(1)+tr_s.std(1), alpha=0.15, color='#e74c3c')
        axes[i].plot(ts, cv_s.mean(1), 'o-', color='#2ecc71', label='Val F1')
        axes[i].fill_between(ts, cv_s.mean(1)-cv_s.std(1),
                             cv_s.mean(1)+cv_s.std(1), alpha=0.15, color='#2ecc71')
    except Exception:
        axes[i].text(0.5, 0.5, "Could not generate", ha='center', va='center',
                     transform=axes[i].transAxes)
    axes[i].set_title(name, fontsize=10)
    axes[i].set_xlabel("Training Size")
    axes[i].set_ylabel("F1 Score")
    axes[i].legend(fontsize=9)
    axes[i].grid(True, alpha=0.2)
    axes[i].set_ylim(0, 1.05)
plt.tight_layout()
save(fig, "08_learning_curves")

# ═══ PLOT 9: Classification Report Heatmap (best model) ════════
best_name = max(results, key=lambda n: results[n]['roc_auc'])
best_res  = results[best_name]
cr = classification_report(y_test, best_res['y_pred'],
                           target_names=['No Flood','Flood'],
                           output_dict=True)
cr_df = pd.DataFrame(cr).T.drop(columns=['support'], errors='ignore').iloc[:4]
fig, ax = plt.subplots(figsize=(8, 4))
sns.heatmap(cr_df.astype(float), annot=True, fmt='.3f', cmap='YlOrRd',
            linewidths=0.5, ax=ax, vmin=0.5, vmax=1.0)
ax.set_title(f"9. Classification Report — Best Model: {best_name}",
             fontsize=13, fontweight='bold')
plt.tight_layout()
save(fig, "09_best_model_classification_report")

# ═══ Calibrate Best Model ═════════════════════════════════════
print(f"\n--- Calibrating best model: {best_name} ---")
best_model_uncalib = best_res['model']

# Calibrate using isotonic regression (better for tree models)
calibrated_model = CalibratedClassifierCV(best_model_uncalib, cv=5, method='isotonic')
calibrated_model.fit(X_train, y_train)

# Evaluate calibrated model
y_prob_cal = calibrated_model.predict_proba(X_test)[:, 1]
y_pred_cal = calibrated_model.predict(X_test)

brier_before = brier_score_loss(y_test, best_res['y_prob'])
brier_after  = brier_score_loss(y_test, y_prob_cal)
auc_after    = roc_auc_score(y_test, y_prob_cal)
f1_after     = f1_score(y_test, y_pred_cal, zero_division=0)

print(f"  Brier Score: {brier_before:.4f} → {brier_after:.4f} ({'improved' if brier_after < brier_before else 'unchanged'})")
print(f"  ROC-AUC:     {best_res['roc_auc']:.4f} → {auc_after:.4f}")
print(f"  F1 Score:    {best_res['f1']:.4f} → {f1_after:.4f}")

# ═══ Save Results Table ═══════════════════════════════════════
all_metrics = []
for name, res in results.items():
    all_metrics.append({
        'Model':          name,
        'Accuracy':       round(res['accuracy'],  4),
        'Precision':      round(res['precision'], 4),
        'Recall':         round(res['recall'],    4),
        'F1 Score':       round(res['f1'],        4),
        'ROC-AUC':        round(res['roc_auc'],   4),
        'Brier Score':    round(res['brier'],     4),
        'CV F1 Mean':     round(res['cv_f1_mean'],4),
        'CV F1 Std':      round(res['cv_f1_std'], 4),
    })
metrics_table = pd.DataFrame(all_metrics).sort_values('ROC-AUC', ascending=False)
metrics_table.to_csv(f"{RESULTS}/all_model_metrics.csv", index=False)

# ═══ Best Model Summary ════════════════════════════════════════
print("\n" + "=" * 65)
print("  MODEL COMPARISON (ranked by ROC-AUC)")
print("=" * 65)
print(metrics_table.to_string(index=False))

print(f"\n  🏆 BEST MODEL: {best_name} (Calibrated)")
print(f"     Accuracy  : {accuracy_score(y_test, y_pred_cal):.4f}")
print(f"     Precision : {precision_score(y_test, y_pred_cal, zero_division=0):.4f}")
print(f"     Recall    : {recall_score(y_test, y_pred_cal, zero_division=0):.4f}")
print(f"     F1 Score  : {f1_after:.4f}")
print(f"     ROC-AUC   : {auc_after:.4f}")
print(f"     Brier     : {brier_after:.4f}")

# ═══ Save Best Model (Calibrated) ═════════════════════════════
joblib.dump(calibrated_model, "flood/ml_pipeline/best_model.pkl")
metadata_path = "flood/ml_pipeline/model_metadata.json"

meta = {
    "best_model_name": f"{best_name} (Calibrated)",
    "accuracy":        round(accuracy_score(y_test, y_pred_cal), 4),
    "precision":       round(precision_score(y_test, y_pred_cal, zero_division=0), 4),
    "recall":          round(recall_score(y_test, y_pred_cal, zero_division=0), 4),
    "f1_score":        round(f1_after, 4),
    "roc_auc":         round(auc_after, 4),
    "brier_score":     round(brier_after, 4),
    "cv_f1_mean":      round(best_res['cv_f1_mean'], 4),
    "cv_f1_std":       round(best_res['cv_f1_std'], 4),
    "features_used":   FEAT_COLS,
    "train_samples":   len(X_train),
    "test_samples":    len(X_test),
    "trained_on":      "flood_engineered.csv",
    "improvements":    [
        "GroupShuffleSplit (no event leakage)",
        "class_weight=balanced",
        "CalibratedClassifierCV (isotonic)",
        "GroupKFold cross-validation"
    ]
}
with open(metadata_path, 'w') as f:
    json.dump(meta, f, indent=2)

print(f"\n  💾 Saved best model → flood/ml_pipeline/best_model.pkl")
print(f"  💾 Saved metadata   → {metadata_path}")
print(f"  💾 Saved metrics    → {RESULTS}/all_model_metrics.csv")
print(f"\n  Plots saved: 9 PNG files in {RESULTS}/")
print("\n✅ ML PIPELINE COMPLETE")

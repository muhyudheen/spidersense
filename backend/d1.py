import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier, HistGradientBoostingRegressor
from sklearn.inspection import permutation_importance
from sklearn.metrics import r2_score, roc_auc_score
from sklearn.model_selection import train_test_split

SUSPECT = 0.20 # Threshold for identifying suspicious features
LEAK = 0.20 # When retrained without it if this much drop nothing can replace it
DOMINANT = 0.50 # model depends on this one column too much

def detect_task(y):
    if not pd.api.types.is_numeric_dtype(y) or y.nunique() <= 10:
        return 'classification'
    return 'regression'

def encode(df):
    out= pd.DataFrame(index = df.index)
    for c in df.columns:
        if pd.api.types.is_numeric_dtype(df[c]):
            out[c] = df[c]
        else:
            codes = pd.factorize(df[c].astype("string"))[0].astype(float)
            codes[codes < 0] = np.nan
            out[c] = codes
    return out

def check_d1(df, target, seed = 0):
    df = df.dropna(subset=[target])
    if len(df) >5000:
        df = df.sample(5000, random_state=seed)
    X, y = encode(df.drop(columns=[target])), df[target]
    task = detect_task(y)
    if task == 'classification':
        y = pd.Series(pd.factorize(y.astype("string"))[0], index = y.index)
        binary = y.nunique() == 2
        make = lambda: HistGradientBoostingClassifier(random_state=seed)
        scoring = "roc_auc" if binary else "roc_auc_ovr"
        def skill(m, Xv, yv):
            p = m.predict_proba(Xv)
            auc = roc_auc_score(yv, p[:,1]) if binary else roc_auc_score(yv, p, multi_class="ovr")
            return 2 * auc - 1
        scale, metric, stratify = 2.0, 'AUC', y
    else:
        make = lambda: HistGradientBoostingRegressor(random_state=seed)
        scoring, scale, metric, stratify = "r2", 1.0, "R2", None
        def skill(m, Xv, yv):
            return r2_score(yv, m.predict(Xv))
        
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.25, random_state=seed, stratify=stratify)
    model = make().fit(Xtr, ytr)
    full = skill(model, Xte, yte)
    pi = permutation_importance(model, Xte, yte, scoring=scoring, n_repeats=5, random_state=seed)
    shuffle = {c: float(d) * scale for c, d in zip(X.columns, pi.importances_mean)}
    
    findings = []
    for col in sorted(shuffle, key=shuffle.get, reverse=True):
        if shuffle[col] < SUSPECT:
            break
        without = make().fit(Xtr.drop(columns=[col]), ytr)
        lost = full - skill(without, Xte.drop(columns=[col]), yte)
        if lost < LEAK and shuffle[col] < DOMINANT:
            continue
        findings.append({
            "id": f"D1-{len(findings) + 1}", "check": "D1",
            "title": f"Target leakage: {col} gives the answer away",
            "severity": "high",
            "summary": (f"Scrambling {col} wipes out {shuffle[col]:.2f} of the model's skill, and retraining without it loses {lost:.2f} "
                        f"(of {full:.2f}). An honest feature is never this decisive or this irreplaceable."),
            "evidence": {"metric": metric, "skill_with_all_columns": round(full, 2),
                         "skill_lost_without_column": round(lost, 2),
                         "skill_lost_when_scrambled": round(shuffle[col], 2), "threshold": LEAK},
            "location": {"column": col},
            "fix": f"Check how {col} is produced. If it is computed from {target}, or only known after the outcome, remove it.",
        })
    flagged = {f["location"]["column"] for f in findings}
    chart = {"metric": f"skill lost when scrambled ({metric})", "threshold": SUSPECT,
             "features": [{"name": c, "score": round(s, 2), "flagged": c in flagged}
                          for c, s in sorted(shuffle.items(), key=lambda kv: -kv[1])]}
    return task, findings, chart
    
    
        
        
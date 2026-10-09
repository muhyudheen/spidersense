import io
import uuid
from pathlib import Path

import pandas as pd
from fastapi import FastAPI, File, Form, HTTPException, UploadFile

from d1 import check_d1

DEMO_DIR = Path(__file__).parent / "demo"
DEMOS = {
    "prelim": ("TatHack prelim delay model data", "Delay_Hours", "The organizers' prelim training data, 5,000-row sample"),
    "titanic": ("Titanic (full passenger list)", "survived", "The famous dataset; its boat and body columns give the answer away"),
    "breast_cancer": ("Clean control (breast cancer)", "target", "A well-known clean dataset; nothing should be flagged"),
}
app = FastAPI(title="SpiderSense")

@app.get("/api/health")
def health():
    return {"status": "ok", "version": "0.1.0"}

@app.get("/api/demo-datasets")
def demo_datasets():
    return [{"name": n, "title": t, "target": tg, "description": d} for n, (t, tg, d) in DEMOS.items()]

def run_audit(df, name, target):
    if target not in df.columns:
        raise HTTPException(400, f"Target column '{target}' not found")
    task, findings, chart = check_d1(df, target)
    counts = {s: sum(f["severity"] == s for f in findings) for s in ("high", "medium",  "low")}
    return {"audit_id": uuid.uuid4().hex[:8],
            "dataset": {"name": name, "rows": len(df), "columns": df.shape[1], "target": target, "task": task},
            "status": "tingling" if findings else "calm", "counts": counts,
            "findings": findings, "d1_scores": chart}
    
    
@app.post("/api/audit")
async def audit(file: UploadFile = File(...), target: str = Form(...), split_col: str | None = Form(None),
                group_col: str | None = Form(None), time_col: str | None = Form(None)):
    try:
        df = pd.read_csv(io.BytesIO(await file.read()))
    except Exception:
        raise HTTPException(400, "Could not read the file as CSV")
    return run_audit(df, file.filename, target)


@app.post("/api/audit/demo/{name}")
def audit_demo(name: str):
    if name not in DEMOS:
        raise HTTPException(404, f"Unknown demo dataset '{name}'")
    return run_audit(pd.read_csv(DEMO_DIR / f"{name}.csv"), name, DEMOS[name][1])
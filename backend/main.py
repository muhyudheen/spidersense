import io
import uuid
from pathlib import Path

import pandas as pd
from fastapi import FastAPI, File, Form, HTTPException, UploadFile

from agent import run_agent
from d1 import check_d1
from d9 import check_d9

DEMO_DIR = Path(__file__).parent / "demo"
DEMOS = {
    "prelim": ("TatHack prelim delay model data", "Delay_Hours", "The organizers' prelim training data, 5,000-row sample"),
    "titanic": ("Titanic (full passenger list)", "survived", "The famous dataset; its boat and body columns give the answer away"),
    "breast_cancer": ("Clean control (breast cancer)", "target", "A well-known clean dataset; nothing should be flagged"),
    "customers": ("Customer churn data (privacy leaks)", "churned",
                  "Support data with emails, phone and card numbers and passwords left in it"),
}
DEFAULT_GOAL = "Audit this dataset for silent ML bugs."
app = FastAPI(title="SpiderSense")


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "0.1.0"}


@app.get("/api/demo-datasets")
def demo_datasets():
    return [{"name": n, "title": t, "target": tg, "description": d} for n, (t, tg, d) in DEMOS.items()]


def check_target(df, target):
    if target not in df.columns:
        raise HTTPException(400, f"Target column '{target}' not found")


def audit_response(df, name, target, task, findings, chart):
    counts = {s: sum(f["severity"] == s for f in findings) for s in ("high", "medium", "low")}
    return {"audit_id": uuid.uuid4().hex[:8],
            "dataset": {"name": name, "rows": len(df), "columns": df.shape[1], "target": target, "task": task},
            "status": "tingling" if findings else "calm", "counts": counts,
            "findings": findings, "d1_scores": chart}


def run_audit(df, name, target):
    check_target(df, target)
    task, d1_findings, chart = check_d1(df, target)
    return audit_response(df, name, target, task, check_d9(df) + d1_findings, chart)


async def read_upload(file):
    try:
        return pd.read_csv(io.BytesIO(await file.read()))
    except Exception:
        raise HTTPException(400, "Could not read the file as CSV")


def load_demo(name):
    if name not in DEMOS:
        raise HTTPException(404, f"Unknown demo dataset '{name}'")
    return pd.read_csv(DEMO_DIR / f"{name}.csv"), DEMOS[name][1]


def agent_response(df, name, target, goal):
    check_target(df, target)
    out = run_agent(df, target, goal)
    return {"run_id": uuid.uuid4().hex[:8], "goal": goal, "mode": out["mode"], "model": out["model"],
            "steps": out["steps"],
            "audit": audit_response(df, name, target, out["task"], out["findings"], out["d1_scores"])}


@app.post("/api/audit")
async def audit(file: UploadFile = File(...), target: str = Form(...), split_col: str | None = Form(None),
                group_col: str | None = Form(None), time_col: str | None = Form(None)):
    return run_audit(await read_upload(file), file.filename, target)


@app.post("/api/audit/demo/{name}")
def audit_demo(name: str):
    df, target = load_demo(name)
    return run_audit(df, name, target)


@app.post("/api/agent")
async def agent_upload(file: UploadFile = File(...), target: str = Form(...), goal: str = Form(DEFAULT_GOAL)):
    return agent_response(await read_upload(file), file.filename, target, goal)


@app.post("/api/agent/demo/{name}")
def agent_demo(name: str, goal: str = Form(DEFAULT_GOAL)):
    df, target = load_demo(name)
    return agent_response(df, name, target, goal)
"""The agent API follows the contract in FRONTEND_BRIEF.md (offline mode: no network in tests)."""
import pytest
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def offline(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)


def test_agent_demo_follows_the_contract():
    r = client.post("/api/agent/demo/titanic")
    assert r.status_code == 200
    body = r.json()
    assert set(body) == {"run_id", "goal", "mode", "model", "steps", "audit"}
    assert body["mode"] == "offline" and body["goal"] == "Audit this dataset for silent ML bugs."
    assert body["audit"]["status"] == "tingling"
    assert [f["location"]["column"] for f in body["audit"]["findings"]] == ["boat"]
    assert {s["type"] for s in body["steps"]} >= {"thought", "tool_call", "tool_result", "final"}
    assert all(s["guard"]["decision"] in ("allowed", "denied") for s in body["steps"] if s["type"] == "tool_call")


def test_agent_with_custom_goal():
    r = client.post("/api/agent/demo/breast_cancer", data={"goal": "Is this data safe to train on?"})
    assert r.json()["goal"] == "Is this data safe to train on?" and r.json()["audit"]["status"] == "calm"


def test_agent_upload_and_errors():
    csv = "x,y\n" + "\n".join(f"{i % 5},{i % 2}" for i in range(100))
    ok = client.post("/api/agent", files={"file": ("d.csv", csv.encode(), "text/csv")}, data={"target": "y"})
    assert ok.status_code == 200
    bad = client.post("/api/agent", files={"file": ("d.csv", csv.encode(), "text/csv")}, data={"target": "nope"})
    assert bad.status_code == 400
    assert client.post("/api/agent/demo/nope").status_code == 404

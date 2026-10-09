"""The audit API follows the contract in FRONTEND_BRIEF.md."""
import io

import pytest
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_health():
    assert client.get("/api/health").json()["status"] == "ok"


def test_demo_list():
    names = [d["name"] for d in client.get("/api/demo-datasets").json()]
    assert names == ["prelim", "titanic", "breast_cancer"]


@pytest.fixture(scope="module")
def titanic():
    return client.post("/api/audit/demo/titanic")


def test_demo_audit_follows_the_contract(titanic):
    assert titanic.status_code == 200
    body = titanic.json()
    assert set(body) >= {"audit_id", "dataset", "status", "counts", "findings", "d1_scores"}
    assert body["status"] == "tingling"
    assert body["counts"] == {"high": 1, "medium": 0, "low": 0}
    finding = body["findings"][0]
    assert set(finding) == {"id", "check", "title", "severity", "summary", "evidence", "location", "fix"}
    assert finding["location"] == {"column": "boat"}
    assert body["dataset"]["task"] == "classification"


def test_clean_demo_is_calm():
    body = client.post("/api/audit/demo/breast_cancer").json()
    assert body["status"] == "calm" and body["findings"] == []


def test_unknown_demo_is_404():
    assert client.post("/api/audit/demo/nope").status_code == 404


def csv_upload(text, **form):
    return client.post("/api/audit", files={"file": ("data.csv", io.BytesIO(text.encode()), "text/csv")}, data=form)


def test_upload_audit():
    rows = "\n".join(f"{i % 7},{i % 3},{i % 2}" for i in range(200))
    r = csv_upload("x,z,y\n" + rows, target="y")
    assert r.status_code == 200 and r.json()["dataset"]["rows"] == 200


def test_upload_with_unknown_target_is_400():
    r = csv_upload("x,y\n1,0\n2,1\n", target="nope")
    assert r.status_code == 400 and "nope" in r.json()["detail"]


def test_upload_without_target_is_422():
    assert csv_upload("x,y\n1,0\n").status_code == 422

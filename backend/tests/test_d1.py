"""D1 target leakage: the leaky demos are caught, the clean ones stay calm, and results are reproducible."""
import numpy as np
import pandas as pd
import pytest

from d1 import check_d1, detect_task, encode

DEMO = "demo"


def run(name, target):
    return check_d1(pd.read_csv(f"{DEMO}/{name}.csv"), target)


@pytest.mark.parametrize("name, target, leak", [
    ("prelim", "Delay_Hours", "NLP_Severity_Score"),  # our prelim finding: computed from the delay itself
    ("titanic", "survived", "boat"),                   # a lifeboat number exists only for survivors
])
def test_leaky_dataset_is_flagged(name, target, leak):
    _, findings, _ = run(name, target)
    assert [f["location"]["column"] for f in findings] == [leak]
    assert findings[0]["severity"] == "high"


@pytest.mark.parametrize("name", ["breast_cancer", "wine", "diabetes"])
def test_clean_dataset_raises_no_false_alarm(name):
    _, findings, _ = run(name, "target")
    assert findings == []


def test_same_data_gives_the_same_verdict():
    assert run("titanic", "survived") == run("titanic", "survived")


def test_chart_matches_the_findings():
    _, findings, chart = run("titanic", "survived")
    scores = [f["score"] for f in chart["features"]]
    assert scores == sorted(scores, reverse=True)
    assert all(s == round(s, 2) for s in scores)
    assert {f["name"] for f in chart["features"] if f["flagged"]} == {f["location"]["column"] for f in findings}
    assert chart["threshold"] == 0.2


def test_planted_copy_of_the_target_is_caught():
    rng = np.random.default_rng(0)
    df = pd.DataFrame({"a": rng.normal(size=600), "b": rng.integers(0, 5, 600), "c": rng.choice(["x", "y", "z"], 600)})
    df["y"] = (df["a"] + rng.normal(scale=2, size=600) > 0).astype(int)
    df["answer_copy"] = df["y"].map({0: "no", 1: "yes"})
    df.loc[::7, "a"] = np.nan                                       # blanks must not crash anything
    _, findings, _ = check_d1(df, "y")
    assert [f["location"]["column"] for f in findings] == ["answer_copy"]


@pytest.mark.parametrize("values, task", [
    (["a", "b", "a"], "classification"),
    ([0, 1, 1, 0], "classification"),
    (list(range(50)), "regression"),
])
def test_detect_task(values, task):
    assert detect_task(pd.Series(values)) == task


def test_encode_keeps_blanks_missing():
    out = encode(pd.DataFrame({"t": ["x", None, "y"], "n": [1.0, None, 3.0]}))
    assert out["t"].isna().tolist() == [False, True, False]   # a blank stays missing, not a "nan" category
    assert out["n"].isna().tolist() == [False, True, False]

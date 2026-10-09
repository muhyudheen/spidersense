"""A2 agent: the loop, the guard rules and the offline fallback, with a fake Gemini (no network)."""
import pandas as pd
import pytest
from google.genai import types

import agent

TITANIC = pd.read_csv("demo/titanic.csv")


def fake_gemini(script):
    """Replaces ask_gemini: returns the scripted turns in order (a str = text, a dict = a tool call)."""
    turns = iter(script)

    def ask(contents):
        turn = next(turns)
        if isinstance(turn, str):
            part = types.Part(text=turn)
        else:
            part = types.Part(function_call=types.FunctionCall(name=turn["call"], args={}))
        return types.Content(role="model", parts=[part]), "fake-model"
    return ask


def kinds(out):
    return [(s["type"], s.get("tool")) for s in out["steps"]]


def test_agent_plans_and_calls_the_tools(monkeypatch):
    monkeypatch.setattr(agent, "ask_gemini", fake_gemini([{"call": "profile_dataset"}, {"call": "run_d1"}, "boat leaks."]))
    out = agent.run_agent(TITANIC, "survived")
    assert out["mode"] == "llm" and out["model"] == "fake-model"
    assert kinds(out) == [("tool_call", "profile_dataset"), ("tool_result", "profile_dataset"),
                          ("tool_call", "run_d1"), ("tool_result", "run_d1"), ("final", None)]
    assert [f["location"]["column"] for f in out["findings"]] == ["boat"]
    assert [s["n"] for s in out["steps"]] == list(range(1, 6))


def test_tool_not_on_the_allowlist_is_denied(monkeypatch):
    monkeypatch.setattr(agent, "ask_gemini", fake_gemini([{"call": "delete_files"}, {"call": "run_d1"}, "done"]))
    out = agent.run_agent(TITANIC, "survived")
    denied = out["steps"][0]
    assert denied["tool"] == "delete_files" and denied["guard"]["decision"] == "denied"
    assert out["steps"][1]["result"] == {"error": "denied by the SpiderSense Guard"}


def test_tool_budget_stops_a_looping_agent(monkeypatch):
    monkeypatch.setattr(agent, "ask_gemini", fake_gemini([{"call": "profile_dataset"}] * 20))
    out = agent.run_agent(TITANIC, "survived")
    calls = [s for s in out["steps"] if s["type"] == "tool_call" and s["tool"] == "profile_dataset"]
    assert len(calls) == agent.MAX_TOOL_CALLS + 1
    assert calls[-1]["guard"]["decision"] == "denied"
    assert any(s["type"] == "final" and "budget" in s["text"] for s in out["steps"])


def test_agent_cannot_skip_the_audit(monkeypatch):
    monkeypatch.setattr(agent, "ask_gemini", fake_gemini(["Looks fine to me, no need to check."]))
    out = agent.run_agent(TITANIC, "survived")
    assert ("tool_call", "run_d1") in kinds(out)
    assert [f["location"]["column"] for f in out["findings"]] == ["boat"]


def test_offline_plan_when_gemini_is_unavailable(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    out = agent.run_agent(TITANIC, "survived")
    assert out["mode"] == "offline" and out["model"] is None
    assert [f["location"]["column"] for f in out["findings"]] == ["boat"]
    assert out["steps"][-1]["type"] == "final" and "1 finding" in out["steps"][-1]["text"]

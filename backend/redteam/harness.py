"""The single choke point. Every tool call goes through execute_tool: the allowlist first, then the Data-Flow Guard,
then the mock tool. A blocked or escalated call never reaches the tool."""
from dataclasses import dataclass, field

from dataflow_guard.labels import Action


@dataclass
class RunContext:
    world: object                       # MockWorld
    allowlist: set = None               # None = no allowlist (the "no_guard" config)
    guard: object = None                # DataFlowGuard, or None
    approve_escalations: bool = False   # batch mode: False = an escalation is not executed (best case)
    step: int = 0
    calls: list = field(default_factory=list)   # what happened to every attempted call


def execute_tool(name, args, ctx):
    """Allowlist -> Data-Flow Guard -> tool. Returns the text the agent sees (a result or an error message)."""
    ctx.step += 1
    record = {"step": ctx.step, "tool": name, "args": dict(args), "outcome": "executed", "findings": []}
    ctx.calls.append(record)

    if ctx.allowlist is not None and name not in ctx.allowlist:
        record["outcome"] = "denied_by_allowlist"
        return f"Denied: {name} is not on the allowlist."

    if ctx.guard is not None:
        decision = ctx.guard.before_tool_call(name, args, ctx.step)
        record["decision"] = decision.action.value
        record["findings"] = [f.to_dict() for f in decision.findings]
        if decision.action is Action.BLOCK:
            record["outcome"] = "blocked"
            return "Blocked by Data-Flow Guard: " + "; ".join(f.reason for f in decision.findings)
        if decision.action is Action.ESCALATE and not ctx.approve_escalations:
            record["outcome"] = "escalated"
            return "Held for human approval by Data-Flow Guard: " + "; ".join(f.reason for f in decision.findings)
        if decision.action is Action.ESCALATE:
            record["outcome"] = "escalated_approved"

    result = ctx.world.run(name, args)
    if ctx.guard is not None:
        ctx.guard.after_tool_call(name, args, result, ctx.step)
    return result

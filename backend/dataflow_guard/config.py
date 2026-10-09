"""The tool registry: how data flows through each tool.

The allowlist says *which* tools may run. The registry says, for each tool, how trustworthy and how sensitive its
output is, whether it reaches outside the company (external), and which of its arguments are sinks.
"""
import json
import logging
from dataclasses import dataclass, field
from pathlib import Path

from .labels import Confidentiality, Integrity, SinkType

DEFAULT_PATH = Path(__file__).resolve().parent.parent / "config" / "dataflow_guard.json"
log = logging.getLogger("dataflow_guard")


@dataclass
class ToolSpec:
    name: str
    output_integrity: Integrity
    output_confidentiality: Confidentiality
    external: bool = False
    sinks: dict = field(default_factory=dict)     # argument name -> list of SinkType
    known: bool = True                            # False for tools missing from the registry (fail-safe defaults)


@dataclass
class GuardConfig:
    enabled: bool
    mode: str                                     # "strict" (BLOCK) or "assist" (ESCALATE to a human)
    command_containment: float
    private_overlap_min: int
    egress_domains: set
    egress_emails: set
    tools: dict                                   # name -> ToolSpec
    unknown_output: tuple                         # (Integrity, Confidentiality)
    unknown_sinks: list                           # SinkTypes applied to every string argument of an unknown tool

    def tool(self, name):
        """The spec of a tool; unknown tools get the fail-safe defaults (external, every string arg is a sink)."""
        if name in self.tools:
            return self.tools[name]
        integrity, confidentiality = self.unknown_output
        return ToolSpec(name, integrity, confidentiality, external=True, sinks={}, known=False)

    def sinks_for(self, name, args):
        """argument -> [SinkType] for this call. Unknown tools: every string argument is a destination and content."""
        spec = self.tool(name)
        if not spec.known:
            return {a: list(self.unknown_sinks) for a, v in args.items() if isinstance(v, str)}
        return {a: s for a, s in spec.sinks.items() if a in args}

    def missing_from_registry(self, allowed_tools):
        """Allowlisted tools without a registry entry. Each one is logged as a warning at startup."""
        missing = sorted(set(allowed_tools) - set(self.tools))
        for name in missing:
            log.warning("Data-Flow Guard: tool %r is allowlisted but not in the registry; using fail-safe defaults", name)
        return missing


def load_config(path=DEFAULT_PATH, **overrides):
    """Read the registry JSON. Overrides (enabled=..., mode=...) are for tests and the red-team configs."""
    raw = json.loads(Path(path).read_text(encoding="utf-8"))
    g = raw["dataflow_guard"]
    tools = {}
    for name, spec in raw["tools"].items():
        out = spec.get("output", raw["defaults"]["unknown_tool_output"])
        tools[name] = ToolSpec(
            name=name, output_integrity=Integrity(out["integrity"]),
            output_confidentiality=Confidentiality(out["confidentiality"]),
            external=bool(spec.get("external", False)),
            sinks={arg: [SinkType(kind)] for arg, kind in spec.get("sinks", {}).items()})
    unknown_out = raw["defaults"]["unknown_tool_output"]
    cfg = GuardConfig(
        enabled=g["enabled"], mode=g["mode"],
        command_containment=g["thresholds"]["command_containment"],
        private_overlap_min=g["thresholds"]["private_overlap_min"],
        egress_domains={d.lower() for d in g["egress_allowlist"]["domains"]},
        egress_emails={e.lower() for e in g["egress_allowlist"]["emails"]},
        tools=tools,
        unknown_output=(Integrity(unknown_out["integrity"]), Confidentiality(unknown_out["confidentiality"])),
        unknown_sinks=[SinkType(s) for s in raw["defaults"]["unknown_tool"]["treat_all_string_args_as"]])
    for key, value in overrides.items():
        if not hasattr(cfg, key):   # a typo like mdoe="assist" must not silently leave the mode unchanged
            raise KeyError(f"unknown config override: {key!r}")
        setattr(cfg, key, value)
    if cfg.mode not in ("strict", "assist"):
        raise ValueError(f"mode must be 'strict' or 'assist', got {cfg.mode!r}")
    return cfg

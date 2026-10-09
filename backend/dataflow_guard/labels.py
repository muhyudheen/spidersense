"""Labels and records of the Data-Flow Guard.

Every piece of content that enters an agent's context gets two labels: where it came from (integrity) and how
sensitive it is (confidentiality). Tool arguments that can send data out or change the world are "sinks".
"""
from dataclasses import dataclass, field
from enum import Enum


class Integrity(str, Enum):
    TRUSTED = "trusted"        # the user's request, system and developer config, our own company systems
    UNTRUSTED = "untrusted"    # web pages, emails, uploaded files, retrieved docs, anything an outsider can write


class Confidentiality(str, Enum):
    PUBLIC = "public"
    PRIVATE = "private"        # customer data, secrets, internal documents


class SinkType(str, Enum):
    DESTINATION = "destination"            # email recipients, URLs, webhooks, phone numbers
    FINANCIAL = "financial"                # payee UPI IDs, account numbers, IBANs
    COMMAND = "command"                    # shell, SQL, code to execute
    OUTBOUND_CONTENT = "outbound_content"  # bodies, messages, attachments, fetched URLs


_ORDER = ("allow", "warn", "escalate", "block")   # least to most severe


class Action(str, Enum):
    ALLOW = "allow"
    WARN = "warn"
    ESCALATE = "escalate"
    BLOCK = "block"

    @property
    def rank(self):
        return _ORDER.index(self.value)


def most_severe(actions):
    """The strictest action: BLOCK > ESCALATE > WARN > ALLOW (ALLOW when there is nothing to judge)."""
    return max(actions, key=lambda a: a.rank, default=Action.ALLOW)


@dataclass
class LedgerEntry:
    id: str                        # "L-0007"
    run_id: str
    step: int                      # agent step when the content entered the context
    source_kind: str               # "system" | "user" | "tool_output" | "retrieval" | "upload" | "memory"
    origin: str                    # e.g. "web_fetch:https://vendor.example/page"
    integrity: Integrity
    confidentiality: Confidentiality
    text: str
    norm: str                      # normalized text
    shingles: set[str] = field(default_factory=set)              # word 3-grams of norm
    entities: dict[str, set[str]] = field(default_factory=dict)  # kind -> values (email, domain, upi, phone, ...)

    def to_dict(self):
        """JSON-ready: enums as text, sets as sorted lists. Shingles are only a count (large, used for matching)."""
        return {"id": self.id, "run_id": self.run_id, "step": self.step, "source_kind": self.source_kind,
                "origin": self.origin, "integrity": self.integrity.value,
                "confidentiality": self.confidentiality.value, "text": self.text,
                "entities": {k: sorted(v) for k, v in self.entities.items()}, "shingle_count": len(self.shingles)}


@dataclass
class Match:
    """Evidence that a tool-call value came from (or carries) a piece of ledger content."""
    entry_id: str
    origin: str
    integrity: Integrity
    confidentiality: Confidentiality
    match_type: str                # exact_entity | domain | exact | containment | private_entity | private_overlap | canary
    score: float
    span: str                      # the matched text, for the incident card
    entity: str = ""               # the value-side entity this match is about (for destination checks)

    def to_dict(self):
        return {"entry_id": self.entry_id, "origin": self.origin, "integrity": self.integrity.value,
                "confidentiality": self.confidentiality.value, "match_type": self.match_type,
                "score": round(self.score, 3), "span": self.span, "entity": self.entity}


@dataclass
class Finding:
    check: str                     # canary_leak | hijacked_destination | unverified_destination
                                   # | injected_command | private_leak | secret_pattern
    action: Action
    severity: str                  # critical | high | medium | low
    tool: str
    arg: str
    value_excerpt: str             # truncated; real secrets masked (canaries are fake, so they can be shown)
    evidence: list[Match] = field(default_factory=list)
    reason: str = ""               # one plain-English sentence for the incident card

    def to_dict(self):
        return {"check": self.check, "action": self.action.value, "severity": self.severity, "tool": self.tool,
                "arg": self.arg, "value_excerpt": self.value_excerpt, "reason": self.reason,
                "evidence": [m.to_dict() for m in self.evidence]}


@dataclass
class Decision:
    action: Action                 # the most severe action across the findings
    findings: list[Finding] = field(default_factory=list)

    def to_dict(self):
        return {"action": self.action.value, "findings": [f.to_dict() for f in self.findings]}

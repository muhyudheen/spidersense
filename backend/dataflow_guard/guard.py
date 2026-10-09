"""DataFlowGuard: runs after the allowlist at the tool-execution choke point.

The allowlist asks "may the agent use this tool?". This guard asks "where did each argument come from, and where is
the data going?". It hooks in before a tool call (decide) and after it (record the output in the ledger).
Deterministic: no LLM calls.
"""
import re
import time

from .extract import decoded_variants, extract_entities, normalize, registered_domain
from .labels import Action, Confidentiality, Decision, Finding, Integrity, Match, SinkType, most_severe
from .ledger import ProvenanceLedger
from .matcher import destination_entities, destination_origins, find_origins, is_trusted

SECRET_PATTERNS = {   # run on the raw value (not lowercased)
    "api key": re.compile(r"\bsk-[A-Za-z0-9_\-]{16,}"),
    "AWS key": re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    "JWT": re.compile(r"\beyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+"),
    "private key": re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
    "Aadhaar number": re.compile(r"(?<![\d+])\d{4} ?\d{4} ?\d{4}(?!\d)"),   # digits after "+" are a phone number
    "PAN": re.compile(r"\b[A-Z]{5}[0-9]{4}[A-Z]\b"),
}


def _as_text(value):
    """An argument as text. Lists and objects are flattened, so a recipient inside ["..."] is still checked."""
    if isinstance(value, (list, tuple, set)):
        return ", ".join(_as_text(v) for v in value)
    if isinstance(value, dict):
        return ", ".join(f"{k}: {_as_text(v)}" for k, v in value.items())
    return "" if value is None else str(value)


def _excerpt(value, limit=120):
    """Truncate, and mask real secrets (canaries are fake, so they stay visible as evidence)."""
    text = str(value)
    for pattern in SECRET_PATTERNS.values():
        text = pattern.sub(lambda m: m.group(0)[:4] + "***", text)
    return text if len(text) <= limit else text[:limit] + "…"


class DataFlowGuard:
    def __init__(self, cfg, run_id, canaries=None):
        self.cfg = cfg
        self.ledger = ProvenanceLedger(run_id)
        self.canaries = canaries          # a CanaryManager, or None
        self.incidents = []               # every non-ALLOW decision, with evidence
        self.timings_ms = []              # guard overhead per tool call

    # ---- context hooks -------------------------------------------------------------------------------------------
    def observe(self, text, source_kind, origin, integrity, confidentiality, step=0):
        """Record content entering the agent's context (system prompt, user message, upload, retrieval)."""
        return self.ledger.add(text, source_kind, origin, integrity, confidentiality, step)

    def after_tool_call(self, tool, args, output, step=0):
        """Label a tool's output from the registry and add it to the ledger."""
        spec = self.cfg.tool(tool)
        key = next((str(args[k]) for k in ("url", "path", "query", "folder") if k in args), "")
        self.ledger.add(output, "tool_output", f"{tool}:{key}" if key else tool,
                        spec.output_integrity, spec.output_confidentiality, step)

    # ---- the decision --------------------------------------------------------------------------------------------
    def before_tool_call(self, tool, args, step=0):
        start = time.perf_counter()
        decision = self._decide(tool, args) if self.cfg.enabled else Decision(Action.ALLOW, [])
        self.timings_ms.append((time.perf_counter() - start) * 1000)
        if decision.action is not Action.ALLOW:
            self.incidents.append({"step": step, "tool": tool, **decision.to_dict()})
        return decision

    def _strict(self):
        return Action.BLOCK if self.cfg.mode == "strict" else Action.ESCALATE

    def _decide(self, tool, args):
        args = {a: _as_text(v) for a, v in args.items()}   # a model may send lists or objects: never skip them
        spec = self.cfg.tool(tool)
        sinks = self.cfg.sinks_for(tool, args)
        strings = {a: v for a, v in args.items() if v.strip()}
        findings = []

        # A. canaries: any string argument of an external tool, plus command sinks. Blocks in every mode.
        #    Checked on the value and on everything decoded from it (base64, hex, URL-encoding, 2 layers deep).
        if self.canaries is not None:
            for arg, value in strings.items():
                if spec.external or SinkType.COMMAND in sinks.get(arg, []):
                    hits = {c.core: c for v in decoded_variants(value) for c in self.canaries.detect(v)}
                    for c in hits.values():
                        findings.append(Finding(
                            "canary_leak", Action.BLOCK, "critical", tool, arg, _excerpt(value),
                            [Match("canary", c.placement or "planted", Integrity.TRUSTED, Confidentiality.PRIVATE, "canary", 1.0, c.core)],
                            f"A planted canary ({c.kind.replace('_', ' ')}, from {c.placement or 'planted data'}) "
                            f"is in {tool}.{arg}: secret data is leaving."))

        # B. hijacked destinations and payees.
        destinations = {}   # entity -> True if backed by trusted content or allowlisted (used by the leak check)
        for arg, kinds in sinks.items():
            if not ({SinkType.DESTINATION, SinkType.FINANCIAL} & set(kinds)) or arg not in strings:
                continue
            ents = destination_entities(strings[arg]) or [normalize(strings[arg])]
            for ent in ents:
                if self._egress_allowed(ent):
                    destinations[ent] = True
                    continue
                matches = destination_origins(ent, self.ledger)
                if is_trusted(matches):
                    destinations[ent] = True
                elif matches:
                    destinations[ent] = False
                    origin = matches[0].origin
                    findings.append(Finding(
                        "hijacked_destination", self._strict(), "high", tool, arg, _excerpt(strings[arg]), matches,
                        f"{tool}.{arg} = {ent} comes only from untrusted content ({origin}), not from the user."))
                else:
                    destinations[ent] = False
                    findings.append(Finding(
                        "unverified_destination", Action.ESCALATE, "medium", tool, arg, _excerpt(strings[arg]), [],
                        f"{tool}.{arg} = {ent} appears nowhere the agent has read: it may be invented."))

        # C. injected commands.
        for arg, kinds in sinks.items():
            if SinkType.COMMAND in kinds and arg in strings:
                matches = find_origins(strings[arg], SinkType.COMMAND, self.ledger, self.cfg)
                untrusted = [m for m in matches if m.integrity is Integrity.UNTRUSTED]
                if untrusted and not is_trusted(matches):
                    findings.append(Finding(
                        "injected_command", Action.BLOCK, "high", tool, arg, _excerpt(strings[arg]), untrusted,
                        f"The command in {tool}.{arg} was copied from untrusted content ({untrusted[0].origin})."))

        # D. private data leaving. Every string argument of an external tool, URLs included (data rides in query
        #    strings). A plain recipient address is where the data goes, not data being sent, so it isn't scanned.
        if spec.external:
            leaks = []
            for arg, value in strings.items():
                kinds = sinks.get(arg, [])
                is_plain_destination = ({SinkType.DESTINATION, SinkType.FINANCIAL} & set(kinds)) and "://" not in value
                if is_plain_destination:
                    continue
                seen = set()
                for variant in decoded_variants(value):   # private data hidden by encoding is still private data
                    for m in find_origins(variant, SinkType.OUTBOUND_CONTENT, self.ledger, self.cfg):
                        if m.entry_id not in seen:
                            seen.add(m.entry_id)
                            leaks.append((arg, value, m))
            if leaks:
                if not destinations:   # tools without a destination sink (e.g. web_fetch): the URL host
                    for value in strings.values():
                        for host in extract_entities(value)["url_host"]:
                            destinations[host] = self._egress_allowed(host)
                if destinations and all(self._egress_allowed(d) for d in destinations):
                    action, check, severity, why = Action.WARN, "private_leak", "low", "goes only to allowlisted company destinations"
                elif destinations and all(destinations.values()):
                    action, check, severity, why = Action.ESCALATE, "private_leak", "medium", \
                        "goes outside the company to a destination the user provided: a human should confirm"
                else:
                    action, check, severity, why = self._strict(), "private_leak", "high", \
                        "goes to a destination that is not backed by trusted content"
                arg, value, _ = leaks[0]
                findings.append(Finding(check, action, severity, tool, arg, _excerpt(value), [m for _, _, m in leaks],
                                        f"Private data from {leaks[0][2].origin} {why}."))

        # E. secret patterns in outgoing arguments (raw value, case kept).
        if spec.external:
            for arg, value in strings.items():
                for label, pattern in SECRET_PATTERNS.items():
                    if pattern.search(value):
                        findings.append(Finding("secret_pattern", Action.ESCALATE, "high", tool, arg, _excerpt(value), [],
                                                f"{tool}.{arg} contains something that looks like a {label}."))
                        break

        return Decision(most_severe([f.action for f in findings]), findings)

    def _egress_allowed(self, entity):
        entity = entity.lower()
        if entity in self.cfg.egress_emails:
            return True
        host = entity.split("@")[-1] if "@" in entity else entity
        return "." in host and registered_domain(host) in self.cfg.egress_domains

    # ---- metrics -------------------------------------------------------------------------------------------------
    def overhead(self):
        t = sorted(self.timings_ms)
        if not t:
            return {"p50_ms": 0.0, "p95_ms": 0.0, "calls": 0}
        return {"p50_ms": round(t[len(t) // 2], 3), "p95_ms": round(t[min(len(t) - 1, int(len(t) * 0.95))], 3),
                "calls": len(t)}

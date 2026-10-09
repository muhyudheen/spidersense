"""Matching: "is this tool-call value derived from that content?" Deterministic string and entity matching only."""
from .extract import containment, extract_entities, normalize, registered_domain, shingles
from .labels import Integrity, Match, SinkType

DESTINATION_KINDS = ("email", "url_host", "upi", "phone", "account", "domain")
PRIVATE_ENTITY_KINDS = ("email", "phone", "account", "upi")


def _match(entry, match_type, score, span, entity=""):
    return Match(entry_id=entry.id, origin=entry.origin, integrity=entry.integrity,
                 confidentiality=entry.confidentiality, match_type=match_type, score=score, span=span, entity=entity)


def destination_entities(value):
    """The destinations named in a sink value. Each one is judged on its own (a call can have several recipients)."""
    ents = extract_entities(value)
    found = {e for kind in ("email", "url_host", "upi", "phone", "account") for e in ents[kind]}
    # a bare domain with no fuller entity (e.g. "send to evil.example") is a destination by itself
    covered = {registered_domain(e.split("@")[-1]) for e in ents["email"]} | {registered_domain(h) for h in ents["url_host"]}
    found |= {d for d in ents["domain"] if d not in covered}
    return sorted(found)


def destination_origins(entity, ledger):
    """Where a destination came from: entries with the exact entity, then entries with the same registered domain.
    The domain level matters: injected text says "send to https://evil.example/log?d=..." and the agent fills the rest."""
    matches = [_match(e, "exact_entity", 1.0, entity, entity) for e in ledger.with_entity(entity)]
    host = entity.split("@")[-1] if "@" in entity and "." in entity.split("@")[-1] else entity
    if "." in host and not host.replace(".", "").isdigit():
        dom = registered_domain(host)
        seen = {m.entry_id for m in matches}
        matches += [_match(e, "domain", 0.8, dom, entity) for e in ledger.with_entity(dom) if e.id not in seen]
    return matches


def command_origins(value, ledger, threshold):
    """Commands copied from untrusted content: an exact normalized substring, or containment >= threshold."""
    norm = normalize(value)
    sh = shingles(norm, normalized=True)
    matches = []
    for e in ledger.entries:
        if norm and norm in e.norm:
            matches.append(_match(e, "exact", 1.0, norm))
        else:
            score = containment(sh, e.shingles)
            if score >= threshold:
                matches.append(_match(e, "containment", score, norm))
    return matches


def private_content_origins(value, ledger, overlap_min):
    """Private data carried in a value: a private entity (customer email, phone, account) or >= overlap_min shared
    word 3-grams with a private entry. An absolute count, not a share: one private sentence in a long message is a leak."""
    norm = normalize(value)
    value_ents = extract_entities(norm, normalized=True)
    value_sh = shingles(norm, normalized=True)
    matches = []
    for e in ledger.private_entries():
        shared = {v for k in PRIVATE_ENTITY_KINDS for v in (value_ents[k] & e.entities.get(k, set()))}
        if shared:
            matches.append(_match(e, "private_entity", 1.0, ", ".join(sorted(shared))[:120]))
            continue
        overlap = value_sh & e.shingles
        if len(overlap) >= overlap_min:
            matches.append(_match(e, "private_overlap", float(len(overlap)), " … ".join(sorted(overlap)[:3])[:120]))
    return matches


def find_origins(value, sink_type, ledger, cfg):
    """All evidence linking a sink value to ledger content, for one sink type."""
    if sink_type in (SinkType.DESTINATION, SinkType.FINANCIAL):
        return [m for ent in destination_entities(value) for m in destination_origins(ent, ledger)]
    if sink_type is SinkType.COMMAND:
        return command_origins(value, ledger, cfg.command_containment)
    return private_content_origins(value, ledger, cfg.private_overlap_min)


def is_trusted(matches):
    return any(m.integrity is Integrity.TRUSTED for m in matches)

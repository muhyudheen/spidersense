"""The provenance ledger: every piece of content that entered the agent's context during one run, with its labels."""
from .extract import extract_entities, normalize, shingles
from .labels import Confidentiality, Integrity, LedgerEntry


class ProvenanceLedger:
    def __init__(self, run_id):
        self.run_id = run_id
        self.entries = []
        self.by_entity = {}      # entity value -> entry ids (inverted index)
        self.by_shingle = {}     # shingle -> entry ids

    def add(self, text, source_kind, origin, integrity, confidentiality, step=0):
        """Record content as it enters the context. Never record the model's own messages: they are what gets checked."""
        norm = normalize(text)
        entry = LedgerEntry(id=f"L-{len(self.entries) + 1:04d}", run_id=self.run_id, step=step,
                            source_kind=source_kind, origin=origin, integrity=Integrity(integrity),
                            confidentiality=Confidentiality(confidentiality), text=str(text), norm=norm,
                            shingles=shingles(norm, normalized=True),
                            entities=extract_entities(norm, normalized=True))
        self.entries.append(entry)
        for values in entry.entities.values():
            for v in values:
                self.by_entity.setdefault(v, set()).add(entry.id)
        for sh in entry.shingles:
            self.by_shingle.setdefault(sh, set()).add(entry.id)
        return entry

    def get(self, entry_id):
        return self.entries[int(entry_id.split("-")[1]) - 1]

    def with_entity(self, value):
        """Entries whose text contains this entity (an email, a registered domain, a UPI ID, ...)."""
        return [self.get(i) for i in sorted(self.by_entity.get(value, ()))]

    def private_entries(self):
        return [e for e in self.entries if e.confidentiality is Confidentiality.PRIVATE]

    def untrusted_entries(self):
        return [e for e in self.entries if e.integrity is Integrity.UNTRUSTED]

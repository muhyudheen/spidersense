"""The provenance ledger: every piece of content that entered the agent's context during one run, with its labels."""
from .extract import decoded_variants, extract_entities, normalize, shingles
from .labels import Confidentiality, Integrity, LedgerEntry

MASKED_KINDS = ("email", "upi", "phone", "account", "iban")   # personal values; domains and hosts stay visible


def _mask(value):
    """'asha.rao@example.org' -> 'as***@example.org'; '9876543210' -> '98****3210'."""
    if "@" in value:
        local, _, domain = value.partition("@")
        return f"{local[:2]}***@{domain}"
    return f"{value[:2]}****{value[-4:]}" if len(value) > 6 else "***"


class ProvenanceLedger:
    def __init__(self, run_id):
        self.run_id = run_id
        self.entries = []
        self.by_id = {}          # entry id -> entry
        self.by_entity = {}      # entity value -> entry ids (inverted index)
        self.by_shingle = {}     # shingle -> entry ids

    def add(self, text, source_kind, origin, integrity, confidentiality, step):
        """Record content as it enters the context. Never record the model's own messages: they are what gets checked."""
        norm = normalize(text)
        entities = extract_entities(norm, normalized=True)
        # also index what is hidden one or two encoding layers deep (base64, hex), so an address the agent decodes
        # is still traced to this source. Decoding runs on the raw text: lowercasing would break base64.
        for variant in decoded_variants(str(text))[1:]:
            for kind, values in extract_entities(variant).items():
                entities.setdefault(kind, set()).update(values)
        entry = LedgerEntry(id=f"L-{len(self.entries) + 1:04d}", run_id=self.run_id, step=step,
                            source_kind=source_kind, origin=origin, integrity=Integrity(integrity),
                            confidentiality=Confidentiality(confidentiality), text=str(text), norm=norm,
                            shingles=shingles(norm, normalized=True),
                            entities=entities)
        self.entries.append(entry)
        self.by_id[entry.id] = entry
        for values in entry.entities.values():
            for v in values:
                self.by_entity.setdefault(v, set()).add(entry.id)
        for sh in entry.shingles:
            self.by_shingle.setdefault(sh, set()).add(entry.id)
        return entry

    def get(self, entry_id):
        return self.by_id[entry_id]

    def with_entity(self, value):
        """Entries whose text contains this entity (an email, a registered domain, a UPI ID, ...)."""
        return [self.get(i) for i in sorted(self.by_entity.get(value, ()))]

    def export(self, mask=True, canaries=None):
        """The ledger as JSON-ready dicts, for the dashboard, an API or a log. Masked by default: the text of private
        entries is hidden and personal values are masked, so exporting the ledger can't leak what it holds.
        Canaries are fake, so the ones found in an entry are listed in full as evidence."""
        out = []
        for e in self.entries:
            d = e.to_dict()
            if mask and e.confidentiality is Confidentiality.PRIVATE:
                d["text"] = f"[private: {len(e.text)} characters hidden]"
                d["entities"] = {k: sorted({_mask(v) for v in values}) if k in MASKED_KINDS else values
                                 for k, values in d["entities"].items()}
            if canaries is not None:
                d["canaries"] = sorted(c.core for c in canaries.detect(e.text))
            out.append(d)
        return out

    def private_entries(self):
        return [e for e in self.entries if e.confidentiality is Confidentiality.PRIVATE]

    def untrusted_entries(self):
        return [e for e in self.entries if e.integrity is Integrity.UNTRUSTED]

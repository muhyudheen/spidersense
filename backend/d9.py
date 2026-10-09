"""D9: secrets and personal data in the training data (the privacy meaning of "data leakage")."""
import re

import pandas as pd

# What we look for in text columns. Secrets are high severity; personal data is medium.
PATTERNS = {
    "api_key": (re.compile(r"\b(?:AIza[0-9A-Za-z_\-]{35}|sk-[A-Za-z0-9_\-]{20,}|ghp_[A-Za-z0-9]{36}|AKIA[0-9A-Z]{16})\b"), "high"),
    "credential": (re.compile(r"(?i)\b(?:password|passwd|pwd|secret|api[_-]?key|token)\s*[:=]\s*\S+"), "high"),
    "card_number": (re.compile(r"\b(?:\d[ -]?){13,19}\b"), "high"),
    "email": (re.compile(r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b"), "medium"),
    "phone": (re.compile(r"(?<![\w-])\+?\d[\d ()\-]{8,}\d\b"), "medium"),
}


def luhn_ok(text):
    """True if the digits pass the Luhn check that real card numbers use (filters out random long numbers)."""
    digits = [int(d) for d in re.sub(r"\D", "", text)][::-1]
    total = sum(d if i % 2 == 0 else (d * 2 - 9 if d * 2 > 9 else d * 2) for i, d in enumerate(digits))
    return 13 <= len(digits) <= 19 and total % 10 == 0


def mask(value):
    """Show just enough to recognise the kind of value, never the secret itself."""
    if "@" in value:
        name, domain = value.split("@", 1)
        return f"{name[:1]}***@{domain}"
    return f"{value[:4]}***{value[-2:]}" if len(value) > 8 else "***"


def check_d9(df, max_samples=3):
    findings = []
    for col in df.columns:
        if pd.api.types.is_numeric_dtype(df[col]):
            continue  # secrets and personal data live in text columns
        text = df[col].dropna().astype("string")
        kinds, samples, rows = {}, [], set()
        for kind, (pattern, _) in PATTERNS.items():
            for idx, value in text.items():
                for match in pattern.findall(value):
                    if kind == "card_number" and not luhn_ok(match):
                        continue
                    if kind == "phone" and luhn_ok(match):
                        continue  # a card number, already counted
                    kinds[kind] = kinds.get(kind, 0) + 1
                    rows.add(idx)
                    if len(samples) < max_samples:
                        samples.append(mask(match.strip()))
        if not kinds:
            continue
        severity = "high" if any(PATTERNS[k][1] == "high" for k in kinds) else "medium"
        found = ", ".join(f"{n} {k.replace('_', ' ')}{'s' if n != 1 else ''}" for k, n in kinds.items())
        findings.append({
            "id": f"D9-{len(findings) + 1}", "check": "D9",
            "title": f"Private data: {col} contains {found}",
            "severity": severity,
            "summary": (f"{len(rows)} of {len(df)} rows in {col} contain secrets or personal data ({found}). "
                        f"A model trained on them can memorise and repeat them, and anyone with the file can read them."),
            "evidence": {"found": kinds, "rows_affected": len(rows), "share_of_rows": round(len(rows) / len(df), 3),
                         "masked_samples": samples},
            "location": {"column": col},
            "fix": f"Remove or anonymise {col} before training, and rotate any real keys or passwords it contains.",
        })
    return findings

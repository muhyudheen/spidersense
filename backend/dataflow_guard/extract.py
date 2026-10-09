"""Normalization, entity extraction and shingling: turn text into things we can compare reliably."""
import re
import unicodedata
from urllib.parse import unquote, urlparse

try:  # optional: the public-suffix list gives exact registered domains
    import tldextract
    _TLD = tldextract.TLDExtract(suffix_list_urls=())  # offline: use the bundled snapshot, never download
except ImportError:  # the heuristic below is good enough for the demo domains
    _TLD = None

ZERO_WIDTH = dict.fromkeys(map(ord, "\u200b\u200c\u200d\u2060\ufeff"))  # zero-width space/joiners, word joiner, BOM
SECOND_LEVEL = {"co", "ac", "gov", "org", "net", "edu"}   # e.g. evil.co.in -> registered domain has 3 labels


def normalize(s):
    """NFKC -> drop zero-width characters -> URL-decode once -> lowercase -> collapse spaces -> trim quotes/punctuation."""
    s = unicodedata.normalize("NFKC", str(s)).translate(ZERO_WIDTH)
    s = unquote(s).lower()
    s = re.sub(r"\s+", " ", s).strip()
    return s.strip("\"'`.,;:!?()[]{}<> ")


def registered_domain(host):
    """'mail.evil.example' -> 'evil.example'; 'a.b.evil.co.in' -> 'evil.co.in'."""
    host = host.lower().strip(".").split(":")[0]
    if _TLD is not None:
        parts = _TLD(host)
        if parts.domain and parts.suffix:
            return f"{parts.domain}.{parts.suffix}"
    labels = [p for p in host.split(".") if p]
    if len(labels) >= 3 and labels[-2] in SECOND_LEVEL and len(labels[-1]) == 2:
        return ".".join(labels[-3:])
    return ".".join(labels[-2:])


EMAIL_OR_UPI = re.compile(r"[a-z0-9._%+\-]+@[a-z0-9.\-]+")
URL = re.compile(r"https?://[^\s'\"<>]+")
BARE_DOMAIN = re.compile(r"(?<![@\w.\-])((?:[a-z0-9\-]+\.)+[a-z]{2,})(?![\w\-])")
PHONE = re.compile(r"(?<!\d)(?:\+?91[ \-]?)?[6-9]\d{4}[ \-]?\d{5}(?!\d)|\+\d{8,15}(?!\d)")
ACCOUNT = re.compile(r"(?<!\d)\d{9,18}(?!\d)")
IBAN = re.compile(r"\b[a-z]{2}\d{2}[a-z0-9]{11,30}\b")


def _phone_key(raw):
    digits = re.sub(r"\D", "", raw)
    return digits[-10:] if digits.startswith("91") and len(digits) == 12 else digits


def extract_entities(s, normalized=False):
    """Every destination-like thing in the text: email, email_domain, url_host, domain, upi, phone, account."""
    text = s if normalized else normalize(s)
    ents = {k: set() for k in ("email", "email_domain", "url_host", "domain", "upi", "phone", "account")}
    for raw in EMAIL_OR_UPI.findall(text):
        raw = raw.strip(".-")
        local, _, after = raw.partition("@")
        if "." in after:                      # an email: the part after @ has a dot
            ents["email"].add(raw)
            ents["email_domain"].add(registered_domain(after))
            ents["domain"].add(registered_domain(after))
        elif local and after:                 # a UPI ID: handle@psp, no dot after @
            ents["upi"].add(raw)
    for url in URL.findall(text):
        host = urlparse(url).hostname
        if host:
            ents["url_host"].add(host)
            ents["domain"].add(registered_domain(host))
    without_urls_emails = EMAIL_OR_UPI.sub(" ", URL.sub(" ", text))
    for dom in BARE_DOMAIN.findall(without_urls_emails):
        if not re.fullmatch(r"[\d.]+", dom):  # skip numbers like 3.14
            ents["domain"].add(registered_domain(dom))
    phones = {_phone_key(p) for p in PHONE.findall(text)}
    ents["phone"] = phones
    for acc in ACCOUNT.findall(text):
        if acc not in phones and _phone_key(acc) not in phones:
            ents["account"].add(acc)
    ents["account"].update(IBAN.findall(text))
    return ents


def shingles(s, normalized=False):
    """Word 3-grams of the normalized text; for strings under 3 words, character 5-grams."""
    text = s if normalized else normalize(s)
    words = re.findall(r"\w+", text)
    if len(words) >= 3:
        return {" ".join(words[i:i + 3]) for i in range(len(words) - 2)}
    compact = " ".join(words)
    if len(compact) <= 5:
        return {compact} if compact else set()
    return {compact[i:i + 5] for i in range(len(compact) - 4)}


def containment(value_shingles, source_shingles):
    """The share of the value found in the source: |S(v) & S(s)| / |S(v)|. Not Jaccard: a short value copied from a
    long page has a tiny Jaccard score but a containment close to 1."""
    if not value_shingles:
        return 0.0
    return len(value_shingles & source_shingles) / len(value_shingles)

"""Normalization, entity extraction and shingling: turn text into things we can compare reliably."""
import base64
import binascii
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


# Common Cyrillic and Greek look-alikes of Latin letters (lowercase): "аudit@evil.example" with a Cyrillic "а"
CONFUSABLES = str.maketrans({  # Cyrillic (U+04xx) and Greek (U+03xx) letters that look Latin
    "\u0430": "a", "\u0435": "e", "\u043e": "o", "\u0440": "p", "\u0441": "c", "\u0443": "y", "\u0445": "x",
    "\u0456": "i", "\u0458": "j", "\u0455": "s", "\u0501": "d", "\u04cf": "l", "\u0432": "b", "\u043a": "k",
    "\u043c": "m", "\u043d": "h", "\u0442": "t", "\u03b1": "a", "\u03b5": "e", "\u03b9": "i", "\u03ba": "k",
    "\u03bd": "v", "\u03bf": "o", "\u03c1": "p", "\u03c4": "t", "\u03c5": "u", "\u03c7": "x",
})


def normalize(s):
    """NFKC -> drop zero-width characters -> URL-decode once -> lowercase -> map look-alike letters to Latin ->
    collapse spaces -> trim quotes/punctuation."""
    s = unicodedata.normalize("NFKC", str(s)).translate(ZERO_WIDTH)
    s = unquote(s).lower().translate(CONFUSABLES)
    s = re.sub(r"\s+", " ", s).strip()
    return s.strip("\"'`.,;:!?()[]{}<> ")


B64_TOKEN = re.compile(r"[A-Za-z0-9+/_\-]{16,}={0,2}")
HEX_TOKEN = re.compile(r"\b(?:[0-9a-fA-F]{2}){8,}\b")


def _printable(raw):
    """Decoded bytes count only if they look like text (so random tokens don't produce garbage variants)."""
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        return None
    ok = sum(ch.isprintable() or ch in "\n\t" for ch in text)
    return text if text and ok / len(text) >= 0.9 else None


def _decode_once(text):
    """Every text hidden one encoding layer deep: base64 (standard or URL-safe), hex, or URL-encoding."""
    found = []
    for token in B64_TOKEN.findall(text):
        padded = token + "=" * (-len(token) % 4)
        for alt in (padded, padded.replace("-", "+").replace("_", "/")):
            try:
                decoded = _printable(base64.b64decode(alt, validate=True))
            except (ValueError, binascii.Error):
                decoded = None
            if decoded:
                found.append(decoded)
                break
    for token in HEX_TOKEN.findall(text):
        decoded = _printable(bytes.fromhex(token))
        if decoded:
            found.append(decoded)
    unquoted = unquote(text)
    if unquoted != text:
        found.append(unquoted)
    return found


def decoded_variants(text, depth=2):
    """The text plus everything hidden inside it, up to `depth` encoding layers (e.g. base64 of URL-encoded data)."""
    variants, frontier = [str(text)], [str(text)]
    for _ in range(depth):
        frontier = [d for t in frontier for d in _decode_once(t) if d not in variants]
        variants += frontier
    return variants


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

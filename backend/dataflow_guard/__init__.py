"""SpiderSense Data-Flow Guard: blocks tool calls whose sensitive arguments came from untrusted content, and stops
private data and planted canary secrets from leaving the system. Deterministic: no LLM calls in its checks."""

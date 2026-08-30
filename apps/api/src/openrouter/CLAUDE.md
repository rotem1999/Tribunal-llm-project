# openrouter/

OpenRouter client (OpenAI-compatible). `callModel({model, systemPrompt, userPrompt, temperature, maxTokens})` -> content + usage + latency. Read `usage.cost` directly (0 for free) — never estimate from tokens; also capture prompt/completion and `reasoning_tokens`.

Model resolution (§5.2): `GET /models`, keep only `pricing.prompt==="0" && pricing.completion==="0"`, sort by `context_length` desc, cache ~10 min. **Never hardcode model ids.**

Errors: 429 -> exp backoff + jitter, max 4 tries; 402 -> abort (out of credits); the free-policy 404 -> typed `DataPolicyError` with the actionable privacy-toggle message (§5.3). Per-call timeout `CALL_TIMEOUT_MS`.

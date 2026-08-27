---
name: openrouter-model-picker
description: Resolve which free OpenRouter model(s) a Tribunal run should use, at runtime, and handle the free-endpoint data-policy 404. Use when implementing or debugging model resolution (§5.2), Mode A single-model / Mode B per-persona assignment, the /models/free endpoint, or when a run fails with "No endpoints available matching your data policy". Triggers - "which model", "free model list", "model resolution", "Mode B assignment", "data policy 404", "models endpoint".
---

# openrouter-model-picker

Encodes SPEC §5.2–5.3. **Never hardcode model names** — the free roster changes monthly. Verify live behavior against OpenRouter docs before trusting anything (CLAUDE.md "verify, don't assume").

## Free-model resolution (§5.2)
1. Fetch `GET https://openrouter.ai/api/v1/models` (auth: `Bearer ${OPENROUTER_API_KEY}`). Cache the free list in memory ~10 min; refresh on cache miss or on a data-policy 404.
2. **Free filter — both must be zero-price strings:** keep entries where `pricing.prompt === "0"` **and** `pricing.completion === "0"`. Exclude free-prompt/paid-completion. (These are the `:free` endpoints; ids typically end in `:free`, but filter by price, not by the suffix.)
3. **Sort** candidates by `context_length` **descending** — judges need room for the charge sheet + all 4 speeches.
4. **Mode A (single model):** use `MODE_A_MODEL` env **only if it is still present and free**; otherwise candidate #1. Persist the chosen id on the run (`modelSingle`).
5. **Mode B (per persona):** assign the first 7 distinct candidates to the 7 personas in a **fixed persona order**. If fewer than 7 free models exist, **round-robin deterministically** to fill 7. Record the actual model id on every `Speech`/`Verdict` so the run is reproducible.

## Data-policy 404 (§5.3) — must be explicit
Free endpoints only serve if the OpenRouter **account** has enabled, under Settings → Privacy, BOTH "Free endpoints that may train on request data" AND "Free endpoints that may publish prompts". If disabled, every free model returns HTTP **404** `"No endpoints available matching your data policy"`.
- Detect this specific 404 and raise a typed `DataPolicyError`, not a generic failure.
- Surface the actionable message verbatim-but-friendly: *"No free models are available for your OpenRouter account. Enable the two free-endpoint privacy toggles in OpenRouter Settings → Privacy, or configure a paid model."*
- Owner accepts training/publishing on prompts because cases are fictional (D1).

## Other guardrails
- Read cost from `usage.cost` (USD; `0` for free) — never estimate from token counts.
- Rate limits: 20 req/min (the 4+3 parallel calls stay well under). Free tier also has daily caps (50/day with no credit) — surface a clear message if hit.
- Empty free list → throw the actionable no-free-models error (same as the 404 path).

When invoked, produce or check the resolver so it satisfies the §14.2 "Free-model filter & assignment" test cases.

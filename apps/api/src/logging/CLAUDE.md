# logging/

Diagnostic file log (§5.7) — durable forensic record **beside** the NestJS `Logger`. `LoggingService` writes one JSON line to daily `${LOG_DIR}/app-YYYY-MM-DD.jsonl` (under gitignored `data/`). No DB table/endpoint/UI in v1.

Captures: every OpenRouter call (success + failure, **full** request/response) from `openrouter.client`; run lifecycle + swaps from `tribunal`; unhandled errors from `AllExceptionsFilter`. Correlate via `runId`/`personaKey` (threaded through `CallModelParams`, not sent to OpenRouter).

Rules: **always redact** secrets (API key/`Authorization`/JWT/`SEED_PASSWORD`; token-count keys kept). Writes are **best-effort, non-blocking** — `log*` never throws/awaits; failure falls back to console. `@Global`; injected `@Optional()` into client + filter. Config: `LOG_DIR`, `LOG_TO_FILE` (false = console only), `LOG_LEVEL`. Tests `await flush()`.

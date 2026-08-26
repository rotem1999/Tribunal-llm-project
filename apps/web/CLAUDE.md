# apps/web/

React + Tailwind + Vite — the Nx `web` app. Talks only to `apps/api`, never OpenRouter; imports contracts from `@tribunal/shared-types`. UI English (§11).

- Auth: JWT in memory + `sessionStorage`; on 401 clear token and route to Login.
- Pages: Login, New Run, Run Result, History.
- Run Result: 4 SpeechCards (support vs against), 3 VerdictCards, Economy panel — **no** combined "final verdict"; any tally is labelled non-binding.
- New Run shows the active charge sheet **read-only** — no upload/paste/edit in v1 (D9).
- Surface the §5.3 data-policy error as a friendly banner; disable Run while in flight.
- `nx serve|test web` (Vitest).

# Tribunal Web (`apps/web`)

React + Tailwind (Vite) single-page frontend. It talks only to the Tribunal API — never to OpenRouter
directly — using the shared request/response types from `@tribunal/shared-types`, so the front/back
contract can't drift.

For the product overview and architecture, see the [root README](../../README.md). The backend and its
setup live in [`apps/api/README.md`](../api/README.md).

## Running

```bash
npx nx serve web     # dev server — http://localhost:4200
npx nx build web     # production build → apps/web/dist
npx nx test web      # component tests (Vitest + React Testing Library + MSW)
npx nx lint web
```

The backend must be running (`npx nx serve api`) for the app to log in and fetch data. Make sure the
web origin (`http://localhost:4200` by default) is listed in the API's `CORS_ORIGINS`.

## Environment

The frontend needs one setting — where the API lives:

| Variable | Default | Purpose |
|----------|---------|---------|
| `VITE_API_URL` | `http://localhost:3000/api` | Base URL of the Tribunal API |

Vite exposes only variables prefixed `VITE_`. To override the default, add it to a `.env` file in the
workspace root (or `apps/web/`):

```bash
VITE_API_URL=http://localhost:3000/api
```

## Pages

- **Login** — username/password against the seeded user; stores the JWT (in `sessionStorage`) and
  attaches it as a bearer token on every request. A `401` clears the token and routes back here.
- **New Run** — shows the stored active charge sheet **read-only** (there is no upload or edit control
  in v1, by design — D9), a **Mode A/B** toggle, and, in Mode A, an optional free-model picker
  (leaving it on *Auto* is safe — the backend skips any restricted model automatically). Starting a
  run returns immediately and navigates to the run.
- **Run Result** — because a run executes in the background, this page has two states:
  - **Live** — while the run is `pending`/`running` it polls `GET /runs/:id/progress` and renders the
    **`TribunalCircle`** animation: the four advocates and three judges arranged in a circle, each
    spinning while its call is in flight and turning to a check once its speech or verdict is
    persisted (advocates light up first, then judges).
  - **Result** — once the run is terminal it shows the four advocate speeches grouped support vs
    against, the **three independent judge verdicts** (decision badge, confidence, full
    reasoning/protocol) with an explicitly **non-binding** vote tally — there is no combined "final
    verdict" — and, via a **Verdict / Economy** tab bar, the **Economy panel** (per-persona and
    per-model tokens & cost, `$0.00 (free)` shown honestly, plus a Download JSON button). A `failed`
    or `aborted_over_budget` run shows the error and whatever completed.
- **History** — a table of past runs; clicking a row opens its result.

The persona roster that labels the circle comes from `GET /personas`. Backend errors — the OpenRouter
data-policy `404` and the "all free models restricted" `422` (see the api README) — are surfaced to the
user as friendly, actionable messages rather than raw failures.

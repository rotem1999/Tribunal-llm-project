# Tribunal

Tribunal is a web app that simulates a courtroom deliberation over a **charge sheet** (free text
describing an alleged crime) using LLM personas. Seven models run per case — **four advocates** (two
arguing *for* the accused, two *against*) each give one persuasive speech, then **three judges** each
read the charge sheet and all four speeches and return an independent **verdict**: `justified` /
`not_justified`, a confidence score, and written reasoning (the "protocol" — how that judge decided).

The output of a run is deliberately **the three verdicts as-is, never a single combined ruling**, plus
the run's **token/cost economy**. `justified` favours the accused (the act was lawful or necessary);
`not_justified` is against. A non-binding vote tally may be shown for convenience, but it is a display
of the three opinions, not a decision — the tribunal issues no combined verdict and imposes no
sentence.

## The two run modes

A run picks exactly one mode via a toggle:

- **Mode A — single model:** one model serves all seven personas; only the system prompts differ.
- **Mode B — model per persona:** each of the seven personas is assigned a **distinct** model drawn
  from OpenRouter's live free-model roster. This is the interesting comparison against Mode A.

Models are resolved at runtime from OpenRouter's `/models` endpoint, filtered to zero price — model
names are never hardcoded, because the free roster changes month to month.

## Token economy

Every run — completed or aborted over budget — records each call's real token usage and `usage.cost`
straight from OpenRouter (free models report `$0.00`, shown honestly). Each run writes a per-run JSON
file and appends a line to a cumulative ledger, and the same figures appear in the UI beside the
verdicts with a JSON download. A configurable per-run cost ceiling (default `$5`) hard-stops a run
before it can overspend.

## Architecture

```
                         ┌──────────────────────── Nx monorepo ────────────────────────┐
┌────────────────────┐   │  apps/web (React+Tailwind+Vite)     apps/api (NestJS+TS)     │
│   Browser (SPA)    │◀──┼─▶  ── JWT (Bearer), JSON over HTTP ─▶  TypeORM ▶ PostgreSQL   │
└────────────────────┘   │        ▲                                  │  OpenRouter client │
                         │        └── imports types from ───┐        └────────┬──────────┘
                         │        libs/shared-types  ◀──────┘                 │ HTTPS      │
                         └──────────────────────────────────────────────────┼────────────┘
                                                                             ▼
                                                              OpenRouter API (chat + models)
```

- **`apps/api`** — NestJS + TypeORM + PostgreSQL. Owns all LLM orchestration, cost accounting,
  persistence, and auth. The frontend never talks to OpenRouter directly; the API key stays
  server-side.
- **`apps/web`** — React + Tailwind (Vite). Talks only to the backend.
- **`libs/shared-types`** — framework-free TypeScript interfaces and enums (`mode`, `decision`, run
  `status`) defined once and imported by both apps, so the front/back contract can't drift. The api's
  DTO classes (which carry Swagger + validation decorators) `implement` these shared interfaces; the
  web app imports only the plain types.

The [`SPEC.md`](./SPEC.md) at the repo root is the authoritative blueprint; [`INTENT.txt`](./INTENT.txt)
is the original brief.

## Prerequisites

- **Node.js** 20+ and npm.
- **PostgreSQL** running **locally on the host** (natively installed — the repo ships no Docker
  setup, by owner decision). Create a database and a role for it before first run.
- An **OpenRouter API key** ([openrouter.ai](https://openrouter.ai)). To use free models you must also
  enable both free-endpoint privacy toggles in **OpenRouter → Settings → Privacy** ("Free endpoints
  that may train on request data" **and** "…that may publish prompts"); otherwise every free model
  returns a `404` data-policy error. See [`apps/api/README.md`](./apps/api/README.md) for details.

## Quickstart

```bash
# 1. Install (one root package.json for the whole workspace)
npm install

# 2. Create the local Postgres database + role (example)
createdb tribunal
psql -d tribunal -c "CREATE ROLE tribunal LOGIN PASSWORD 'tribunal';"
psql -d tribunal -c "GRANT ALL ON DATABASE tribunal TO tribunal;"
psql -d tribunal -c "GRANT ALL ON SCHEMA public TO tribunal;"   # PostgreSQL 15+: lets the role create tables

# 3. Configure the environment
cp .env.example .env
#    then fill in OPENROUTER_API_KEY, JWT_SECRET, SEED_USERNAME, SEED_PASSWORD,
#    and point DATABASE_URL at your local instance.

# 4. Run the backend — migrations run and the user + charge sheet seed automatically on boot
npx nx serve api        # http://localhost:3000/api  (Swagger at /api/docs)

# 5. In another terminal, run the frontend
npx nx serve web        # http://localhost:4200
```

Log in with the seeded `SEED_USERNAME` / `SEED_PASSWORD`, open **New Run**, pick a mode, and run the
tribunal. On first boot the canonical Case **T-001** charge sheet is seeded and shown read-only.

## Nx workspace

Tribunal is a single **Nx** integrated monorepo. All source lives under `apps/` and `libs/`, with one
root `package.json` and shared TypeScript path aliases (`@tribunal/shared-types`).

```
Tribunal/
├─ apps/
│  ├─ api/          NestJS backend         (scope:api)
│  ├─ api-e2e/      backend Supertest e2e
│  └─ web/          React frontend         (scope:web)
└─ libs/
   └─ shared-types/ framework-free DTOs + enums shared by api & web  (scope:shared)
```

Module boundaries are enforced by `@nx/enforce-module-boundaries` via the `scope:*` / `type:*` tags,
so the web bundle can never pull in backend code and vice-versa.

Common commands (prefix with `npx` to use the workspace-local Nx):

```bash
npx nx serve api          # run the backend (watch)
npx nx serve web          # run the frontend (watch)
npx nx build api          # production build
npx nx build web
npx nx test api           # backend unit tests (Jest)
npx nx test web           # frontend component tests (Vitest)
npx nx e2e api-e2e        # backend integration/e2e (Supertest)
npx nx lint api           # or lint web / shared-types
npx nx run-many -t test   # every project's tests
npx nx affected -t test lint   # only what your changes touched
```

## Testing

The suite runs entirely with OpenRouter mocked — no network, no real spend.

- **Backend unit tests** (`nx test api`) — pure logic (verdict parsing, tally, speech order, prompt
  building, budget guard, economy aggregation) with no database.
- **Backend integration / e2e** (`nx e2e api-e2e`) — boots the real NestJS app against a test Postgres
  with a fake OpenRouter server (Supertest, in-process).
- **Frontend component tests** (`nx test web`) — Vitest + React Testing Library + MSW covering the
  components, pages, API client, and routing.

See `SPEC.md` §14 for the full testing strategy.

## API docs

With the backend running, Swagger UI is served at **`/api/docs`** and documents every endpoint,
request/response schema, the enums, the bearer scheme, and the special `401` / `402` / `404` error
bodies. `openapi.json` is emitted as a build artifact.

## Per-app docs

- [`apps/api/README.md`](./apps/api/README.md) — env reference, database & migrations, seeding, the
  OpenRouter privacy-toggle requirement, Nx targets, and where run files land.
- [`apps/web/README.md`](./apps/web/README.md) — frontend env, serve/build/test.

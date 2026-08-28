# Tribunal API (`apps/api`)

NestJS + TypeORM + PostgreSQL backend. It owns everything that touches secrets or costs money: LLM
orchestration over OpenRouter, token/cost accounting, persistence, and JWT auth. The frontend talks
only to this service — the OpenRouter key never leaves the server.

For the product overview, architecture diagram, and workspace-level commands, see the
[root README](../../README.md). `SPEC.md` at the repo root is authoritative.

## Running

```bash
npx nx serve api     # dev (watch) — http://localhost:3000/api
npx nx build api     # production build (webpack) → apps/api/dist
npx nx test api      # unit tests (Jest via @nx/jest)
npx nx lint api
```

On boot the app validates the environment, **runs pending migrations automatically**
(`migrationsRun`), and **seeds** the single user and the canonical charge sheet if they are missing.
If `personalities.json` is missing or invalid, the app refuses to start.

## OpenRouter privacy toggles — read this first

Free models are only served if your OpenRouter **account** has enabled, under **Settings → Privacy**,
both:

- *"Free endpoints that may train on request data"*, **and**
- *"Free endpoints that may publish prompts"*.

If either is off, **every** free model returns HTTP `404` — *"No endpoints available matching your
data policy"*. The API detects this specific case and surfaces an actionable message
("Enable the two free-endpoint privacy toggles in OpenRouter Settings → Privacy, or configure a paid
model") rather than a generic crash. Charge sheets in Tribunal are always fictional/demo, so enabling
these toggles is acceptable; if you'd rather not, pin a paid model via `MODE_A_MODEL`.

## Environment

All configuration is loaded through `@nestjs/config` and validated against a Zod schema at boot
(`src/config/config.schema.ts`) — a bad or missing variable fails fast with a single aggregated error
listing every offender. Copy [`.env.example`](../../.env.example) to `.env` at the **workspace root**
and fill in the required values.

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `OPENROUTER_API_KEY` | **yes** | — | OpenRouter API key |
| `OPENROUTER_BASE_URL` | no | `https://openrouter.ai/api/v1` | OpenRouter base URL |
| `OPENROUTER_APP_TITLE` | no | `Tribunal` | sent as `X-Title` |
| `OPENROUTER_APP_URL` | no | — | sent as `HTTP-Referer` for attribution |
| `MODE_A_MODEL` | no | auto (first free model) | pin Mode A's single model id |
| `RUN_COST_CEILING_USD` | no | `5` | hard per-run cost ceiling |
| `ADVOCATE_TEMPERATURE` | no | `0.9` | advocate sampling temperature |
| `JUDGE_TEMPERATURE` | no | `0.2` | judge sampling temperature |
| `MODEL_MAX_TOKENS` | no | `1024` | per-call output cap |
| `CALL_TIMEOUT_MS` | no | `90000` | per-call timeout |
| `DATABASE_URL` | **yes** | — | local Postgres connection string |
| `JWT_SECRET` | **yes** | — | JWT signing secret (use a long random string) |
| `JWT_EXPIRES_IN` | no | `1d` | token lifetime |
| `SEED_USERNAME` | **yes** | — | seeded user's username |
| `SEED_PASSWORD` | **yes** | — | seeded user's password (seeded once at boot) |
| `PERSONAS_FILE` | no | `personalities.json` | persona source, resolved from the workspace root |
| `CHARGE_SHEET_SEED_FILE` | no | `charge-sheet.seed.txt` | Case T-001 seed text, from the workspace root |
| `CORS_ORIGINS` | **yes** | — | comma-separated allowed frontend origins |
| `PORT` | no | `3000` | backend port |

## Database & migrations

PostgreSQL runs **locally on the host** (natively installed, not in Docker — owner decision). Point
`DATABASE_URL` at that instance. Schema changes go through TypeORM migrations, not `synchronize`
(which is off).

Migrations run automatically when the app boots, so a normal `nx serve api` against an empty database
brings the schema up to date and seeds it. For out-of-Nest tooling — generating a new migration or
reverting — a standalone `DataSource` lives at `src/data-source.ts` (it reads `DATABASE_URL` from
`.env`):

```bash
# generate a migration from entity changes
npx typeorm-ts-node-esm migration:generate apps/api/src/migrations/<Name> -d apps/api/src/data-source.ts
# revert the most recent migration
npx typeorm-ts-node-esm migration:revert -d apps/api/src/data-source.ts
```

Seeding is idempotent: the user is created from `SEED_USERNAME`/`SEED_PASSWORD` (password hashed with
argon2id) and the active charge sheet from `CHARGE_SHEET_SEED_FILE` only if they don't already exist.

## Run pipeline & the "protocol"

One run = **7 LLM calls**: the 4 advocate calls run in parallel, then the 3 judge calls run in
parallel. Each advocate is *blind* — it sees only its own persona and the charge sheet, never another
advocate's speech. Each judge sees the charge sheet plus all four speeches, in a **counterbalanced
order** (rotated per judge and recorded) to blunt the position bias LLM judges show toward whichever
argument they read first.

Each judge's written reasoning is its **protocol** — the account of *how* it reached its decision. The
pipeline parses each judge's answer into `{ decision, confidence, reasoning }` and **never** collapses
the three into an authoritative combined verdict. The run snapshots the charge sheet content and the
cost ceiling up front, so a mid-flight edit to the charge sheet can't change an in-progress run.

Core modules carry top-of-file docblocks explaining the pipeline: `src/tribunal/` (orchestration),
`src/openrouter/` (chat wrapper, model resolution, retry/backoff), and `src/economy/` (cost
aggregation and file/ledger writing).

## Where run files land

The economy for every run is written under `apps/api/data/` (gitignored):

- `apps/api/data/runs/<runId>.json` — the full per-run economy (per-persona, per-model, totals).
- `apps/api/data/ledger.jsonl` — an append-only line per run; reconstructable from the DB if lost.

Both are also served over the API (`GET /runs/:id/economy`, `GET /economy/ledger`) and surfaced in the
UI.

## API surface

Every route except `POST /auth/login` requires `Authorization: Bearer <jwt>`. The full contract —
auth, `/models/free`, charge-sheet read/list/patch, run create/list/detail, and the economy
endpoints — is documented in Swagger UI at **`/api/docs`** when the server is running, and in `SPEC.md`
§10.

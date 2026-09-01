# Tribunal — Execution Plan (PR-by-PR)

> **Purpose.** This file slices the settled build blueprint in `SPEC.md` (§16 build order,
> §17 acceptance) into a sequence of **PR-sized** increments. It does not change any decision
> in `SPEC.md` — it only sequences the work. Read the cited `SPEC.md` section before starting
> any PR. Last updated: 2026-08-27.

---

## 0. Governing rules for every PR

These two rules are hard constraints on **every** PR in this plan.

**Rule 1 — Size budget.** A single PR may change **at most 10 hand-authored files** and **at most
~1000 changed lines total**. The line budget is a pool, not a per-file cap: it may concentrate
(1 file × ~1000) or spread (10 files × ~100), in any mix that stays under both ceilings.

- *Counted:* every file a human writes or edits by hand (source, config edits, tests, docs).
- *Not counted (exempt):* files produced by a scaffold/generator command (`create-nx-workspace`,
  `nx g …`), lockfiles (`package-lock.json` / `pnpm-lock.yaml`), and TypeORM **migration files
  emitted** by `migration:generate`. These are reviewed but do not consume the budget.
- If a PR would exceed either ceiling, it must be split. Where a PR below is already close to the
  ceiling, that is flagged.

**Rule 2 — Stay in scope.** Each PR does **only** what its "Scope" line states and nothing more.
No opportunistic refactors, no reaching ahead to the next phase, no adding features `SPEC.md`
defers (upload/paste UI, SSE streaming, refresh tokens, multi-user, rebuttals). If a PR uncovers
adjacent work, it is noted as a **follow-up PR**, not folded in.

**Two conventions that follow from Rule 2 (both are `SPEC.md`, not scope creep):**

- **Swagger decorators travel with their endpoint.** `@ApiProperty` / `@ApiOperation` /
  `@ApiResponse` / `@ApiBearerAuth` are added in the *same* files as the DTO/controller they
  document, in the PR that introduces that endpoint (SPEC §15.1, §16.10 "not deferred"). Only the
  Swagger **bootstrap** (`main.ts` + `openapi.json` emit) is its own PR.
- **Migrations travel with their entity.** An entity PR sets `synchronize:false` and includes the
  generated migration (exempt from the budget) so schema changes are reviewable and ordered.

---

## 1. Sequencing principles

1. **Contract before consumers.** `libs/shared-types` lands early (PR-4) so both apps compile
   against one contract from the start (SPEC §3 "removes front/back contract drift").
2. **Backend module = its own PR (or two).** Each `apps/api/src/<module>` from SPEC §3.1 is a
   self-contained increment: entity/service/controller/module + its Swagger decorators.
3. **Each PR is independently runnable/mergeable** — it builds, lints, and (from the test phase on)
   passes CI. This mirrors SPEC §16's "each phase independently runnable."
4. **Tests land in dedicated PRs** after the logic they cover exists, chunked by area to respect the
   file budget (SPEC §14). Pure-logic modules are written test-friendly (pure functions) so their
   tests are cheap.
5. **Dependency-ordered.** A PR never merges before the PRs in its "Depends on" list. The graph is
   acyclic; the numbering is one valid topological order.

---

## 2. Phase → PR overview

| Phase (SPEC §16) | PRs | Outcome |
|---|---|---|
| 0. Foundation (§16.1, §3.2) | PR-1 … PR-4 | Nx workspace, dev infra, Tailwind, shared contract |
| 1. Auth (§16.2, §7) | PR-5 … PR-7 | Seed user, JWT login/guard, Login page |
| 2. OpenRouter (§16.3, §5) | PR-8 … PR-9 | Chat wrapper + free-model resolution/`/models/free` |
| 3. Personas (§16.4, §8) | PR-10 | Load + validate `personalities.json` at boot |
| 4. Charge sheet (§16.5, §4.2) | PR-11 | Entity, seed, `GET`/`PATCH` endpoints |
| 5. Tribunal orchestration (§16.6, §5.5) | PR-12 … PR-13 | Entities + pure logic, then the run pipeline |
| 6. Economy (§16.7, §6) | PR-14 | JSON/ledger writer + economy endpoints |
| 7. Runs API + hardening (§16.8, §12–13) | PR-15 … PR-16 | Run endpoints, then error surfaces/input caps/CORS |
| 8. Frontend (§16.9, §11) | PR-17 … PR-19 | New Run, Run Result, History |
| 9. Swagger + tests (§16.10, §14–15) | PR-20 … PR-25 | Swagger bootstrap, then backend + frontend suites |
| 10. Docs (§16.11, §15.2) | PR-26 | READMEs, `.env.example`, module docblocks |

---

## 3. Master PR list

| PR | Title | Hand files | Depends on | Est. lines |
|----|-------|-----------:|------------|-----------:|
| 1 | Nx workspace scaffold + module boundaries | ~6 | — | ~250 |
| 2 | Dev infra: docker-compose + config validation | ~5 | 1 | ~300 |
| 3 | Tailwind + web app shell | ~5 | 1 | ~200 |
| 4 | `shared-types`: enums + contract interfaces | ~6 | 1 | ~400 |
| 5 | User entity + TypeORM data source + seed | ~5 | 2, 4 | ~350 |
| 6 | Auth: login, JWT strategy, guard, `/auth/me` | ~6 | 5 | ~450 |
| 7 | Web: Login page + API client + protected routes | ~6 | 3, 4, 6 | ~450 |
| 8 | OpenRouter chat wrapper (usage/cost, retry, errors) | ~4 | 2 | ~450 |
| 9 | Model resolution + `/models/free` | ~4 | 6, 8 | ~450 |
| 10 | Personas loader + boot validation | ~3 | 2 | ~350 |
| 11 | ChargeSheet entity + seed + endpoints | ~6 | 5, 6 | ~450 |
| 12 | Run/Speech/Verdict entities + pure logic | ~7 | 4, 5 | ~650 |
| 13 | Tribunal orchestration pipeline | ~3 | 9, 10, 11, 12 | ~500 |
| 14 | Economy builder + file/ledger writer + endpoints | ~4 | 12, 13 | ~450 |
| 15 | Runs API: `POST /runs`, `GET /runs`, `GET /runs/:id` | ~5 | 13, 14 | ~450 |
| 16 | Hardening: exception filter, input caps, CORS | ~4 | 9, 15 | ~350 |
| 17 | Web: New Run page + run/models/charge-sheet client | ~6 | 7, 15 | ~500 |
| 18 | Web: Run Result page + cards | ~5 | 17 | ~600 |
| 19 | Web: History page + navigation | ~3 | 18 | ~250 |
| 20 | Swagger bootstrap + `openapi.json` emit | ~2 | 15 | ~150 |
| 21 | Backend unit tests — pure logic | ~7 | 12, 13 | ~800 |
| 22 | Backend unit tests — I/O modules (nock) | ~7 | 8, 9, 10, 11, 14 | ~800 |
| 23 | Backend integration/e2e (Supertest + Testcontainers) | ~7 | 15, 16 | ~800 |
| 24 | Frontend component tests — results & panels | ~7 | 18 | ~700 |
| 25 | Frontend component tests — flows & client | ~6 | 17, 19 | ~600 |
| 26 | Docs: READMEs, `.env.example`, module docblocks | ~7 | 20 | ~600 |

**26 PRs.** Every row is within the 10-file / ~1000-line budget. PRs 12, 18, 21–24 are the
largest; each stays under the ceiling and is a candidate to split further if a real diff overruns.

---

## 4. Per-PR detail

Each block: **Scope** (the one thing this PR does) · **Files** (hand-authored) · **Done when**
(acceptance) · **Out of scope** (guard for Rule 2).

### Phase 0 — Foundation

**PR-1 · Nx workspace scaffold + module boundaries** — SPEC §3.1, §3.2, §16.1
- **Scope:** Create the integrated Nx workspace and the three projects; wire the shared path alias,
  project tags, module-boundary lint rule, and caching. (Generator output is exempt; this PR's
  budget is the *hand edits* to the generated files.)
- **Commands (generate, exempt):** `npx create-nx-workspace@latest tribunal --preset=apps`;
  `nx add @nx/nest @nx/react @nx/js`; `nx g @nx/nest:app apps/api`;
  `nx g @nx/react:app apps/web --bundler=vite`; `nx g @nx/js:lib libs/shared-types --bundler=tsc`.
- **Files (hand):** `tsconfig.base.json` (add `@tribunal/shared-types` alias), `nx.json`
  (targetDefaults cache + `dependsOn:["^build"]` + named inputs), root ESLint config
  (`@nx/enforce-module-boundaries`), `apps/api/project.json` + `apps/web/project.json` +
  `libs/shared-types/project.json` (tags `scope:*` / `type:*`).
- **Done when:** `nx run-many -t build lint` passes on the empty projects; `web` importing `api`
  code fails lint (boundary enforced); `@tribunal/shared-types` resolves.
- **Out of scope:** any app feature code, Tailwind, docker, env.

**PR-2 · Dev infra: docker-compose + config validation** — SPEC §3.1, §9, §16.1
- **Scope:** Local Postgres and validated env loading.
- **Files:** `docker-compose.yml` (postgres + optional adminer), `.env.example` (every var in §9,
  values blank/example), `apps/api/src/config/config.schema.ts` (zod/joi schema for §9),
  `apps/api/src/config/config.module.ts` (`@nestjs/config` + schema), `apps/api/src/app/app.module.ts`
  (import ConfigModule).
- **Done when:** `docker compose up` starts Postgres; API boot fails fast with a clear message when a
  required env var is missing; `.env.example` lists all §9 vars.
- **Out of scope:** DB entities/connection (PR-5), any secret values.

**PR-3 · Tailwind + web app shell** — SPEC §11, §16.1
- **Scope:** Tailwind wired into the Vite React app + a minimal App shell.
- **Files:** `apps/web/tailwind.config.js`, `apps/web/postcss.config.js`,
  `apps/web/src/styles/index.css` (Tailwind directives), `apps/web/src/main.tsx` (import styles),
  `apps/web/src/app/App.tsx` (shell placeholder).
- **Done when:** `nx serve web` renders a Tailwind-styled shell; a utility class visibly applies.
- **Out of scope:** pages, routing, API calls (later frontend PRs).

**PR-4 · `shared-types`: enums + contract interfaces** — SPEC §3, §10, §16.1
- **Scope:** The single source of truth for the front/back contract — **framework-free** TS only.
- **Files:** `libs/shared-types/src/enums.ts` (`mode` A_single/B_per_persona, `decision`
  justified/not_justified, run `status`, `side`), `auth.ts`, `charge-sheet.ts`,
  `run.ts` (Run/Speech/Verdict response shapes + `verdictTally`), `economy.ts` (per-run JSON +
  ledger line shapes), `index.ts` (barrel).
- **Done when:** `nx build shared-types` passes; no NestJS/class-validator/Swagger import present;
  both apps can import from `@tribunal/shared-types`.
- **Out of scope:** DTO classes with decorators (those live in `apps/api` and `implements` these).

### Phase 1 — Auth

**PR-5 · User entity + TypeORM data source + seed** — SPEC §4.1, §7, §16.2
- **Scope:** DB connection, `User` table, idempotent seed user (argon2id).
- **Files:** `apps/api/src/users/user.entity.ts`, `apps/api/src/users/users.service.ts` (seed +
  lookup; never logs password), `apps/api/src/users/users.module.ts`,
  `apps/api/src/data-source.ts` (TypeORM `DataSource`, `synchronize:false`),
  `apps/api/src/app/app.module.ts` (edit: `TypeOrmModule.forRootAsync`). *(+ generated initial
  migration, exempt.)*
- **Done when:** on boot with an empty DB, exactly one user is created from `SEED_USERNAME/PASSWORD`;
  a second boot creates no duplicate; password stored hashed.
- **Out of scope:** login/JWT (PR-6).

**PR-6 · Auth: login, JWT strategy, guard, `/auth/me`** — SPEC §7, §10, §16.2
- **Scope:** Password login → JWT; guard protecting routes; current-user endpoint. Swagger
  decorators included.
- **Files:** `auth.service.ts` (verify + sign), `auth.controller.ts` (`POST /auth/login`,
  `GET /auth/me`, `@ApiTags`/`@ApiOperation`/`@ApiResponse` 200/401), `jwt.strategy.ts`,
  `jwt-auth.guard.ts`, `dto/login.dto.ts` (`implements` shared interface, `@ApiProperty`),
  `auth.module.ts`.
- **Done when:** valid creds → `{accessToken}`; invalid → 401; a route behind the guard rejects
  no/expired token and accepts a valid one.
- **Out of scope:** applying the guard to `/runs`,`/models` (done in those modules' PRs), refresh
  tokens (deferred).

**PR-7 · Web: Login page + API client + protected routes** — SPEC §7, §11, §16.2
- **Scope:** Front-end auth: typed fetch client (Bearer + 401→login), token store, Login page,
  protected routing.
- **Files:** `apps/web/src/api/client.ts` (fetch wrapper, attaches Bearer, on 401 clears + routes),
  `apps/web/src/api/auth.ts`, `apps/web/src/auth/AuthContext.tsx` (memory + sessionStorage token),
  `apps/web/src/pages/Login.tsx`, `apps/web/src/app/App.tsx` (edit: router + guarded routes),
  `apps/web/src/app/routes.tsx`.
- **Done when:** login stores token and navigates; visiting a protected route with no token
  redirects to Login; 401 from the API clears the token and redirects.
- **Out of scope:** New Run / Result / History pages (Phase 8).

### Phase 2 — OpenRouter

**PR-8 · OpenRouter chat wrapper** — SPEC §5.1, §5.4, §16.3
- **Scope:** The single `callModel(...)` used by all personas: usage/cost capture, retry/backoff,
  typed errors, timeout. No orchestration.
- **Files:** `apps/api/src/openrouter/openrouter.client.ts` (`callModel`, reads `usage.cost` +
  token/reasoning fields; 429 backoff w/ jitter max 4; 402 no-retry credits error; per-call
  timeout), `openrouter.errors.ts` (`DataPolicyError`, `OutOfCreditsError`, `RateLimitError`),
  `openrouter.types.ts` (internal request/usage shapes), `openrouter.module.ts`.
- **Done when:** a stubbed 200 returns normalized `{content, usage{…cost}, latencyMs}`; a 429 then
  200 succeeds after backoff; a 402 throws credits error without retry; the §5.3 404 body maps to
  `DataPolicyError`.
- **Out of scope:** `/models` fetch (PR-9), calling real network in code paths that ship.

**PR-9 · Model resolution + `/models/free`** — SPEC §5.2, §5.3, §10, §16.3
- **Scope:** Resolve free models at runtime (never hardcode), cache ~10 min, Mode A/B assignment,
  expose the guarded `/models/free`.
- **Files:** `apps/api/src/openrouter/models.service.ts` (`GET /models`, keep
  `prompt=="0" && completion=="0"`, sort by context desc, cache, Mode A pick/`MODE_A_MODEL`
  honor, Mode B 7-distinct + deterministic round-robin, empty-list → actionable error),
  `models.controller.ts` (`GET /models/free`, JWT-guarded, Swagger), `models.module.ts`,
  `app.module.ts` (edit: register module).
- **Done when:** `/models/free` (with token) returns the cached free list; free filter and Mode A/B
  assignment behave per §5.2; empty free list surfaces the "enable privacy toggles" message.
- **Out of scope:** using the models in a run (PR-13).

### Phase 3 — Personas

**PR-10 · Personas loader + boot validation** — SPEC §8, §16.4
- **Scope:** Load `personalities.json` (path via `PERSONAS_FILE`), validate the §8 schema, fail fast.
- **Files:** `apps/api/src/personas/personas.schema.ts` (zod: 4 advocates [2 support/2 against],
  3 judges, unique keys, non-empty `systemPrompt`), `personas.service.ts` (load at boot, expose
  typed personas, compose prompt from traits+template when needed), `personas.module.ts`.
- **Done when:** the repo-root `personalities.json` loads into 4+3 typed personas; a malformed file
  (wrong counts / dup keys / empty prompt / missing file) aborts boot with a clear message.
- **Out of scope:** the `DECISION:`/`CONFIDENCE:` output block (that is orchestrator-appended, PR-12/13);
  any UI editing of personas (forbidden by D3).

### Phase 4 — Charge sheet

**PR-11 · ChargeSheet entity + seed + endpoints** — SPEC §4.2, §4.2b, §10, §16.5
- **Scope:** First-class editable `ChargeSheet`, boot seed of Case T-001, read/list/patch endpoints
  with the single-active invariant. Endpoints built + JWT-guarded but **not** surfaced in v1 UI (D9).
- **Files:** `charge-sheet.entity.ts`, `chargesheets.service.ts` (seed from
  `charge-sheet.seed.txt`, activation invariant: setting one active clears others),
  `chargesheets.controller.ts` (`GET /charge-sheet`, `GET /charge-sheets`, `PATCH /charge-sheet/:id`,
  Swagger), `dto/patch-charge-sheet.dto.ts`, `dto/charge-sheet.response.dto.ts`,
  `chargesheets.module.ts`. *(+ generated migration, exempt.)*
- **Done when:** empty DB seeds one active T-001; `GET /charge-sheet` returns it; `PATCH …
  {isActive:true}` flips active and clears the previous; content edit persists.
- **Out of scope:** run snapshotting (PR-13); upload/paste/edit UI (deferred, D9).

### Phase 5 — Tribunal orchestration

**PR-12 · Run/Speech/Verdict entities + pure logic** — SPEC §4.3–4.5, §5.5, §5.6, §16.6
- **Scope:** Persistence shapes + the deterministic, DB-free helpers the pipeline composes. All pure
  functions (highest test value, SPEC §14.2).
- **Files:** `runs/run.entity.ts`, `runs/speech.entity.ts`, `runs/verdict.entity.ts`,
  `tribunal/prompt-builder.ts` (advocate prompt leaks no other speech; judge prompt = snapshot +
  4 speeches + strict output block; charge framed as untrusted "case text"),
  `tribunal/verdict-parser.ts` (`DECISION:`/`CONFIDENCE:` regex, clamp, needs-reask/fallback),
  `tribunal/speech-order.ts` (counterbalanced rotation by judge index, deterministic),
  `tribunal/verdict-tally.ts` (non-binding counts; **no** combined `finalDecision`). *(+ generated
  migration, exempt.)* **Near budget — split entities vs helpers if the diff runs long.**
- **Done when:** builds; helpers are exported pure functions with no side effects; entities match §4.
- **Out of scope:** the pipeline that calls them (PR-13); the tests (PR-21).

**PR-13 · Tribunal orchestration pipeline** — SPEC §5.5, §2.1, §16.6
- **Scope:** `runTribunal(...)`: load+snapshot charge sheet, resolve models, advocate phase (4
  parallel), judge phase (3 parallel, counterbalanced), budget guard, finalize (tally + token/cost
  sums). Service method, not inline in a controller (§10.1).
- **Files:** `tribunal/tribunal.service.ts`, `tribunal/budget-guard.ts` (ceiling from run snapshot;
  over → `aborted_over_budget`, persist partial), `tribunal/tribunal.module.ts`.
- **Done when:** given personas + a charge sheet + a mode (OpenRouter stubbed), it persists 4
  Speeches + 3 Verdicts + Run totals, records per-judge speech order, and never computes an
  authoritative combined verdict.
- **Out of scope:** writing economy files (PR-14); the HTTP endpoint (PR-15).

### Phase 6 — Economy

**PR-14 · Economy builder + file/ledger writer + endpoints** — SPEC §6, §10, §16.7
- **Scope:** Build the per-run economy object, write `data/runs/<id>.json` + append
  `data/ledger.jsonl`, expose download/ledger endpoints; call it from finalize.
- **Files:** `economy/economy.builder.ts` (per-persona + per-model rollup + totals, §6 shape),
  `economy/economy.writer.ts` (JSON file + append-only ledger line), `economy/economy.controller.ts`
  (`GET /runs/:id/economy` with `Content-Disposition: attachment`, `GET /economy/ledger`, Swagger),
  `economy/economy.module.ts`. *(Wire `tribunal.service` finalize to call the writer — small edit
  within budget.)*
- **Done when:** a completed run writes a spec-shaped JSON file and a ledger line; the endpoints
  serve them; free-model costs show as `0.00`.
- **Out of scope:** the UI economy panel (PR-18).

### Phase 7 — Runs API + hardening

**PR-15 · Runs API** — SPEC §10, §10.1, §16.8
- **Scope:** The run endpoints. `POST /runs` runs the pipeline synchronously and returns; list + get.
- **Files:** `runs/runs.controller.ts` (`POST /runs`, `GET /runs`, `GET /runs/:id`, JWT-guarded,
  Swagger 200/201/401/402/404), `runs/runs.service.ts` (list/get; delegates execution to
  `tribunal.service`), `runs/dto/create-run.dto.ts` (`{mode, modelSingle?, chargeSheetId?}`),
  `runs/dto/run-response.dto.ts`, `runs/runs.module.ts`.
- **Done when:** `POST /runs {mode:A_single}` returns a completed run with 4 speeches + 3 verdicts +
  economy; `GET /runs/:id` returns the full run; list paginates.
- **Out of scope:** async/202/SSE (deferred, §10.1); frontend.

**PR-16 · Hardening: exception filter, input caps, CORS** — SPEC §12, §13, §16.10
- **Scope:** Turn typed errors into correct HTTP responses; bound input; lock CORS.
- **Files:** `common/all-exceptions.filter.ts` (`DataPolicyError`→404 actionable body,
  `OutOfCreditsError`→402, budget→partial 200), `common/charge-sheet-size.pipe.ts` (or validator)
  capping charge-sheet chars, `common/common.module.ts`, `apps/api/src/main.ts` (edit: register
  filter + `CORS_ORIGINS`).
- **Done when:** the §5.3 404 returns the actionable message (not 500); 402 returns the credits
  message; oversized charge-sheet content is rejected; CORS allows only configured origins.
- **Out of scope:** the test suite that asserts these (PR-23).

### Phase 8 — Frontend

**PR-17 · Web: New Run page + clients** — SPEC §11, §16.9
- **Scope:** New Run page: read-only active charge sheet, Mode A/B toggle, Mode-A model picker,
  submit → `POST /runs` → navigate on completion. Plus the typed clients it needs.
- **Files:** `apps/web/src/api/runs.ts`, `apps/web/src/api/models.ts`,
  `apps/web/src/api/chargeSheet.ts`, `apps/web/src/components/ModeToggle.tsx`,
  `apps/web/src/pages/NewRun.tsx` (charge sheet **read-only** — no textarea/upload/edit, D9; Run
  button disabled while in flight), `apps/web/src/app/routes.tsx` (edit).
- **Done when:** page shows the active charge sheet read-only; Mode A reveals the model picker, Mode
  B hides it; submit payload carries `mode` (+ `modelSingle` only in A); button disables in flight.
- **Out of scope:** rendering results (PR-18).

**PR-18 · Web: Run Result page + cards** — SPEC §11, §6c, §16.9
- **Scope:** Result view: 4 SpeechCards (support/against columns), 3 VerdictCards, non-binding
  tally, Economy panel with Download JSON. **Near budget — cards are the bulk.**
- **Files:** `components/SpeechCard.tsx`, `components/VerdictCard.tsx` (justified/not_justified
  badge + confidence + protocol), `components/VerdictTally.tsx` ("no combined verdict" label),
  `components/EconomyPanel.tsx` (per-persona + per-model + totals; "$0.00 (free)"; Download JSON),
  `pages/RunResult.tsx`.
- **Done when:** all four speeches and three verdicts render; the tally shows counts + its
  non-binding label with **no** single "final verdict" element; Download JSON fetches the economy
  file.
- **Out of scope:** History (PR-19).

**PR-19 · Web: History page + navigation** — SPEC §11, §16.9
- **Scope:** History table from `GET /runs`; row click → Run Result; nav links.
- **Files:** `pages/History.tsx`, `apps/web/src/api/runs.ts` (edit: list), `apps/web/src/app/App.tsx`
  (edit: nav + route).
- **Done when:** rows render from `GET /runs`; clicking a row opens its result.
- **Out of scope:** everything already shipped.

### Phase 9 — Swagger + tests

**PR-20 · Swagger bootstrap + `openapi.json` emit** — SPEC §15.1, §16.11
- **Scope:** Mount Swagger UI and emit the spec. (Per-endpoint decorators already landed with their
  PRs.)
- **Files:** `apps/api/src/main.ts` (edit: `DocumentBuilder` title/version, `.addBearerAuth()`,
  `SwaggerModule.setup('api/docs', …)`, gate in prod), `apps/api/src/swagger.ts` (build doc + write
  `openapi.json` artifact).
- **Done when:** `/api/docs` renders with every §10 endpoint, the enums, the bearer scheme, and the
  401/402/404 bodies; `openapi.json` is emitted on build.
- **Out of scope:** generating the FE client from it (optional, not v1).

**PR-21 · Backend unit tests — pure logic** — SPEC §14.2, §16.10
- **Scope:** Test the DB-free helpers from PR-12 (highest value).
- **Files:** specs for verdict parser, verdict tally (asserts no combined verdict), free-model
  filter/assignment, counterbalanced order, prompt builders (no speech leak; injection framing) +
  `test/fixtures/` for `/models` and chat responses. ~6–7 files.
- **Done when:** all pass; cover the §14.2 cases for these components; no network.
- **Out of scope:** I/O-module tests (PR-22).

**PR-22 · Backend unit tests — I/O modules (nock)** — SPEC §14.2, §16.10
- **Scope:** Test modules that touch HTTP/DB/files with everything stubbed.
- **Files:** specs for OpenRouter client (nock: cost/tokens, 429 backoff, 402, 404 data-policy,
  timeout), economy builder + writer, budget guard, personas loader, charge-sheet invariant, auth
  (hash/JWT/seed idempotency) + fixtures. ~7 files.
- **Done when:** all pass; §14.2 I/O cases covered; no real network.
- **Out of scope:** e2e (PR-23).

**PR-23 · Backend integration/e2e** — SPEC §14.3, §16.10
- **Scope:** Supertest + Testcontainers-postgres + nock end-to-end paths.
- **Files (in `apps/api-e2e`):** auth+guard e2e, full-run happy path (file + ledger written), Mode B
  distinct-model rows, charge-sheet activation/snapshot, failure surfaces (404 data-policy / 402 /
  budget), test bootstrap (testcontainers + nock helpers). ~7 files.
- **Done when:** the §14.3 suite passes in CI with OpenRouter fully mocked.
- **Out of scope:** frontend tests.

**PR-24 · Frontend component tests — results & panels** — SPEC §14.4, §16.10
- **Scope:** Vitest + RTL + MSW for the result-side UI.
- **Files:** MSW setup/handlers, VerdictCard, Verdict-list+tally (no "final verdict" element),
  EconomyPanel (Download JSON), ModeToggle, SpeechCard grouping. ~7 files.
- **Done when:** the covered §14.4 rows pass; MSW mocks the backend (no real calls).
- **Out of scope:** flow/client tests (PR-25).

**PR-25 · Frontend component tests — flows & client** — SPEC §14.4, §16.10
- **Scope:** The remaining §14.4 rows.
- **Files:** NewRun (read-only charge sheet; no upload/edit control — guards D9; button disabled in
  flight), Login flow (token stored; protected redirect), API client (Bearer; 401 clear+redirect;
  data-policy banner), History (rows + row-click nav) + shared MSW handlers. ~6 files.
- **Done when:** these §14.4 rows pass; coverage gate on core modules met (§14.1).
- **Out of scope:** optional Playwright e2e (§14.5, not v1).

### Phase 10 — Docs

**PR-26 · Docs: READMEs, `.env.example`, module docblocks** — SPEC §15.2, §15.3, §16.11
- **Scope:** Finalize written docs.
- **Files:** root `README.md` (what it is, §3 diagram, docker-compose run, the two modes, economy
  output, Nx commands + layout), `apps/api/README.md` (env table §9, DB/migrations, seeding user +
  charge sheet, **the OpenRouter privacy-toggle §5.3 note prominently**, Nx targets, data paths),
  `apps/web/README.md` (API base URL, serve/build/test), `.env.example` (edit: final pass),
  docblocks atop `tribunal/`, `openrouter/`, `economy/` index files explaining the pipeline + the
  "protocol" concept. ~7 files.
- **Done when:** the READMEs cover §15.2; `.env.example` documents every §9 var; the privacy-toggle
  requirement is called out; TSDoc on the public service methods (§15.3).
- **Out of scope:** anything code-behavioral.

---

## 5. Acceptance mapping (SPEC §17 → PRs)

| §17 acceptance item | Delivered by |
|---|---|
| Seeded user logs in; unauth rejected | PR-5, PR-6 |
| T-001 seeded, shown read-only; editable via PATCH, future-only | PR-11, PR-17 |
| Run → 4 speeches + 3 independent verdicts + budget; no combined verdict; immutable snapshot | PR-12, PR-13, PR-15 |
| Mode A one model; Mode B distinct per persona (recorded) | PR-9, PR-13 |
| Real usage/cost captured; per-run JSON + ledger; shown in UI with JSON download | PR-8, PR-14, PR-18 |
| 404 data-policy → actionable message | PR-8, PR-16 |
| $5 (configurable) ceiling enforced (`aborted_over_budget`) | PR-13, PR-16 |
| Personas load or app refuses to start | PR-10 |
| Swagger at `/api/docs` + `openapi.json` | per-endpoint PRs + PR-20 |
| Test suites pass in CI, OpenRouter mocked, coverage gate | PR-21 … PR-25 |

Every §17 line is covered, and no PR introduces a deferred feature (upload/paste UI, SSE, refresh
tokens, multi-user, rebuttals).

---

## 6. Notes & open follow-ups (explicitly out of v1 scope)

- **CI pipeline** (`nx affected -t build test lint`) is assumed to be configured once tests exist
  (from PR-21 on). If a CI config file is wanted as its own increment, add it as a small PR after
  PR-20; it is not counted above.
- **Splitting the near-budget PRs** (12, 18) is pre-authorized: if a real diff exceeds either
  ceiling, split entities/helpers (PR-12) or cards/page (PR-18) into two PRs rather than overrun.
- **Deferred by SPEC, not planned here:** upload/paste + charge-sheet edit UI (D9), SSE streaming,
  refresh tokens, multi-user, rebuttal rounds, Nx Cloud remote cache, Playwright e2e (§14.5).

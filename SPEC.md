# Tribunal — Build Specification (SPEC.md)

> **Purpose of this file.** This is the authoritative build blueprint for the "Tribunal" project.
> It is written for an implementing agent (Claude) to read and build from directly. Every design
> decision below is *settled* — there are no open questions. Where the source `INTENT.txt` was
> ambiguous, the resolution was decided with the project owner (Rotem) and is recorded here as
> fact. If reality (an API, a library) contradicts this spec at build time, prefer reality and
> note the deviation, but do not silently change a *decision* recorded here without owner approval.

Last updated: 2026-08-25. Derived from `INTENT.txt` + owner decisions + web research (sources at bottom).

---

## 1. What Tribunal is

Tribunal is a web app that simulates a courtroom deliberation over a **charge sheet** (free text
describing an alleged crime) using LLM personas:

- **4 advocates** — 2 arguing *for* the accused (`support`), 2 arguing *against* (`against`). Each
  has a fixed personality (its own system prompt). Each produces one persuasive **speech**.
- **3 judges** — each has a fixed personality. Each reads the charge sheet **and all four speeches**
  and produces a **verdict** (justified / not_justified + confidence + written reasoning = the
  "protocol"). "Justified" favors the accused (the act was lawful/necessary); "not_justified" is
  against the accused.
- The system's **output** is exactly what `INTENT.txt` specifies (lines 14–15): the **three
  independent verdicts** (`verd1`, `verd2`, `verd3`), each with its **protocol** (how that judge
  decided), plus the **code budget** (token/cost economy for the run). The tribunal does **not**
  combine the three opinions into a single verdict and does not impose a sentence — this is required
  by INTENT's output clause and stated explicitly in the source dossier's scope note. A non-binding
  vote *tally* may be shown for convenience (see D5/§4.3), but it is a display of the three verdicts,
  not a ruling.

One full run = **7 LLM calls** (4 advocates, then 3 judges).

### 1.1 The two run modes (owner-confirmed meaning)

Selected per-run via a toggle. Exactly one mode runs per run.

- **Mode A — "single model":** one model ID serves all 7 personas. Only the system prompts differ.
- **Mode B — "model per persona":** each of the 7 personas runs a model the user **explicitly picks**
  for it (free or paid), from OpenRouter's live model list. The New Run UI requires all 7 to be chosen
  before the run can start (§11); the API also accepts an auto-assignment fallback (§5.2). This is the
  interesting comparison against Mode A.

### 1.2 Non-goals (v1)

- No rebuttal / multi-round debate. Advocates are **blind**: each sees only its own system prompt +
  the charge sheet, never another advocate's speech. (Judges see everything.) Architecture must
  leave room to add rounds later, but v1 does not implement them.
- No multi-user system. One seeded user only (see §7).
- No real-time streaming of tokens to the UI in v1 (a run executes server-side and returns when
  complete, with a progress state). SSE streaming is a documented future extension, not v1 scope.

---

## 2. Owner decisions (the settled answers)

| # | Question | Decision |
|---|----------|----------|
| D1 | Are charge sheets ever sensitive/private? | **No — always fictional/demo.** Free models are fine; enabling OpenRouter's "may train on / may publish prompts" privacy toggles is acceptable (required for free endpoints — see §5.3). **Revised (owner, 2026-09-01): paid models are now permitted** — the owner funded the account. Free stays the default in the UI; paid models are opt-in (§2.1/§5.2/§11). The OpenRouter key carries its own **$5 hard spend cap**, which is the ultimate backstop on top of the per-run ceiling (§5.5). |
| D2 | Auth / user model | **Single seeded user + JWT.** One username/password seeded at setup; JWT gates the API. No public registration. |
| D3 | Personalities configurable? | **Fully baked-in, loaded from an owner-provided file.** Not editable in the UI. See §8 for the required file contract. |
| D4 | Debate depth | **Single blind round.** Advocates get only their persona + charge. Judges get persona + charge + all 4 speeches. No rebuttals. |
| D5 | Verdict format | **Justified / Not_justified + confidence (0–100) + reasoning (= the protocol).** Labels are `justified` / `not_justified` (not guilty/not-guilty) because a tribunal decides whether the alleged act was *justified* — matching the source dossier's scope note ("The Tribunal decides justified / not justified and gives reasons"). `justified` = for the accused; `not_justified` = against. **Revised (INTENT re-check):** the system does **not** produce an authoritative combined/majority verdict — INTENT's output clause lists only the 3 verdicts + protocols + code budget, and the dossier scope note says it "does not… combine the three opinions into one verdict." An optional, clearly-labeled **non-binding vote tally** (counts of the 3) may be shown for convenience only. |
| D6 | Mode B meaning | **Different model per persona** (from the live free list). Mode A = one model for all. |
| D7 | Mode selection | **Per-run toggle.** One mode per run. |
| D8 | Cost/economy output | **Per-run JSON file + cumulative ledger file**, both persisted and downloadable; the run's economy is **also shown in the UI** alongside the final output. |
| D9 | Charge sheet handling | **Stored in the DB and loaded by the program**, seeded from the canonical Case T-001 (from the dossier). For now the UI has **no upload/paste and no edit control** — a run uses the stored active charge sheet. But the charge sheet is a **first-class editable DB entity** (editable via API/DB, snapshotted per run), so exposing editing/upload later is a UI change only, not a data-model change. |

### 2.1 Decisions the implementer makes (low-stakes, stated so nothing is left open)

- **UI language:** English. (Model output naturally follows the charge sheet's language.)
- **Charge sheet input:** the program loads the **stored active charge sheet** from the DB (seeded
  from Case T-001). The `.txt` upload / paste textarea from `INTENT.txt` is **deferred** — the entity
  and API are built editable now, but the New Run UI does not expose editing or upload yet (D9).
- **Model selection:** resolved at runtime from OpenRouter `GET /models` (do **not** hardcode model
  names; the roster changes monthly). The candidate list keeps every model usable as a text
  advocate/judge (text output, not a blacklisted task type — §5.2), **both free and paid**, each
  carrying its price and an `isFree` flag. The UI shows **free by default with paid opt-in** (§11);
  "Auto" resolves to the top free model. Free models still require the §5.3 privacy toggles; paid
  models do not.
- **Position-bias mitigation:** the order in which the 4 speeches are shown to each judge is
  **counterbalanced** (rotated per judge) and the exact order is recorded per run. Rationale: LLM
  judges measurably favor whichever argument they read first (§ research).
- **Temperatures:** advocates `0.9` (persuasive), judges `0.2` (consistent). Configurable via env.
- **Concurrency:** the 4 advocate calls run in parallel; then the 3 judge calls run in parallel.
  Stays within OpenRouter's 20 requests/minute cap comfortably.
- **Database runtime:** PostgreSQL runs **locally on the host** (natively installed and
  running), not in Docker (owner decision, 2026-08-27). `DATABASE_URL` points at that local
  instance; the repo ships **no** `docker-compose.yml`.

---

## 3. Architecture overview

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

- **Monorepo:** a single **Nx** workspace holds both apps and the code they share (§3.2). Package
  scope is `@nx/*` (current, not `@nrwl/*`).
- **`apps/api` (Backend):** NestJS (TypeScript), TypeORM, PostgreSQL. Owns all LLM orchestration,
  cost accounting, persistence, auth. The frontend never talks to OpenRouter directly (the API key
  stays server-side).
- **`apps/web` (Frontend):** React + Tailwind (Vite). Talks only to the backend.
- **`libs/shared-types` (shared):** the request/response **interfaces** and **enums** (`mode`,
  `decision`, run `status`) are defined **once** here and imported by both apps — the main reason to
  use a monorepo; it removes front/back contract drift. **Framework-free TypeScript only** (no
  NestJS, class-validator, or Swagger imports — those would bloat the browser bundle). Consequence:
  the api's DTO *classes* (which carry `@ApiProperty` + class-validator decorators for Swagger and
  validation, §15.1) live in `apps/api` and **`implements`** the shared interfaces; `apps/web`
  imports only the plain interfaces/enums. One source of truth for the shape, decorators only where
  they're needed.
- **Auth:** JWT bearer tokens between front and back.

### 3.1 Repository layout (Nx workspace)

```
Tribunal/                        # Nx workspace root
├─ INTENT.txt                    # original brief (do not edit)
├─ SPEC.md                       # this file
├─ personalities.json            # owner-provided persona definitions (§8) — REQUIRED to build/run
├─ charge-sheet.seed.txt         # canonical Case T-001 text; seeded into the DB on first boot (§4.2b)
├─ .env.example                  # documents every env var (§9)
├─ nx.json                       # Nx config: target defaults, caching, named inputs (§3.2)
├─ package.json                  # ONE root package.json for the whole workspace
├─ tsconfig.base.json            # path aliases, incl. @tribunal/shared-types → libs/shared-types
├─ apps/
│  ├─ api/                       # NestJS backend  (nx g @nx/nest:app apps/api)
│  │  ├─ src/
│  │  │  ├─ main.ts              # bootstraps Nest + Swagger (§15.1)
│  │  │  ├─ app/app.module.ts
│  │  │  ├─ config/              # env loading + validation (@nestjs/config + zod/joi)
│  │  │  ├─ auth/                # login, JWT strategy, guard, seed user
│  │  │  ├─ users/               # User entity + seed
│  │  │  ├─ personas/            # loads & validates personalities.json at boot
│  │  │  ├─ chargesheets/        # ChargeSheet entity, seed, CRUD
│  │  │  ├─ openrouter/          # HTTP client, model list cache, chat wrapper, retry/backoff
│  │  │  ├─ tribunal/            # orchestration: advocates → judges → verdicts (no combined verdict)
│  │  │  ├─ runs/                # Run/Speech/Verdict entities, run controller
│  │  │  └─ economy/             # cost aggregation, JSON file + ledger writer
│  │  ├─ data/                   # written run JSON files + ledger.jsonl (gitignored)
│  │  ├─ project.json            # Nx targets: build/serve/test/lint (Jest via @nx/jest)
│  │  └─ tsconfig.*.json
│  ├─ api-e2e/                   # backend e2e (Supertest) — nx g @nx/nest:app or jest e2e project
│  └─ web/                       # React frontend  (nx g @nx/react:app apps/web --bundler=vite)
│     ├─ src/
│     │  ├─ main.tsx, app/App.tsx
│     │  ├─ api/                 # typed fetch client (uses @tribunal/shared-types), auth token
│     │  ├─ pages/               # Login, NewRun, RunResult, History
│     │  ├─ components/          # SpeechCard, VerdictCard, EconomyPanel, ModeToggle, VerdictTally…
│     │  └─ styles/
│     ├─ index.html
│     ├─ src/styles.css           # Tailwind v4 CSS-first: @import 'tailwindcss' + @theme tokens
│     ├─ vite.config.ts          # Vitest configured here too
│     └─ project.json            # Nx targets: build/serve/test (Vitest via @nx/vite)/lint
├─ apps/web-e2e/                 # Playwright e2e (optional) — @nx/playwright
└─ libs/
   └─ shared-types/              # framework-free DTOs/enums shared by api + web
      ├─ src/index.ts            # public barrel; import path @tribunal/shared-types
      └─ project.json            # buildable lib (@nx/js)
```

> Domain modules stay inside `apps/api/src` for a project this size. If they grow, extract them to
> `libs/api/<domain>` later — an Nx move, not a redesign. Only truly shared, framework-free contract
> types belong in `libs/shared-types`.

### 3.2 Nx workspace conventions
- **Create:** `npx create-nx-workspace@latest tribunal --preset=apps` (integrated monorepo), then
  `nx add @nx/nest @nx/react @nx/js`. Generate: `nx g @nx/nest:app apps/api`,
  `nx g @nx/react:app apps/web --bundler=vite`, `nx g @nx/js:lib libs/shared-types --bundler=tsc`.
- **One root `package.json`** for the whole workspace (single dependency tree, single lockfile).
- **Task running:** `nx serve api`, `nx serve web`, `nx build <app>`, `nx test <project>`,
  `nx lint <project>`, `nx run-many -t test`, and **`nx affected -t build test lint`** in CI so only
  projects touched by a change (and their dependents) run. Nx computes the project graph from imports.
- **Caching:** `nx.json` sets `targetDefaults` with `cache: true` for build/test/lint and
  `dependsOn: ["^build"]` so a project builds its lib deps first. Named `inputs` exclude test files
  from build hashing. Local cache by default; remote cache (Nx Cloud) optional and out of v1 scope.
- **Module boundaries:** tag each project in `project.json` (`scope:api` | `scope:web` |
  `scope:shared`, and `type:app` | `type:lib`) and enable the `@nx/enforce-module-boundaries` lint
  rule so, e.g., `web` cannot import server code and everything may import `scope:shared`. This is
  what keeps the OpenRouter key and TypeORM entities from ever leaking into the browser bundle.
- **Path alias:** `@tribunal/shared-types` (declared in `tsconfig.base.json`) is how both apps import
  the shared contract. Optionally the `openapi.json` from Swagger (§15.1) generates these types into
  the lib to guarantee they match the running API.

---

## 4. Data model (TypeORM entities, PostgreSQL)

Use UUID primary keys, `createdAt`/`updatedAt` timestamps on all tables. Money stored as
`numeric(12,6)` USD. Token counts as `integer`.

### 4.1 `User`
| column | type | notes |
|--------|------|-------|
| id | uuid PK | |
| username | varchar unique | seeded (§7) |
| passwordHash | varchar | argon2id (preferred) or bcrypt |
| createdAt | timestamptz | |

### 4.2 `ChargeSheet`
The case text fed to every persona. A first-class, **editable** entity (D9). One row is `isActive`.
| column | type | notes |
|--------|------|-------|
| id | uuid PK | |
| title | varchar | e.g. `T-001: The Realm v. Jon Snow` |
| content | text | the full charge-sheet text sent to the models (premises + agreed facts + question + scope) |
| isActive | boolean | exactly one active at a time; the run pipeline loads the active one by default |
| createdAt / updatedAt | timestamptz | `updatedAt` changes when edited |

> **Editable, but runs are immutable.** Editing a `ChargeSheet` (via API/DB) changes future runs
> only. Each `Run` snapshots the exact text it used (`chargeSheetSnapshot` below), so past runs and
> their protocols stay reproducible even after the charge sheet is edited.

### 4.2b Seeding the charge sheet
On backend boot, if no `ChargeSheet` exists, seed one from `charge-sheet.seed.txt` (path overridable
via `CHARGE_SHEET_SEED_FILE`) with `title = "T-001: The Realm v. Jon Snow"` and `isActive = true`.
This is the canonical case extracted from the owner's dossier.

### 4.3 `Run`
| column | type | notes |
|--------|------|-------|
| id | uuid PK | |
| userId | uuid FK → User | owner of the run |
| chargeSheetId | uuid FK → ChargeSheet | which stored charge sheet was used |
| chargeSheetSnapshot | text | exact charge-sheet text at run time (audit/reproducibility) |
| mode | enum(`A_single`,`B_per_persona`) | §1.1 |
| status | enum(`pending`,`running`,`completed`,`failed`,`aborted_over_budget`) | |
| modelSingle | varchar null | Mode A: the one model id used |
| costCeilingUsd | numeric(12,6) | copied from config at run start (default 5.000000) |
| verdictTally | jsonb null | **non-binding** count of the 3 verdicts for display only, e.g. `{ "justified": 2, "not_justified": 1 }`. NOT a combined verdict — the system issues none (INTENT §14–15 + dossier scope note). Null until completed. |
| totalPromptTokens | integer | |
| totalCompletionTokens | integer | |
| totalTokens | integer | |
| totalCostUsd | numeric(12,6) | Σ of all call costs (0 for free models) |
| speechOrderByJudge | jsonb | recorded counterbalanced order per judge (audit) |
| error | text null | populated on failure — a **user-safe** message (§12.1), never the raw cause (raw goes only to the §5.7 log) |
| errorCode | enum(`ErrorCode`) null | stable machine code for the failure/flag (§12.1); e.g. `MODEL_UNAVAILABLE`, or `VERDICT_UNREADABLE` on a completed run that fell back (§5.6) |
| createdAt / completedAt | timestamptz | |

### 4.4 `Speech` (one per advocate call)
| column | type | notes |
|--------|------|-------|
| id | uuid PK | |
| runId | uuid FK → Run | |
| personaKey | varchar | e.g. `support_1`, `against_2` (§8) |
| side | enum(`support`,`against`) | |
| model | varchar | model id actually used |
| systemPrompt | text | exact prompt sent (audit/reproducibility) |
| content | text | the speech |
| promptTokens / completionTokens / totalTokens | integer | from `usage` |
| reasoningTokens | integer null | if the model reports it |
| costUsd | numeric(12,6) | from `usage.cost` |
| latencyMs | integer | |
| createdAt | timestamptz | |

### 4.5 `Verdict` (one per judge call)
| column | type | notes |
|--------|------|-------|
| id | uuid PK | |
| runId | uuid FK → Run | |
| personaKey | varchar | e.g. `judge_1` |
| model | varchar | model id used |
| systemPrompt | text | exact prompt sent |
| decision | enum(`justified`,`not_justified`) | parsed from model output |
| confidence | integer | 0–100, parsed |
| reasoning | text | the judge's **short opinion** (parsed from `OPINION:`, §5.6); full text in `rawResponse` |
| rawResponse | text | full model text (fallback if parsing partial) |
| truncated | boolean | default `false`; the judge's opinion could not be read — the model's reply was **cut off** (`finish_reason = length`, common on free models' small token caps), a re-ask still failed (conservative fallback, §5.6), or the parsed opinion was empty. `decision` + `confidence` are still shown; only the **opinion body** is replaced by a friendly "recess" placeholder in the card (§5.6/§11). |
| speechOrderShown | jsonb | order of speeches this judge saw (audit) |
| promptTokens / completionTokens / totalTokens | integer | |
| reasoningTokens | integer null | |
| costUsd | numeric(12,6) | |
| latencyMs | integer | |
| createdAt | timestamptz | |

> The cumulative **ledger** is derived (a query over `Run`) *and* mirrored to a file (§6). No
> separate ledger table is required, but `data/ledger.jsonl` is the on-disk artifact `INTENT.txt`
> asks for.

---

## 5. LLM orchestration & OpenRouter integration

### 5.1 Provider
OpenRouter, OpenAI-compatible Chat Completions API.
- Base URL: `https://openrouter.ai/api/v1`
- Auth header: `Authorization: Bearer ${OPENROUTER_API_KEY}`
- Recommended headers: `HTTP-Referer` and `X-Title` (app attribution).
- Endpoints used:
  - `POST /chat/completions` — every persona call.
  - `GET /models` — to resolve free models at runtime (cache in memory ~10 min).

### 5.2 Model resolution (do not hardcode model names)
1. Fetch `GET /models`. Each entry exposes `id`, `context_length`, and a `pricing` object with
   per-token string prices (`prompt`, `completion`).
2. **Usable-model filter (free *and* paid):** keep every model usable as a **text advocate/judge**,
   regardless of price. Record each model's per-token `pricing.prompt` / `pricing.completion` (as
   numbers) and an **`isFree`** flag — `true` when both are exactly `"0"` (the `:free` endpoints; IDs
   typically end in `:free`). Then keep only models usable as a **text advocate/judge**:
   - **Text output only** — require `architecture.output_modalities` to be text and reject any that
     also emit `audio`. This unmasks endpoints whose token prices are `"0"` because they bill per
     second of media rather than per token (e.g. Google's Lyria music models), which the price filter
     alone lets through.
   - **Task-type blacklist** — drop models whose id contains a blacklisted substring (case-insensitive):
     classifiers, safety/moderation graders, embedders, rerankers, and audio/speech models
     (`content-safety`, `moderation`, `guard`, `embed`, `rerank`, `lyria`, `whisper`, `tts`, `stt`).
     These often return HTTP 200 with empty/degenerate text. Blacklist a **category by name token**,
     never a specific model id (ids drift monthly). Extend at runtime via `MODEL_BLACKLIST` (§9).
3. Sort candidates **free-first** (`isFree` before paid), then by price ascending, then by
   `context_length` descending (judges need room for the charge + 4 speeches). The `GET /models`
   endpoint returns this full list with pricing + `isFree`; `GET /models/free` returns the free subset
   (retained). The UI shows free by default and reveals paid on an opt-in toggle (§11).
4. **Mode A:** use `MODE_A_MODEL` env / the request's `modelSingle` if set and still a usable
   candidate (**free or paid**); else pick the top **free** candidate ("Auto").
5. **Mode B:** use the request's explicit **`modelByPersona`** map when provided — it must name a
   usable model for **all 7** persona keys (the New Run UI enforces this, §11). When the map is
   **absent**, auto-assign the first 7 distinct **free** candidates in a fixed persona order
   (round-robin to fill 7 if fewer exist) — a documented API fallback. Record the actual assignment per
   `Speech`/`Verdict`. Model swaps (§5.4) draw a replacement from the usable pool, **free-first**.
   Persist the assignment so a run is reproducible. On the **auto-assign fallback** path (no explicit
   map), the number of **distinct** models is bounded by how many free endpoints the account can
   actually call: OpenRouter gates many `:free` models to approved apps and returns **403**, so those
   are swapped out (§5.4) and Mode B can collapse to the few callable models — expected behavior, not
   a failure. Sending both `X-Title` and `HTTP-Referer` (set `OPENROUTER_APP_URL`) unlocks more of
   them. Because the 4 advocate (then 3 judge) calls run in parallel, seed the "already-placed" set
   with the whole resolved assignment before the phase starts, so a persona whose model is rejected
   *fast* (an instant 403) does not swap onto a model another persona is already mid-call with — the
   collision that otherwise collapses Mode B onto one model. Prefer a not-yet-placed replacement;
   fall back to reusing a working model (round-robin) only when the roster is exhausted.
6. Cache the resolved model list (free + paid) to avoid hammering `/models`; refresh on cache miss or
   on a 404 data-policy error (§5.3).

### 5.3 The free-model data-policy requirement (must handle explicitly)
Free endpoints are only served if the OpenRouter **account** has enabled, under Settings → Privacy:
"Free endpoints that may train on request data" **and** "Free endpoints that may publish prompts".
If disabled, **every** free model returns HTTP **404** `"No endpoints available matching your data
policy"`. Owner accepts this (D1). The backend must:
- Detect this specific 404 and surface an **actionable** error to the UI: *"No free models are
  available for your OpenRouter account. Enable the two free-endpoint privacy toggles in OpenRouter
  Settings → Privacy, or configure a paid model."*
- Not treat it as a generic failure.

### 5.4 Chat call wrapper (`openrouter` module)
Single function used by all personas:

```
callModel({ model, systemPrompt, userPrompt, temperature, maxTokens }) → {
  content, usage: { promptTokens, completionTokens, totalTokens, reasoningTokens?, costUsd }, latencyMs
}
```

- `usage.cost` is **always** returned by OpenRouter (USD; `0` for free models). Read it directly —
  do **not** estimate cost from token counts. Also read `usage.prompt_tokens`,
  `usage.completion_tokens`, and `usage.completion_tokens_details.reasoning_tokens` when present.
- **Disable model reasoning** on every persona call by sending `reasoning: { enabled: false }`
  (toggle `DISABLE_MODEL_REASONING`, default on). Many free models otherwise emit their entire
  chain-of-thought as the message *content* and exhaust `MODEL_MAX_TOKENS` before ever producing the
  verdict block (§5.6) — turning a clean 3-line answer into multi-KB of gibberish (empirically, one
  model went from a 140s truncated think-dump to a 2s clean answer). A model that *requires*
  reasoning returns a 400 ("Reasoning is mandatory … cannot be disabled"); that is mapped to
  `ModelUnavailableError` (swap) like any other unusable model.
- **Retry/backoff:** on HTTP 429 (rate limit) retry with exponential backoff (e.g. 1s, 2s, 4s; max
  4 attempts, jitter). On HTTP 402 (out of credits) abort the whole run with a clear message. On
  the §5.3 404, abort with the actionable message.
- **Model-specific rejection → swap, don't fail the run:** the following are each mapped to a typed
  error for *that model only* — the pipeline marks it unavailable and swaps to another free model
  (§5.2) instead of aborting the run:
  - an HTTP **403** (model gated/restricted → `ModelUnavailableError`);
  - a **provider-side error** — an HTTP **400** *or* a **5xx** that OpenRouter tags with provider
    metadata ("Provider returned error" / `INVALID_ARGUMENT` / `provider_name` / "Upstream error …
    temporarily overloaded" — e.g. a Google AI Studio free model that rejects or fails the request →
    `ModelUnavailableError`);
  - a **per-call timeout** (§ Timeout below → `ModelTimeoutError`) — several free endpoints hang;
  - an **HTTP 200 with empty text** (some "free" models are classifiers, or reasoning models that
    spend the whole token budget on hidden reasoning and return nothing usable) — treated as
    unavailable in the pipeline so an empty speech/verdict is never persisted.

  A 400/5xx that is **not** a provider error (an OpenRouter-level validation failure of our own
  request, or a bare gateway error with no provider fingerprint) still surfaces as a hard error so a
  real bug is not masked. Swaps are bounded (a few attempts per persona), then the run fails.
- **Timeout:** per-call timeout (e.g. 90s), configurable. The timeout **must cover the response-body
  read**, not just the connection/headers: free endpoints return headers in milliseconds and then
  stream a whitespace-padded body while the upstream generates (sometimes for minutes, sometimes
  never finishing), so the abort timer stays armed through the body read.

### 5.5 Run pipeline (`tribunal` module)
1. Load the charge sheet: use the request's `chargeSheetId` if given, else the `isActive`
   `ChargeSheet`. Create `Run` (status `running`), set `chargeSheetId`, copy its `content` into
   `chargeSheetSnapshot`, and snapshot `costCeilingUsd` from config. All later steps use the
   snapshot, never re-read the entity (so a mid-flight edit cannot change this run).
2. Resolve models for the chosen mode (§5.2).
3. **Advocate phase** — build each advocate's prompt = `{ system: persona.systemPrompt, user:
   chargeSheetSnapshot }`. The advocate prompt constrains output to the in-character speech only — no preamble, meta-commentary, headings, or stage directions — and a conservative sanitizer strips a leading filler line if one slips through. Run the 4 calls in parallel. Persist a `Speech` per call. After each call, add
   its `costUsd` to the running total; if total > `costCeilingUsd`, stop, set status
   `aborted_over_budget`, persist what exists, still write economy, and return. (With free models this
   never triggers; with **paid models it is now live** — D1. On top of it, the OpenRouter **key's own
   $5 hard cap** is the ultimate backstop: once hit, calls return 402 → the run fails with the
   `OUT_OF_CREDITS` message (§12.1), no partial spend beyond the cap.)
4. **Judge phase** — for each judge, compute a **counterbalanced speech order** (rotate the 4
   speeches by judge index; record it). Build prompt = `{ system: judge.systemPrompt, user:
   chargeSheetSnapshot + rendered speeches in that order + a strict output-format instruction }`. Run the 3
   calls in parallel. Parse each into a short `{ decision, confidence, reasoning }` — `reasoning` holds the judge's brief opinion, not a long protocol (§5.6). Persist a
   `Verdict` per judge. Apply the budget guard as in step 3.
5. **Finalize** — do **not** compute an authoritative combined verdict (INTENT outputs the 3
   verdicts as-is). Optionally compute `verdictTally` = counts of the 3 `decision` values for
   non-binding display. Sum tokens and cost across all 7 calls into the `Run`.
6. Write the economy JSON file + append to the ledger (§6). Set status `completed`, `completedAt`.

**Execution is asynchronous (see §10.1):** `POST /runs` creates the `Run` (status `running`) and returns `{ runId }` immediately, then runs the phases in the background. If any step throws (including the §5.3 data-policy 404 or the §5.4 402), the run is persisted with status `failed` and an `error` message rather than surfacing as an HTTP error on the POST — the frontend reads it while polling. Speeches and verdicts are persisted as each call resolves, so `GET /runs/:id/progress` reports which personas have finished.

### 5.6 Verdict output parsing (robust)
Each judge is instructed to answer with **only** a short, strict, machine-readable block — a brief
opinion instead of a long protocol, so the output stays on-signal. Prompt suffix (exact intent,
wording may be tuned; include a concrete example to maximize compliance):

> "Do NOT write a long protocol. Output ONLY these three lines and nothing else:
> `OPINION: <your verdict in 1-3 plain sentences>`
> `CONFIDENCE: <integer 0-100>`
> `DECISION: justified` — or — `DECISION: not_justified`"

Parser: case-insensitive regex for `OPINION:`, `CONFIDENCE:`, and `DECISION:`. First strip any
balanced `<think>` / `<thinking>` / `<reasoning>` blocks so a verdict a model *rehearsed inside its
own reasoning* is never read as the final answer (free-form think prose is prevented at the source by
disabling reasoning, above). For both `DECISION` and `CONFIDENCE`, take the **last** match — a model
that restates or echoes the format before its real answer must not win over it. The `CONFIDENCE`
match is tolerant (accepts a trailing `%`, a "confidence level:" lead-in, and surrounding words) to
fix the observed inconsistency where the number was dropped or reformatted; it is clamped to 0-100.
`reasoning` is set to the parsed `OPINION` (falling back to the block-stripped text if `OPINION` is
absent but `DECISION` parsed). If `DECISION` or `CONFIDENCE` is missing, do a single one-shot re-ask
("Reply with ONLY the three lines…") using the same model; if it still fails, store `rawResponse`,
mark the verdict `decision` via a conservative fallback (`justified` = benefit of the doubt to the
accused) with `confidence: 0`, and flag the run in `error`. Always keep `rawResponse`.

**Truncated-opinion flag (`truncated`).** Free models cap completion tokens, so a judge's reply can
stop **mid-opinion** (or a slow model can time out) — leaving a `decision`/`confidence` we can still
use but no readable opinion. Set `truncated = true` on the persisted verdict when **any** of: the
final judge call's `finish_reason` is `length` (the reply was cut off at `max_tokens`); the
conservative fallback above was used (parsing failed even after the re-ask); or the parsed opinion is
empty/whitespace. The verdict still carries its parsed-or-fallback `decision` and `confidence`
unchanged — **only the opinion display is affected**: the card (§11) shows a short, friendly "the
judge stepped out for a recess" placeholder instead of dumping the cut-off/garbled text. `rawResponse`
is always kept for forensics regardless.

### 5.7 Diagnostic logging (`logging` module — backend observability)

**Goal:** after the fact, be able to *see why an OpenRouter call or a run failed* without re-running
it. Every OpenRouter failure is already typed (§5.4), but today it only reaches the console
(`Logger.warn/error` in the `tribunal` swap loop and `AllExceptionsFilter`), so it is lost the moment
the terminal scrolls. This clause adds a durable, file-based diagnostic log **alongside** the existing
NestJS `Logger` — the human-readable console lines stay; this is an additional structured sink, not a
replacement.

**Sink — JSONL file, no DB table (owner decision, 2026-09-01).** One append-only structured log,
rotated daily, at `apps/api/data/logs/app-YYYY-MM-DD.jsonl` (directory overridable via `LOG_DIR`;
lives under the already-gitignored `data/`, §3.1). One JSON object per line. Daily rotation bounds
file size given the full-payload entries below. **No `LogEntry` DB entity and no query API in v1** —
logs are read straight off disk (tail / download / grep). A DB-backed log table, a JWT-guarded
`GET /logs` endpoint, and a web Diagnostics page are explicitly documented **future extensions, out of
v1 scope** (mirrors how charge-sheet editing is built server-side but not surfaced in the v1 UI).

**What is captured (owner decision): OpenRouter calls + run lifecycle + errors.**
- **Every OpenRouter chat call — success *and* failure** — one entry carrying `model`, `personaKey`,
  `runId`, HTTP `status`, `latencyMs`, token `usage`, the swap `attempt` number, and (on failure) the
  typed error name (§5.4: `DataPolicyError`, `OutOfCreditsError`, `RateLimitError`,
  `ModelUnavailableError`, `ModelTimeoutError`, `OpenRouterError`).
- **Run lifecycle** — `running` → `completed` / `failed` / `aborted_over_budget`, plus each **model
  swap** event (which model was skipped, why, and which free model replaced it — §5.2/§5.4).
- **Unhandled backend errors** — whatever reaches `AllExceptionsFilter` (§12), with stack.
- **Not captured:** an inbound access log of every HTTP request (out of scope — the driver is
  OpenRouter/run debugging, not request tracing).

**Entry detail (owner decision): full request + response payloads.** For each OpenRouter call the
entry stores the **full request payload** (the `messages` incl. system prompt + charge-sheet/speeches,
`temperature`, `max_tokens`, the `reasoning` flag) and the **full response body** (or the raw error
body on a non-2xx). This is acceptable because all case content is fictional/demo (D1). The payloads
are duplicated from the DB snapshots on purpose: the log is a **standalone forensic record** that
survives even when a call is never persisted as a `Speech`/`Verdict` — e.g. an empty-200, a timeout,
or a provider rejection that gets swapped away (§5.4).

**Redaction is non-negotiable even with "full payloads."** The log must **never** contain secrets:
the `OPENROUTER_API_KEY` / outgoing `Authorization` header, the `JWT_SECRET` or any bearer token, or
`SEED_PASSWORD`. Record the request *body* and only safe headers (`X-Title`, `HTTP-Referer`, `model`);
never the `Authorization` header. (Prompts and speeches are not secret per D1; the items above always
are.)

**Entry schema** (one JSON object per line; fields not relevant to an entry's `event` are omitted/null):
```json
{
  "ts": "2026-09-01T12:00:00.000Z",
  "level": "info | warn | error",
  "event": "openrouter.call | run.lifecycle | run.swap | error.unhandled",
  "runId": "… | null",
  "personaKey": "support_1 | judge_2 | null",
  "model": "… | null",
  "status": 200,
  "latencyMs": 1234,
  "attempt": 1,
  "usage": { "promptTokens": 0, "completionTokens": 0, "totalTokens": 0, "reasoningTokens": null, "costUsd": 0 },
  "error": { "name": "ModelTimeoutError", "message": "…", "stack": "…" },
  "request": { "…": "full OpenRouter request payload, secrets stripped (openrouter.call)" },
  "response": { "…": "full response body, or raw error text on non-2xx (openrouter.call)" },
  "message": "human-readable one-liner"
}
```

**Writes are best-effort and non-blocking.** A logging failure (disk full, unwritable path) must
**never** break or fail a run — catch it and fall back to the console `Logger`. The writer stays
decoupled from the run pipeline (a thin injectable service the `openrouter` client, the `tribunal`
swap loop, and `AllExceptionsFilter` call).

**Config (adds to §9):** `LOG_DIR` (default `apps/api/data/logs`, resolved from the workspace root),
`LOG_TO_FILE` (default `true`; set `false` for console-only, e.g. under test), and `LOG_LEVEL`
(default `info`) which gates which entries are written.

**Testing (extends §14.2).** Unit-test the file writer against a temp dir: assert the JSONL line
shape, that a whole day's entries append to the correct `app-YYYY-MM-DD.jsonl`, that **secrets
(API key / `Authorization` / JWT / password) never appear** in a written line, and that a writer throw
is swallowed so the run continues. Tests default to `LOG_TO_FILE=false` so they never touch disk unless
exercising the writer itself. As always, OpenRouter is mocked (§14.1) — never assert on model prose.

---

## 6. Token economy (the tracking requirement)

Per `INTENT.txt` and D8, every completed (or aborted) run produces:

**(a) Per-run JSON file** — `apps/api/data/runs/<runId>.json`:
```json
{
  "runId": "…", "createdAt": "…", "mode": "A_single | B_per_persona",
  "chargeSheetChars": 1234,
  "verdictTally": { "justified": 2, "not_justified": 1 },
  "perPersona": [
    { "personaKey": "support_1", "personaName": "Jon Snow", "role": "advocate", "side": "support",
      "model": "…", "promptTokens": 0, "completionTokens": 0, "totalTokens": 0,
      "reasoningTokens": 0, "costUsd": 0.0 }
    // … all 7 personas
  ],
  "perModel": [ { "model": "…", "calls": 3, "totalTokens": 0, "costUsd": 0.0 } ],
  "totals": { "promptTokens": 0, "completionTokens": 0, "totalTokens": 0, "costUsd": 0.0 },
  "costCeilingUsd": 5.0, "status": "completed"
}
```

**(b) Cumulative ledger** — `apps/api/data/ledger.jsonl`: one compact JSON line appended per run
`{ runId, createdAt, mode, totalTokens, costUsd, verdictTally }`. Append-only; also reconstructable
from the DB if the file is lost.

**(c) UI display** — the RunResult page shows an **Economy panel** for that run (per-persona table,
per-model rollup, grand totals in tokens and USD) next to the verdicts, plus a **Download JSON**
button (serves file (a)) and a link to view/download the ledger.

Cost values come straight from OpenRouter `usage.cost`. For free models these are `0.0`, which is
correct and should be shown honestly (the panel notes "free model — $0.00").

---

## 7. Authentication (D2)

- **Single seeded user.** On backend boot, if no user exists, create one from `SEED_USERNAME` /
  `SEED_PASSWORD` (password hashed with argon2id). Never log the password.
- `POST /auth/login` → `{ accessToken }` (JWT signed with `JWT_SECRET`, `expiresIn = JWT_EXPIRES_IN`,
  default `1d`). Payload: `{ sub: userId, username }`.
- All `/runs*` and `/models*` routes protected by a JWT auth guard (`@nestjs/passport` +
  `passport-jwt`). `GET /auth/me` returns the current user.
- No refresh token in v1 (documented as a possible extension). Frontend stores the token in memory
  + `sessionStorage`; on 401 it routes to Login.
- CORS: allow only the frontend origin(s) from `CORS_ORIGINS`.

---

## 8. Personalities file contract (owner-provided — REQUIRED)

The owner supplies the personalities. The build **loads them from `personalities.json`** at repo
root (path overridable via `PERSONAS_FILE`), validates the schema at boot, and **fails fast** with a
clear message if it is missing or invalid. Personalities are **not** editable in the UI (D3).

**Canonical schema** (the implementer must map the owner's provided file onto this shape if it
differs; keep the mapping in `personas/`):

```json
{
  "advocates": [
    { "key": "support_1", "side": "support", "name": "…", "traits": ["…"], "systemPrompt": "…" },
    { "key": "support_2", "side": "support", "name": "…", "traits": ["…"], "systemPrompt": "…" },
    { "key": "against_1", "side": "against", "name": "…", "traits": ["…"], "systemPrompt": "…" },
    { "key": "against_2", "side": "against", "name": "…", "traits": ["…"], "systemPrompt": "…" }
  ],
  "judges": [
    { "key": "judge_1", "name": "…", "traits": ["…"], "systemPrompt": "…" },
    { "key": "judge_2", "name": "…", "traits": ["…"], "systemPrompt": "…" },
    { "key": "judge_3", "name": "…", "traits": ["…"], "systemPrompt": "…" }
  ]
}
```

**Validation rules:** exactly 4 advocates (2 `support`, 2 `against`) and exactly 3 judges; unique
`key`s; non-empty `systemPrompt`s. `traits` is optional metadata (may be folded into the system
prompt at render time or shown in the UI). If the owner's file only provides prose "traits" and not
full system prompts, the persona loader composes a system prompt from a template + traits — but the
exact text sent is always snapshotted onto each `Speech`/`Verdict` for audit.

**Status: PROVIDED.** `personalities.json` now exists at repo root, derived from the owner's dossier
("THE TRIBUNAL — Jon Snow and the untimely demise of Daenerys Targaryen"). The seven personas are:

| key | side / role | persona | notes |
|-----|-------------|---------|-------|
| `support_1` | support (defense) | Jon Snow | fictional GoT character, first-person voice |
| `support_2` | support (defense) | Tyrion Lannister | fictional GoT character |
| `against_1` | against (prosecution) | Daenerys Targaryen | fictional GoT character (the deceased, arguing in character) |
| `against_2` | against (prosecution) | Grey Worm | fictional GoT character |
| `judge_1` | judge | Barak tradition | fictional judge reasoning in the *method* of Justice Aharon Barak |
| `judge_2` | judge | Elon tradition | fictional judge reasoning in the *method* of Justice Menachem Elon |
| `judge_3` | judge | Shamgar tradition | fictional judge reasoning in the *method* of Justice Meir Shamgar |

**Judge personas are method-based, not impersonations.** Each judge `systemPrompt` opens with an
explicit disclaimer: a fictional judge reasoning in the jurisprudential tradition associated with the
named jurist, *not* the real person, *not* their views, on a fictional case. This matches the
dossier's own framing ("adapts judicial methods; does not impersonate the judges or predict a real
court") and must be preserved in any edit — do not rewrite these into first-person impersonations of
the real justices.

**Verdict-format text is intentionally NOT in the persona file.** The judge `systemPrompt`s
establish character and instruct "reach your own reasoned verdict," but the strict machine-readable
`DECISION:` / `CONFIDENCE:` block is appended by the orchestrator at call time (§5.6), not stored in
`personalities.json`. Keep it that way (single source of truth for the output contract).

---

## 9. Configuration (env)

All via `@nestjs/config` with schema validation; document in `.env.example`.

| var | required | default | purpose |
|-----|----------|---------|---------|
| `OPENROUTER_API_KEY` | yes | — | OpenRouter key |
| `OPENROUTER_BASE_URL` | no | `https://openrouter.ai/api/v1` | |
| `OPENROUTER_APP_TITLE` | no | `Tribunal` | sent as `X-Title` |
| `OPENROUTER_APP_URL` | no | — | sent as `HTTP-Referer` |
| `MODE_A_MODEL` | no | auto (first free) | pin Mode A's single model if desired |
| `MODEL_BLACKLIST` | no | — | extra comma-separated substrings that exclude a "free" model from being an advocate/judge, on top of the built-in task-type blacklist (§5.2); matched case-insensitively against the model id |
| `RUN_COST_CEILING_USD` | no | `5` | hard per-run ceiling (INTENT's $5) |
| `ADVOCATE_TEMPERATURE` | no | `0.9` | |
| `JUDGE_TEMPERATURE` | no | `0.2` | |
| `MODEL_MAX_TOKENS` | no | `1024` | per call output cap |
| `CALL_TIMEOUT_MS` | no | `90000` | per-call timeout; covers the response-body read, not just headers (§5.4) |
| `DISABLE_MODEL_REASONING` | no | `true` | send `reasoning:{enabled:false}` so models return the plain verdict block instead of dumping chain-of-thought (§5.4/§5.6) |
| `LOG_DIR` | no | `apps/api/data/logs` | directory for the diagnostic JSONL log (§5.7), resolved from the workspace root |
| `LOG_TO_FILE` | no | `true` | write the diagnostic log to file; `false` = console only (e.g. under test) (§5.7) |
| `LOG_LEVEL` | no | `info` | minimum level written to the diagnostic log: `info`/`warn`/`error` (§5.7) |
| `DATABASE_URL` | yes | — | Postgres connection |
| `JWT_SECRET` | yes | — | |
| `JWT_EXPIRES_IN` | no | `1d` | |
| `SEED_USERNAME` | yes | — | |
| `SEED_PASSWORD` | yes | — | seeded once at boot |
| `PERSONAS_FILE` | no | `personalities.json` | persona source, resolved from the Nx workspace root (`nx serve` runs from root) |
| `CHARGE_SHEET_SEED_FILE` | no | `charge-sheet.seed.txt` | seed text for Case T-001 (§4.2b), resolved from workspace root |
| `CORS_ORIGINS` | yes | — | comma-separated frontend origins |
| `PORT` | no | `3000` | backend port |

---

## 10. API contract (backend)

All JSON. All except `/auth/login` require `Authorization: Bearer <jwt>`. Error responses share one
shape — `{ statusCode, code, message }` — where `code` is a stable `ErrorCode` and `message` is
user-safe, never the raw cause (§12.1).

| method | path | body / query | returns |
|--------|------|--------------|---------|
| POST | `/auth/login` | `{ username, password }` | `{ accessToken }` |
| GET | `/auth/me` | — | `{ id, username }` |
| GET | `/models` | — | `[{ id, contextLength, promptUsd, completionUsd, isFree }]` — cached live list of usable text models, **free + paid**, sorted free-first then price asc (§5.2). Feeds the pickers. |
| GET | `/models/free` | — | `[{ id, contextLength }]` (cached live free subset; retained) |
| GET | `/personas` | — | roster for display/animation: `[{ key, name, role, side? }]` — no `systemPrompt` |
| GET | `/charge-sheet` | — | the active charge sheet `{ id, title, content, updatedAt }` |
| GET | `/charge-sheets` | — | list of all charge sheets (id, title, isActive, updatedAt) |
| PATCH | `/charge-sheet/:id` | `{ title?, content?, isActive? }` | updates a charge sheet (editable per D9); setting `isActive:true` deactivates the others. **Built and protected, but not surfaced in the v1 UI.** |
| POST | `/runs` | `{ mode, modelSingle?, modelByPersona?, chargeSheetId? }` | `{ runId }` — **creates** the run (status `running`) and returns immediately; the pipeline runs in the background (see §10.1). Mode A uses `modelSingle` (optional; else Auto). Mode B uses `modelByPersona` (a `{ personaKey → modelId }` map; the UI sends all 7, else the server auto-assigns — §5.2). Uses `chargeSheetId` or the active charge sheet. No charge-sheet text in the body. |
| GET | `/runs` | `?limit&offset` | list of run summaries (id, createdAt, mode, verdictTally, totalCostUsd, status) |
| GET | `/runs/:id` | — | full run: charge, 4 speeches, 3 verdicts (each with its short opinion), economy, optional non-binding `verdictTally`. Speeches/verdicts include the resolved persona `name`. |
| GET | `/runs/:id/progress` | — | lightweight progress: `{ status, phase, completedPersonaKeys[], error }` — polled to drive the live animation (§11) |
| GET | `/runs/:id/economy` | — | the per-run economy JSON (file (a)); `Content-Disposition: attachment` |
| GET | `/economy/ledger` | — | the cumulative ledger (from DB and/or `ledger.jsonl`) |

### 10.1 Run execution model
`POST /runs` **creates** the run (status `running`) and returns `{ runId }` immediately; the ~7-call
pipeline runs in the background (orchestration stays a service method, not inline in the controller).
The frontend navigates straight to the live Run Result view and **polls `GET /runs/:id/progress`**
(~1.5s) to drive the per-persona animation (§11), then loads the full run via `GET /runs/:id` once the
status is terminal (`completed`, `failed`, or `aborted_over_budget`). A background failure is recorded
on the run (`status: failed`, `error`) rather than returned from the POST. (Earlier revisions ran this
synchronously; the async model here is the extension the original §10.1 anticipated.)

---

## 11. Frontend (`apps/web` — React + Tailwind, Vite)

Pages:
- **Login** — username/password → stores JWT.
- **New Run** — displays the **stored active charge sheet read-only** (from `GET /charge-sheet`; no
  edit/upload control in v1, per D9), a **Mode A/B toggle** with a one-line explanation of each, and a
  model picker fed by `GET /models`. Model pickers show **free models by default** with each model's
  price; a **"show paid models"** opt-in toggle reveals the paid ones (D1/§5.2). "Free ($0)" is
  labelled honestly.
  - **Mode A:** one optional model picker (an "Auto — top free model" default; may pick free or paid).
  - **Mode B:** **seven** pickers, one per persona (in roster order from `GET /personas`, each titled
    by the persona's name/role). **All 7 must be chosen** before the run can start — the "Run tribunal"
    button stays disabled until then (the paid opt-in applies to every picker).
  "Run tribunal" button → `POST /runs` (body carries `mode` + `modelSingle` in Mode A, or the full
  `modelByPersona` map in Mode B) → navigates immediately to the live Run Result view.
- **Run Result** — a **two-tab view** driven by a small segmented tab bar (UX rule 4: self-evident,
  no instructions). The default tab is **Verdict**; the other is **Economy**.
  - **Verdict tab** — **Judges first** (they deliver the verdict; UX rule 2: structure mirrors the
    domain). Each of the 3 VerdictCards is titled with the judge's **name** (on its own header line so
    it stays legible in the narrow judges column) and reads top-to-bottom as: (1) the **verdict** — a
    decision badge (justified/not_justified) + confidence, exactly as today; then (2) a labelled
    **Reasoning** section holding the judge's **short opinion** (§5.6) — how that judge weighed the
    speeches it was shown. When the verdict is `truncated` (§5.6 — the model's reply was cut off or
    unreadable), the Reasoning section instead shows a short, friendly **recess placeholder** (e.g.
    "This judge stepped out for a brief recess and didn't file an opinion — their model's reply was cut
    off") rather than raw/garbled text; the decision badge and confidence are still shown unchanged.
    Below them, the
    The three judge cards share **one group expand/collapse control** on the Judges section header
    (a rotating caret / "Expand all" affordance), **not** a control on each card: readers either open
    **all** judgements at once (every card expanded) or see them **all** cut to a fixed collapsed
    size — there is deliberately **no per-judge toggle**. (Rationale: the cards sit in one
    shared-height grid row, so expanding a single card stretches its neighbours to the same height
    while leaving them collapsed and empty — you could never actually read an individual judge.) Below
    them, the **Advocates**: 4 SpeechCards grouped Support (defense) vs Against (prosecution), each
    titled with the persona's **name** (e.g. "Jon Snow"); these stack vertically, so each keeps its
    own **per-card** fixed-collapsed-size **expand/collapse-on-click** (a rotating caret; UX rule 1:
    compact by default, UX rule 3: immediate feedback). The three verdicts are the output — there is **no combined "final verdict"**.
    A non-binding tally may appear only as a **bare count** (e.g. "Justified 2 · Not justified 1") —
    **no disclaimer copy** (UX rule 1: trim explanatory/AI statements; the "no combined verdict"
    behavior stands regardless of copy).
  - **Economy tab** — a per-persona (by **name**) + per-model + totals table (tokens & USD), "$0.00 (free)" shown
    honestly, and **Download JSON** / view-ledger actions.
- **History** — table of past runs (from `GET /runs`); row click → Run Result.

UX notes: disable the Run button while a run is in flight; surface the §5.3 data-policy error
verbatim-but-friendly; show partial results if status is `aborted_over_budget`.

**Live run animation:** while a run's status is `running`, the Run Result page shows the roster (4 advocates + 3 judges from `GET /personas`) arranged in a circle, each with a spinning sync icon that turns to a check as that persona's speech/verdict is persisted (polled via `GET /runs/:id/progress`). Judges appear pending until the advocate phase finishes; on terminal status the page swaps to the results view.

---

## 12. Error handling & resilience (summary)

- 429 → exponential backoff w/ jitter, max 4 tries (per §5.4).
- 402 → abort run, status `failed`, message "OpenRouter account out of credits."
- 404 free-policy → abort, actionable privacy-toggle message (§5.3).
- Verdict parse failure → one re-ask, then conservative fallback + flag (§5.6).
- Budget exceeded → `aborted_over_budget`, persist partial + economy.
- All model prompts/responses and model IDs are snapshotted per call for reproducibility/audit.

### 12.1 User-facing error taxonomy (friendly copy, never raw)

**Goal:** the app never shows a user a raw exception string, HTTP status dump, or model/provider
output. The single seeded user is not a developer; every error reaching the screen is a short, plain
sentence they can act on. The raw technical detail is not lost — it lives only in the §5.7 diagnostic
log (and `rawResponse` for verdicts).

**How (owner decision, 2026-09-01): a backend error *code* + frontend *copy*.** The backend
classifies every failure into one stable, machine-readable `code`; the frontend owns the
user-facing wording keyed by that code. No string-matching of raw messages in the UI.

**The codes** (`ErrorCode` enum in `@tribunal/shared-types`):

| `code` | raised by | HTTP | plain-language copy (frontend) |
|--------|-----------|------|--------------------------------|
| `UNAUTHORIZED` | expired/missing JWT (§7) | 401 | "Your session has ended. Please sign in again." (client also routes to Login) |
| `INVALID_INPUT` | `ValidationPipe` / bad DTO | 400 | "Some details weren't entered correctly. Please check and try again." |
| `NO_FREE_MODELS` | `DataPolicyError` (§5.3) | 404 | "No free AI models are available. In your OpenRouter account, turn on the two free-endpoint privacy settings, then try again." (keeps §5.3's actionable intent, in plain words) |
| `OUT_OF_CREDITS` | `OutOfCreditsError` (§5.4) | 402 | "The AI service is out of credits. Please try again later." |
| `RATE_LIMITED` | `RateLimitError` (§5.4) | 429 | "The AI service is busy right now. Please wait a moment and try again." |
| `MODEL_UNAVAILABLE` | `ModelUnavailableError` surfaced after swaps exhausted (§5.2/§5.4) | 422 | "We couldn't reach a working AI model for this run. Please try again." |
| `PROVIDER_ERROR` | other `OpenRouterError` / bad gateway | 502 | "The AI service had a problem completing this run. Please try again." |
| `VERDICT_UNREADABLE` | verdict parse fell back (§5.6) — a **completed** run flag, not a failure | — | "One judge's verdict couldn't be read clearly, so a cautious default was used." |
| `INTERNAL` | anything uncategorized | 500 | "Something went wrong. Please try again." |
| `NETWORK` | frontend-only: the request never got a response (API unreachable) | — | "Couldn't reach the Tribunal service. Check that it's running and try again." |

**Backend contract:**
- Error responses become `{ statusCode, code, message }` where `message` is the **user-safe** string
  (not raw). A single `classifyError(err) → { status, code, message }` helper (in `apps/api/src/common/`)
  is the one source of truth, used by **both** the `AllExceptionsFilter` (§12) and the run pipeline.
  The filter logs the raw cause to the §5.7 log, then responds with the safe body.
- The `Run` gains an **`errorCode`** column (`ErrorCode` enum, nullable; §4.3). On a failed run the
  pipeline stores `errorCode` + a user-safe `error` message via `classifyError`; the **raw** cause
  goes only to the §5.7 log (never into `Run.error`). A completed run that fell back on a verdict
  (§5.6) carries `errorCode = VERDICT_UNREADABLE` (status stays `completed`).

**Frontend contract:**
- `ApiError` carries `code` (parsed from the body; `NETWORK` when `fetch` rejects with no response).
- A small presenter maps `code → copy`; components render only that copy, **never** `run.error` or a
  backend `message` verbatim. Unknown/absent codes fall back to the `INTERNAL` copy.
- **Fallback reference (owner decision):** for an unexpected/uncategorized failure the friendly line
  is followed by a small, quotable **reference** — the run id and the `code` — so the user can report
  it to whoever runs the app without any internals being exposed. The raw cause stays in the §5.7 log.

---

## 13. Security notes

- OpenRouter key lives only in the backend; never sent to the browser.
- Passwords hashed (argon2id); JWT secret from env; tokens expire.
- Validate/limit charge-sheet size (e.g. cap characters) to bound token spend and prompt-injection
  surface. Treat charge-sheet text as untrusted content inside prompts (it is data, not instructions
  to the judges); the judge/advocate system prompts should frame it as "the case text to evaluate."
- CORS locked to configured origins.

---

## 14. Testing

### 14.1 Tooling & conventions
- **Backend:** Jest (NestJS default) for unit + integration; **Supertest** for HTTP e2e; **nock**
  (or `msw/node`) to stub every OpenRouter HTTP call; **Testcontainers-postgres** (ephemeral real
  Postgres) for repository/e2e tests. Pure-logic units use no DB. Fixtures for `/models` and chat
  responses live in `apps/api/test/fixtures/`.
- **Frontend:** **Vitest** (via `@nx/vite`) + **React Testing Library** (jsdom); **MSW** to mock the
  backend; **Playwright** (via `@nx/playwright`, in `apps/web-e2e`, optional) for one happy-path e2e.
- **Runner:** tests run through **Nx targets** — `nx test api`, `nx test web`, `nx test shared-types`
  — and in CI via **`nx affected -t test lint build`** so only projects touched by a change (and
  their dependents) run. Backend unit + integration use Jest (`@nx/jest`).
- **Hard rule — determinism:** tests NEVER call the real OpenRouter or any network. Everything is
  stubbed. Never assert on model *prose/quality* (non-deterministic) — assert on parsing, routing,
  aggregation, persistence, and structure.
- **Coverage gate:** ≥ 80% lines/branches on the core logic modules (`tribunal/`, `openrouter/`,
  `economy/`, `chargesheets/`, `personas/`, `auth/`) plus `libs/shared-types`. Config as a build
  decision, adjustable.

### 14.2 Backend unit tests (pure logic — highest value, DB-free)

| Component | Cases to cover |
|-----------|----------------|
| **Verdict parser** (§5.6) | parses `justified`/`not_justified` + confidence from multiline text with reasoning above; case-insensitive; trailing punctuation/whitespace tolerated; confidence clamped to 0–100; missing `DECISION:` or `CONFIDENCE:` → `needsReask`; conflicting duplicate `DECISION:` lines → documented rule (take last); total failure after re-ask → fallback `{justified, 0}` + flag |
| **Verdict tally** (§5.5, non-binding) | counts the 3 `decision` values correctly (3–0, 2–1, 0–3); confidence never changes the counts; guard requires exactly 3 verdicts; asserts **no** authoritative combined `finalDecision` field is produced (INTENT conformance) |
| **Free-model filter & assignment** (§5.2) | keeps only `prompt=="0" && completion=="0"`; excludes free-prompt/paid-completion; excludes non-text/audio-output models (e.g. Lyria) and blacklisted task types (built-in list + `MODEL_BLACKLIST`, case-insensitive substring); sorts by `context_length` desc; Mode A picks #1, honors `MODE_A_MODEL` only when still free; Mode B assigns 7 distinct, round-robins deterministically when < 7 exist, records assignment; empty free list → throws the actionable no-free-models error |
| **Counterbalanced speech order** (§5.5) | judge *i* gets rotation *i*; the 3 judges get 3 distinct orders; recorded order == rendered order; deterministic (no RNG) |
| **Economy builder** (§6) | sums `usage.cost` (free → `0.00`); per-persona rows for all 7; per-model rollup groups by model id with call counts; token totals correct; JSON shape matches §6 (snapshot test); ledger line shape `{runId,createdAt,mode,totalTokens,costUsd,verdictTally}` |
| **Budget guard** (§5.5) | cumulative cost > ceiling → status `aborted_over_budget`, remaining calls skipped; ceiling read from the run *snapshot* not live config; partial rows + economy still persisted |
| **Personas loader** (§8) | valid file loads 4+3; rejects ≠4 advocates / ≠3 judges; rejects side counts ≠ (2 support, 2 against); rejects duplicate keys; rejects empty `systemPrompt`; fail-fast with a clear message |
| **Prompt builders** (§5.5, §13) | advocate prompt = `{system: persona, user: chargeSheetSnapshot}` with NO other speeches leaked; judge prompt includes snapshot + all 4 speeches + the `DECISION`/`CONFIDENCE` block; charge sheet embedded as clearly-delimited "case text" (framing string present — prompt-injection surface) |
| **Charge sheet invariant** (§4.2) | setting `isActive` on one deactivates all others (exactly one active); run snapshots active content at creation; editing the sheet afterward leaves that run's snapshot unchanged |
| **OpenRouter client** (§5.4, nock) | captures `usage.cost`, prompt/completion tokens, `reasoning_tokens` when present; sends `reasoning:{enabled:false}` when `DISABLE_MODEL_REASONING` (default); 429 → backoff-retries then succeeds; exceeds max tries → throws; 402 → no retry, credits error; 404 data-policy body → typed `DataPolicyError` with actionable message; 403, provider-side 400/5xx, and the "reasoning is mandatory" 400 → `ModelUnavailableError` (swap), bare 400/5xx → hard error; per-call timeout aborts over a slow **body** (not just headers) → `ModelTimeoutError` |
| **Auth** | argon2id hash/verify round-trip; JWT sign/verify; expired token rejected; seed is idempotent (no duplicate user on second boot) |

### 14.3 Backend integration / e2e (Supertest + Testcontainers-postgres + nock)
- `POST /auth/login`: valid → token; invalid → 401. Guard: `/runs` without token → 401, with token → 200.
- **Full run happy path** (OpenRouter stubbed): `POST /runs {mode:A_single}` → `GET /runs/:id`
  returns 4 speeches + 3 verdicts (each with its protocol) + economy (+ optional `verdictTally`); the
  per-run JSON file exists on disk;
  the ledger has a new line.
- **Mode B:** the 7 persisted rows record distinct model ids.
- **Charge sheet:** `GET /charge-sheet` returns the active one; `PATCH /charge-sheet/:id` content is
  reflected in the *next* run's snapshot; `PATCH … {isActive:true}` flips the active flag and clears
  the previous active.
- **Model swap (resilience, §5.4):** a model that returns 403 "agentic harness only", a provider-side
  5xx, or an empty 200 body is skipped and the run completes on another free model — the persisted
  rows never reference the skipped model.
- **Failure surfaces:** OpenRouter 404 data-policy → API returns the actionable message (not 500);
  OpenRouter 402 → run `failed` with credits message; ceiling `0.0001` → run `aborted_over_budget`
  with partial rows persisted.

### 14.4 Frontend component tests (Vitest + RTL + MSW)

| Component | Cases |
|-----------|-------|
| **VerdictCard** | correct badge label/color for `justified` vs `not_justified`; confidence shown; reasoning rendered |
| **Verdict list + tally** | the 3 VerdictCards all render; a single group control expands/collapses **all** judge cards together (no per-card toggle — all readable or all cut); the non-binding tally shows correct counts and its "no combined verdict" label; assert there is no single "final verdict" element |
| **EconomyPanel** | per-persona table + per-model rollup + totals render; `$0.00 (free)` shown when cost is 0; Download JSON triggers the correct request/blob |
| **ModeToggle** | Mode A shows the model picker, Mode B hides it; submit payload carries the chosen mode (+ `modelSingle` only in A) |
| **NewRun page** | charge sheet shown **read-only**; assert NO textarea/upload/edit control exists (guards D9); Run button disabled while the request is in flight |
| **SpeechCard grouping** | support vs against grouped into the right columns |
| **Login flow** | success stores token; a protected route with no token redirects to Login |
| **API client** | attaches `Bearer` token; on 401 clears token + redirects; surfaces the data-policy error into a visible banner |
| **History** | renders rows from `GET /runs`; row click navigates to the result |

### 14.5 Frontend e2e (optional, Playwright, backend mocked/seeded)
- login → run (Mode A) → see 4 speeches, 3 verdicts, the final banner, the economy panel, and a
  working Download JSON.

---

## 15. Documentation

### 15.1 API docs — Swagger / OpenAPI (`@nestjs/swagger`)
- Add `@nestjs/swagger`. In `main.ts`, build a `DocumentBuilder` (title "Tribunal API", version,
  description), call `.addBearerAuth()`, and mount `SwaggerModule.setup('api/docs', …)`. Served in
  dev always; in prod gate behind an env flag (or the JWT).
- Decorate **every DTO** with `@ApiProperty` (types, examples, and the enums: run `mode` =
  `A_single|B_per_persona`, `decision` = `justified|not_justified`, run `status`). Decorate
  controllers with `@ApiTags`, endpoints with `@ApiOperation` + `@ApiResponse` for
  200/201/400/401/402/404, and `@ApiBearerAuth()` on protected routes.
- **Document the special errors** so they show in the schema: 401 (auth), 402 (out of credits), and
  the 404 free-model **data-policy** error — include its actionable "enable the privacy toggles"
  message as the example body.
- Emit `openapi.json` as a build artifact (from the generated `document`); optionally generate the
  typed frontend API client from it (keeps the front/back contract in sync).
- **Acceptance:** `/api/docs` renders and every endpoint in §10 appears with request/response schemas
  and the bearer scheme; `openapi.json` is emitted.

### 15.2 READMEs & operational docs
- **Root README:** what Tribunal is, the architecture diagram (§3), how to run it against a local
  Postgres, the two
  modes, and the token-economy output.
- **Root README:** also documents the **Nx workspace** — install, the project layout (`apps/`,
  `libs/`), the common `nx serve/build/test/lint/affected` commands, and the shared-types lib.
- **`apps/api` README:** the env table (§9), DB + migrations, seeding (user **and** charge sheet),
  the **OpenRouter privacy-toggle requirement (§5.3) called out prominently**, how to run its Nx
  targets, and where run JSON files / the ledger land.
- **`apps/web` README:** env (API base URL), `nx serve web`, build, test.
- `.env.example` documents every var in §9.
- Top-of-module docblocks for `tribunal/`, `openrouter/`, `economy/` explaining the pipeline and the
  "protocol" concept (each judge's reasoning).

### 15.3 Code documentation
- TSDoc on the public service methods (`runTribunal`, `resolveModels`, `parseVerdict`,
  `buildEconomy`, charge-sheet activation). DTOs are the single source of API truth — Swagger derives
  from them, so keep them accurate rather than hand-writing schemas.

---

## 16. Build order (phased, each phase independently runnable)

1. **Scaffold (Nx)** — `create-nx-workspace` (integrated), `nx add @nx/nest @nx/react @nx/js`,
   generate `apps/api` (Nest), `apps/web` (React+Vite), `libs/shared-types` (§3.2); wire
   `@tribunal/shared-types` path alias, tags + `@nx/enforce-module-boundaries`, `nx.json` caching;
   a locally-running Postgres (no Docker), Tailwind in `apps/web`, `.env.example`, config validation.
2. **Auth** — User entity, seed user, `/auth/login`, JWT guard, `/auth/me`; Login page.
3. **OpenRouter module** — chat wrapper (usage+cost capture, retry/backoff), `GET /models` free
   filter + cache, `/models/free` endpoint. Smoke-test one free call end to end.
4. **Personas module** — load + validate `personalities.json` (example file for dev).
5. **Charge sheet module** — `ChargeSheet` entity, seed from `charge-sheet.seed.txt` on boot,
   `GET /charge-sheet`, `GET /charge-sheets`, `PATCH /charge-sheet/:id` (editable; not surfaced in
   v1 UI).
6. **Tribunal orchestration** — advocate phase, judge phase (counterbalanced order), aggregation,
   budget guard. Persist Run/Speech/Verdict.
7. **Economy** — per-run JSON writer, ledger append, `/runs/:id/economy`, `/economy/ledger`.
8. **Runs API** — `POST /runs`, `GET /runs`, `GET /runs/:id`.
9. **Frontend** — New Run, Run Result (speeches + verdicts + final banner + economy panel), History.
10. **Hardening + tests** — error surfaces (§12), input caps, and the full test suite per **§14**
    (backend unit + integration/e2e, frontend component tests, coverage gate). OpenRouter is always
    mocked. Swagger decorators (`@ApiProperty`/`@ApiOperation`/…) are added *alongside* each endpoint
    in earlier phases, not deferred — this phase just verifies completeness.
11. **Docs** — finalize **§15**: mount Swagger at `/api/docs` + emit `openapi.json`; write the root /
    backend / frontend READMEs (incl. the "enable OpenRouter free-endpoint privacy toggles" note and
    the reminder to drop in the real `personalities.json`).

## 17. Acceptance criteria (definition of done for v1)

- A seeded user can log in; unauthenticated API calls are rejected.
- The canonical charge sheet (Case T-001) is seeded into the DB on first boot and loaded by the
  program; the New Run page shows it read-only (no upload/edit control in v1). Editing it via
  `PATCH /charge-sheet/:id` works and affects only future runs.
- Given the stored charge sheet and a chosen mode, a run produces 4 speeches and **3 independent
  verdicts** (each with decision + confidence + reasoning/protocol) plus the code budget — matching
  INTENT's output clause. The system produces **no** authoritative combined/majority verdict; any
  vote tally shown is explicitly non-binding. Each run stores an immutable `chargeSheetSnapshot`.
- Mode A uses one model (free or paid); Mode B runs a **user-selected** model per persona (free or
  paid; all 7 chosen in the UI, or auto-assigned via the API fallback) — recorded per call.
- Every call's real token usage and `usage.cost` are captured; a per-run JSON file and a ledger
  entry are written; the same economy is shown in the UI with a working JSON download.
- Free-model 404 data-policy error yields the actionable message, not a generic crash.
- The $5 (configurable) ceiling is enforced (verifiable by setting it very low and confirming
  `aborted_over_budget`).
- Personas load from `personalities.json` and the app refuses to start if it is missing/invalid.
- **Swagger UI at `/api/docs`** documents every §10 endpoint (request/response schemas, enums, the
  bearer scheme, and the 401/402/404 error bodies); `openapi.json` is emitted.
- **Test suites pass** in CI with OpenRouter fully mocked: backend unit + integration/e2e (§14.2–3)
  and frontend component tests (§14.4), meeting the coverage gate on core logic modules.

---

## 18. Research basis (sources)

Free-model rate limits (50/day no-credit, 1,000/day after $10 lifetime, 20/min):
- https://openrouter.ai/docs/api_reference/limits
- https://openrouter.zendesk.com/hc/en-us/articles/39501163636379-OpenRouter-Rate-Limits-What-You-Need-to-Know

Free-model data-policy 404 (must enable train/publish toggles):
- https://openrouter.zendesk.com/hc/en-us/articles/51690904755227-Why-do-all-free-models-return-a-404-No-endpoints-available-matching-your-guardrail-restrictions-and-data-policy

Usage & cost fields returned per response (`usage.cost`, token details):
- https://openrouter.ai/docs/cookbook/administration/usage-accounting

LLM-judge position bias (motivates counterbalanced speech order) & courtroom multi-agent debate:
- https://arxiv.org/html/2406.07791v7  (Judging the Judges: position bias)
- https://arxiv.org/html/2603.28488v1  (courtroom-style multi-agent debate)

Stack currency (TypeORM still viable & NestJS-supported in 2026; Prisma/Drizzle are alternatives —
owner chose TypeORM, respected):
- https://www.bytebase.com/blog/prisma-vs-typeorm/
```

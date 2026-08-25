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
- **Mode B — "model per persona":** each of the 7 personas is assigned a **distinct** model,
  chosen from OpenRouter's live free-model list. This is the interesting comparison against Mode A.

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
| D1 | Are charge sheets ever sensitive/private? | **No — always fictional/demo.** Free models are fine; enabling OpenRouter's "may train on / may publish prompts" privacy toggles is acceptable (required for free endpoints — see §5.3). |
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
- **Model selection:** resolved at runtime from OpenRouter `GET /models`, filtered to zero price
  (do **not** hardcode model names; the free roster changes monthly).
- **Position-bias mitigation:** the order in which the 4 speeches are shown to each judge is
  **counterbalanced** (rotated per judge) and the exact order is recorded per run. Rationale: LLM
  judges measurably favor whichever argument they read first (§ research).
- **Temperatures:** advocates `0.9` (persuasive), judges `0.2` (consistent). Configurable via env.
- **Concurrency:** the 4 advocate calls run in parallel; then the 3 judge calls run in parallel.
  Stays within OpenRouter's 20 requests/minute cap comfortably.

---

## 3. Architecture overview

```
┌────────────────────┐        JWT (Bearer)        ┌─────────────────────────────┐
│  Frontend (React)  │  ───────────────────────▶  │  Backend (NestJS + TS)      │
│  Vite + Tailwind   │  ◀───────────────────────  │  TypeORM ▶ PostgreSQL       │
└────────────────────┘        JSON over HTTP       │  OpenRouter client          │
                                                    └──────────────┬──────────────┘
                                                                   │ HTTPS
                                                                   ▼
                                                     OpenRouter API (chat + models)
```

- **Backend:** NestJS (TypeScript), TypeORM, PostgreSQL. Owns all LLM orchestration, cost
  accounting, persistence, auth. The frontend never talks to OpenRouter directly (the API key
  stays server-side).
- **Frontend:** React + Tailwind (build with Vite). Talks only to the backend.
- **Auth:** JWT bearer tokens between front and back.

### 3.1 Repository layout

```
Tribunal/
├─ INTENT.txt                 # original brief (do not edit)
├─ SPEC.md                    # this file
├─ personalities.json         # owner-provided persona definitions (see §8) — REQUIRED to build/run
├─ charge-sheet.seed.txt      # canonical Case T-001 text; seeded into the DB on first boot (§4.2b)
├─ docker-compose.yml         # postgres (+ optional adminer) for local dev
├─ .env.example               # documents every env var (see §9)
├─ backend/
│  ├─ src/
│  │  ├─ main.ts
│  │  ├─ app.module.ts
│  │  ├─ config/                     # env loading + validation (@nestjs/config + zod/joi)
│  │  ├─ auth/                       # login, JWT strategy, guard, seed user
│  │  ├─ users/                      # User entity + seed
│  │  ├─ personas/                   # loads & validates personalities.json at boot
│  │  ├─ chargesheets/               # ChargeSheet entity, seed from charge-sheet.seed.txt, CRUD
│  │  ├─ openrouter/                 # HTTP client, model list cache, chat wrapper, retry/backoff
│  │  ├─ tribunal/                   # orchestration: run a tribunal (advocates → judges → verdict)
│  │  ├─ runs/                       # Run/Speech/Verdict entities, run controller, economy export
│  │  └─ economy/                    # cost aggregation, JSON file + ledger writer
│  ├─ data/                          # written run JSON files + ledger.jsonl (gitignored)
│  ├─ test/
│  ├─ package.json
│  └─ tsconfig.json
└─ frontend/
   ├─ src/
   │  ├─ main.tsx, App.tsx
   │  ├─ api/                        # typed fetch client, auth token handling
   │  ├─ pages/  (Login, NewRun, RunResult, History)
   │  ├─ components/                 # SpeechCard, VerdictCard, EconomyPanel, ModeToggle, ...
   │  └─ styles/
   ├─ index.html
   ├─ tailwind.config.js
   ├─ package.json
   └─ vite.config.ts
```

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
| error | text null | populated on failure |
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
| reasoning | text | the "protocol" for this judge |
| rawResponse | text | full model text (fallback if parsing partial) |
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
2. **Free filter:** keep models where `pricing.prompt === "0"` **and** `pricing.completion === "0"`.
   (These are the `:free` endpoints. IDs typically end in `:free`.)
3. Sort candidates by `context_length` descending (need room for charge + 4 speeches for judges).
4. **Mode A:** use `MODE_A_MODEL` env if set and still free/available; else pick candidate #1.
5. **Mode B:** assign the first 7 distinct candidates to the 7 personas in a fixed persona order.
   If fewer than 7 free models are available, round-robin (reuse) to fill 7, and record the actual
   assignment on each `Speech`/`Verdict`. Persist the assignment so a run is reproducible.
6. Cache the free list to avoid hammering `/models`; refresh on cache miss or on a 404 data-policy
   error (§5.3).

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
- **Retry/backoff:** on HTTP 429 (rate limit) retry with exponential backoff (e.g. 1s, 2s, 4s; max
  4 attempts, jitter). On HTTP 402 (out of credits) abort the whole run with a clear message. On
  the §5.3 404, abort with the actionable message.
- **Timeout:** per-call timeout (e.g. 90s), configurable.

### 5.5 Run pipeline (`tribunal` module)
1. Load the charge sheet: use the request's `chargeSheetId` if given, else the `isActive`
   `ChargeSheet`. Create `Run` (status `running`), set `chargeSheetId`, copy its `content` into
   `chargeSheetSnapshot`, and snapshot `costCeilingUsd` from config. All later steps use the
   snapshot, never re-read the entity (so a mid-flight edit cannot change this run).
2. Resolve models for the chosen mode (§5.2).
3. **Advocate phase** — build each advocate's prompt = `{ system: persona.systemPrompt, user:
   chargeSheetSnapshot }`. Run the 4 calls in parallel. Persist a `Speech` per call. After each call, add
   its `costUsd` to the running total; if total > `costCeilingUsd`, stop, set status
   `aborted_over_budget`, persist what exists, still write economy, and return. (With free models
   this never triggers; the guard exists for safety and future paid models.)
4. **Judge phase** — for each judge, compute a **counterbalanced speech order** (rotate the 4
   speeches by judge index; record it). Build prompt = `{ system: judge.systemPrompt, user:
   chargeSheetSnapshot + rendered speeches in that order + a strict output-format instruction }`. Run the 3
   calls in parallel. Parse each into `{ decision, confidence, reasoning }` (§5.6). Persist a
   `Verdict` per judge. Apply the budget guard as in step 3.
5. **Finalize** — do **not** compute an authoritative combined verdict (INTENT outputs the 3
   verdicts as-is). Optionally compute `verdictTally` = counts of the 3 `decision` values for
   non-binding display. Sum tokens and cost across all 7 calls into the `Run`.
6. Write the economy JSON file + append to the ledger (§6). Set status `completed`, `completedAt`.

### 5.6 Verdict output parsing (robust)
Instruct each judge to end its answer with a strict machine-readable block, while still giving free
reasoning above it. Prompt suffix (exact intent, wording may be tuned):

> "First give your reasoning as the trial protocol. Then, on the final lines, output EXACTLY:
> `DECISION: justified` or `DECISION: not_justified`, then `CONFIDENCE: <integer 0-100>`."

Parser: case-insensitive regex for `DECISION:` and `CONFIDENCE:`. If parsing fails, do a single
one-shot re-ask ("Reply with only the two lines…") using the same model; if it still fails, store
`rawResponse`, mark the verdict `decision` via a conservative fallback (`justified` =
benefit of the doubt to the accused) with `confidence: 0`, and flag the run in `error`. Always keep
`rawResponse`.

---

## 6. Token economy (the tracking requirement)

Per `INTENT.txt` and D8, every completed (or aborted) run produces:

**(a) Per-run JSON file** — `backend/data/runs/<runId>.json`:
```json
{
  "runId": "…", "createdAt": "…", "mode": "A_single | B_per_persona",
  "chargeSheetChars": 1234,
  "verdictTally": { "justified": 2, "not_justified": 1 },
  "perPersona": [
    { "personaKey": "support_1", "role": "advocate", "side": "support",
      "model": "…", "promptTokens": 0, "completionTokens": 0, "totalTokens": 0,
      "reasoningTokens": 0, "costUsd": 0.0 }
    // … all 7 personas
  ],
  "perModel": [ { "model": "…", "calls": 3, "totalTokens": 0, "costUsd": 0.0 } ],
  "totals": { "promptTokens": 0, "completionTokens": 0, "totalTokens": 0, "costUsd": 0.0 },
  "costCeilingUsd": 5.0, "status": "completed"
}
```

**(b) Cumulative ledger** — `backend/data/ledger.jsonl`: one compact JSON line appended per run
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
| `RUN_COST_CEILING_USD` | no | `5` | hard per-run ceiling (INTENT's $5) |
| `ADVOCATE_TEMPERATURE` | no | `0.9` | |
| `JUDGE_TEMPERATURE` | no | `0.2` | |
| `MODEL_MAX_TOKENS` | no | `1024` | per call output cap |
| `CALL_TIMEOUT_MS` | no | `90000` | |
| `DATABASE_URL` | yes | — | Postgres connection |
| `JWT_SECRET` | yes | — | |
| `JWT_EXPIRES_IN` | no | `1d` | |
| `SEED_USERNAME` | yes | — | |
| `SEED_PASSWORD` | yes | — | seeded once at boot |
| `PERSONAS_FILE` | no | `../personalities.json` | persona source |
| `CHARGE_SHEET_SEED_FILE` | no | `../charge-sheet.seed.txt` | seed text for Case T-001 (§4.2b) |
| `CORS_ORIGINS` | yes | — | comma-separated frontend origins |
| `PORT` | no | `3000` | backend port |

---

## 10. API contract (backend)

All JSON. All except `/auth/login` require `Authorization: Bearer <jwt>`.

| method | path | body / query | returns |
|--------|------|--------------|---------|
| POST | `/auth/login` | `{ username, password }` | `{ accessToken }` |
| GET | `/auth/me` | — | `{ id, username }` |
| GET | `/models/free` | — | `[{ id, contextLength }]` (cached live free list) |
| GET | `/charge-sheet` | — | the active charge sheet `{ id, title, content, updatedAt }` |
| GET | `/charge-sheets` | — | list of all charge sheets (id, title, isActive, updatedAt) |
| PATCH | `/charge-sheet/:id` | `{ title?, content?, isActive? }` | updates a charge sheet (editable per D9); setting `isActive:true` deactivates the others. **Built and protected, but not surfaced in the v1 UI.** |
| POST | `/runs` | `{ mode, modelSingle?, chargeSheetId? }` | `{ runId }` — starts a run using `chargeSheetId` or the active charge sheet (see §10.1). No charge-sheet text in the body. |
| GET | `/runs` | `?limit&offset` | list of run summaries (id, createdAt, mode, verdictTally, totalCostUsd, status) |
| GET | `/runs/:id` | — | full run: charge, 4 speeches, 3 verdicts (each with protocol), economy, optional non-binding `verdictTally` |
| GET | `/runs/:id/economy` | — | the per-run economy JSON (file (a)); `Content-Disposition: attachment` |
| GET | `/economy/ledger` | — | the cumulative ledger (from DB and/or `ledger.jsonl`) |

### 10.1 Run execution model (v1)
`POST /runs` executes the pipeline **synchronously** server-side and returns the completed run
(a run is ~7 sequential-ish calls; expect tens of seconds). The frontend shows a loading/progress
state. **Extension (not v1):** switch to async (`202` + `GET /runs/:id` polling or SSE) if runs get
slow or rounds are added. Build the service layer so the controller could return early without a
rewrite (i.e. orchestration is a service method, not inline in the controller).

---

## 11. Frontend (React + Tailwind, Vite)

Pages:
- **Login** — username/password → stores JWT.
- **New Run** — displays the **stored active charge sheet read-only** (from `GET /charge-sheet`; no
  edit/upload control in v1, per D9), a **Mode A/B toggle** with a one-line explanation of each, and
  (Mode A) an optional model picker fed by `GET /models/free`. "Run tribunal" button → `POST /runs`
  (body carries only `mode` and optional `modelSingle`) → navigates to result on completion.
- **Run Result** — three regions:
  1. **Advocates** — 4 SpeechCards grouped Support (defense) vs Against (prosecution).
  2. **Judges** — 3 VerdictCards side by side, each showing its decision badge
     (justified/not_justified), confidence, and the full reasoning/protocol. The three verdicts are
     the output — there is **no combined "final verdict"**. A small, explicitly **non-binding vote
     tally** ("2 of 3 judges: justified — the tribunal issues no combined verdict") may be shown for
     convenience only.
  3. **Economy panel** — per-persona + per-model + totals table (tokens & USD), "$0.00 (free)" shown
     honestly, and **Download JSON** / view-ledger actions.
- **History** — table of past runs (from `GET /runs`); row click → Run Result.

UX notes: disable the Run button while a run is in flight; surface the §5.3 data-policy error
verbatim-but-friendly; show partial results if status is `aborted_over_budget`.

---

## 12. Error handling & resilience (summary)

- 429 → exponential backoff w/ jitter, max 4 tries (per §5.4).
- 402 → abort run, status `failed`, message "OpenRouter account out of credits."
- 404 free-policy → abort, actionable privacy-toggle message (§5.3).
- Verdict parse failure → one re-ask, then conservative fallback + flag (§5.6).
- Budget exceeded → `aborted_over_budget`, persist partial + economy.
- All model prompts/responses and model IDs are snapshotted per call for reproducibility/audit.

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
  responses live in `backend/test/fixtures/`.
- **Frontend:** **Vitest** + **React Testing Library** (jsdom); **MSW** to mock the backend;
  **Playwright** (optional) for one happy-path browser e2e.
- **Hard rule — determinism:** tests NEVER call the real OpenRouter or any network. Everything is
  stubbed. Never assert on model *prose/quality* (non-deterministic) — assert on parsing, routing,
  aggregation, persistence, and structure.
- **Coverage gate:** ≥ 80% lines/branches on the core logic modules (`tribunal/`, `openrouter/`,
  `economy/`, `chargesheets/`, `personas/`, `auth/`). Config as a build decision, adjustable.

### 14.2 Backend unit tests (pure logic — highest value, DB-free)

| Component | Cases to cover |
|-----------|----------------|
| **Verdict parser** (§5.6) | parses `justified`/`not_justified` + confidence from multiline text with reasoning above; case-insensitive; trailing punctuation/whitespace tolerated; confidence clamped to 0–100; missing `DECISION:` or `CONFIDENCE:` → `needsReask`; conflicting duplicate `DECISION:` lines → documented rule (take last); total failure after re-ask → fallback `{justified, 0}` + flag |
| **Verdict tally** (§5.5, non-binding) | counts the 3 `decision` values correctly (3–0, 2–1, 0–3); confidence never changes the counts; guard requires exactly 3 verdicts; asserts **no** authoritative combined `finalDecision` field is produced (INTENT conformance) |
| **Free-model filter & assignment** (§5.2) | keeps only `prompt=="0" && completion=="0"`; excludes free-prompt/paid-completion; sorts by `context_length` desc; Mode A picks #1, honors `MODE_A_MODEL` only when still free; Mode B assigns 7 distinct, round-robins deterministically when < 7 exist, records assignment; empty free list → throws the actionable no-free-models error |
| **Counterbalanced speech order** (§5.5) | judge *i* gets rotation *i*; the 3 judges get 3 distinct orders; recorded order == rendered order; deterministic (no RNG) |
| **Economy builder** (§6) | sums `usage.cost` (free → `0.00`); per-persona rows for all 7; per-model rollup groups by model id with call counts; token totals correct; JSON shape matches §6 (snapshot test); ledger line shape `{runId,createdAt,mode,totalTokens,costUsd,verdictTally}` |
| **Budget guard** (§5.5) | cumulative cost > ceiling → status `aborted_over_budget`, remaining calls skipped; ceiling read from the run *snapshot* not live config; partial rows + economy still persisted |
| **Personas loader** (§8) | valid file loads 4+3; rejects ≠4 advocates / ≠3 judges; rejects side counts ≠ (2 support, 2 against); rejects duplicate keys; rejects empty `systemPrompt`; fail-fast with a clear message |
| **Prompt builders** (§5.5, §13) | advocate prompt = `{system: persona, user: chargeSheetSnapshot}` with NO other speeches leaked; judge prompt includes snapshot + all 4 speeches + the `DECISION`/`CONFIDENCE` block; charge sheet embedded as clearly-delimited "case text" (framing string present — prompt-injection surface) |
| **Charge sheet invariant** (§4.2) | setting `isActive` on one deactivates all others (exactly one active); run snapshots active content at creation; editing the sheet afterward leaves that run's snapshot unchanged |
| **OpenRouter client** (§5.4, nock) | captures `usage.cost`, prompt/completion tokens, `reasoning_tokens` when present; 429 → backoff-retries then succeeds; exceeds max tries → throws; 402 → no retry, credits error; 404 data-policy body → typed `DataPolicyError` with actionable message; per-call timeout aborts |
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
- **Failure surfaces:** OpenRouter 404 data-policy → API returns the actionable message (not 500);
  OpenRouter 402 → run `failed` with credits message; ceiling `0.0001` → run `aborted_over_budget`
  with partial rows persisted.

### 14.4 Frontend component tests (Vitest + RTL + MSW)

| Component | Cases |
|-----------|-------|
| **VerdictCard** | correct badge label/color for `justified` vs `not_justified`; confidence shown; reasoning rendered |
| **Verdict list + tally** | the 3 VerdictCards all render; the non-binding tally shows correct counts and its "no combined verdict" label; assert there is no single "final verdict" element |
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
- **Root README:** what Tribunal is, the architecture diagram (§3), run-with-docker-compose, the two
  modes, and the token-economy output.
- **Backend README:** the env table (§9), DB + migrations, seeding (user **and** charge sheet), the
  **OpenRouter privacy-toggle requirement (§5.3) called out prominently**, how to run tests +
  coverage, and where run JSON files / the ledger land.
- **Frontend README:** env (API base URL), dev server, build, test.
- `.env.example` documents every var in §9.
- Top-of-module docblocks for `tribunal/`, `openrouter/`, `economy/` explaining the pipeline and the
  "protocol" concept (each judge's reasoning).

### 15.3 Code documentation
- TSDoc on the public service methods (`runTribunal`, `resolveModels`, `parseVerdict`,
  `buildEconomy`, charge-sheet activation). DTOs are the single source of API truth — Swagger derives
  from them, so keep them accurate rather than hand-writing schemas.

---

## 16. Build order (phased, each phase independently runnable)

1. **Scaffold** — repo layout, `docker-compose` Postgres, NestJS app, Vite React app, Tailwind,
   `.env.example`, config validation.
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
- Mode A uses one model; Mode B assigns distinct free models per persona (recorded per call).
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

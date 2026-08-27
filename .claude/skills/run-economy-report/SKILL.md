---
name: run-economy-report
description: Build, validate, or explain a Tribunal run's token/cost economy - the per-run JSON file, the cumulative ledger line, and the UI economy panel data (§6). Use when implementing the economy module, writing the run JSON / ledger.jsonl, wiring the EconomyPanel, or summarizing what a run cost. Triggers - "economy", "token usage", "cost per run", "ledger", "code budget", "run JSON", "download economy", "how much did the run cost".
---

# run-economy-report

Encodes SPEC §6 + D8. Every completed **or aborted** run must emit its economy. Cost always comes straight from OpenRouter `usage.cost` (USD, `0.0` for free) — **never estimated from token counts**. `$0.00 (free)` is correct and shown honestly.

## (a) Per-run JSON — `apps/api/data/runs/<runId>.json`
Shape (snapshot-test this exact structure):
```json
{
  "runId": "…", "createdAt": "…", "mode": "A_single | B_per_persona",
  "chargeSheetChars": 1234,
  "verdictTally": { "justified": 2, "not_justified": 1 },
  "perPersona": [
    { "personaKey": "support_1", "role": "advocate", "side": "support",
      "model": "…", "promptTokens": 0, "completionTokens": 0, "totalTokens": 0,
      "reasoningTokens": 0, "costUsd": 0.0 }
  ],
  "perModel": [ { "model": "…", "calls": 3, "totalTokens": 0, "costUsd": 0.0 } ],
  "totals": { "promptTokens": 0, "completionTokens": 0, "totalTokens": 0, "costUsd": 0.0 },
  "costCeilingUsd": 5.0, "status": "completed"
}
```
- `perPersona` has **all 7** rows (4 advocates `role:"advocate"` + 3 judges `role:"judge"`).
- `perModel` groups by model id with `calls` counts (Mode A → one row of 7 calls; Mode B → up to 7 rows).
- `verdictTally` is **non-binding display only** — counts of the 3 decisions; never a combined verdict.

## (b) Cumulative ledger — `apps/api/data/ledger.jsonl`
One compact appended line per run: `{ runId, createdAt, mode, totalTokens, costUsd, verdictTally }`. Append-only, gitignored, and reconstructable from the DB if lost.

## (c) UI economy panel (RunResult)
Per-persona table + per-model rollup + grand totals (tokens & USD), sits **next to the verdicts**, with a **Download JSON** button (serves file (a)) and a view/download-ledger action. Note "free model — $0.00" honestly.

## Rules
- Read `usage.prompt_tokens`, `usage.completion_tokens`, `usage.completion_tokens_details.reasoning_tokens` (when present), and `usage.cost`.
- Money is `numeric(12,6)` USD; tokens are integers.
- On `aborted_over_budget` still write the economy with the partial rows that exist.
- Must satisfy the §14.2 "Economy builder" test cases (sums, per-persona/-model rows, token totals, JSON snapshot, ledger line shape).

When invoked, either generate the builder/writer, or take a run's raw per-call usage and produce files (a)+(b) plus a one-paragraph plain-language cost summary.

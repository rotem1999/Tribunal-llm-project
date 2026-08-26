# economy/

Token/cost accounting (§6, D8). On every completed or aborted run, write (under `apps/api/data/`):
- per-run JSON `data/runs/<runId>.json` — `perPersona` (all 7), `perModel` rollup, `totals`, `status` (shape in §6).
- append one line to `data/ledger.jsonl`: `{runId, createdAt, mode, totalTokens, costUsd, verdictTally}`.

Costs come straight from `usage.cost`; free models = `0.0`, shown honestly as "$0.00 (free)". `data/` is gitignored; the ledger is also reconstructable from the DB. Serve via `GET /runs/:id/economy` (attachment) and `GET /economy/ledger`.

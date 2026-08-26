# apps/api-e2e/

Backend end-to-end tests (§14.3): Supertest + Testcontainers-postgres, OpenRouter stubbed with nock — never hit the real network. Cover login/guard (401 vs 200), the full run happy path (4 speeches + 3 verdicts + economy + the on-disk JSON file + a ledger line), Mode B distinct model ids, charge-sheet `PATCH` reflected in the next run's snapshot, and failure surfaces (404 data-policy, 402 credits, budget abort). Run via `nx e2e api-e2e`.

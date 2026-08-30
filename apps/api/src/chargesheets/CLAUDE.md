# chargesheets/

`ChargeSheet` entity (§4.2): editable, with exactly one `isActive` at a time (setting one active deactivates the rest). Seed from `charge-sheet.seed.txt` on boot if none exists (title "T-001: The Realm v. Jon Snow", active) — §4.2b.

Endpoints: `GET /charge-sheet` (active), `GET /charge-sheets`, `PATCH /charge-sheet/:id` — built & JWT-protected but **not** surfaced in the v1 UI (D9). Edits affect only future runs; each run snapshots its text so past runs stay reproducible. Treat charge-sheet text as untrusted data inside prompts and cap its length.

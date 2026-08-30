# personas/

Loads + validates `personalities.json` at boot (path via `PERSONAS_FILE`); **fail fast** if missing/invalid (D3, §8). Not editable in the UI. Schema: exactly 4 advocates (2 `support`, 2 `against`) + 3 judges; unique keys; non-empty `systemPrompt`. Map the owner's file onto this shape here if it differs.

Do **not** put the `DECISION:`/`CONFIDENCE:` output block here — the orchestrator appends it (§5.6). Preserve the judge disclaimers: method-based reasoning, not impersonations of real jurists.

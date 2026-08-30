# tribunal/

Run orchestration (§5.5). Load charge sheet (request id else active) -> create `Run(running)`, snapshot content + `costCeilingUsd` -> resolve models (§5.2) -> **advocate phase**: 4 parallel calls, prompt `{system: persona, user: snapshot}`, no speech leaked -> **judge phase**: 3 parallel calls, counterbalanced order per judge (recorded), append the `DECISION`/`CONFIDENCE` block.

Temps: advocate 0.9, judge 0.2. After each call add `costUsd`; if over ceiling -> `aborted_over_budget`, persist partial + economy, stop. Finalize: **no** combined verdict; optional non-binding tally. Parse verdicts (§5.6): regex, one re-ask, then fallback `{justified, 0}` + flag; keep `rawResponse`.

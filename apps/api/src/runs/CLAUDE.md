# runs/

`Run`, `Speech`, `Verdict` entities (§4.3–4.5) + the runs controller. Persist one Speech per advocate call and one Verdict per judge call, each snapshotting the exact systemPrompt + model id used. `Run` holds mode, status enum, `chargeSheetSnapshot`, token/cost totals, `speechOrderByJudge`, and the optional non-binding `verdictTally` (null until completed).

Endpoints (§10): `POST /runs {mode, modelSingle?, chargeSheetId?}` runs the pipeline synchronously and returns `{ runId }` (keep orchestration in a service so it can go async later); `GET /runs`; `GET /runs/:id` (4 speeches + 3 verdicts + economy).

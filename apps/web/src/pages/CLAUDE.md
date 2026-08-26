# pages/

Login, NewRun, RunResult, History (§11).
- **NewRun**: active charge sheet **read-only** (no textarea/upload/edit — D9); Mode A/B toggle (A reveals an optional free-model picker); Run button disabled while in flight. POST body carries only `mode` (+ `modelSingle` in Mode A).
- **RunResult**: advocates, judges (3 verdicts, no combined final; non-binding tally only), economy panel with Download JSON.
- **History**: rows from `GET /runs`; row click -> RunResult.

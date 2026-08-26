# Tribunal

Nx monorepo: a courtroom over a free-text **charge sheet** — 4 blind advocates (2 `support`, 2 `against`) speak, then 3 judges each return a verdict.

**SPEC.md is the authoritative, settled blueprint** — if an API/library contradicts it, prefer reality but never change a decision; read the cited section first.

**Verify, don't assume.** Do not treat anything you "know" as true — second-guess yourself, and before asking the owner anything, look it up online first to confirm it (APIs, library versions, and OpenRouter's free-model roster + data-policy behavior all drift).

Projects: `apps/api`, `apps/web`, `libs/shared-types` — run via `nx <target> <project>` (§3.2).

Invariants:
- Output = 3 independent verdicts (decision + confidence + reasoning/protocol) + token/cost budget — never merged; any tally is non-binding.
- `justified` = for the accused; `not_justified` = against.
- Free OpenRouter models only. Personas from `personalities.json`. Charge sheets editable; each run snapshots its text (immutable). Cases fictional.

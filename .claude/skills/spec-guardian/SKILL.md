---
name: spec-guardian
description: Check a planned or in-progress change against SPEC.md and the CLAUDE.md invariants BEFORE writing or reviewing Tribunal code. Use when about to implement any feature, edit an entity/DTO/endpoint/orchestration step, or when unsure whether a change respects the settled blueprint. Triggers - "does this match the spec", "before I build this", "check against SPEC", "is this allowed", any new module/endpoint/entity work in apps/api, apps/web, or libs/shared-types.
---

# spec-guardian

SPEC.md is the **authoritative, settled blueprint** for Tribunal. This skill keeps a change aligned with it. Run it *before* coding a feature and again before merging.

## Procedure

1. **Locate the authority.** Identify which SPEC.md section governs the change (the file's own §-numbers). Read that section in full before touching code — do not work from memory. If the task spans several sections, read each.
2. **Read the invariants** in the nearest `CLAUDE.md` (root + the module's own). The root invariants that override everything:
   - Output = **3 independent verdicts** (decision + confidence + reasoning/protocol) + token/cost budget. **Never merged.** Any vote tally is **non-binding** and must be labelled so (D5, §5.5). The system issues **no** authoritative combined/majority verdict.
   - `justified` = for the accused; `not_justified` = against. Labels are exactly these strings (not guilty/not-guilty).
   - **Free OpenRouter models only**; model names are resolved at runtime, never hardcoded (§5.2). Do not hardcode `:free` ids.
   - Personas come from `personalities.json` (§8); judges are **method-based, not impersonations** — preserve the disclaimer, never rewrite into first-person impersonations of the real justices.
   - Charge sheets are editable but **runs are immutable**: each run snapshots `chargeSheetSnapshot` and later steps read the snapshot, never the live entity (§4.2, §5.5).
   - Cases are fictional (D1). The `DECISION:`/`CONFIDENCE:` output block is appended by the orchestrator (§5.6), never stored in `personalities.json`.
   - The OpenRouter key stays server-side; `libs/shared-types` is framework-free (§3).
3. **Diff the intent against the spec.** For each thing the change does, answer: does the spec *decide* this? If yes, conform. If the spec is silent, it's an implementer choice (§2.1) — pick the option most consistent with the settled decisions and note it.
4. **Reality-vs-decision rule.** If an API or library contradicts the spec at build time, **prefer reality but never silently change a decision** — flag the deviation to the owner (Rotem) and, per CLAUDE.md, verify the API/version online first before assuming.
5. **Report** as: `Section(s) consulted → conforms / deviates`. For each deviation: what the spec says, what the change does, and either how to fix it or (if reality forces it) the owner-approval note.

## Red flags that fail the check immediately
- Any `finalDecision` / combined / majority verdict field or UI element.
- A hardcoded model id anywhere outside config/env fallback.
- A run step re-reading the live `ChargeSheet` instead of the snapshot.
- `DECISION:`/`CONFIDENCE:` wording living inside `personalities.json`.
- shared-types importing NestJS / class-validator / Swagger.
- A judge system prompt rewritten as a real-person impersonation.

Keep the output short and decision-focused — this is a gate, not a rewrite.

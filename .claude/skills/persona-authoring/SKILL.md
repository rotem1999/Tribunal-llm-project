---
name: persona-authoring
description: Validate or generate the Tribunal personalities.json against the §8 personas contract, and map an owner-provided file onto the canonical schema. Use when editing personalities.json, adding/adjusting an advocate or judge persona, wiring the personas loader, or debugging a boot-time persona validation failure. Triggers - "personalities.json", "add a persona", "persona schema", "advocate/judge system prompt", "personas loader", "why won't it boot" (persona validation).
---

# persona-authoring

Encodes SPEC §8. Personas are baked-in (D3), loaded from `personalities.json` at workspace root (override via `PERSONAS_FILE`), validated at boot with **fail-fast** on any violation.

## Canonical schema
```json
{
  "advocates": [
    { "key": "support_1", "side": "support", "name": "…", "traits": ["…"], "systemPrompt": "…" },
    { "key": "support_2", "side": "support", "name": "…", "traits": ["…"], "systemPrompt": "…" },
    { "key": "against_1", "side": "against", "name": "…", "traits": ["…"], "systemPrompt": "…" },
    { "key": "against_2", "side": "against", "name": "…", "traits": ["…"], "systemPrompt": "…" }
  ],
  "judges": [
    { "key": "judge_1", "name": "…", "traits": ["…"], "systemPrompt": "…" },
    { "key": "judge_2", "name": "…", "traits": ["…"], "systemPrompt": "…" },
    { "key": "judge_3", "name": "…", "traits": ["…"], "systemPrompt": "…" }
  ]
}
```

## Validation rules (must fail-fast with a clear message)
- Exactly **4 advocates** — exactly **2 `support`** and **2 `against`**.
- Exactly **3 judges**.
- **Unique** `key`s across all 7.
- **Non-empty** `systemPrompt` on every persona.
- `traits` is optional metadata (may be folded into the prompt at render time or shown in the UI).
- If the owner's file gives only prose traits and no full prompts, the loader **composes** a system prompt from a template + traits — but the **exact text sent is snapshotted** onto each `Speech`/`Verdict` regardless.

## Content rules that must be preserved
- **Judges are method-based, not impersonations.** Each judge `systemPrompt` opens with an explicit disclaimer: a fictional judge reasoning in the jurisprudential *tradition/method* associated with the named jurist — **not** the real person, not their views, on a fictional case. Never rewrite a judge into a first-person impersonation of the real justice.
- **Do not put the output contract in the persona file.** The strict `DECISION:` / `CONFIDENCE:` block is appended by the orchestrator at call time (§5.6). Judge prompts say "reach your own reasoned verdict" and stop there. Single source of truth for the output format.
- Advocates argue only their side; they are **blind** (they never see other speeches) — nothing in a persona prompt should assume otherwise.
- Cases are fictional; keep the GoT framing consistent with the current 7 personas (Jon Snow, Tyrion, Daenerys, Grey Worm; Barak/Elon/Shamgar-tradition judges).

## When invoked
1. Read the current `personalities.json`.
2. Run every validation rule above; report pass/fail per rule with the offending key.
3. For a new/edited persona, keep counts and side balance intact and preserve the judge disclaimer.
4. Confirm the result satisfies the §14.2 "Personas loader" test cases.

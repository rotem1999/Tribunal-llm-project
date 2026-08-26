# apps/api/src/

One NestJS feature module per folder (module + controller + service + entities/DTOs). Bootstraps in `main.ts` (+ Swagger, §15.1); root module `app/app.module.ts`.

- Business logic in **services**, not controllers — keep controllers thin so the run pipeline can go async later (§10.1).
- DTO classes are the API source of truth (Swagger derives from them); add `@ApiProperty` + enums, and `implements` the shared interfaces.
- TSDoc on public service methods (`runTribunal`, `resolveModels`, `parseVerdict`, `buildEconomy`, charge-sheet activation).
- Snapshot the exact systemPrompt + model id onto every persisted Speech/Verdict.

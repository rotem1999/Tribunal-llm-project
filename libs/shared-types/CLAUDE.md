# shared-types/

Framework-free request/response **interfaces** + **enums** (`mode`, `decision`, run `status`), defined once and imported by both apps via `@tribunal/shared-types` (§3). **No** NestJS / class-validator / Swagger imports (they would bloat the browser bundle). The api's DTO *classes* live in `apps/api` and `implements` these interfaces — decorators only there. Public barrel: `src/index.ts`. Optionally generated from `openapi.json` to match the running API.

# apps/api/

NestJS + TS, TypeORM, PostgreSQL — the Nx `api` app. Owns LLM orchestration, cost accounting, persistence, and auth; the OpenRouter key stays server-side.

Conventions:
- Every entity: UUID PK + `createdAt`/`updatedAt`. Money = `numeric(12,6)` USD; tokens = integer.
- Config only via `@nestjs/config` with schema validation (§9); keep `.env.example` in sync.
- Auth: single seeded user + JWT bearer; guard all `/runs*` and `/models*` (§7).
- DTO classes carry `@ApiProperty` + class-validator; Swagger at `/api/docs`, emit `openapi.json` (§15.1).
- Seed on boot idempotently: user (§7) + charge sheet (§4.2b).
- `nx serve|test api`; OpenRouter always mocked (§14).

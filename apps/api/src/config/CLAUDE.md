# config/

Env loading + validation via `@nestjs/config` + zod/joi. Validate at boot and **fail fast** on any missing/invalid var. Full table in SPEC §9; keep `.env.example` in sync. Paths (`PERSONAS_FILE`, `CHARGE_SHEET_SEED_FILE`) resolve from the Nx workspace root. Required: `OPENROUTER_API_KEY`, `DATABASE_URL`, `JWT_SECRET`, `SEED_USERNAME`, `SEED_PASSWORD`, `CORS_ORIGINS`.

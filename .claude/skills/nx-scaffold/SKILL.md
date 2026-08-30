---
name: nx-scaffold
description: Apply the Tribunal Nx workspace conventions - generating apps/libs, running targets, caching, tags and module boundaries (§3.2). Use when scaffolding a project, adding a module, running build/serve/test/lint, setting up CI affected commands, or wiring the shared-types path alias. Triggers - "nx generate", "nx serve/build/test", "add a module", "module boundaries", "affected", "shared-types alias", "scaffold the workspace".
---

# nx-scaffold

Encodes SPEC §3.1–3.2. Package scope is `@nx/*` (current, not `@nrwl/*`). One root `package.json`, one lockfile.

## Create / generate
- Workspace: `npx create-nx-workspace@latest tribunal --preset=apps` (integrated monorepo), then `nx add @nx/nest @nx/react @nx/js`.
- Apps/libs:
  - `nx g @nx/nest:app apps/api`
  - `nx g @nx/react:app apps/web --bundler=vite`
  - `nx g @nx/js:lib libs/shared-types --bundler=tsc`
- Path alias `@tribunal/shared-types` declared in `tsconfig.base.json`; both apps import the shared contract through it.

## Run targets
`nx serve api`, `nx serve web`, `nx build <app>`, `nx test <project>`, `nx lint <project>`, `nx run-many -t test`. In CI use **`nx affected -t build test lint`** so only touched projects + dependents run. Backend tests are Jest (`@nx/jest`); web tests are Vitest (`@nx/vite`).

## Caching & boundaries (the load-bearing config)
- `nx.json` → `targetDefaults` with `cache: true` for build/test/lint and `dependsOn: ["^build"]` (a project builds its lib deps first). Named `inputs` exclude test files from build hashing.
- **Tag every project** in `project.json`: `scope:api` | `scope:web` | `scope:shared`, and `type:app` | `type:lib`.
- Enable `@nx/enforce-module-boundaries` so `web` **cannot** import server code and everything may import `scope:shared`. This is what keeps the OpenRouter key and TypeORM entities out of the browser bundle.

## Placement rules
- Domain modules live in `apps/api/src/<domain>` for a project this size (auth, users, personas, chargesheets, openrouter, tribunal, runs, economy, config). Extract to `libs/api/<domain>` later only if they grow — an Nx move, not a redesign.
- Only truly shared, **framework-free** contract types (enums `mode`/`decision`/`status`, request/response interfaces) belong in `libs/shared-types`. No NestJS/class-validator/Swagger imports there. The api's DTO classes live in `apps/api` and `implements` those interfaces.

When invoked, produce the exact `nx g` / `nx run` commands for the task and verify the generated project's tags + `project.json` targets match the above before moving on.

# apps/

Nx application projects: `api` (NestJS backend) and `web` (React frontend), each with an `*-e2e` sibling. Both may import `@tribunal/shared-types`; **`web` must never import `api`/server code** — enforced by `@nx/enforce-module-boundaries` via `scope:` tags (§3.2). Auth is JWT bearer between web and api.

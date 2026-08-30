# apps/web/src/

Entry `main.tsx`, root `app/App.tsx`. Layout: `api/` (typed fetch client + auth), `pages/`, `components/`, `styles/`. Import request/response types from `@tribunal/shared-types` (optionally generated from the api's `openapi.json`) to keep the front/back contract in sync. Tests: Vitest + React Testing Library + MSW (§14.4).

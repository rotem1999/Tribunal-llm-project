# api/

Typed fetch client (§11). Attach `Authorization: Bearer <jwt>` to every request; on 401 clear the token and redirect to Login; surface the data-policy 404 message into a visible banner. Base URL from env. Types come from `@tribunal/shared-types` (optionally generated from the api's `openapi.json`).

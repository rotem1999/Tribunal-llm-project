# api/

Typed fetch client (§11). Attach `Authorization: Bearer <jwt>` to every request; on 401 clear the token and redirect to Login. Base URL from env. Types from `@tribunal/shared-types`.

Errors (§12.1): `ApiError` carries a stable `ErrorCode` (a failed `fetch` → `NETWORK`). The UI renders user-safe copy keyed by that code via `errors.ts` + `<ErrorNotice>` — **never** a raw `run.error`, backend `message`, or model output. Uncategorized failures (INTERNAL/NETWORK) also show a quotable run-id + code reference. Keep `errors.ts` copy in step with the api's `classify-error.ts`.

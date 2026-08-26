# auth/

Single seeded user + JWT (D2, §7). `POST /auth/login` -> `{ accessToken }` (JWT signed with `JWT_SECRET`, payload `{ sub, username }`, expiry `JWT_EXPIRES_IN`, default 1d). `GET /auth/me` returns the user. A JWT guard (`@nestjs/passport` + `passport-jwt`) protects all `/runs*` and `/models*`. No registration and no refresh token in v1. Hash passwords with argon2id; never log the password. CORS limited to `CORS_ORIGINS`.

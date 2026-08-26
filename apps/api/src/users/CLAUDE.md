# users/

`User` entity (§4.1): `id` uuid, `username` unique, `passwordHash` (argon2id preferred), `createdAt`. On boot, if no user exists, seed one from `SEED_USERNAME`/`SEED_PASSWORD` — idempotent (no duplicate user on a second boot). Never log the password.

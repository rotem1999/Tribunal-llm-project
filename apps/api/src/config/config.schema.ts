import { z } from 'zod';

/**
 * Environment schema for the Tribunal API (SPEC §9).
 *
 * Every process env var the backend reads is declared here with its type,
 * requiredness, and default. {@link validateEnv} runs this at boot via
 * `@nestjs/config` so the app fails fast with a clear, aggregated message
 * when a required var is missing or malformed — never at first use.
 */

/** Coerce a possibly-string env value into a number, keeping undefined as-is. */
const numberFromEnv = z.coerce.number();

/**
 * Treat a blank env value as "unset". Env vars are always strings, so a blank
 * line in a .env file (e.g. `OPENROUTER_APP_URL=`) arrives as `''` — which is
 * "present but empty", not "absent". Without this, an empty optional URL would
 * fail `.url()` instead of falling through to optional/default. Applied to the
 * URL fields so copying `.env.example` (which lists them blank) boots cleanly.
 */
const blankToUndefined = (v: unknown) =>
  typeof v === 'string' && v.trim() === '' ? undefined : v;

/**
 * Parse a boolean env value. Env vars are strings, so `z.coerce.boolean()` is
 * wrong here (it treats the string `"false"` as `true`). Accepts the usual
 * truthy/falsy spellings; anything else falls through to zod's error.
 */
const booleanFromEnv = z.preprocess((v) => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(s)) return true;
    if (['false', '0', 'no', 'off'].includes(s)) return false;
  }
  return v;
}, z.boolean());

export const envSchema = z.object({
  // --- OpenRouter (SPEC §5, §9) ---
  OPENROUTER_API_KEY: z.string().min(1, 'OPENROUTER_API_KEY is required'),
  OPENROUTER_BASE_URL: z.preprocess(
    blankToUndefined,
    z.string().url().default('https://openrouter.ai/api/v1'),
  ),
  OPENROUTER_APP_TITLE: z.string().default('Tribunal'),
  OPENROUTER_APP_URL: z.preprocess(blankToUndefined, z.string().url().optional()),
  MODE_A_MODEL: z.string().optional(),
  // Extra comma-separated substrings that exclude a "free" model from being an
  // advocate/judge, on top of the built-in task-type blacklist (SPEC §5.2).
  MODEL_BLACKLIST: z.string().optional(),

  // --- Run economy / model tuning (SPEC §2.1, §5, §9) ---
  RUN_COST_CEILING_USD: numberFromEnv.positive().default(5),
  ADVOCATE_TEMPERATURE: numberFromEnv.min(0).max(2).default(0.9),
  JUDGE_TEMPERATURE: numberFromEnv.min(0).max(2).default(0.2),
  MODEL_MAX_TOKENS: numberFromEnv.int().positive().default(1024),
  CALL_TIMEOUT_MS: numberFromEnv.int().positive().default(90000),
  // Ask OpenRouter to disable model "reasoning" on persona calls. Many free
  // models otherwise dump their entire chain-of-thought into the response and
  // exhaust MODEL_MAX_TOKENS before emitting the required verdict block (§5.6).
  DISABLE_MODEL_REASONING: booleanFromEnv.default(true),

  // --- Persistence (SPEC §4, §9) ---
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // --- Auth (SPEC §7, §9) ---
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  JWT_EXPIRES_IN: z.string().default('1d'),
  SEED_USERNAME: z.string().min(1, 'SEED_USERNAME is required'),
  SEED_PASSWORD: z.string().min(1, 'SEED_PASSWORD is required'),

  // --- File sources (SPEC §8, §4.2b, §9) — resolved from the workspace root ---
  PERSONAS_FILE: z.string().default('personalities.json'),
  CHARGE_SHEET_SEED_FILE: z.string().default('charge-sheet.seed.txt'),

  // --- HTTP (SPEC §7, §9) ---
  CORS_ORIGINS: z.string().min(1, 'CORS_ORIGINS is required'),
  PORT: numberFromEnv.int().positive().default(3000),
});

/** Fully-typed, validated environment. */
export type Env = z.infer<typeof envSchema>;

/**
 * Validate `process.env` at boot. Passed to `ConfigModule.forRoot({ validate })`.
 * Throws a single Error listing every offending variable so misconfiguration is
 * obvious and fixable in one pass.
 */
export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(
      `Invalid environment configuration (see SPEC §9 / .env.example):\n${issues}`,
    );
  }
  return result.data;
}

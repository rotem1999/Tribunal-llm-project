import { describe, expect, it } from '@jest/globals';
import { validateEnv } from './config.schema';

/**
 * Environment-config validator (SPEC §9). We test {@link validateEnv} — the zod
 * schema `@nestjs/config` runs at boot — directly: valid parsing + coercion,
 * applied defaults, required-var enforcement via the single aggregated error,
 * the blank-URL regression, malformed-URL rejection, and numeric bounds.
 *
 * Env vars are always strings at runtime, so the helper models every value as a
 * string (as `process.env` would deliver it) and each test overrides only what
 * it probes.
 */

/** A complete, valid env with ONLY the required vars set (as strings). */
function validEnv(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    OPENROUTER_API_KEY: 'sk-or-test-key',
    DATABASE_URL: 'postgres://user:pass@localhost:5432/tribunal',
    JWT_SECRET: 'super-secret-jwt-signing-key',
    SEED_USERNAME: 'admin',
    SEED_PASSWORD: 'hunter2',
    CORS_ORIGINS: 'http://localhost:4200',
    ...overrides,
  };
}

describe('validateEnv', () => {
  describe('valid parse + coercion', () => {
    it('parses a complete valid env and coerces numeric fields to real numbers', () => {
      const env = validateEnv(
        validEnv({
          OPENROUTER_BASE_URL: 'https://example.com/api',
          OPENROUTER_APP_TITLE: 'MyTribunal',
          OPENROUTER_APP_URL: 'https://app.example.com',
          MODE_A_MODEL: 'openai/gpt-4o',
          RUN_COST_CEILING_USD: '12.5',
          ADVOCATE_TEMPERATURE: '1.1',
          JUDGE_TEMPERATURE: '0.3',
          MODEL_MAX_TOKENS: '2048',
          CALL_TIMEOUT_MS: '60000',
          JWT_EXPIRES_IN: '7d',
          PERSONAS_FILE: 'custom-personas.json',
          CHARGE_SHEET_SEED_FILE: 'custom-seed.txt',
          PORT: '8080',
        }),
      );

      // Numeric fields become real numbers, not strings.
      expect(env.RUN_COST_CEILING_USD).toBe(12.5);
      expect(env.ADVOCATE_TEMPERATURE).toBe(1.1);
      expect(env.JUDGE_TEMPERATURE).toBe(0.3);
      expect(env.MODEL_MAX_TOKENS).toBe(2048);
      expect(env.CALL_TIMEOUT_MS).toBe(60000);
      expect(env.PORT).toBe(8080);
      for (const n of [
        env.RUN_COST_CEILING_USD,
        env.ADVOCATE_TEMPERATURE,
        env.JUDGE_TEMPERATURE,
        env.MODEL_MAX_TOKENS,
        env.CALL_TIMEOUT_MS,
        env.PORT,
      ]) {
        expect(typeof n).toBe('number');
      }

      // String fields pass through unchanged.
      expect(env.OPENROUTER_API_KEY).toBe('sk-or-test-key');
      expect(env.OPENROUTER_BASE_URL).toBe('https://example.com/api');
      expect(env.OPENROUTER_APP_TITLE).toBe('MyTribunal');
      expect(env.OPENROUTER_APP_URL).toBe('https://app.example.com');
      expect(env.MODE_A_MODEL).toBe('openai/gpt-4o');
      expect(env.DATABASE_URL).toBe('postgres://user:pass@localhost:5432/tribunal');
      expect(env.JWT_SECRET).toBe('super-secret-jwt-signing-key');
      expect(env.JWT_EXPIRES_IN).toBe('7d');
      expect(env.SEED_USERNAME).toBe('admin');
      expect(env.SEED_PASSWORD).toBe('hunter2');
      expect(env.PERSONAS_FILE).toBe('custom-personas.json');
      expect(env.CHARGE_SHEET_SEED_FILE).toBe('custom-seed.txt');
      expect(env.CORS_ORIGINS).toBe('http://localhost:4200');
    });
  });

  describe('defaults', () => {
    it('applies all documented defaults when optional vars are omitted', () => {
      const env = validateEnv(validEnv());

      expect(env.OPENROUTER_BASE_URL).toBe('https://openrouter.ai/api/v1');
      expect(env.OPENROUTER_APP_TITLE).toBe('Tribunal');
      expect(env.JWT_EXPIRES_IN).toBe('1d');
      expect(env.ADVOCATE_TEMPERATURE).toBe(0.9);
      expect(env.JUDGE_TEMPERATURE).toBe(0.2);
      expect(env.MODEL_MAX_TOKENS).toBe(1024);
      expect(env.CALL_TIMEOUT_MS).toBe(90000);
      expect(env.RUN_COST_CEILING_USD).toBe(5);
      expect(env.PERSONAS_FILE).toBe('personalities.json');
      expect(env.CHARGE_SHEET_SEED_FILE).toBe('charge-sheet.seed.txt');
      expect(env.PORT).toBe(3000);
    });

    it('leaves purely-optional vars (no default) undefined when omitted', () => {
      const env = validateEnv(validEnv());
      expect(env.OPENROUTER_APP_URL).toBeUndefined();
      expect(env.MODE_A_MODEL).toBeUndefined();
    });
  });

  describe('required vars', () => {
    const required = [
      'OPENROUTER_API_KEY',
      'DATABASE_URL',
      'JWT_SECRET',
      'SEED_USERNAME',
      'SEED_PASSWORD',
      'CORS_ORIGINS',
    ] as const;

    it.each(required)('throws the aggregated error when %s is missing', (key) => {
      const config = validEnv();
      delete config[key];

      expect(() => validateEnv(config)).toThrow(/Invalid environment configuration/);
      // The offending variable is named in the message.
      expect(() => validateEnv(config)).toThrow(new RegExp(key));
    });

    it('rejects an empty-string required var (min(1)) and names it', () => {
      expect(() => validateEnv(validEnv({ JWT_SECRET: '' }))).toThrow(/JWT_SECRET/);
    });

    it('lists every missing required var at once in one aggregated error', () => {
      const config = validEnv();
      delete config.JWT_SECRET;
      delete config.DATABASE_URL;
      delete config.SEED_PASSWORD;

      let message = '';
      try {
        validateEnv(config);
      } catch (err) {
        message = (err as Error).message;
      }

      expect(message).toContain('Invalid environment configuration');
      expect(message).toContain('JWT_SECRET');
      expect(message).toContain('DATABASE_URL');
      expect(message).toContain('SEED_PASSWORD');
      // A single aggregated throw, not one-per-var: header appears exactly once.
      expect(message.match(/Invalid environment configuration/g)).toHaveLength(1);
    });
  });

  describe('blank URL regression (SPEC §9 bug fix)', () => {
    it('accepts a blank OPENROUTER_APP_URL ("") and treats it as unset', () => {
      const env = validateEnv(validEnv({ OPENROUTER_APP_URL: '' }));
      expect(env.OPENROUTER_APP_URL).toBeUndefined();
    });

    it('treats a whitespace-only OPENROUTER_APP_URL as unset', () => {
      const env = validateEnv(validEnv({ OPENROUTER_APP_URL: '   ' }));
      expect(env.OPENROUTER_APP_URL).toBeUndefined();
    });

    it('falls back to the default when OPENROUTER_BASE_URL is blank ("")', () => {
      const env = validateEnv(validEnv({ OPENROUTER_BASE_URL: '' }));
      expect(env.OPENROUTER_BASE_URL).toBe('https://openrouter.ai/api/v1');
    });
  });

  describe('malformed (non-blank) URLs', () => {
    it('rejects a non-URL OPENROUTER_APP_URL', () => {
      expect(() => validateEnv(validEnv({ OPENROUTER_APP_URL: 'not-a-url' }))).toThrow(
        /OPENROUTER_APP_URL/,
      );
    });

    it('rejects a non-URL OPENROUTER_BASE_URL', () => {
      expect(() => validateEnv(validEnv({ OPENROUTER_BASE_URL: 'not-a-url' }))).toThrow(
        /OPENROUTER_BASE_URL/,
      );
    });
  });

  describe('numeric range/format validation', () => {
    it('rejects an ADVOCATE_TEMPERATURE above the max (2)', () => {
      expect(() => validateEnv(validEnv({ ADVOCATE_TEMPERATURE: '2.5' }))).toThrow(
        /ADVOCATE_TEMPERATURE/,
      );
    });

    it('rejects a negative JUDGE_TEMPERATURE (below min 0)', () => {
      expect(() => validateEnv(validEnv({ JUDGE_TEMPERATURE: '-0.1' }))).toThrow(
        /JUDGE_TEMPERATURE/,
      );
    });

    it('accepts the temperature boundary values 0 and 2', () => {
      const env = validateEnv(
        validEnv({ ADVOCATE_TEMPERATURE: '0', JUDGE_TEMPERATURE: '2' }),
      );
      expect(env.ADVOCATE_TEMPERATURE).toBe(0);
      expect(env.JUDGE_TEMPERATURE).toBe(2);
    });

    it('rejects a non-positive RUN_COST_CEILING_USD (0)', () => {
      expect(() => validateEnv(validEnv({ RUN_COST_CEILING_USD: '0' }))).toThrow(
        /RUN_COST_CEILING_USD/,
      );
    });

    it('rejects a negative RUN_COST_CEILING_USD', () => {
      expect(() => validateEnv(validEnv({ RUN_COST_CEILING_USD: '-3' }))).toThrow(
        /RUN_COST_CEILING_USD/,
      );
    });

    it('rejects a non-integer MODEL_MAX_TOKENS', () => {
      expect(() => validateEnv(validEnv({ MODEL_MAX_TOKENS: '10.5' }))).toThrow(
        /MODEL_MAX_TOKENS/,
      );
    });

    it('rejects a non-integer CALL_TIMEOUT_MS', () => {
      expect(() => validateEnv(validEnv({ CALL_TIMEOUT_MS: '1000.7' }))).toThrow(
        /CALL_TIMEOUT_MS/,
      );
    });

    it('rejects a non-integer PORT', () => {
      expect(() => validateEnv(validEnv({ PORT: '3000.5' }))).toThrow(/PORT/);
    });

    it('rejects a non-positive PORT (0)', () => {
      expect(() => validateEnv(validEnv({ PORT: '0' }))).toThrow(/PORT/);
    });

    it('rejects a non-numeric value for a numeric field', () => {
      expect(() => validateEnv(validEnv({ PORT: 'abc' }))).toThrow(/PORT/);
    });
  });
});

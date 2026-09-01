import { describe, expect, it } from '@jest/globals';
import { redact } from './redact';

/**
 * Redaction unit tests (SPEC §5.7 / §14.2). Pure logic, no I/O: the diagnostic
 * log logs full payloads on purpose (case content is fictional, D1) but must
 * NEVER write secrets. Two layers are exercised here — credential-named keys are
 * masked wholesale, and literal secret *values* are scrubbed wherever they
 * appear — while precise token-count keys are deliberately kept.
 */
describe('redact — sensitive key masking', () => {
  it('masks credential-named keys wholesale while leaving non-secret keys intact', () => {
    const out = redact({
      Authorization: 'Bearer super-secret',
      api_key: 'sk-or-abc123',
      password: 'hunter2',
      jwt: 'eyJhbGciOi',
      model: 'free/model',
    }) as Record<string, unknown>;

    expect(out.Authorization).toBe('[REDACTED]');
    expect(out.api_key).toBe('[REDACTED]');
    expect(out.password).toBe('[REDACTED]');
    expect(out.jwt).toBe('[REDACTED]');
    // A non-credential key is untouched.
    expect(out.model).toBe('free/model');
  });

  it('KEEPS token-count keys that merely contain the word "token" (must NOT be redacted)', () => {
    const usage = {
      total_tokens: 140,
      completion_tokens: 40,
      reasoning_tokens: 12,
      promptTokens: 100,
    };
    // None of these are credential keys — the whole usage block survives verbatim.
    expect(redact(usage)).toEqual(usage);
  });
});

describe('redact — literal secret value scrubbing', () => {
  it('scrubs literal secret VALUES wherever they appear inside strings and nested arrays', () => {
    const secret = 'sk-or-SECRET-123';
    const out = redact(
      {
        note: `the key is ${secret} here`,
        list: ['plain', `prefix ${secret} suffix`, ['deep', secret]],
      },
      [secret],
    ) as { note: string; list: unknown[] };

    expect(out.note).toBe('the key is [REDACTED] here');
    expect(out.list).toEqual(['plain', 'prefix [REDACTED] suffix', ['deep', '[REDACTED]']]);
  });

  it('ignores blank / whitespace-only secrets (does not scrub with them)', () => {
    const out = redact({ text: 'nothing secret here' }, ['', '   ', '\t\n']) as {
      text: string;
    };
    expect(out.text).toBe('nothing secret here');
  });
});

describe('redact — recursion and immutability', () => {
  it('recurses into nested objects/arrays and does not mutate the input object', () => {
    const input = {
      a: { b: { c: 'keep-me' } },
      arr: [{ password: 'hunter2' }, { ok: 'value' }],
    };

    const out = redact(input) as {
      a: { b: { c: string } };
      arr: Array<Record<string, unknown>>;
    };

    // Recursed: the nested credential key is masked, the nested plain value kept.
    expect(out.arr[0].password).toBe('[REDACTED]');
    expect(out.arr[1].ok).toBe('value');
    expect(out.a.b.c).toBe('keep-me');

    // The input object is never mutated — the original still holds its secret.
    expect(input.arr[0].password).toBe('hunter2');
    expect(input).toEqual({
      a: { b: { c: 'keep-me' } },
      arr: [{ password: 'hunter2' }, { ok: 'value' }],
    });
    // Deep clone, not a shared reference.
    expect(out.arr).not.toBe(input.arr);
  });
});

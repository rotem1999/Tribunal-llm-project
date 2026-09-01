/**
 * Redaction for the diagnostic log (SPEC §5.7). Even though case content is
 * fictional (D1) and full payloads are logged on purpose, secrets must NEVER be
 * written: the OpenRouter API key / outgoing `Authorization` header, the
 * `JWT_SECRET` or any bearer token, and `SEED_PASSWORD`. Two layers:
 *   1. keys whose *name* is sensitive are masked wholesale;
 *   2. the literal secret *values* are scrubbed wherever they appear in a string.
 * Deliberately precise so token-count keys (`total_tokens`, `reasoning_tokens`,
 * `promptTokens`, …) are kept — only true credential keys are masked.
 */

const REDACTED = '[REDACTED]';

/** Object keys that are always credentials, matched case-insensitively (exact). */
const SECRET_KEY_RE =
  /^(authorization|api[_-]?key|password|passwordhash|jwt|jwt[_-]?secret|secret|access[_-]?token|refresh[_-]?token|bearer)$/i;

const MAX_DEPTH = 8;

/**
 * Deep-clone `value`, masking sensitive keys and any occurrence of a known
 * secret string. `secrets` are the literal values to scrub (API key, JWT secret,
 * seed password); blanks are ignored. Never mutates the input.
 */
export function redact(value: unknown, secrets: readonly string[] = []): unknown {
  const needles = secrets.filter((s) => typeof s === 'string' && s.trim().length > 0);
  return walk(value, needles, 0);
}

function walk(value: unknown, secrets: readonly string[], depth: number): unknown {
  if (depth > MAX_DEPTH) return REDACTED;
  if (typeof value === 'string') return scrub(value, secrets);
  if (Array.isArray(value)) return value.map((v) => walk(v, secrets, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SECRET_KEY_RE.test(k) ? REDACTED : walk(v, secrets, depth + 1);
    }
    return out;
  }
  return value;
}

/** Replace every literal secret value inside a string. */
function scrub(s: string, secrets: readonly string[]): string {
  let out = s;
  for (const secret of secrets) {
    if (out.includes(secret)) out = out.split(secret).join(REDACTED);
  }
  return out;
}

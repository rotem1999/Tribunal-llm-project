import { describe, expect, it } from '@jest/globals';
import { Side } from '@tribunal/shared-types';
import { personasSchema } from './personas.schema';

/**
 * Owner-provided personalities schema (SPEC §8). The app fails fast at boot on a
 * malformed file, so we test the zod schema directly against its structural
 * rules: exactly 4 advocates (2 support + 2 against), exactly 3 judges, unique
 * keys, and non-empty system prompts.
 */

function makeAdvocate(key: string, side: Side) {
  return {
    key,
    side,
    name: `Advocate ${key}`,
    traits: ['persuasive'],
    systemPrompt: `SYSTEM_PROMPT_${key}`,
  };
}

function makeJudge(key: string) {
  return {
    key,
    name: `Judge ${key}`,
    systemPrompt: `SYSTEM_PROMPT_${key}`,
  };
}

/** A fully valid personalities object: 2 support + 2 against advocates, 3 judges. */
function validPersonas() {
  return {
    advocates: [
      makeAdvocate('sup1', Side.support),
      makeAdvocate('sup2', Side.support),
      makeAdvocate('agn1', Side.against),
      makeAdvocate('agn2', Side.against),
    ],
    judges: [makeJudge('j1'), makeJudge('j2'), makeJudge('j3')],
  };
}

describe('personasSchema', () => {
  it('accepts a valid file (4 advocates + 3 judges, 2/2 sides)', () => {
    const result = personasSchema.safeParse(validPersonas());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.advocates).toHaveLength(4);
      expect(result.data.judges).toHaveLength(3);
    }
  });

  it('accepts advocates without the optional traits array', () => {
    const data = validPersonas();
    for (const a of data.advocates) delete (a as { traits?: string[] }).traits;
    expect(personasSchema.safeParse(data).success).toBe(true);
  });

  it('rejects when there are not exactly 4 advocates (too few)', () => {
    const data = validPersonas();
    data.advocates.pop();
    const result = personasSchema.safeParse(data);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(JSON.stringify(result.error.issues)).toContain('4 advocates');
    }
  });

  it('rejects when there are more than 4 advocates', () => {
    const data = validPersonas();
    data.advocates.push(makeAdvocate('sup3', Side.support));
    expect(personasSchema.safeParse(data).success).toBe(false);
  });

  it('rejects when there are not exactly 3 judges', () => {
    const data = validPersonas();
    data.judges.pop();
    const result = personasSchema.safeParse(data);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(JSON.stringify(result.error.issues)).toContain('3 judges');
    }
  });

  it('rejects wrong side counts (3 support + 1 against)', () => {
    const data = {
      advocates: [
        makeAdvocate('a', Side.support),
        makeAdvocate('b', Side.support),
        makeAdvocate('c', Side.support),
        makeAdvocate('d', Side.against),
      ],
      judges: [makeJudge('j1'), makeJudge('j2'), makeJudge('j3')],
    };
    const result = personasSchema.safeParse(data);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(JSON.stringify(result.error.issues)).toMatch(/2 support \+ 2 against/);
    }
  });

  it('rejects wrong side counts (4 against, 0 support)', () => {
    const data = {
      advocates: [
        makeAdvocate('a', Side.against),
        makeAdvocate('b', Side.against),
        makeAdvocate('c', Side.against),
        makeAdvocate('d', Side.against),
      ],
      judges: [makeJudge('j1'), makeJudge('j2'), makeJudge('j3')],
    };
    expect(personasSchema.safeParse(data).success).toBe(false);
  });

  it('rejects duplicate keys across advocates and judges', () => {
    const data = validPersonas();
    // Collide an advocate key with a judge key.
    data.judges[0].key = data.advocates[0].key;
    const result = personasSchema.safeParse(data);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(JSON.stringify(result.error.issues)).toMatch(/keys must be unique/);
    }
  });

  it('rejects duplicate keys among advocates', () => {
    const data = validPersonas();
    data.advocates[1].key = data.advocates[0].key;
    expect(personasSchema.safeParse(data).success).toBe(false);
  });

  it('rejects an empty advocate systemPrompt', () => {
    const data = validPersonas();
    data.advocates[0].systemPrompt = '';
    const result = personasSchema.safeParse(data);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(JSON.stringify(result.error.issues)).toContain(
        'advocate systemPrompt must be non-empty',
      );
    }
  });

  it('rejects an empty judge systemPrompt', () => {
    const data = validPersonas();
    data.judges[0].systemPrompt = '';
    const result = personasSchema.safeParse(data);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(JSON.stringify(result.error.issues)).toContain(
        'judge systemPrompt must be non-empty',
      );
    }
  });

  it('rejects an empty advocate key', () => {
    const data = validPersonas();
    data.advocates[0].key = '';
    expect(personasSchema.safeParse(data).success).toBe(false);
  });

  it('rejects an invalid side enum value', () => {
    const data = validPersonas();
    (data.advocates[0] as { side: string }).side = 'neutral';
    expect(personasSchema.safeParse(data).success).toBe(false);
  });

  it('rejects a missing advocates/judges key entirely', () => {
    expect(personasSchema.safeParse({ judges: [] }).success).toBe(false);
    expect(personasSchema.safeParse({ advocates: [] }).success).toBe(false);
    expect(personasSchema.safeParse({}).success).toBe(false);
  });
});

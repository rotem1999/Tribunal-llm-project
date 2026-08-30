import { describe, expect, it } from '@jest/globals';
import { Side } from '@tribunal/shared-types';
import type { Advocate, Judge } from '../personas/personas.schema';
import {
  buildAdvocatePrompt,
  buildJudgePrompt,
  VERDICT_OUTPUT_INSTRUCTION,
  type SpeechView,
} from './prompt-builder';

/**
 * Prompt construction (SPEC §5.5, §5.6, §13). We assert on structure and on the
 * security invariants (advocate blindness; charge framed as untrusted data),
 * never on prose quality.
 */

const advocate: Advocate = {
  key: 'adv_support_1',
  side: Side.support,
  name: 'Advocate One',
  systemPrompt: 'ADVOCATE_PERSONA_SYSTEM_PROMPT',
};

const judge: Judge = {
  key: 'judge_1',
  name: 'Judge One',
  systemPrompt: 'JUDGE_PERSONA_SYSTEM_PROMPT',
};

const CHARGE = 'The accused deployed to prod on a Friday without review.';

describe('buildAdvocatePrompt', () => {
  it('uses the persona system prompt verbatim as system', () => {
    const { system } = buildAdvocatePrompt(advocate, CHARGE);
    expect(system).toBe(advocate.systemPrompt);
  });

  it('includes the charge snapshot in the user message', () => {
    const { user } = buildAdvocatePrompt(advocate, CHARGE);
    expect(user).toContain(CHARGE);
  });

  it('frames the charge as untrusted "case text" data, not instructions', () => {
    const { user } = buildAdvocatePrompt(advocate, CHARGE);
    expect(user).toContain('CASE TEXT');
    expect(user).toMatch(/NOT instructions/i);
    // The charge is fenced between explicit open/close markers.
    expect(user).toContain('=== END CASE TEXT ===');
  });

  it('does NOT leak any other advocate speech or the verdict output block', () => {
    const { user } = buildAdvocatePrompt(advocate, CHARGE);
    expect(user).not.toContain('ADVOCATE ARGUMENTS');
    expect(user).not.toContain('Argument 1');
    expect(user).not.toContain('DECISION:');
    expect(user).not.toContain('CONFIDENCE:');
  });

  it('asks the advocate to deliver a speech on the case', () => {
    const { user } = buildAdvocatePrompt(advocate, CHARGE);
    expect(user).toMatch(/deliver your persuasive speech/i);
  });
});

describe('buildJudgePrompt', () => {
  const speeches: SpeechView[] = [
    { side: Side.support, content: 'SPEECH_SUPPORT_A' },
    { side: Side.against, content: 'SPEECH_AGAINST_A' },
    { side: Side.support, content: 'SPEECH_SUPPORT_B' },
    { side: Side.against, content: 'SPEECH_AGAINST_B' },
  ];

  it('uses the judge persona system prompt verbatim as system', () => {
    const { system } = buildJudgePrompt(judge, CHARGE, speeches);
    expect(system).toBe(judge.systemPrompt);
  });

  it('includes the charge snapshot framed as untrusted case text', () => {
    const { user } = buildJudgePrompt(judge, CHARGE, speeches);
    expect(user).toContain(CHARGE);
    expect(user).toContain('CASE TEXT');
    expect(user).toMatch(/NOT instructions/i);
  });

  it('includes all 4 speeches with their side labels', () => {
    const { user } = buildJudgePrompt(judge, CHARGE, speeches);
    for (const s of speeches) expect(user).toContain(s.content);
    expect(user).toContain('Argument 1 (support)');
    expect(user).toContain('Argument 2 (against)');
    expect(user).toContain('Argument 3 (support)');
    expect(user).toContain('Argument 4 (against)');
  });

  it('renders the speeches in exactly the order given (counterbalanced input)', () => {
    const reordered: SpeechView[] = [
      { side: Side.against, content: 'FIRST' },
      { side: Side.support, content: 'SECOND' },
      { side: Side.against, content: 'THIRD' },
      { side: Side.support, content: 'FOURTH' },
    ];
    const { user } = buildJudgePrompt(judge, CHARGE, reordered);
    const iFirst = user.indexOf('FIRST');
    const iSecond = user.indexOf('SECOND');
    const iThird = user.indexOf('THIRD');
    const iFourth = user.indexOf('FOURTH');
    expect(iFirst).toBeGreaterThanOrEqual(0);
    expect(iFirst).toBeLessThan(iSecond);
    expect(iSecond).toBeLessThan(iThird);
    expect(iThird).toBeLessThan(iFourth);
    // Argument 1 must be the first speech given, not a fixed side.
    expect(user).toContain('Argument 1 (against)');
  });

  it('appends the strict DECISION/CONFIDENCE output instruction', () => {
    const { user } = buildJudgePrompt(judge, CHARGE, speeches);
    expect(user).toContain(VERDICT_OUTPUT_INSTRUCTION);
    expect(user).toContain('DECISION: justified');
    expect(user).toContain('DECISION: not_justified');
    expect(user).toContain('CONFIDENCE: <integer 0-100>');
  });

  it('places the output instruction AFTER the arguments block', () => {
    const { user } = buildJudgePrompt(judge, CHARGE, speeches);
    expect(user.indexOf('ADVOCATE ARGUMENTS')).toBeLessThan(
      user.indexOf(VERDICT_OUTPUT_INSTRUCTION),
    );
  });
});

describe('VERDICT_OUTPUT_INSTRUCTION', () => {
  it('is a stable multi-line block naming both decisions and the confidence range', () => {
    expect(VERDICT_OUTPUT_INSTRUCTION).toMatch(/DECISION: justified/);
    expect(VERDICT_OUTPUT_INSTRUCTION).toMatch(/DECISION: not_justified/);
    expect(VERDICT_OUTPUT_INSTRUCTION).toMatch(/CONFIDENCE: <integer 0-100>/);
  });
});

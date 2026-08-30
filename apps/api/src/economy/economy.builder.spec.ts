import { describe, expect, it } from '@jest/globals';
import {
  PersonaRole,
  RunMode,
  RunStatus,
  Side,
  Decision,
} from '@tribunal/shared-types';
import type { Run } from '../runs/run.entity';
import type { Speech } from '../runs/speech.entity';
import type { Verdict } from '../runs/verdict.entity';
import { buildRunEconomy, toLedgerEntry } from './economy.builder';

/**
 * Per-run economy aggregation (SPEC §6). We hand the builder plain objects that
 * match the fields it reads off the entities (no TypeORM needed). Cost values
 * are given as strings to mimic Postgres `numeric` (TypeORM returns them as
 * strings) — the builder must coerce them with Number().
 */

const CREATED = new Date('2026-08-28T12:00:00.000Z');

function makeRun(overrides: Partial<Run> = {}): Run {
  return {
    id: 'run-1',
    createdAt: CREATED,
    mode: RunMode.B_per_persona,
    chargeSheetSnapshot: 'x'.repeat(42),
    verdictTally: { [Decision.justified]: 2, [Decision.not_justified]: 1 },
    costCeilingUsd: '1.500000' as unknown as number,
    status: RunStatus.completed,
    totalTokens: 700,
    totalCostUsd: '0' as unknown as number,
    ...overrides,
  } as Run;
}

function makeSpeech(
  personaKey: string,
  side: Side,
  model: string,
  tokens: { p: number; c: number; t: number; r: number | null },
  costUsd: string,
): Speech {
  return {
    personaKey,
    side,
    model,
    promptTokens: tokens.p,
    completionTokens: tokens.c,
    totalTokens: tokens.t,
    reasoningTokens: tokens.r,
    costUsd: costUsd as unknown as number,
  } as Speech;
}

function makeVerdict(
  personaKey: string,
  model: string,
  tokens: { p: number; c: number; t: number; r: number | null },
  costUsd: string,
): Verdict {
  return {
    personaKey,
    model,
    promptTokens: tokens.p,
    completionTokens: tokens.c,
    totalTokens: tokens.t,
    reasoningTokens: tokens.r,
    costUsd: costUsd as unknown as number,
  } as Verdict;
}

/** 4 advocate speeches + 3 judge verdicts across a couple of models. */
function fullRunData() {
  const speeches: Speech[] = [
    makeSpeech('adv1', Side.support, 'model-x', { p: 10, c: 20, t: 30, r: 5 }, '0'),
    makeSpeech('adv2', Side.support, 'model-x', { p: 11, c: 21, t: 32, r: null }, '0'),
    makeSpeech('adv3', Side.against, 'model-y', { p: 12, c: 22, t: 34, r: 3 }, '0'),
    makeSpeech('adv4', Side.against, 'model-y', { p: 13, c: 23, t: 36, r: null }, '0'),
  ];
  const verdicts: Verdict[] = [
    makeVerdict('judge1', 'model-x', { p: 14, c: 24, t: 38, r: 7 }, '0'),
    makeVerdict('judge2', 'model-y', { p: 15, c: 25, t: 40, r: null }, '0'),
    makeVerdict('judge3', 'model-z', { p: 16, c: 26, t: 42, r: 1 }, '0'),
  ];
  return { speeches, verdicts };
}

describe('buildRunEconomy', () => {
  it('produces exactly 7 per-persona rows (4 advocates + 3 judges)', () => {
    const { speeches, verdicts } = fullRunData();
    const econ = buildRunEconomy(makeRun(), speeches, verdicts);
    expect(econ.perPersona).toHaveLength(7);
    const advocates = econ.perPersona.filter(
      (r) => r.role === PersonaRole.advocate,
    );
    const judges = econ.perPersona.filter((r) => r.role === PersonaRole.judge);
    expect(advocates).toHaveLength(4);
    expect(judges).toHaveLength(3);
  });

  it('resolves each row personaName via nameFor (defaults to the key)', () => {
    const { speeches, verdicts } = fullRunData();
    const named = buildRunEconomy(
      makeRun(),
      speeches,
      verdicts,
      (k) => `Name(${k})`,
    );
    expect(
      named.perPersona.find((r) => r.personaKey === 'adv1')?.personaName,
    ).toBe('Name(adv1)');
    const def = buildRunEconomy(makeRun(), speeches, verdicts);
    expect(
      def.perPersona.find((r) => r.personaKey === 'judge1')?.personaName,
    ).toBe('judge1');
  });

  it('tags advocate rows with their side and judge rows with side null', () => {
    const { speeches, verdicts } = fullRunData();
    const econ = buildRunEconomy(makeRun(), speeches, verdicts);
    const adv = econ.perPersona.find((r) => r.personaKey === 'adv1');
    const judge = econ.perPersona.find((r) => r.personaKey === 'judge1');
    expect(adv?.role).toBe(PersonaRole.advocate);
    expect(adv?.side).toBe(Side.support);
    expect(judge?.role).toBe(PersonaRole.judge);
    expect(judge?.side).toBeNull();
  });

  it('coerces null reasoning tokens to 0', () => {
    const { speeches, verdicts } = fullRunData();
    const econ = buildRunEconomy(makeRun(), speeches, verdicts);
    expect(econ.perPersona.find((r) => r.personaKey === 'adv2')?.reasoningTokens).toBe(0);
    expect(econ.perPersona.find((r) => r.personaKey === 'adv1')?.reasoningTokens).toBe(5);
  });

  it('sums token totals across all 7 calls', () => {
    const { speeches, verdicts } = fullRunData();
    const econ = buildRunEconomy(makeRun(), speeches, verdicts);
    // prompt: 10+11+12+13+14+15+16 = 91
    expect(econ.totals.promptTokens).toBe(91);
    // completion: 20+21+22+23+24+25+26 = 161
    expect(econ.totals.completionTokens).toBe(161);
    // total: 30+32+34+36+38+40+42 = 252
    expect(econ.totals.totalTokens).toBe(252);
  });

  it('sums free-model cost to 0', () => {
    const { speeches, verdicts } = fullRunData();
    const econ = buildRunEconomy(makeRun(), speeches, verdicts);
    expect(econ.totals.costUsd).toBe(0);
  });

  it('rolls up per model grouped by model id with call counts', () => {
    const { speeches, verdicts } = fullRunData();
    const econ = buildRunEconomy(makeRun(), speeches, verdicts);
    const byModel = Object.fromEntries(econ.perModel.map((m) => [m.model, m]));
    // model-x: adv1, adv2, judge1 -> 3 calls; tokens 30+32+38 = 100
    expect(byModel['model-x'].calls).toBe(3);
    expect(byModel['model-x'].totalTokens).toBe(100);
    // model-y: adv3, adv4, judge2 -> 3 calls; tokens 34+36+40 = 110
    expect(byModel['model-y'].calls).toBe(3);
    expect(byModel['model-y'].totalTokens).toBe(110);
    // model-z: judge3 -> 1 call; tokens 42
    expect(byModel['model-z'].calls).toBe(1);
    expect(byModel['model-z'].totalTokens).toBe(42);
    // Total calls across the rollup equals the 7 persona calls.
    expect(econ.perModel.reduce((s, m) => s + m.calls, 0)).toBe(7);
  });

  it('carries run metadata (id, iso timestamp, mode, charge chars, ceiling, status)', () => {
    const { speeches, verdicts } = fullRunData();
    const econ = buildRunEconomy(makeRun(), speeches, verdicts);
    expect(econ.runId).toBe('run-1');
    expect(econ.createdAt).toBe('2026-08-28T12:00:00.000Z');
    expect(econ.mode).toBe(RunMode.B_per_persona);
    expect(econ.chargeSheetChars).toBe(42);
    expect(econ.costCeilingUsd).toBe(1.5);
    expect(econ.status).toBe(RunStatus.completed);
    expect(econ.verdictTally).toEqual({
      [Decision.justified]: 2,
      [Decision.not_justified]: 1,
    });
  });

  it('sums and rounds real (paid) costs to 6 decimals', () => {
    // Values chosen so a naive float sum would drift beyond 6 dp.
    const speeches: Speech[] = [
      makeSpeech('adv1', Side.support, 'm', { p: 1, c: 1, t: 2, r: 0 }, '0.1'),
      makeSpeech('adv2', Side.support, 'm', { p: 1, c: 1, t: 2, r: 0 }, '0.2'),
      makeSpeech('adv3', Side.against, 'm', { p: 1, c: 1, t: 2, r: 0 }, '0.0000005'),
      makeSpeech('adv4', Side.against, 'm', { p: 1, c: 1, t: 2, r: 0 }, '0'),
    ];
    const verdicts: Verdict[] = [
      makeVerdict('j1', 'm', { p: 1, c: 1, t: 2, r: 0 }, '0'),
      makeVerdict('j2', 'm', { p: 1, c: 1, t: 2, r: 0 }, '0'),
      makeVerdict('j3', 'm', { p: 1, c: 1, t: 2, r: 0 }, '0'),
    ];
    const econ = buildRunEconomy(makeRun(), speeches, verdicts);
    // 0.1 + 0.2 + 0.0000005 = 0.3000005 -> round6 -> 0.3 (0.0000005 rounds to 0.000001? -> 0.300001)
    expect(econ.totals.costUsd).toBeCloseTo(0.300001, 6);
    // Per-model cost is also rounded to 6 dp and finite.
    expect(econ.perModel[0].costUsd).toBeCloseTo(0.300001, 6);
    expect(Number.isFinite(econ.totals.costUsd)).toBe(true);
  });
});

describe('toLedgerEntry', () => {
  it('produces the compact ledger shape from a run', () => {
    const run = makeRun({
      totalTokens: 252,
      totalCostUsd: '0' as unknown as number,
    });
    const entry = toLedgerEntry(run);
    expect(entry).toEqual({
      runId: 'run-1',
      createdAt: '2026-08-28T12:00:00.000Z',
      mode: RunMode.B_per_persona,
      totalTokens: 252,
      costUsd: 0,
      verdictTally: { [Decision.justified]: 2, [Decision.not_justified]: 1 },
    });
  });

  it('coerces a numeric-string total cost to a number', () => {
    const entry = toLedgerEntry(
      makeRun({ totalCostUsd: '0.125000' as unknown as number }),
    );
    expect(entry.costUsd).toBe(0.125);
    expect(typeof entry.costUsd).toBe('number');
  });

  it('has NO combined/authoritative verdict field — only the tally', () => {
    const entry = toLedgerEntry(makeRun());
    expect(entry).not.toHaveProperty('finalDecision');
    expect(entry).not.toHaveProperty('decision');
    expect(entry).not.toHaveProperty('winner');
  });
});

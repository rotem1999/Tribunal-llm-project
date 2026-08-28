import {
  PersonaRole,
  type LedgerEntry,
  type ModelEconomy,
  type PersonaEconomy,
  type RunEconomy,
} from '@tribunal/shared-types';
import type { Run } from '../runs/run.entity';
import type { Speech } from '../runs/speech.entity';
import type { Verdict } from '../runs/verdict.entity';

/** Build the per-run economy object (SPEC §6a) from a run + its speeches/verdicts. */
export function buildRunEconomy(
  run: Run,
  speeches: Speech[],
  verdicts: Verdict[],
): RunEconomy {
  const perPersona: PersonaEconomy[] = [
    ...speeches.map((s) => ({
      personaKey: s.personaKey,
      role: PersonaRole.advocate,
      side: s.side,
      model: s.model,
      promptTokens: s.promptTokens,
      completionTokens: s.completionTokens,
      totalTokens: s.totalTokens,
      reasoningTokens: s.reasoningTokens ?? 0,
      costUsd: Number(s.costUsd),
    })),
    ...verdicts.map((v) => ({
      personaKey: v.personaKey,
      role: PersonaRole.judge,
      side: null,
      model: v.model,
      promptTokens: v.promptTokens,
      completionTokens: v.completionTokens,
      totalTokens: v.totalTokens,
      reasoningTokens: v.reasoningTokens ?? 0,
      costUsd: Number(v.costUsd),
    })),
  ];

  const perModel = rollupByModel(perPersona);
  const totals = {
    promptTokens: sum(perPersona, 'promptTokens'),
    completionTokens: sum(perPersona, 'completionTokens'),
    totalTokens: sum(perPersona, 'totalTokens'),
    costUsd: round6(perPersona.reduce((s, p) => s + p.costUsd, 0)),
  };

  return {
    runId: run.id,
    createdAt: run.createdAt.toISOString(),
    mode: run.mode,
    chargeSheetChars: run.chargeSheetSnapshot.length,
    verdictTally: run.verdictTally,
    perPersona,
    perModel,
    totals,
    costCeilingUsd: Number(run.costCeilingUsd),
    status: run.status,
  };
}

/** Compact ledger line derived from a completed/aborted run (SPEC §6b). */
export function toLedgerEntry(run: Run): LedgerEntry {
  return {
    runId: run.id,
    createdAt: run.createdAt.toISOString(),
    mode: run.mode,
    totalTokens: run.totalTokens,
    costUsd: Number(run.totalCostUsd),
    verdictTally: run.verdictTally,
  };
}

function rollupByModel(rows: PersonaEconomy[]): ModelEconomy[] {
  const map = new Map<string, ModelEconomy>();
  for (const r of rows) {
    const m = map.get(r.model) ?? {
      model: r.model,
      calls: 0,
      totalTokens: 0,
      costUsd: 0,
    };
    m.calls += 1;
    m.totalTokens += r.totalTokens;
    m.costUsd = round6(m.costUsd + r.costUsd);
    map.set(r.model, m);
  }
  return [...map.values()];
}

function sum<T>(rows: T[], key: keyof T): number {
  return rows.reduce((s, r) => s + Number(r[key] ?? 0), 0);
}

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

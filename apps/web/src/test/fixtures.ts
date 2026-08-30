import {
  Decision,
  PersonaRole,
  RunMode,
  RunStatus,
  Side,
  type ChargeSheet,
  type FreeModel,
  type RunDetail,
  type PersonaInfo,
  type RunEconomy,
  type RunProgress,
  type RunSummary,
  type Speech,
  type Verdict,
} from '@tribunal/shared-types';

/** Test data builders. Each takes a partial override so a test can pin only the
 * fields it asserts on. */

export function makeSpeech(overrides: Partial<Speech> = {}): Speech {
  return {
    id: 'sp-1',
    runId: 'run-1',
    personaKey: 'advocate_support',
    personaName: 'Jon Snow',
    side: Side.support,
    model: 'meta-llama/llama-3-8b:free',
    content: 'The accused acted reasonably.',
    promptTokens: 100,
    completionTokens: 50,
    totalTokens: 150,
    reasoningTokens: null,
    costUsd: 0,
    latencyMs: 1200,
    createdAt: '2026-08-28T10:00:00.000Z',
    ...overrides,
  };
}

export function makeVerdict(overrides: Partial<Verdict> = {}): Verdict {
  return {
    id: 'vd-1',
    runId: 'run-1',
    personaKey: 'judge_one',
    personaName: 'Presiding Justice',
    model: 'meta-llama/llama-3-8b:free',
    decision: Decision.justified,
    confidence: 72,
    reasoning: 'On balance the conduct was justified because ...',
    promptTokens: 200,
    completionTokens: 80,
    totalTokens: 280,
    reasoningTokens: null,
    costUsd: 0,
    latencyMs: 1500,
    createdAt: '2026-08-28T10:00:05.000Z',
    ...overrides,
  };
}

export function makeEconomy(overrides: Partial<RunEconomy> = {}): RunEconomy {
  return {
    runId: 'run-1',
    createdAt: '2026-08-28T10:00:00.000Z',
    mode: RunMode.A_single,
    chargeSheetChars: 420,
    verdictTally: { justified: 2, not_justified: 1 },
    perPersona: [
      {
        personaKey: 'advocate_support',
        personaName: 'Jon Snow',
        role: PersonaRole.advocate,
        side: Side.support,
        model: 'meta-llama/llama-3-8b:free',
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        reasoningTokens: 0,
        costUsd: 0,
      },
      {
        personaKey: 'judge_one',
        personaName: 'Presiding Justice',
        role: PersonaRole.judge,
        side: null,
        model: 'anthropic/claude-3-haiku',
        promptTokens: 200,
        completionTokens: 80,
        totalTokens: 280,
        reasoningTokens: 0,
        costUsd: 0.001234,
      },
    ],
    perModel: [
      {
        model: 'meta-llama/llama-3-8b:free',
        calls: 4,
        totalTokens: 600,
        costUsd: 0,
      },
      {
        model: 'anthropic/claude-3-haiku',
        calls: 3,
        totalTokens: 840,
        costUsd: 0.003702,
      },
    ],
    totals: {
      promptTokens: 900,
      completionTokens: 540,
      totalTokens: 1440,
      costUsd: 0.003702,
    },
    costCeilingUsd: 0.5,
    status: 'completed',
    ...overrides,
  };
}

export function makeRunDetail(overrides: Partial<RunDetail> = {}): RunDetail {
  return {
    id: 'run-1',
    mode: RunMode.A_single,
    status: RunStatus.completed,
    modelSingle: 'meta-llama/llama-3-8b:free',
    chargeSheetSnapshot: 'The accused did the thing.',
    chargeSheetTitle: 'People v. Accused',
    speeches: [
      makeSpeech({
        id: 'sp-1',
        personaKey: 'advocate_support',
        personaName: 'Jon Snow',
        side: Side.support,
        content: 'Defense argues justification.',
      }),
      makeSpeech({
        id: 'sp-2',
        personaKey: 'advocate_against',
        personaName: 'Grey Worm',
        side: Side.against,
        content: 'Prosecution argues fault.',
      }),
    ],
    verdicts: [
      makeVerdict({
        id: 'vd-1',
        personaKey: 'judge_one',
        personaName: 'Presiding Justice',
        decision: Decision.justified,
      }),
      makeVerdict({
        id: 'vd-2',
        personaKey: 'judge_two',
        personaName: 'Justice Elon',
        decision: Decision.justified,
      }),
      makeVerdict({
        id: 'vd-3',
        personaKey: 'judge_three',
        personaName: 'Justice Shamgar',
        decision: Decision.not_justified,
      }),
    ],
    economy: makeEconomy(),
    verdictTally: { justified: 2, not_justified: 1 },
    totalPromptTokens: 900,
    totalCompletionTokens: 540,
    totalTokens: 1440,
    totalCostUsd: 0.003702,
    costCeilingUsd: 0.5,
    createdAt: '2026-08-28T10:00:00.000Z',
    completedAt: '2026-08-28T10:01:00.000Z',
    error: null,
    ...overrides,
  };
}

export function makeRunSummary(overrides: Partial<RunSummary> = {}): RunSummary {
  return {
    id: 'run-1',
    createdAt: '2026-08-28T10:00:00.000Z',
    mode: RunMode.A_single,
    status: RunStatus.completed,
    verdictTally: { justified: 2, not_justified: 1 },
    totalCostUsd: 0,
    ...overrides,
  };
}

export function makeChargeSheet(overrides: Partial<ChargeSheet> = {}): ChargeSheet {
  return {
    id: 'cs-1',
    title: 'People v. Accused',
    content: 'The accused did the thing on the date in question.',
    isActive: true,
    createdAt: '2026-08-20T10:00:00.000Z',
    updatedAt: '2026-08-25T10:00:00.000Z',
    ...overrides,
  };
}

export function makeFreeModels(): FreeModel[] {
  return [
    { id: 'meta-llama/llama-3-8b:free', contextLength: 8192 },
    { id: 'mistralai/mistral-7b:free', contextLength: 32768 },
  ];
}

export function makeProgress(overrides: Partial<RunProgress> = {}): RunProgress {
  return {
    status: RunStatus.completed,
    phase: 'done',
    completedPersonaKeys: [
      'support_1',
      'support_2',
      'against_1',
      'against_2',
      'judge_1',
      'judge_2',
      'judge_3',
    ],
    error: null,
    ...overrides,
  };
}

export function makePersonas(): PersonaInfo[] {
  return [
    { key: 'support_1', name: 'Jon Snow', role: PersonaRole.advocate, side: Side.support },
    { key: 'support_2', name: 'Tyrion Lannister', role: PersonaRole.advocate, side: Side.support },
    { key: 'against_1', name: 'Daenerys Targaryen', role: PersonaRole.advocate, side: Side.against },
    { key: 'against_2', name: 'Grey Worm', role: PersonaRole.advocate, side: Side.against },
    { key: 'judge_1', name: 'Presiding Justice', role: PersonaRole.judge, side: null },
    { key: 'judge_2', name: 'Justice Elon', role: PersonaRole.judge, side: null },
    { key: 'judge_3', name: 'Justice Shamgar', role: PersonaRole.judge, side: null },
  ];
}

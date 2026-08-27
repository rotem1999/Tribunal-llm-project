import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  CreateRunRequest,
  CreateRunResponse,
  RunDetail,
  RunSummary,
  Speech as SpeechDto,
  Verdict as VerdictDto,
} from '@tribunal/shared-types';
import { EconomyService } from '../economy/economy.service';
import { TribunalService } from '../tribunal/tribunal.service';
import { Run } from './run.entity';
import { Speech } from './speech.entity';
import { Verdict } from './verdict.entity';

/** Run endpoints backing (SPEC §10). Execution is delegated to TribunalService. */
@Injectable()
export class RunsService {
  constructor(
    private readonly tribunal: TribunalService,
    private readonly economy: EconomyService,
    @InjectRepository(Run) private readonly runs: Repository<Run>,
    @InjectRepository(Speech) private readonly speeches: Repository<Speech>,
    @InjectRepository(Verdict) private readonly verdicts: Repository<Verdict>,
  ) {}

  /** Execute a run synchronously (SPEC §10.1) and return its id. */
  async create(
    userId: string,
    dto: CreateRunRequest,
  ): Promise<CreateRunResponse> {
    const run = await this.tribunal.runTribunal(userId, dto);
    return { runId: run.id };
  }

  async list(limit = 20, offset = 0): Promise<RunSummary[]> {
    const runs = await this.runs.find({
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return runs.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      mode: r.mode,
      status: r.status,
      verdictTally: r.verdictTally,
      totalCostUsd: Number(r.totalCostUsd),
    }));
  }

  async getDetail(id: string): Promise<RunDetail> {
    const run = await this.runs.findOne({ where: { id } });
    if (!run) throw new NotFoundException(`Run ${id} not found.`);
    const [speeches, verdicts, economy] = await Promise.all([
      this.speeches.find({ where: { runId: id }, order: { createdAt: 'ASC' } }),
      this.verdicts.find({ where: { runId: id }, order: { createdAt: 'ASC' } }),
      this.economy.buildForRun(id),
    ]);
    return {
      id: run.id,
      mode: run.mode,
      status: run.status,
      modelSingle: run.modelSingle,
      chargeSheetSnapshot: run.chargeSheetSnapshot,
      speeches: speeches.map(toSpeechDto),
      verdicts: verdicts.map(toVerdictDto),
      economy,
      verdictTally: run.verdictTally,
      totalPromptTokens: run.totalPromptTokens,
      totalCompletionTokens: run.totalCompletionTokens,
      totalTokens: run.totalTokens,
      totalCostUsd: Number(run.totalCostUsd),
      costCeilingUsd: Number(run.costCeilingUsd),
      createdAt: run.createdAt.toISOString(),
      completedAt: run.completedAt ? run.completedAt.toISOString() : null,
      error: run.error,
    };
  }
}

function toSpeechDto(s: Speech): SpeechDto {
  return {
    id: s.id,
    runId: s.runId,
    personaKey: s.personaKey,
    side: s.side,
    model: s.model,
    content: s.content,
    promptTokens: s.promptTokens,
    completionTokens: s.completionTokens,
    totalTokens: s.totalTokens,
    reasoningTokens: s.reasoningTokens,
    costUsd: Number(s.costUsd),
    latencyMs: s.latencyMs,
    createdAt: s.createdAt.toISOString(),
  };
}

function toVerdictDto(v: Verdict): VerdictDto {
  return {
    id: v.id,
    runId: v.runId,
    personaKey: v.personaKey,
    model: v.model,
    decision: v.decision,
    confidence: v.confidence,
    reasoning: v.reasoning,
    promptTokens: v.promptTokens,
    completionTokens: v.completionTokens,
    totalTokens: v.totalTokens,
    reasoningTokens: v.reasoningTokens,
    costUsd: Number(v.costUsd),
    latencyMs: v.latencyMs,
    createdAt: v.createdAt.toISOString(),
  };
}

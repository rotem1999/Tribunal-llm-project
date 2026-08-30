import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  type CreateRunRequest,
  RunMode,
  RunStatus,
} from '@tribunal/shared-types';
import { ChargeSheetsService } from '../chargesheets/chargesheets.service';
import { EconomyService } from '../economy/economy.service';
import { OpenRouterClient } from '../openrouter/openrouter.client';
import { ModelUnavailableError } from '../openrouter/openrouter.errors';
import type {
  CallModelParams,
  CallModelResult,
} from '../openrouter/openrouter.types';
import { ModelsService } from '../openrouter/models.service';
import { PersonasService } from '../personas/personas.service';
import { Run } from '../runs/run.entity';
import { Speech } from '../runs/speech.entity';
import { Verdict } from '../runs/verdict.entity';
import { isOverBudget } from './budget-guard';
import {
  buildAdvocatePrompt,
  buildJudgePrompt,
  type SpeechView,
} from './prompt-builder';
import { counterbalancedOrder } from './speech-order';
import {
  fallbackVerdict,
  isNeedsReask,
  parseVerdict,
} from './verdict-parser';
import { computeTally } from './verdict-tally';

/**
 * The run pipeline (SPEC §5.5): snapshot the charge, resolve models, run the 4
 * advocates then the 3 judges (counterbalanced), enforce the budget ceiling, and
 * finalize. Produces 3 independent verdicts + a non-binding tally — never a
 * combined verdict. Exposed as a service method so the controller stays thin (§10.1).
 */
@Injectable()
export class TribunalService {
  private readonly logger = new Logger(TribunalService.name);

  constructor(
    private readonly personas: PersonasService,
    private readonly models: ModelsService,
    private readonly openrouter: OpenRouterClient,
    private readonly chargeSheets: ChargeSheetsService,
    @InjectRepository(Run) private readonly runs: Repository<Run>,
    @InjectRepository(Speech) private readonly speeches: Repository<Speech>,
    @InjectRepository(Verdict) private readonly verdicts: Repository<Verdict>,
    private readonly config: ConfigService,
    private readonly economy: EconomyService,
  ) {}

  /** Max times a single persona call will swap to another free model. */
  private static readonly MAX_MODEL_SWAPS = 4;

  /**
   * Call a persona's model, transparently swapping to another free model when
   * the chosen one is restricted/unavailable (OpenRouter 403 — e.g. free models
   * gated to approved apps; SPEC §5.2). Returns the model actually used so
   * persistence records the truth. `used` tracks models already placed this run
   * so Mode B keeps its per-persona models distinct where possible.
   */
  private async callPersona(
    params: Omit<CallModelParams, 'model'>,
    startModel: string,
    used: Set<string>,
  ): Promise<{ res: CallModelResult; model: string }> {
    let model = startModel;
    const tried = new Set<string>();
    for (let attempt = 0; ; attempt++) {
      tried.add(model);
      try {
        const res = await this.openrouter.callModel({ ...params, model });
        used.add(model);
        return { res, model };
      } catch (err) {
        if (
          !(err instanceof ModelUnavailableError) ||
          attempt >= TribunalService.MAX_MODEL_SWAPS
        ) {
          throw err;
        }
        this.models.markUnavailable(model);
        const next = await this.models.pickReplacement(
          new Set([...used, ...tried]),
        );
        if (!next) throw err;
        this.logger.warn(
          `Model "${model}" is restricted/unavailable — retrying persona with "${next}".`,
        );
        model = next;
      }
    }
  }

  async runTribunal(userId: string, req: CreateRunRequest): Promise<Run> {
    const sheet = req.chargeSheetId
      ? await this.chargeSheets.getById(req.chargeSheetId)
      : await this.chargeSheets.getActive();

    const ceiling = Number(this.config.get<string>('RUN_COST_CEILING_USD', '5'));
    const maxTokens = Number(this.config.get<string>('MODEL_MAX_TOKENS', '1024'));
    const advTemp = Number(this.config.get<string>('ADVOCATE_TEMPERATURE', '0.9'));
    const judgeTemp = Number(this.config.get<string>('JUDGE_TEMPERATURE', '0.2'));

    // Resolve models for the chosen mode (SPEC §5.2).
    const personaKeys = this.personas.getPersonaKeys();
    let modelSingle: string | null = null;
    let assignment: Record<string, string> = {};
    if (req.mode === RunMode.A_single) {
      modelSingle = await this.models.resolveModeAModel(req.modelSingle);
    } else {
      assignment = await this.models.assignModeBModels(personaKeys);
    }
    const modelFor = (key: string): string =>
      req.mode === RunMode.A_single ? (modelSingle as string) : assignment[key];

    let run = await this.runs.save(
      this.runs.create({
        userId,
        chargeSheetId: sheet.id,
        chargeSheetSnapshot: sheet.content,
        mode: req.mode,
        status: RunStatus.running,
        modelSingle,
        costCeilingUsd: ceiling,
      }),
    );

    let totalCost = 0;
    let runError: string | null = null;

    // Models actually used this run (after any restricted-model swaps), so
    // Mode B stays distinct where possible and persistence records the truth.
    const usedModels = new Set<string>();

    // --- Advocate phase (4 in parallel) ---
    const advocates = this.personas.getAdvocates();
    const speeches = await Promise.all(
      advocates.map(async (adv) => {
        const { system, user } = buildAdvocatePrompt(adv, sheet.content);
        const { res, model } = await this.callPersona(
          { systemPrompt: system, userPrompt: user, temperature: advTemp, maxTokens },
          modelFor(adv.key),
          usedModels,
        );
        return this.speeches.save(
          this.speeches.create({
            runId: run.id,
            personaKey: adv.key,
            side: adv.side,
            model,
            systemPrompt: system,
            content: res.content,
            ...usageColumns(res),
          }),
        );
      }),
    );
    // Mode A: if the auto/pinned model was swapped out, adopt the model that
    // actually worked so the judges use it and the Run records it.
    if (req.mode === RunMode.A_single && speeches.length > 0) {
      modelSingle = speeches[0].model;
      run.modelSingle = modelSingle;
    }
    totalCost += speeches.reduce((s, sp) => s + Number(sp.costUsd), 0);
    if (isOverBudget(totalCost, ceiling)) {
      return this.abortOverBudget(run, totalCost, speeches, []);
    }

    // --- Judge phase (3 in parallel, counterbalanced) ---
    const speechViews: (SpeechView & { personaKey: string })[] = speeches.map(
      (s) => ({ side: s.side, content: s.content, personaKey: s.personaKey }),
    );
    const speechOrderByJudge: Record<string, string[]> = {};
    const judges = this.personas.getJudges();
    const verdicts = await Promise.all(
      judges.map(async (judge, i) => {
        const ordered = counterbalancedOrder(speechViews, i);
        const shownOrder = ordered.map((o) => o.personaKey);
        speechOrderByJudge[judge.key] = shownOrder;
        const { system, user } = buildJudgePrompt(judge, sheet.content, ordered);

        const { res, model } = await this.callPersona(
          { systemPrompt: system, userPrompt: user, temperature: judgeTemp, maxTokens },
          modelFor(judge.key),
          usedModels,
        );
        let raw = res.content;
        let usage = res.usage;
        let parsed = parseVerdict(res.content);

        // One re-ask if the strict block is missing (SPEC §5.6).
        if (isNeedsReask(parsed)) {
          const reask = await this.openrouter.callModel({
            model,
            systemPrompt: system,
            userPrompt: `${user}\n\nReply with ONLY the two lines:\nDECISION: justified|not_justified\nCONFIDENCE: <0-100>`,
            temperature: judgeTemp,
            maxTokens,
          });
          raw = `${res.content}\n---REASK---\n${reask.content}`;
          usage = mergeUsage(res.usage, reask.usage);
          const p2 = parseVerdict(reask.content);
          if (isNeedsReask(p2)) {
            parsed = fallbackVerdict(raw);
            runError = `verdict parse fell back for ${judge.key}`;
          } else {
            parsed = p2;
          }
        }

        return this.verdicts.save(
          this.verdicts.create({
            runId: run.id,
            personaKey: judge.key,
            model,
            systemPrompt: system,
            decision: parsed.decision,
            confidence: parsed.confidence,
            reasoning: parsed.reasoning,
            rawResponse: raw,
            speechOrderShown: shownOrder,
            ...usageColumns({ ...res, usage }),
          }),
        );
      }),
    );
    totalCost += verdicts.reduce((s, v) => s + Number(v.costUsd), 0);
    if (isOverBudget(totalCost, ceiling)) {
      return this.abortOverBudget(run, totalCost, speeches, verdicts, {
        speechOrderByJudge,
      });
    }

    // --- Finalize: tally + totals (no combined verdict) ---
    const all = [...speeches, ...verdicts];
    run.status = RunStatus.completed;
    run.completedAt = new Date();
    run.verdictTally = computeTally(verdicts.map((v) => v.decision));
    run.speechOrderByJudge = speechOrderByJudge;
    run.totalPromptTokens = sum(all, 'promptTokens');
    run.totalCompletionTokens = sum(all, 'completionTokens');
    run.totalTokens = sum(all, 'totalTokens');
    run.totalCostUsd = totalCost;
    run.error = runError;
    run = await this.runs.save(run);
    await this.economy.writeRun(run, speeches, verdicts);
    this.logger.log(
      `Run ${run.id} completed (${run.mode}) — tally ${JSON.stringify(run.verdictTally)}.`,
    );
    return run;
  }

  private async abortOverBudget(
    run: Run,
    totalCost: number,
    speeches: Speech[],
    verdicts: Verdict[],
    extra: Partial<Run> = {},
  ): Promise<Run> {
    run.status = RunStatus.aborted_over_budget;
    run.totalCostUsd = totalCost;
    run.completedAt = new Date();
    Object.assign(run, extra);
    const saved = await this.runs.save(run);
    // Persist partial economy on abort too (SPEC §5.5 step 3).
    await this.economy.writeRun(saved, speeches, verdicts);
    return saved;
  }
}

/** Map an OpenRouter result onto the token/cost/latency columns. */
function usageColumns(res: CallModelResult) {
  return {
    promptTokens: res.usage.promptTokens,
    completionTokens: res.usage.completionTokens,
    totalTokens: res.usage.totalTokens,
    reasoningTokens: res.usage.reasoningTokens,
    costUsd: res.usage.costUsd,
    latencyMs: res.latencyMs,
  };
}

function mergeUsage(
  a: CallModelResult['usage'],
  b: CallModelResult['usage'],
): CallModelResult['usage'] {
  return {
    promptTokens: a.promptTokens + b.promptTokens,
    completionTokens: a.completionTokens + b.completionTokens,
    totalTokens: a.totalTokens + b.totalTokens,
    reasoningTokens:
      a.reasoningTokens === null && b.reasoningTokens === null
        ? null
        : (a.reasoningTokens ?? 0) + (b.reasoningTokens ?? 0),
    costUsd: a.costUsd + b.costUsd,
  };
}

function sum<T>(rows: T[], key: keyof T): number {
  return rows.reduce((s, r) => s + Number(r[key] ?? 0), 0);
}

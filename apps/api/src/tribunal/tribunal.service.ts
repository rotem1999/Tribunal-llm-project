import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  type CreateRunRequest,
  ErrorCode,
  RunMode,
  RunStatus,
} from '@tribunal/shared-types';
import { ChargeSheetsService } from '../chargesheets/chargesheets.service';
import { classifyError, messageFor } from '../common/classify-error';
import { EconomyService } from '../economy/economy.service';
import { LoggingService } from '../logging/logging.service';
import { OpenRouterClient } from '../openrouter/openrouter.client';
import {
  ModelTimeoutError,
  ModelUnavailableError,
} from '../openrouter/openrouter.errors';
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
import { sanitizeSpeech } from './speech-sanitizer';
import { counterbalancedOrder } from './speech-order';
import {
  fallbackVerdict,
  isNeedsReask,
  parseVerdict,
} from './verdict-parser';
import { computeTally } from './verdict-tally';

/**
 * The run pipeline (SPEC §5.5). Execution is asynchronous (SPEC §10.1):
 * `createRun` persists the `Run` (status `running`) and returns immediately;
 * `executeRun` runs the 4 advocates then the 3 judges (counterbalanced) in the
 * background, enforces the budget ceiling, and finalizes — persisting a `failed`
 * status + error on any throw so the frontend sees it while polling. Produces 3
 * independent verdicts + a non-binding tally — never a combined verdict.
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
    private readonly logging: LoggingService,
  ) {}

  /** Max times a single persona call will swap to another free model. */
  private static readonly MAX_MODEL_SWAPS = 4;

  /**
   * Call a persona's model, transparently swapping to another free model when
   * the chosen one is unusable: an OpenRouter 403 (gated to approved apps), a
   * provider-side rejection (§5.4), a per-call timeout ({@link ModelTimeoutError}
   * — several free endpoints hang), or an HTTP 200 with empty text (classifiers
   * / reasoning models that spend the whole budget on hidden tokens). Returns
   * the model actually used so persistence records the truth. `used` tracks
   * models already placed this run so Mode B keeps its per-persona models
   * distinct where possible.
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
        if (res.content.trim().length === 0) {
          // 200 OK but nothing usable — treat like an unavailable model and swap
          // rather than persisting an empty speech/verdict.
          throw new ModelUnavailableError(
            model,
            `The model "${model}" returned an empty response.`,
          );
        }
        used.add(model);
        return { res, model };
      } catch (err) {
        const swappable =
          err instanceof ModelUnavailableError || err instanceof ModelTimeoutError;
        if (!swappable || attempt >= TribunalService.MAX_MODEL_SWAPS) {
          throw err;
        }
        this.models.markUnavailable(model);
        // Prefer a model not yet placed this run (keeps Mode B distinct); if the
        // roster is exhausted, fall back to reusing a working model — excluding
        // only ones this persona already tried and failed (SPEC §5.2 round-robin).
        const next =
          (await this.models.pickReplacement(new Set([...used, ...tried]))) ??
          (await this.models.pickReplacement(tried));
        if (!next) throw err;
        // Reserve the replacement immediately so other personas running in
        // parallel (Mode B) don't all swap onto the same model (SPEC §5.2).
        used.add(next);
        this.logger.warn(
          `Model "${model}" is unusable (${(err as Error).name}) — retrying persona with "${next}".`,
        );
        this.logging.logSwap({
          runId: params.runId ?? 'unknown',
          personaKey: params.personaKey ?? 'unknown',
          fromModel: model,
          toModel: next,
          reason: (err as Error).name,
        });
        model = next;
      }
    }
  }

  /**
   * Create the `Run` row (status `running`) and return it immediately (SPEC
   * §10.1). Model resolution is deferred to `executeRun` so its errors (e.g. the
   * §5.3 data-policy 404) are recorded on the run, not thrown from `POST /runs`.
   */
  async createRun(userId: string, req: CreateRunRequest): Promise<Run> {
    const sheet = req.chargeSheetId
      ? await this.chargeSheets.getById(req.chargeSheetId)
      : await this.chargeSheets.getActive();
    const ceiling = Number(this.config.get<string>('RUN_COST_CEILING_USD', '5'));
    return this.runs.save(
      this.runs.create({
        userId,
        chargeSheetId: sheet.id,
        chargeSheetSnapshot: sheet.content,
        mode: req.mode,
        status: RunStatus.running,
        modelSingle: null,
        costCeilingUsd: ceiling,
      }),
    );
  }

  /**
   * Run the pipeline in the background against an already-created run (SPEC
   * §5.5). Uses the immutable snapshot on the run. On any throw, persists status
   * `failed` + the message and returns — it never rejects.
   */
  async executeRun(run: Run, req: CreateRunRequest): Promise<Run> {
    let speeches: Speech[] = [];
    let verdicts: Verdict[] = [];
    this.logging.logRunLifecycle({ runId: run.id, status: 'running', mode: run.mode });
    try {
      const ceiling = Number(run.costCeilingUsd);
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
        assignment = await this.models.assignModeBModels(
          personaKeys,
          req.modelByPersona,
        );
      }
      const modelFor = (key: string): string =>
        req.mode === RunMode.A_single ? (modelSingle as string) : assignment[key];

      // Set if any judge's verdict had to fall back (§5.6): a completed run that
      // carries the VERDICT_UNREADABLE flag (SPEC §12.1), not a failure.
      let verdictFellBack = false;

      // Models actually used this run (after any restricted-model swaps), so
      // Mode B stays distinct where possible and persistence records the truth.
      // Seed it with every model resolved for this mode so that a persona whose
      // model is rejected *fast* (e.g. an instant 403) does not swap onto a
      // model another persona is already mid-call with — the collision that
      // otherwise collapses Mode B onto a single model (SPEC §5.2).
      const usedModels = new Set<string>(
        req.mode === RunMode.A_single
          ? modelSingle
            ? [modelSingle]
            : []
          : Object.values(assignment),
      );

      // --- Advocate phase (4 in parallel) ---
      const advocates = this.personas.getAdvocates();
      speeches = await Promise.all(
        advocates.map(async (adv) => {
          const { system, user } = buildAdvocatePrompt(adv, run.chargeSheetSnapshot);
          const { res, model } = await this.callPersona(
            {
              systemPrompt: system,
              userPrompt: user,
              temperature: advTemp,
              maxTokens,
              runId: run.id,
              personaKey: adv.key,
            },
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
              content: sanitizeSpeech(res.content),
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
      let totalCost = speeches.reduce((s, sp) => s + Number(sp.costUsd), 0);
      if (isOverBudget(totalCost, ceiling)) {
        return this.abortOverBudget(run, totalCost, speeches, []);
      }

      // --- Judge phase (3 in parallel, counterbalanced) ---
      const speechViews: (SpeechView & { personaKey: string })[] = speeches.map(
        (s) => ({ side: s.side, content: s.content, personaKey: s.personaKey }),
      );
      const speechOrderByJudge: Record<string, string[]> = {};
      const judges = this.personas.getJudges();
      verdicts = await Promise.all(
        judges.map(async (judge, i) => {
          const ordered = counterbalancedOrder(speechViews, i);
          const shownOrder = ordered.map((o) => o.personaKey);
          speechOrderByJudge[judge.key] = shownOrder;
          const { system, user } = buildJudgePrompt(judge, run.chargeSheetSnapshot, ordered);

          const { res, model } = await this.callPersona(
            {
              systemPrompt: system,
              userPrompt: user,
              temperature: judgeTemp,
              maxTokens,
              runId: run.id,
              personaKey: judge.key,
              // Capture the judge's reasoning for display (SPEC §5.4).
              captureReasoning: true,
            },
            modelFor(judge.key),
            usedModels,
          );
          let raw = res.content;
          let usage = res.usage;
          // finish_reason of the answer we ultimately parse (re-ask if any).
          let finishReason = res.finishReason;
          // The model's own thinking, for display (SPEC §5.4); null when absent.
          let modelReasoning = res.reasoning;
          let fellBack = false;
          let parsed = parseVerdict(res.content);

          // One re-ask if the strict block is missing (SPEC §5.6).
          if (isNeedsReask(parsed)) {
            const reask = await this.openrouter.callModel({
              model,
              systemPrompt: system,
              userPrompt: `${user}\n\nReply with ONLY these three lines:\nOPINION: <1-3 sentences>\nCONFIDENCE: <integer 0-100>\nDECISION: justified|not_justified`,
              temperature: judgeTemp,
              maxTokens,
              runId: run.id,
              personaKey: judge.key,
              captureReasoning: true,
            });
            raw = `${res.content}\n---REASK---\n${reask.content}`;
            usage = mergeUsage(res.usage, reask.usage);
            finishReason = reask.finishReason;
            modelReasoning = reask.reasoning ?? modelReasoning;
            const p2 = parseVerdict(reask.content);
            if (isNeedsReask(p2)) {
              parsed = fallbackVerdict(raw);
              fellBack = true;
              verdictFellBack = true;
            } else {
              parsed = p2;
            }
          }

          // The opinion is unreadable when the reply was cut off at max_tokens
          // (`length`), the fallback was used, or nothing parsed out (SPEC §5.6).
          const truncated =
            fellBack ||
            finishReason === 'length' ||
            parsed.reasoning.trim().length === 0;

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
              truncated,
              modelReasoning: modelReasoning?.trim() || null,
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
      // A completed run may still carry the non-fatal VERDICT_UNREADABLE flag (§12.1).
      run.errorCode = verdictFellBack ? ErrorCode.VERDICT_UNREADABLE : null;
      run.error = verdictFellBack ? messageFor(ErrorCode.VERDICT_UNREADABLE) : null;
      const saved = await this.runs.save(run);
      await this.economy.writeRun(saved, speeches, verdicts);
      this.logger.log(
        `Run ${run.id} completed (${run.mode}) — tally ${JSON.stringify(saved.verdictTally)}.`,
      );
      this.logging.logRunLifecycle({
        runId: run.id,
        status: 'completed',
        mode: run.mode,
        message: `run completed (${run.mode}) — tally ${JSON.stringify(saved.verdictTally)}`,
      });
      return saved;
    } catch (err) {
      // Console + §5.7 log keep the RAW cause; the persisted run stores only a
      // user-safe message + stable code (SPEC §12.1).
      const raw = (err as Error)?.message ?? 'Run failed.';
      this.logger.error(`Run ${run.id} failed: ${raw}`);
      this.logging.logRunLifecycle({
        runId: run.id,
        status: 'failed',
        mode: run.mode,
        error: err,
      });
      const { code, message } = classifyError(err);
      run.status = RunStatus.failed;
      run.error = message;
      run.errorCode = code;
      run.completedAt = new Date();
      const saved = await this.runs.save(run);
      // Persist partial economy so token/cost spent so far is still recorded.
      try {
        await this.economy.writeRun(saved, speeches, verdicts);
      } catch {
        // best-effort; the failed status is already persisted.
      }
      return saved;
    }
  }

  /**
   * Create + execute in one call (synchronous convenience for tests and any
   * caller that wants the completed run). The async controller path uses
   * `createRun` + `executeRun` directly.
   */
  async runTribunal(userId: string, req: CreateRunRequest): Promise<Run> {
    const run = await this.createRun(userId, req);
    return this.executeRun(run, req);
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
    this.logging.logRunLifecycle({
      runId: run.id,
      status: 'aborted_over_budget',
      mode: run.mode,
      message: `run aborted_over_budget at $${totalCost}`,
    });
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

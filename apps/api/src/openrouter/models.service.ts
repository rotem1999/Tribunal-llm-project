import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FreeModel, ModelInfo } from '@tribunal/shared-types';
import {
  DataPolicyError,
  ModelUnavailableError,
  OpenRouterError,
} from './openrouter.errors';

interface RawModel {
  id: string;
  context_length?: number;
  pricing?: { prompt?: string; completion?: string };
  architecture?: {
    input_modalities?: string[];
    output_modalities?: string[];
  };
  supported_parameters?: string[];
}

const CACHE_TTL_MS = 10 * 60 * 1000; // ~10 min (SPEC §5.2)

/**
 * Substring tokens (case-insensitive) that mark a model as unfit to be a
 * Tribunal advocate or judge, whatever its price. These are the *wrong task
 * type* — classifiers, safety/moderation graders, embedders, rerankers, and
 * audio/music/speech models — which either return an HTTP 200 with
 * empty/degenerate text or bill $0 per token while charging per second of audio
 * (so they slip past a price filter). Blacklists a *category* by name token, not
 * a specific model id, so it survives the roster drifting month to month (SPEC
 * §5.2). Extend at runtime with the comma-separated `MODEL_BLACKLIST` env var.
 */
const DEFAULT_BLACKLIST = [
  'content-safety',
  'moderation',
  'guard', // llama-guard / shield-style safety classifiers
  'embed',
  'rerank',
  'lyria', // Google music-generation models (bill per second of audio)
  'whisper',
  'tts',
  'stt',
];

/**
 * Resolves OpenRouter's model roster at runtime and assigns models per run mode
 * (SPEC §5.2). Keeps usable text models **free and paid**, each with pricing +
 * an `isFree` flag; free stays the UI default (§11) and "Auto" resolves to the
 * top free model. Never hardcodes model ids — the roster changes monthly.
 */
@Injectable()
export class ModelsService {
  private cache?: { at: number; models: ModelInfo[] };
  /**
   * Models that returned a 403 (restricted / not callable by this account, e.g.
   * free models gated to approved apps). Learned at call time and excluded from
   * every subsequent resolution so a bad pick is not chosen again this session.
   */
  private readonly unavailable = new Set<string>();

  constructor(private readonly config: ConfigService) {}

  /** Mark a model unusable for the rest of this process (see {@link unavailable}). */
  markUnavailable(modelId: string): void {
    this.unavailable.add(modelId);
  }

  /**
   * Live, cached list of usable text models — **free and paid** — sorted
   * free-first, then price ascending, then context descending (SPEC §5.2), minus
   * any model learned to be restricted for this account. Empty is allowed (the
   * caller decides what that means); it does not by itself imply the §5.3
   * data-policy situation, which is specifically about *free* endpoints.
   */
  async getUsableModels(force = false): Promise<ModelInfo[]> {
    if (force || !this.cache || Date.now() - this.cache.at >= CACHE_TTL_MS) {
      this.cache = { at: Date.now(), models: this.filterUsable(await this.fetchModels()) };
    }
    return this.cache.models.filter((m) => !this.unavailable.has(m.id));
  }

  /**
   * Live, cached **free** subset (SPEC §5.2). Throws {@link DataPolicyError} when
   * no free models are callable — almost always the §5.3 privacy-toggle
   * situation — so "Auto"/free paths surface the actionable message.
   */
  async getFreeModels(force = false): Promise<FreeModel[]> {
    const usable = await this.getUsableModels(force);
    const free = usable.filter((m) => m.isFree);
    if (free.length === 0) {
      // Distinguish "no free at all" (data policy) from "the ones we have are
      // all restricted for this account" (swap exhausted).
      const anyFree = (this.cache?.models ?? []).some((m) => m.isFree);
      if (!anyFree) throw new DataPolicyError();
      throw new ModelUnavailableError(
        this.cache?.models[0]?.id ?? 'unknown',
        'Every free model was rejected as restricted/unavailable for this account. Pick a paid model, or set MODE_A_MODEL to one that works.',
      );
    }
    return free.map((m) => ({ id: m.id, contextLength: m.contextLength }));
  }

  /**
   * Mode A: use the pinned model (`modelSingle`/`MODE_A_MODEL`) when it is a
   * usable candidate — **free or paid** (SPEC §5.2); otherwise the top free model
   * ("Auto").
   */
  async resolveModeAModel(preferred?: string): Promise<string> {
    const pin = preferred ?? this.config.get<string>('MODE_A_MODEL');
    if (pin) {
      const usable = await this.getUsableModels();
      if (usable.some((m) => m.id === pin)) return pin;
    }
    const free = await this.getFreeModels();
    return free[0].id;
  }

  /**
   * The top usable model not in `exclude`, free-first — used to swap in a
   * replacement when a chosen model turns out to be restricted (SPEC §5.4).
   * Undefined if none remain.
   */
  async pickReplacement(exclude: ReadonlySet<string>): Promise<string | undefined> {
    const usable = await this.getUsableModels();
    return usable.find((m) => !exclude.has(m.id))?.id;
  }

  /**
   * Mode B (SPEC §5.2): use the caller's explicit `{ personaKey → modelId }` map
   * when provided — it must name a usable model for **every** persona key (the UI
   * enforces all 7); an incomplete or unknown-model map is rejected. When the map
   * is absent, auto-assign a distinct free model per persona in the given fixed
   * order, round-robining deterministically if fewer than 7 free models exist.
   */
  async assignModeBModels(
    personaKeys: string[],
    requested?: Record<string, string>,
  ): Promise<Record<string, string>> {
    if (requested && Object.keys(requested).length > 0) {
      const usable = await this.getUsableModels();
      const usableIds = new Set(usable.map((m) => m.id));
      const assignment: Record<string, string> = {};
      for (const key of personaKeys) {
        const id = requested[key];
        if (!id) {
          throw new ModelUnavailableError(
            'unknown',
            `No model was chosen for "${key}". Pick a model for every persona.`,
          );
        }
        if (!usableIds.has(id)) {
          throw new ModelUnavailableError(
            id,
            `The model "${id}" chosen for "${key}" is not available. Pick another model.`,
          );
        }
        assignment[key] = id;
      }
      return assignment;
    }
    const free = await this.getFreeModels();
    const assignment: Record<string, string> = {};
    personaKeys.forEach((key, i) => {
      assignment[key] = free[i % free.length].id;
    });
    return assignment;
  }

  /** Blacklist tokens (defaults + `MODEL_BLACKLIST` env), lower-cased. */
  private blacklistTokens(): string[] {
    const extra = (this.config.get<string>('MODEL_BLACKLIST', '') ?? '')
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    return [...DEFAULT_BLACKLIST, ...extra];
  }

  /**
   * Keep only models usable as a text advocate/judge (SPEC §5.2): **text output**
   * (excludes audio/image generators — e.g. Google Lyria, whose token prices are
   * "0" because it bills per second of audio) and not blacklisted by task type.
   * Free and paid alike; each carries its per-token price + `isFree`. Sorted
   * free-first, then price ascending, then context length descending.
   */
  private filterUsable(raw: RawModel[]): ModelInfo[] {
    const blacklist = this.blacklistTokens();
    return raw
      .filter((m) => outputsText(m))
      .filter((m) => {
        const id = m.id.toLowerCase();
        return !blacklist.some((t) => id.includes(t));
      })
      .map((m) => {
        const promptUsd = priceOf(m.pricing?.prompt);
        const completionUsd = priceOf(m.pricing?.completion);
        return {
          id: m.id,
          contextLength: m.context_length ?? 0,
          promptUsd,
          completionUsd,
          isFree: promptUsd === 0 && completionUsd === 0,
        };
      })
      .sort((a, b) => {
        if (a.isFree !== b.isFree) return a.isFree ? -1 : 1;
        const priceDelta =
          a.promptUsd + a.completionUsd - (b.promptUsd + b.completionUsd);
        if (priceDelta !== 0) return priceDelta;
        return b.contextLength - a.contextLength;
      });
  }

  private async fetchModels(): Promise<RawModel[]> {
    const baseUrl = this.config
      .get<string>('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1')
      .replace(/\/$/, '');
    const apiKey = this.config.getOrThrow<string>('OPENROUTER_API_KEY');
    const res = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.status === 404) throw new DataPolicyError();
    if (!res.ok) {
      throw new OpenRouterError(
        `Failed to fetch models (${res.status})`,
        res.status,
      );
    }
    const json = (await res.json()) as { data?: RawModel[] };
    return json.data ?? [];
  }
}

/** Parse a per-token price string ("0", "0.0000006") to a number; missing → 0. */
function priceOf(v?: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * True if the model produces text (and not audio) output. When `architecture`
 * is absent (older `/models` payloads, and the unit-test fixtures) we assume
 * text so the price filter alone still governs. When present, we require `text`
 * in `output_modalities` and reject anything that also emits `audio` — that is
 * what unmasks Google's Lyria music endpoints, which advertise "0" token prices.
 */
function outputsText(m: RawModel): boolean {
  const out = m.architecture?.output_modalities;
  if (!out || out.length === 0) return true;
  return out.includes('text') && !out.includes('audio');
}

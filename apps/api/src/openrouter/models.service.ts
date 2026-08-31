import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FreeModel } from '@tribunal/shared-types';
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
 * Substring tokens (case-insensitive) that mark a nominally-"free" model as
 * unfit to be a Tribunal advocate or judge, even though it passes the price
 * filter. These are the *wrong task type* — classifiers, safety/moderation
 * graders, embedders, rerankers, and audio/music/speech models — which either
 * return an HTTP 200 with empty/degenerate text or bill $0 per token while
 * charging per second of audio (so they slip past the price filter). Blacklists
 * a *category* by name token, not a specific model id, so it survives the free
 * roster drifting month to month (SPEC §5.2). Extend at runtime with the
 * comma-separated `MODEL_BLACKLIST` env var.
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
 * Resolves OpenRouter's free-model roster at runtime and assigns models per run
 * mode (SPEC §5.2). Never hardcodes model ids — the free list changes monthly.
 */
@Injectable()
export class ModelsService {
  private cache?: { at: number; models: FreeModel[] };
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

  /** Live, cached zero-price roster (highest context first), minus any model
   * learned to be restricted for this account. */
  async getFreeModels(force = false): Promise<FreeModel[]> {
    if (force || !this.cache || Date.now() - this.cache.at >= CACHE_TTL_MS) {
      this.cache = { at: Date.now(), models: this.filterFree(await this.fetchModels()) };
    }
    if (this.cache.models.length === 0) {
      // No free endpoints at all — almost always the §5.3 data-policy situation.
      throw new DataPolicyError();
    }
    const usable = this.cache.models.filter((m) => !this.unavailable.has(m.id));
    if (usable.length === 0) {
      throw new ModelUnavailableError(
        this.cache.models[0].id,
        'Every free model was rejected as restricted/unavailable for this account. Set MODE_A_MODEL to a model that works, or enable a paid model.',
      );
    }
    return usable;
  }

  /** Mode A: honor MODE_A_MODEL when still free, else the top free model. */
  async resolveModeAModel(preferred?: string): Promise<string> {
    const free = await this.getFreeModels();
    if (preferred && free.some((m) => m.id === preferred)) return preferred;
    return free[0].id;
  }

  /** The top free model not in `exclude` — used to swap in a replacement when a
   * chosen model turns out to be restricted. Undefined if none remain. */
  async pickReplacement(exclude: ReadonlySet<string>): Promise<string | undefined> {
    const free = await this.getFreeModels();
    return free.find((m) => !exclude.has(m.id))?.id;
  }

  /**
   * Mode B: assign a distinct free model to each persona in the given fixed
   * order; round-robin deterministically if fewer than 7 free models exist.
   */
  async assignModeBModels(
    personaKeys: string[],
  ): Promise<Record<string, string>> {
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
   * Keep only models usable as a text advocate/judge (SPEC §5.2): both token
   * prices exactly "0", **text output** (excludes audio/image generators — e.g.
   * Google Lyria, whose token prices are "0" because it bills per second of
   * audio), and not blacklisted by task type. Sorted by context length desc.
   */
  private filterFree(raw: RawModel[]): FreeModel[] {
    const blacklist = this.blacklistTokens();
    return raw
      .filter((m) => m.pricing?.prompt === '0' && m.pricing?.completion === '0')
      .filter((m) => outputsText(m))
      .filter((m) => {
        const id = m.id.toLowerCase();
        return !blacklist.some((t) => id.includes(t));
      })
      .map((m) => ({ id: m.id, contextLength: m.context_length ?? 0 }))
      .sort((a, b) => b.contextLength - a.contextLength);
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

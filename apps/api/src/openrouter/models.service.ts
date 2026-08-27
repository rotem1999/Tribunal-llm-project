import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FreeModel } from '@tribunal/shared-types';
import { DataPolicyError, OpenRouterError } from './openrouter.errors';

interface RawModel {
  id: string;
  context_length?: number;
  pricing?: { prompt?: string; completion?: string };
}

const CACHE_TTL_MS = 10 * 60 * 1000; // ~10 min (SPEC §5.2)

/**
 * Resolves OpenRouter's free-model roster at runtime and assigns models per run
 * mode (SPEC §5.2). Never hardcodes model ids — the free list changes monthly.
 */
@Injectable()
export class ModelsService {
  private cache?: { at: number; models: FreeModel[] };

  constructor(private readonly config: ConfigService) {}

  /** Live, cached list of zero-price models (highest context first). */
  async getFreeModels(force = false): Promise<FreeModel[]> {
    if (!force && this.cache && Date.now() - this.cache.at < CACHE_TTL_MS) {
      return this.cache.models;
    }
    const models = this.filterFree(await this.fetchModels());
    if (models.length === 0) {
      // No free endpoints — almost always the §5.3 data-policy situation.
      throw new DataPolicyError();
    }
    this.cache = { at: Date.now(), models };
    return models;
  }

  /** Mode A: honor MODE_A_MODEL when still free, else the top free model. */
  async resolveModeAModel(preferred?: string): Promise<string> {
    const free = await this.getFreeModels();
    if (preferred && free.some((m) => m.id === preferred)) return preferred;
    return free[0].id;
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

  private filterFree(raw: RawModel[]): FreeModel[] {
    return raw
      .filter((m) => m.pricing?.prompt === '0' && m.pricing?.completion === '0')
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

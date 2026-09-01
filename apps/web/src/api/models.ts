import type { FreeModel, ModelInfo } from '@tribunal/shared-types';
import { api } from './client';

export const getFreeModels = (): Promise<FreeModel[]> =>
  api<FreeModel[]>('/models/free');

/** Usable models, free + paid, with pricing (SPEC §5.2/§11). */
export const getModels = (): Promise<ModelInfo[]> => api<ModelInfo[]>('/models');

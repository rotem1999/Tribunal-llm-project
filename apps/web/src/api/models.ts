import type { FreeModel } from '@tribunal/shared-types';
import { api } from './client';

export const getFreeModels = (): Promise<FreeModel[]> =>
  api<FreeModel[]>('/models/free');

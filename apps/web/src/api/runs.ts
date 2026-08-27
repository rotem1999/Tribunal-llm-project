import type {
  CreateRunRequest,
  CreateRunResponse,
  RunDetail,
  RunSummary,
} from '@tribunal/shared-types';
import { api } from './client';

export const createRun = (body: CreateRunRequest): Promise<CreateRunResponse> =>
  api<CreateRunResponse>('/runs', { method: 'POST', body: JSON.stringify(body) });

export const listRuns = (limit = 20): Promise<RunSummary[]> =>
  api<RunSummary[]>(`/runs?limit=${limit}`);

export const getRun = (id: string): Promise<RunDetail> =>
  api<RunDetail>(`/runs/${id}`);

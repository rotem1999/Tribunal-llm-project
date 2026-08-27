import type { ChargeSheet } from '@tribunal/shared-types';
import { api } from './client';

export const getActiveChargeSheet = (): Promise<ChargeSheet> =>
  api<ChargeSheet>('/charge-sheet');

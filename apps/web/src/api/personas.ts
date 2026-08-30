import type { PersonaInfo } from '@tribunal/shared-types';
import { api } from './client';

/** Roster for display + the live run animation (SPEC §10, §11). */
export const getPersonas = (): Promise<PersonaInfo[]> =>
  api<PersonaInfo[]>('/personas');

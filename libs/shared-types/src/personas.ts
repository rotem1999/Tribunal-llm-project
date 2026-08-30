/** Public persona roster (SPEC §8, §10). Display info only — no `systemPrompt`. */

import type { PersonaRole, Side } from './enums.js';

/**
 * One persona as exposed by `GET /personas` for display and the live run
 * animation (§11): its stable key, human name, role, and (advocates only) side.
 */
export interface PersonaInfo {
  key: string;
  name: string;
  role: PersonaRole;
  /** Present for advocates; null/absent for judges. */
  side?: Side | null;
}

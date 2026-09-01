/** Error contract shared by api + web (SPEC §12.1). */

import type { ErrorCode } from './enums.js';

/**
 * The one JSON shape every API error response takes (SPEC §12.1). `message` is
 * always **user-safe** — a short, plain sentence, never a raw exception or model
 * output. `code` is the stable category the frontend maps to its own copy.
 */
export interface ApiErrorBody {
  statusCode: number;
  code: ErrorCode;
  message: string;
}

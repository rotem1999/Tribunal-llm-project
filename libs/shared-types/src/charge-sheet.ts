/** Charge-sheet contract (SPEC §4.2, §10). Editable entity (D9); runs snapshot it. */

/** Full charge sheet (`GET /charge-sheet` returns id/title/content/updatedAt). */
export interface ChargeSheet {
  id: string;
  title: string;
  content: string;
  isActive: boolean;
  /** ISO-8601 timestamp. */
  createdAt: string;
  /** ISO-8601 timestamp. */
  updatedAt: string;
}

/** Row shape for `GET /charge-sheets` (list). */
export interface ChargeSheetSummary {
  id: string;
  title: string;
  isActive: boolean;
  /** ISO-8601 timestamp. */
  updatedAt: string;
}

/**
 * `PATCH /charge-sheet/:id` body (SPEC §10). Setting `isActive: true`
 * deactivates the others. Built + protected, but not surfaced in the v1 UI (D9).
 */
export interface UpdateChargeSheetRequest {
  title?: string;
  content?: string;
  isActive?: boolean;
}

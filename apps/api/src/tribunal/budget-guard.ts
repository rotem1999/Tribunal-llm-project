/**
 * Per-run cost ceiling (SPEC §5.5). The ceiling is read from the run snapshot,
 * not live config, so a mid-flight config change can't affect an in-progress run.
 * With free models cost is always 0, so this never triggers — it exists as a
 * safety guard for future paid models.
 */
export function isOverBudget(totalCostUsd: number, ceilingUsd: number): boolean {
  return totalCostUsd > ceilingUsd;
}

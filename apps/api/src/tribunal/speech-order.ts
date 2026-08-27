/**
 * Counterbalanced speech ordering (SPEC §2.1, §5.5). LLM judges favor whichever
 * argument they read first, so each judge sees the speeches rotated by its index
 * (judge 0 → no rotation, judge 1 → shift 1, …). Deterministic; no RNG.
 */
export function counterbalancedOrder<T>(items: T[], judgeIndex: number): T[] {
  const n = items.length;
  if (n === 0) return [];
  const shift = ((judgeIndex % n) + n) % n;
  return items.map((_, k) => items[(k + shift) % n]);
}

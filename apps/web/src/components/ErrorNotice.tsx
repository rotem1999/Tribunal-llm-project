import type { ErrorCode } from '@tribunal/shared-types';
import { copyForCode, isUncategorized } from '../api/errors';

/**
 * Renders a user-safe error (SPEC §12.1): a plain sentence keyed by the stable
 * `code`, never a raw message. For an unexpected/uncategorized failure it adds a
 * small, quotable reference (run id + code) so the user can report it — the raw
 * cause stays in the §5.7 diagnostic log, never on screen.
 */
export function ErrorNotice({
  code,
  runId,
  className = 'text-sm text-not-justified',
}: {
  code?: ErrorCode | null;
  runId?: string;
  className?: string;
}) {
  const showReference = isUncategorized(code) && (runId || code);
  return (
    <div role="alert" className={className}>
      <p>{copyForCode(code)}</p>
      {showReference && (
        <p className="mt-1 text-xs text-neutral-500">
          Reference: {[runId, code].filter(Boolean).join(' · ')}
        </p>
      )}
    </div>
  );
}

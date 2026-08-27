import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { RunSummary } from '@tribunal/shared-types';
import { listRuns } from '../api/runs';
import { Card, Eyebrow } from '../components/ui';

const money = (n: number) => (n === 0 ? '$0.00' : `$${n.toFixed(6)}`);

/** History (SPEC §11): past runs; row click opens the result. */
export function History() {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<RunSummary[] | null>(null);

  useEffect(() => {
    listRuns(50).then(setRuns).catch(() => setRuns([]));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <Eyebrow>History</Eyebrow>
        <h1 className="mt-2 font-heading text-2xl font-medium">Past runs</h1>
      </div>

      {runs && runs.length === 0 && (
        <p className="text-sm text-neutral-500">
          No runs yet — start one from New run.
        </p>
      )}

      {runs && runs.length > 0 && (
        <Card className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-normal">Started</th>
                <th className="px-4 py-3 font-normal">Mode</th>
                <th className="px-4 py-3 font-normal">Status</th>
                <th className="px-4 py-3 font-normal">Tally</th>
                <th className="px-4 py-3 text-right font-normal">Cost</th>
              </tr>
            </thead>
            <tbody className="text-neutral-300">
              {runs.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => navigate(`/runs/${r.id}`)}
                  className="cursor-pointer border-t border-divider hover:bg-neutral-800/40"
                >
                  <td className="px-4 py-3">
                    {new Date(r.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{r.mode}</td>
                  <td className="px-4 py-3">{r.status}</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {r.verdictTally
                      ? `${r.verdictTally.justified}/${r.verdictTally.not_justified}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {money(r.totalCostUsd)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

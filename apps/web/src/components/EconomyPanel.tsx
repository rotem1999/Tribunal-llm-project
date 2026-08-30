import type { RunEconomy } from '@tribunal/shared-types';
import { Button, Card } from './ui';

const money = (n: number) => (n === 0 ? '$0.00 (free)' : `$${n.toFixed(6)}`);

function downloadJson(economy: RunEconomy) {
  const blob = new Blob([JSON.stringify(economy, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `run-${economy.runId}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Token economy panel (SPEC §6c, §11): per-persona, per-model, totals + download. */
export function EconomyPanel({ economy }: { economy: RunEconomy }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-text">Economy</h2>
        <Button variant="ghost" onClick={() => downloadJson(economy)}>
          Download JSON
        </Button>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left font-mono text-xs">
          <thead className="text-neutral-500">
            <tr>
              <th className="py-1 pr-4 font-normal">Persona</th>
              <th className="py-1 pr-4 font-normal">Model</th>
              <th className="py-1 pr-4 text-right font-normal">Tokens</th>
              <th className="py-1 text-right font-normal">Cost</th>
            </tr>
          </thead>
          <tbody className="text-neutral-300">
            {economy.perPersona.map((p) => (
              <tr key={p.personaKey} className="border-t border-divider">
                <td className="py-1 pr-4">{p.personaName}</td>
                <td className="py-1 pr-4">{p.model}</td>
                <td className="py-1 pr-4 text-right">{p.totalTokens}</td>
                <td className="py-1 text-right">{money(p.costUsd)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="text-text">
            <tr className="border-t border-neutral-700">
              <td className="py-1 pr-4" colSpan={2}>
                Total
              </td>
              <td className="py-1 pr-4 text-right">
                {economy.totals.totalTokens}
              </td>
              <td className="py-1 text-right">{money(economy.totals.costUsd)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-4 text-xs text-neutral-500">
        Per model:{' '}
        {economy.perModel
          .map((m) => `${m.model} ×${m.calls} (${m.totalTokens} tok)`)
          .join(' · ')}
      </div>
    </Card>
  );
}

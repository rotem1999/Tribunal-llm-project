/**
 * App shell (SPEC §11). Minimal placeholder for PR-3 — proves Tailwind and the
 * design tokens are wired. Real pages (Login, New Run, Run Result, History) and
 * routing arrive in later PRs, built from Tribunal.dc.html.
 */
export function App() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--color-accent)]">
        Tribunal
      </p>
      <h1 className="font-[family-name:var(--font-heading)] text-4xl">
        The Tribunal
      </h1>
      <p className="text-sm text-[var(--color-accent-300)]">
        A courtroom over a charge sheet — 4 advocates speak, 3 judges decide.
      </p>
    </div>
  );
}

export default App;

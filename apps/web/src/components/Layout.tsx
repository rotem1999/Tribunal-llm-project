import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Button } from './ui';

/** App shell for authenticated pages: header, nav, sign-out (SPEC §11). */
export function Layout() {
  const { user, signOut } = useAuth();
  const link = (isActive: boolean) =>
    `text-sm transition-colors ${
      isActive ? 'text-accent' : 'text-neutral-500 hover:text-text'
    }`;

  return (
    <div className="min-h-screen">
      <header className="border-b border-divider">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div className="flex items-baseline gap-6">
            <span className="font-heading text-sm font-semibold">
              The Tribunal
            </span>
            <nav className="flex gap-4">
              <NavLink to="/new" className={({ isActive }) => link(isActive)}>
                New run
              </NavLink>
              <NavLink to="/history" className={({ isActive }) => link(isActive)}>
                History
              </NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            {user && (
              <span className="hidden text-xs text-neutral-500 sm:inline">
                {user.username}
              </span>
            )}
            <Button variant="ghost" onClick={signOut}>
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}

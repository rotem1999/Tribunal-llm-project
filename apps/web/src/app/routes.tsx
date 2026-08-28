import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Button, Eyebrow } from '../components/ui';
import { Login } from '../pages/Login';

/** Gate protected routes behind a token; otherwise route to Login (SPEC §11). */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

/** Placeholder authenticated landing — New Run / Result / History arrive next. */
function Home() {
  const { user, signOut } = useAuth();
  return (
    <main className="min-h-screen max-w-2xl px-6 py-10">
      <Eyebrow>Tribunal</Eyebrow>
      <h1 className="mt-2 font-heading text-2xl font-medium">
        Signed in{user ? ` as ${user.username}` : ''}
      </h1>
      <p className="mt-2 text-sm text-neutral-500">
        The New Run, Result and History screens arrive in the next PRs.
      </p>
      <div className="mt-6">
        <Button variant="ghost" onClick={signOut}>
          Sign out
        </Button>
      </div>
    </main>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

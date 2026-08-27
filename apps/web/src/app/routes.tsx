import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Layout } from '../components/Layout';
import { Login } from '../pages/Login';
import { NewRun } from '../pages/NewRun';

/** Gate protected routes behind a token; otherwise route to Login (SPEC §11). */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/new" element={<NewRun />} />
      </Route>
      <Route path="/" element={<Navigate to="/new" replace />} />
      <Route path="*" element={<Navigate to="/new" replace />} />
    </Routes>
  );
}

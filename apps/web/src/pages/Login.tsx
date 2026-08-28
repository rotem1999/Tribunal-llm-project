import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Button, Eyebrow, Field, Input } from '../components/ui';

/** Login screen (SPEC §11). Single seeded user; stores the JWT on success. */
export function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [signingIn, setSigningIn] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Enter the seeded username and password.');
      return;
    }
    setSigningIn(true);
    setError('');
    try {
      await signIn(username, password);
      navigate('/');
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? 'Invalid username or password.'
          : 'Could not sign in. Is the API running?',
      );
    } finally {
      setSigningIn(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <Eyebrow>Tribunal</Eyebrow>
        <h1 className="mt-2 font-heading text-3xl font-medium">The Tribunal</h1>
        <p className="mt-1 text-sm text-neutral-500">
          A courtroom over a charge sheet.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <Field label="Username" htmlFor="tb-user">
            <Input
              id="tb-user"
              autoComplete="username"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError('');
              }}
            />
          </Field>
          <Field label="Password" htmlFor="tb-pass">
            <Input
              id="tb-pass"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
            />
          </Field>

          {error && (
            <p className="text-sm text-not-justified" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" block disabled={signingIn}>
            {signingIn ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </main>
  );
}

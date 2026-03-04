import type { ComponentType, FormEvent, ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { Input } from './ui/input';
import { Button } from './ui/button';

const STORAGE_KEY = 'simple_password_auth';
const PASSWORD = import.meta.env.VITE_SIMPLE_PASSWORD_AUTH ?? 'vietnam';
const ONE_HOUR_MS = Number(
  import.meta.env.VITE_SIMPLE_PASSWORD_AUTH_TTL_MS ?? 60 * 60 * 1000,
);

type StoredAuth = {
  password: string;
  expiresAt: number;
};

type AuthStatus = 'checking' | 'unauthenticated' | 'authenticated';

function readStoredAuth(): StoredAuth | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAuth;
    if (
      typeof parsed?.password === 'string' &&
      typeof parsed?.expiresAt === 'number'
    ) {
      return parsed;
    }
  } catch {
    // ignore parse errors
  }
  return null;
}

function writeStoredAuth(): void {
  if (typeof window === 'undefined') return;
  const data: StoredAuth = {
    password: PASSWORD,
    expiresAt: Date.now() + ONE_HOUR_MS,
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore storage errors
  }
}

export function withPasswordAuth<P extends object>(
  WrappedComponent: ComponentType<P>,
): ComponentType<P> {
  function ComponentWithAuth(props: P): ReactElement | null {
    const [status, setStatus] = useState<AuthStatus>('checking');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
      const stored = readStoredAuth();
      if (!stored) {
        setStatus('unauthenticated');
        return;
      }

      if (stored.password !== PASSWORD || stored.expiresAt <= Date.now()) {
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(STORAGE_KEY);
        }
        setStatus('unauthenticated');
        return;
      }

      setStatus('authenticated');
    }, []);

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (password === PASSWORD) {
        writeStoredAuth();
        setStatus('authenticated');
        setError(null);
      } else {
        setError('Incorrect password');
      }
    };

    if (status === 'checking') {
      return null;
    }

    if (status === 'unauthenticated') {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-900 text-slate-50">
          <div className="w-full max-w-xs space-y-4 rounded-xl bg-slate-800 p-6 shadow-lg">
            <div className="space-y-1 text-center">
              <h1 className="text-lg font-semibold">Protected dashboard</h1>
              <p className="text-xs text-slate-400">
                Enter the access password to continue.
              </p>
            </div>

            <form className="space-y-3" onSubmit={handleSubmit}>
              <Input
                type="password"
                autoFocus
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
              />
              {error && (
                <p className="text-xs text-red-400" role="alert">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full">
                Continue
              </Button>
            </form>

            <p className="text-[10px] text-center text-slate-500">
              Access is remembered in this browser for 1 hour.
            </p>
          </div>
        </div>
      );
    }

    return <WrappedComponent {...props} />;
  }

  ComponentWithAuth.displayName = `WithPasswordAuth(${
    (WrappedComponent as { displayName?: string }).displayName ||
    WrappedComponent.name ||
    'Component'
  })`;

  return ComponentWithAuth as ComponentType<P>;
}


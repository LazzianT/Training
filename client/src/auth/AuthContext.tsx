import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { EmployeeProfile } from '@training/contracts';
import { loginRequest } from '../api/auth.js';

export type Session = {
  accessToken: string;
  expiresAt: number;
  employee: EmployeeProfile;
};

type AuthValue = {
  session: Session | null;
  signIn: (nip: string, credential: string) => Promise<void>;
  signOut: (sessionExpired?: boolean) => void;
};

const STORAGE_KEY = 'training.session';

/**
 * sessionStorage, not localStorage: it survives a refresh, which is what was
 * asked, but still dies with the tab. An expired token is dropped on read so a
 * stale value can never render a signed-in shell.
 */
const readSession = (): Session | null => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    return parsed.expiresAt > Date.now() ? parsed : null;
  } catch {
    return null;
  }
};

const AuthContext = createContext<AuthValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(readSession);

  const signOut = useCallback((sessionExpired = true) => {
    sessionStorage.removeItem(STORAGE_KEY);
    setSession(null);
    if (sessionExpired) {
      window.alert('Sesi Anda telah berakhir. Silakan masuk kembali.');
      window.location.assign('/login');
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    const remaining = session.expiresAt - Date.now();
    if (remaining <= 0) {
      signOut(true);
      return;
    }
    const timer = window.setTimeout(() => signOut(true), remaining);
    return () => window.clearTimeout(timer);
  }, [session, signOut]);

  const signIn = useCallback(async (nip: string, credential: string) => {
    const result = await loginRequest(nip, credential);
    const next: Session = {
      accessToken: result.accessToken,
      expiresAt: Date.now() + result.expiresInSeconds * 1000,
      employee: result.employee,
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSession(next);
  }, []);

  const value = useMemo<AuthValue>(() => ({ session, signIn, signOut }), [session, signIn, signOut]);

  return <AuthContext value={value}>{children}</AuthContext>;
};

export const useAuth = () => {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
};

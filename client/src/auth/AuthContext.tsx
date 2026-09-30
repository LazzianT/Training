import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { EmployeeProfile } from '@training/contracts';
import { loginRequest } from '../api/auth.js';
import { useToast } from '../components/Toast.js';

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
  const { push } = useToast();
  const navigate = useNavigate();

  /**
   * An expired session redirects through the router instead of
   * window.location: a full reload would tear the toast out of the DOM before
   * the user could read why they were bounced back to the login screen.
   */
  const signOut = useCallback(
    (sessionExpired = true) => {
      sessionStorage.removeItem(STORAGE_KEY);
      setSession(null);
      if (!sessionExpired) return;
      push({
        tone: 'warning',
        title: 'Sesi Anda berakhir',
        description: 'Masuk kembali untuk melanjutkan dari tempat Anda berhenti.',
        duration: 12_000,
      });
      navigate('/login', { replace: true });
    },
    [push, navigate],
  );

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

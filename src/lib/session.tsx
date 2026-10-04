import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { flushPendingConsents } from '@/lib/consent';
import { supabase } from '@/lib/supabase';

/** Stufen aus `user_profiles.verification_level` (Migration 003). */
export type VerificationLevel = 'neu' | 'mail_verifiziert' | 'aktiv';

type SessionState = {
  session: Session | null;
  loading: boolean;
  /**
   * `null` = noch nicht geladen oder nicht ermittelbar (offline, Fehler).
   * Dann wird NICHT gesperrt: lieber einmal zu wenig auf die Regeln leiten
   * als die App ohne Netz unbenutzbar machen. Der Server prueft ohnehin.
   */
  verificationLevel: VerificationLevel | null;
  refreshVerificationLevel: () => Promise<VerificationLevel | null>;
};

const SessionContext = createContext<SessionState>({
  session: null,
  loading: true,
  verificationLevel: null,
  refreshVerificationLevel: async () => null,
});

async function fetchVerificationLevel(userId: string): Promise<VerificationLevel | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('verification_level')
    .eq('id', userId)
    .maybeSingle();
  if (error) return null;
  return (data?.verification_level as VerificationLevel | undefined) ?? null;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<{ session: Session | null; loading: boolean }>({
    session: null,
    loading: true,
  });
  // Stufe samt Konto, zu dem sie gehoert: nach einem Kontowechsel gilt die
  // alte Stufe damit automatisch nicht mehr.
  const [level, setLevel] = useState<{ userId: string; value: VerificationLevel } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuth({ session: data.session, loading: false });
      // Bei E-Mail-Bestaetigung existiert direkt nach signUp() noch keine
      // Session; die Altersbestaetigung wird deshalb hier nachgetragen,
      // sobald es eine gibt (Nachweis nach Art. 7 (1) DSGVO).
      if (data.session) flushPendingConsents();
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuth({ session, loading: false });
      if (session) flushPendingConsents();
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const userId = auth.session?.user.id ?? null;

  const refreshVerificationLevel = useCallback(async () => {
    if (!userId) return null;
    const value = await fetchVerificationLevel(userId);
    if (value) setLevel({ userId, value });
    return value;
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchVerificationLevel(userId).then((value) => {
      if (value && !cancelled) setLevel({ userId, value });
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const value = useMemo<SessionState>(
    () => ({
      ...auth,
      verificationLevel: level && level.userId === userId ? level.value : null,
      refreshVerificationLevel,
    }),
    [auth, level, userId, refreshVerificationLevel]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}

// Daten des Impact-Profils: laedt alles, was der Profil-Screen zeigt, und
// kapselt die beiden Schreibwege (Bestenlisten-Einstellung, Einwilligungen).
// Alle Zahlen kommen vom Server (View points_level, points_ledger via RLS);
// der Client rechnet nichts in Punkte um.

import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { useI18n } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { isValidDisplayName } from '@/lib/validation';
import { startOfIsoWeek } from '@/lib/week';

// `ki_training` ist ein echtes Opt-in (Standard: aus), siehe Migration 023.
export const CONSENT_KEYS = ['kamera', 'standort', 'behoerden_weitergabe', 'ki_training'] as const;
export type ConsentKey = (typeof CONSENT_KEYS)[number];

export type LevelRow = { balance: number; level: number; level_name: string } | null;
export type LedgerRow = { id: number; delta: number; reason: string; created_at: string };
export type BoardRow = { display_name: string; points: number; rank: number };
export type Counts = { reports: number; confirms: number; closes: number; events: number };

export function useProfilData() {
  const { t } = useI18n();
  const { session } = useSession();
  const [level, setLevel] = useState<LevelRow>(null);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [optIn, setOptIn] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [board, setBoard] = useState<BoardRow[]>([]);
  const [consents, setConsents] = useState<Record<string, boolean>>({});
  const [counts, setCounts] = useState<Counts>({ reports: 0, confirms: 0, closes: 0, events: 0 });
  const [isModerator, setIsModerator] = useState(false);
  const [weekCount, setWeekCount] = useState(0);
  // Bis der erste Ladevorgang durch ist: Skeleton statt kurzem "0 Punkte"-Blitzer.
  const [loaded, setLoaded] = useState(false);
  const [levelUp, setLevelUp] = useState<number | null>(null);
  // Zuletzt gesehene Stufe; erst ein ECHTER Anstieg (nicht der erste Ladevorgang)
  // löst die Feier aus. Keine künstlichen Trigger.
  const lastLevel = useRef<number | null>(null);

  // "Erneut versuchen" im Fehler-Dialog ruft die jeweils aktuelle load-Fassung.
  const retry = useRef<() => void>(() => {});

  // Async + Promise.all, damit RefreshControl weiss, wann der Refresh fertig ist.
  const load = useCallback(async () => {
    if (!session) return;
    const uid = session.user.id;

    const levelP = supabase
      .from('points_level')
      .select('*')
      .eq('user_id', uid)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          Alert.alert(t('profil.error_title'), t('profil.error_body'), [
            { text: t('profil.error_retry'), onPress: () => retry.current() },
          ]);
          setLoaded(true);
          return;
        }
        const row = data as LevelRow;
        setLevel(row);
        const lvl = row?.level ?? null;
        if (lvl != null) {
          if (lastLevel.current != null && lvl > lastLevel.current) setLevelUp(lvl);
          lastLevel.current = lvl;
        }
        setLoaded(true);
      });
    const ledgerP = supabase
      .from('points_ledger')
      .select('id, delta, reason, created_at')
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => setLedger((data as LedgerRow[]) ?? []));
    const profileP = supabase
      .from('user_profiles')
      .select('leaderboard_opt_in, display_name, role')
      .eq('id', uid)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setOptIn(Boolean(data.leaderboard_opt_in));
          setDisplayName(data.display_name ?? '');
          setIsModerator(data.role === 'moderator');
        }
      });
    const boardP = supabase
      .from('leaderboard_week')
      .select('*')
      .then(({ data }) => setBoard((data as BoardRow[]) ?? []));
    const consentsP = supabase
      .from('current_consents')
      .select('consent_key, granted')
      .then(({ data }) => {
        const map: Record<string, boolean> = {};
        for (const row of data ?? []) map[row.consent_key] = row.granted;
        setConsents(map);
      });
    // Zaehlwerte fuer die Abzeichen (nur eigene Zeilen via RLS). Reine
    // Anzeige, keine Reward-Buchung.
    const countsP = Promise.all([
      supabase.from('points_ledger').select('id', { count: 'exact', head: true }).eq('reason', 'report_verified'),
      supabase.from('points_ledger').select('id', { count: 'exact', head: true }).eq('reason', 'case_confirmed'),
      supabase.from('points_ledger').select('id', { count: 'exact', head: true }).eq('reason', 'case_closed_after'),
      supabase.from('cleanup_signups').select('id', { count: 'exact', head: true }).eq('user_id', uid),
    ]).then(([r, c, cl, ev]) => {
      setCounts({
        reports: r.count ?? 0,
        confirms: c.count ?? 0,
        closes: cl.count ?? 0,
        events: ev.count ?? 0,
      });
    });

    // Gemeinschafts-Challenge: neue Faelle seit Montag 00:00 (cases ist fuer
    // alle lesbar, keine PII — siehe Migration 002). Gehoert thematisch zur
    // Bestenliste (Gemeinschaft), nicht auf den bewusst minimalistischen
    // Home-Screen (Redesign-Runde 5, docs/design-notes.md).
    const weekP = supabase
      .from('cases')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', startOfIsoWeek().toISOString())
      .then(({ count }) => setWeekCount(count ?? 0));

    await Promise.all([levelP, ledgerP, profileP, boardP, consentsP, countsP, weekP]);
  }, [session, t]);

  useEffect(() => {
    retry.current = load;
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function saveLeaderboardPrefs(nextOptIn: boolean) {
    const trimmedName = displayName.trim();
    if (nextOptIn && trimmedName && !isValidDisplayName(trimmedName)) {
      Alert.alert(t('profil.pseudonym_invalid_title'), t('profil.pseudonym_invalid_body'));
      return;
    }
    setOptIn(nextOptIn);
    const { error } = await supabase.rpc('set_leaderboard_prefs', {
      p_opt_in: nextOptIn,
      p_display_name: trimmedName || null,
    });
    if (error) {
      setOptIn(!nextOptIn);
      Alert.alert(t('profil.error_title'), t('profil.error_body'));
      return;
    }
    load();
  }

  async function setConsent(key: ConsentKey, granted: boolean) {
    setConsents((c) => ({ ...c, [key]: granted }));
    // Nachweisbar: jede Aenderung wird serverseitig als neue Journal-Zeile
    // gespeichert (append-only, Migration 013).
    const { error } = await supabase.rpc('record_consent', {
      p_consent_key: key,
      p_granted: granted,
    });
    // Schalter nie anders zeigen als der Server speichert – sonst saehe z. B.
    // ein Widerruf von `ki_training` erledigt aus, obwohl er nicht angekommen ist.
    if (error) {
      setConsents((c) => ({ ...c, [key]: !granted }));
      Alert.alert(t('profil.error_title'), t('profil.error_body'));
    }
  }

  return {
    load,
    loaded,
    level,
    ledger,
    counts,
    weekCount,
    isModerator,
    leaderboard: { optIn, displayName, setDisplayName, board, save: saveLeaderboardPrefs },
    consents,
    setConsent,
    levelUp,
    clearLevelUp: () => setLevelUp(null),
  };
}

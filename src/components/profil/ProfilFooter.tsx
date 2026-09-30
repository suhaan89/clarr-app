// Fuss des Profils: Moderations-Zugang (nur Moderatoren), Rechtstexte,
// Abmelden.

import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { PressableScale } from '@/components/PressableScale';
import { Spacing, useThemeColors } from '@/constants/theme';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

import { profilStyles } from './styles';

// Rechtliches vollstaendig und ohne Suchen erreichbar: Datenschutz
// (Art. 13 DSGVO), Nutzungsbedingungen (Art. 14 DSA), Melde- und
// Kontaktstelle (Art. 11, 12, 16, 20 DSA), Impressum (§ 5 DDG) und die
// Open-Source-Lizenzhinweise.
const LEGAL_LINKS = [
  { href: '/legal/datenschutz', key: 'datenschutz' },
  { href: '/legal/agb', key: 'agb' },
  { href: '/legal/kontakt', key: 'kontakt' },
  { href: '/legal/impressum', key: 'impressum' },
  { href: '/legal/lizenzen', key: 'lizenzen' },
] as const;

export function ProfilFooter({ isModerator }: { isModerator: boolean }) {
  const colors = useThemeColors();
  const { t } = useI18n();
  const router = useRouter();

  return (
    <>
      {isModerator && (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('moderation.title')}
          onPress={() => router.push('/moderation')}
          haptic="light"
          style={profilStyles.actionRow}>
          <Ionicons name="shield-checkmark-outline" size={18} color={colors.text} />
          <Text style={[profilStyles.actionLabel, { color: colors.text }]} allowFontScaling>
            {t('moderation.title')}
          </Text>
        </PressableScale>
      )}

      <View style={styles.legalLinks}>
        {LEGAL_LINKS.map(({ href, key }) => (
          <Link key={key} href={href} accessibilityLabel={t(`profil.${key}_a11y`)}>
            <Text style={[styles.label, { color: colors.textSecondary }]} allowFontScaling>
              {t(`profil.${key}`)}
            </Text>
          </Link>
        ))}
      </View>

      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={t('profil.signout')}
        onPress={() => supabase.auth.signOut()}
        haptic="light"
        style={styles.signOut}>
        <Text style={[styles.label, { color: colors.textSecondary }]} allowFontScaling>
          {t('profil.signout')}
        </Text>
      </PressableScale>
    </>
  );
}

const styles = StyleSheet.create({
  legalLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    rowGap: Spacing.two,
    justifyContent: 'center',
    marginTop: Spacing.three,
    alignItems: 'center',
  },
  signOut: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 15 },
});

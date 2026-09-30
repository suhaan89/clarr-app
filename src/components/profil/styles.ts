// Gemeinsame Styles der Profil-Abschnitte (Schalter-Zeilen, Hinweise,
// Aktions-Zeilen), damit alle Karten gleich aussehen.

import { StyleSheet } from 'react-native';

import { Spacing } from '@/constants/theme';

export const profilStyles = StyleSheet.create({
  sectionCard: { gap: Spacing.two },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
    gap: Spacing.two,
  },
  switchLabel: { fontSize: 15, flexShrink: 1 },
  note: { fontSize: 12, lineHeight: 17 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 44,
  },
  actionLabel: { fontSize: 15, fontWeight: '600' },
});

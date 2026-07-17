import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing, useThemeColors } from '@/constants/theme';
import { LANGUAGES, useI18n, type LanguageCode } from '@/lib/i18n';

import { Badge } from './Badge';
import { PressableScale } from './PressableScale';

type Props = {
  /** 'row' = Zeile mit Label (Profil), 'icon' = runder Globus-Button (Login). */
  variant?: 'row' | 'icon';
};

/** Sprachwahl: öffnet ein Modal mit allen Sprachen (Endonyme, Häkchen). */
export function LanguagePicker({ variant = 'row' }: Props) {
  const colors = useThemeColors();
  const { lang, setLang, t } = useI18n();
  const [open, setOpen] = useState(false);

  const current = LANGUAGES.find((l) => l.code === lang);

  function choose(code: LanguageCode) {
    setLang(code);
    setOpen(false);
  }

  return (
    <>
      {variant === 'row' ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`${t('profil.language')}: ${current?.label}`}
          onPress={() => setOpen(true)}
          haptic="light"
          style={styles.row}>
          <View style={styles.rowLeft}>
            <Ionicons name="globe-outline" size={20} color={colors.textSecondary} />
            <Text style={[styles.rowLabel, { color: colors.text }]} allowFontScaling>
              {current?.label}
            </Text>
            {current?.beta && <Badge label="Beta" tone="warning" />}
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </PressableScale>
      ) : (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('login.language_a11y')}
          onPress={() => setOpen(true)}
          haptic="light"
          hitSlop={8}
          style={[styles.iconButton, { backgroundColor: colors.backgroundElement }]}>
          <Ionicons name="globe-outline" size={22} color={colors.text} />
        </PressableScale>
      )}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        {/* Backdrop/Sheet sind reine Tipp-Faenger, keine echten Buttons ->
            bewusst ohne PressableScale-Feder (wie in HelpChat). */}
        <Pressable
          style={[styles.backdrop, { backgroundColor: colors.overlay }]}
          accessibilityLabel={t('language.close')}
          onPress={() => setOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.background }]} onPress={() => {}}>
            <View style={styles.sheetHeader}>
              <Text
                accessibilityRole="header"
                style={[styles.sheetTitle, { color: colors.text }]}
                allowFontScaling>
                {t('language.title')}
              </Text>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={t('language.close')}
                onPress={() => setOpen(false)}
                haptic="light"
                hitSlop={8}
                style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </PressableScale>
            </View>
            <FlatList
              data={LANGUAGES}
              keyExtractor={(l) => l.code}
              renderItem={({ item }) => {
                const active = item.code === lang;
                return (
                  <PressableScale
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={item.beta ? `${item.label} (Beta)` : item.label}
                    onPress={() => choose(item.code)}
                    haptic="selection"
                    style={[styles.option, active && { backgroundColor: colors.primarySoft }]}>
                    <View style={styles.optionLeft}>
                      <Text
                        style={[
                          styles.optionLabel,
                          { color: active ? colors.primaryStrong : colors.text },
                          active && styles.optionActive,
                        ]}
                        allowFontScaling>
                        {item.label}
                      </Text>
                      {item.beta && <Badge label="Beta" tone="warning" />}
                    </View>
                    {active && <Ionicons name="checkmark" size={20} color={colors.primaryStrong} />}
                  </PressableScale>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  rowLabel: { fontSize: 15 },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: { flex: 1, justifyContent: 'center', padding: Spacing.four },
  sheet: {
    borderRadius: Radius.lg,
    padding: Spacing.three,
    maxHeight: '80%',
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', flex: 1 },
  closeBtn: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.two,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flexShrink: 1,
  },
  optionLabel: { fontSize: 16 },
  optionActive: { fontWeight: '700' },
});

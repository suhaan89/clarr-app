// CLAR — Hilfe-Chat mit Clari (Runde 6, Paket E.20).
//
// Bewusst regelbasiert (FAQ-/Entscheidungsbaum), kein LLM-Backend: eine
// feste Frageliste, jede Frage hat genau eine Antwort. Texte kommen aus
// src/lib/i18n statt hartkodiert zu sein, damit die Uebersetzungen greifen.

import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Mascot } from './Mascot';
import { Radius, Shadow, Spacing, useThemeColors } from '@/constants/theme';
import { useI18n, type TranslationKey } from '@/lib/i18n';

type Question = { id: string; q: TranslationKey; a: TranslationKey };

const QUESTIONS: Question[] = [
  { id: 'report', q: 'chat.q.report', a: 'chat.a.report' },
  { id: 'photos', q: 'chat.q.photos', a: 'chat.a.photos' },
  { id: 'points', q: 'chat.q.points', a: 'chat.a.points' },
  { id: 'privacy', q: 'chat.q.privacy', a: 'chat.a.privacy' },
];

export function HelpChat() {
  const colors = useThemeColors();
  const { t } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const active = QUESTIONS.find((q) => q.id === activeId) ?? null;

  function close() {
    setOpen(false);
    setActiveId(null);
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('chat.open_a11y')}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.fab,
          Shadow,
          { backgroundColor: colors.primary, bottom: insets.bottom + Spacing.six + Spacing.three },
          pressed && styles.pressed,
        ]}>
        <Ionicons name="help" size={24} color={colors.onPrimary} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <Pressable
          style={[styles.backdrop, { backgroundColor: colors.overlay }]}
          accessibilityRole="button"
          accessibilityLabel={t('chat.close_a11y')}
          onPress={close}>
          <Pressable
            style={[styles.sheet, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}
            onPress={(e) => e.stopPropagation()}>
            <View style={styles.header}>
              <Mascot pose="hint" size={44} accessibilityLabel="Clari" />
              <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]} allowFontScaling>
                {t('chat.title')}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('chat.close_a11y')}
                onPress={close}
                style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
              {active ? (
                <>
                  <View style={[styles.bubble, { backgroundColor: colors.primarySoft }]}>
                    <Text style={[styles.bubbleText, { color: colors.text }]} allowFontScaling>
                      {t(active.a)}
                    </Text>
                  </View>
                  {active.id === 'privacy' && (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        close();
                        router.push('/legal/datenschutz');
                      }}
                      style={[styles.linkBtn, { borderColor: colors.border }]}>
                      <Ionicons name="lock-closed-outline" size={16} color={colors.primaryStrong} />
                      <Text style={[styles.linkText, { color: colors.primaryStrong }]} allowFontScaling>
                        {t('chat.privacy_link')}
                      </Text>
                    </Pressable>
                  )}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('chat.back_a11y')}
                    onPress={() => setActiveId(null)}
                    style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={16} color={colors.textSecondary} />
                    <Text style={[styles.backText, { color: colors.textSecondary }]} allowFontScaling>
                      {t('chat.back')}
                    </Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <View style={[styles.bubble, { backgroundColor: colors.primarySoft }]}>
                    <Text style={[styles.bubbleText, { color: colors.text }]} allowFontScaling>
                      {t('chat.intro')}
                    </Text>
                  </View>
                  {QUESTIONS.map((q) => (
                    <Pressable
                      key={q.id}
                      accessibilityRole="button"
                      onPress={() => setActiveId(q.id)}
                      style={({ pressed }) => [styles.qBtn, { borderColor: colors.border }, pressed && styles.pressed]}>
                      <Text style={[styles.qText, { color: colors.text }]} allowFontScaling>
                        {t(q.q)}
                      </Text>
                      <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                    </Pressable>
                  ))}
                </>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: Spacing.three,
    width: 52,
    height: 52,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  pressed: { opacity: 0.8 },
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  sheet: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  title: { fontSize: 18, fontWeight: '700', flex: 1 },
  closeBtn: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  body: { gap: Spacing.two },
  bubble: { borderRadius: Radius.lg, padding: Spacing.three },
  bubbleText: { fontSize: 15, lineHeight: 21 },
  qBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    minHeight: 48,
  },
  qText: { fontSize: 15, fontWeight: '600', flexShrink: 1 },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    minHeight: 44,
    alignSelf: 'flex-start',
  },
  linkText: { fontSize: 14, fontWeight: '600' },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    minHeight: 44,
    alignSelf: 'flex-start',
  },
  backText: { fontSize: 14 },
});

// CLAR — Globale ErrorBoundary (Runde 6, Paket G.27). React-Fehlergrenzen
// gibt es nur als Klassenkomponente (kein Hook-Äquivalent) — bewusst die
// einzige Klassenkomponente im Projekt, aus diesem Grund. Sitzt bewusst
// AUSSERHALB von I18nProvider (faengt auch Fehler beim Provider-Start ab),
// kann also nicht useI18n() nutzen — liest die gespeicherte Sprache direkt
// aus AsyncStorage und uebersetzt mit der reinen `translate()`-Funktion
// (Runde 7, Design-Audit: vorher fest Deutsch, unabhaengig von der
// Spracheinstellung).

import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Component, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from './Button';
import { Colors, DisplayFont, Spacing } from '@/constants/theme';
import { LANGUAGES, type LanguageCode } from '@/lib/i18n';
import { translate } from '@/lib/i18n/translate';

const LANGUAGE_STORAGE_KEY = 'clar.language';

type Props = { children: ReactNode };
type State = { error: Error | null; lang: LanguageCode };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, lang: 'de' };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // Nur in die Konsole, keine Inhalte/Nutzerdaten — reine Diagnose.
    console.error('ErrorBoundary hat einen Render-Fehler abgefangen:', error, info.componentStack);
    AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)
      .then((stored) => {
        if (stored && LANGUAGES.some((l) => l.code === stored)) {
          this.setState({ lang: stored as LanguageCode });
        }
      })
      .catch(() => {
        // Ohne gespeicherte Sprache bleibt es beim Deutsch-Default.
      });
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;

    // Kein useThemeColors (Hooks funktionieren nicht in Klassenkomponenten) —
    // fester, systemunabhaengiger Light-Ton reicht fuer diesen seltenen Fallback.
    const colors = Colors.light;
    const t = (key: Parameters<typeof translate>[1]) => translate(this.state.lang, key);
    return (
      <View style={[styles.wrap, { backgroundColor: colors.background }]}>
        <View style={[styles.iconCircle, { backgroundColor: colors.dangerSoft }]}>
          <Ionicons name="alert-circle-outline" size={32} color={colors.danger} />
        </View>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]} allowFontScaling>
          {t('error_boundary.title')}
        </Text>
        <Text style={[styles.body, { color: colors.textSecondary }]} allowFontScaling>
          {t('error_boundary.body')}
        </Text>
        <Button label={t('error.retry')} onPress={this.reset} />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.five,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  title: { fontFamily: DisplayFont.regular, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  body: { fontSize: 15, lineHeight: 22, textAlign: 'center', maxWidth: 320 },
});

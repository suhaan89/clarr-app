// CLAR — Globale ErrorBoundary (Runde 6, Paket G.27). React-Fehlergrenzen
// gibt es nur als Klassenkomponente (kein Hook-Äquivalent) — bewusst die
// einzige Klassenkomponente im Projekt, aus diesem Grund.

import Ionicons from '@expo/vector-icons/Ionicons';
import { Component, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from './Button';
import { Colors, DisplayFont, Spacing } from '@/constants/theme';

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // Nur in die Konsole, keine Inhalte/Nutzerdaten — reine Diagnose.
    console.error('ErrorBoundary hat einen Render-Fehler abgefangen:', error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;

    // Kein useThemeColors (Hooks funktionieren nicht in Klassenkomponenten) —
    // fester, systemunabhaengiger Light-Ton reicht fuer diesen seltenen Fallback.
    const colors = Colors.light;
    return (
      <View style={[styles.wrap, { backgroundColor: colors.background }]}>
        <View style={[styles.iconCircle, { backgroundColor: colors.dangerSoft }]}>
          <Ionicons name="alert-circle-outline" size={32} color={colors.danger} />
        </View>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]} allowFontScaling>
          Da ist etwas schiefgelaufen
        </Text>
        <Text style={[styles.body, { color: colors.textSecondary }]} allowFontScaling>
          Die App hatte einen unerwarteten Fehler. Deine Daten sind sicher – bitte versuche es
          erneut.
        </Text>
        <Button label="Erneut versuchen" onPress={this.reset} />
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

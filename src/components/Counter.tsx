import { useEffect, useState } from 'react';
import { Animated, Text, type StyleProp, type TextStyle } from 'react-native';

type Props = {
  value: number;
  style?: StyleProp<TextStyle>;
  /** Präfix/Suffix bleiben statisch, nur die Zahl zählt hoch. */
  suffix?: string;
  duration?: number;
};

/**
 * Zahl, die beim Erscheinen (und bei jeder Änderung) weich hochzählt.
 * Läuft bewusst ohne Native-Driver – Textinhalt lässt sich nur im
 * JS-Thread setzen; kurze Dauer hält das unkritisch.
 */
export function Counter({ value, style, suffix, duration = 750 }: Props) {
  const [anim] = useState(() => new Animated.Value(0));
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const id = anim.addListener(({ value: v }) => setDisplay(Math.round(v)));
    Animated.timing(anim, {
      toValue: value,
      duration,
      useNativeDriver: false,
    }).start();
    return () => anim.removeListener(id);
  }, [value, duration, anim]);

  return (
    <Text style={style} allowFontScaling>
      {display}
      {suffix ?? ''}
    </Text>
  );
}

// Metro-Konfiguration. Standard von Expo + `.tflite` als Asset-Extension,
// damit `react-native-fast-tflite` das gebündelte On-Device-Modell laden kann
// (siehe docs/vision-ondevice.md). NativeWind verarbeitet `src/global.css`
// (Tailwind-Direktiven + Font-Variablen) für die neuen react-native-reusables-
// UI-Komponenten unter `src/components/ui`.
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('tflite');

module.exports = withNativeWind(config, { input: './src/global.css' });

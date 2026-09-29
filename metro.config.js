// Metro-Konfiguration. Standard von Expo + `.tflite` als Asset-Extension (das
// On-Device-Modell kommt inzwischen per Download, siehe
// docs/vision-ondevice.md; die Extension schadet nicht und erlaubt Tests mit
// einem lokal eingebundenen Modell). NativeWind verarbeitet `src/global.css`
// (Tailwind-Direktiven + Font-Variablen) für die neuen react-native-reusables-
// UI-Komponenten unter `src/components/ui`.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('tflite');

// training/ (Python, Fotos, Modelle) gehört nicht zur App.
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const trainingDir = path
  .resolve(__dirname, 'training')
  .split(/[/\\]/)
  .map(escapeRe)
  .join('[/\\\\]');
config.resolver.blockList = [
  ...[].concat(config.resolver.blockList ?? []),
  new RegExp(`^${trainingDir}[/\\\\]`),
];

module.exports = withNativeWind(config, { input: './src/global.css' });

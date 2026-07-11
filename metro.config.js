// Metro-Konfiguration. Standard von Expo + `.tflite` als Asset-Extension,
// damit `react-native-fast-tflite` das gebündelte On-Device-Modell laden kann
// (siehe docs/vision-ondevice.md).
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('tflite');

module.exports = config;

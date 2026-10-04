// Metro-Konfiguration. Standard von Expo + `.tflite` als Asset-Extension (das
// On-Device-Modell kommt inzwischen per Download, siehe
// docs/vision-ondevice.md; die Extension schadet nicht und erlaubt Tests mit
// einem lokal eingebundenen Modell).
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

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

module.exports = config;

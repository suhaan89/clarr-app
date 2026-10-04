// Ergaenzt app.json um Werte, die nicht ins Repo gehoeren (Schluessel aus der
// Umgebung). Alles Feste bleibt in app.json.
module.exports = ({ config }) => {
  // Android zeigt die Karte ueber Google Maps und bleibt ohne Schluessel leer.
  // iOS nutzt Apple Maps und braucht keinen. Einrichtung: docs/ops.md.
  const mapsKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  return {
    ...config,
    plugins: [
      ...(config.plugins ?? []),
      ...(mapsKey ? [['react-native-maps', { androidGoogleMapsApiKey: mapsKey }]] : []),
    ],
  };
};

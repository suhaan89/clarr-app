// Plattform-Weiche für die Karte: nativ die echte react-native-maps-Karte.
// Auf Web löst Metro stattdessen AppMap.web.tsx auf, weil react-native-maps
// React-Native-Interna importiert und das Web-Bundle sonst komplett bricht.
export { default as MapView, Marker as MapMarker } from 'react-native-maps';

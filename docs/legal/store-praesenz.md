<!--
  Betreiber-Checkliste (Area 4). Was ICH (Agent) nicht erzeugen kann:
  Screenshots echter Geraete/Simulatoren, Grafiken und finale Marketing-Texte.
  Hier die genauen Formate + Textentwuerfe als Startpunkt.
-->

# Store-Präsenz — benötigte Assets & Texte

## 1. Grafik-Assets (vom Betreiber zu erstellen)

### Apple App Store
| Asset | Format | Pflicht |
|---|---|---|
| App-Icon | 1024×1024 px, PNG, **kein** Alpha/Transparenz, keine abgerundeten Ecken | Ja (aus `assets/expo.icon` bzw. `assets/images/icon.png` ableiten) |
| iPhone 6.7"/6.9" Screenshots | 1290×2796 px (Portrait), 2–10 Stück | **Ja** |
| iPhone 6.5" Screenshots | 1242×2688 px | je nach Gerätematrix |
| iPad 12.9" Screenshots | 2048×2732 px | nur falls iPad-Support (aktuell aus) |
| App Preview (Video) | optional | Nein |

> Aktuell **iPhone-only** (supportsTablet aus) → iPad-Screenshots erst nötig,
> wenn nativer iPad-Support aktiviert wird.

### Google Play
| Asset | Format | Pflicht |
|---|---|---|
| App-Icon | 512×512 px, PNG (32-bit, Alpha) | **Ja** |
| **Feature-Graphic** | 1024×500 px, PNG/JPG | **Ja** |
| Telefon-Screenshots | min. 2, 16:9 oder 9:16, je 320–3840 px Kante | **Ja** |
| Tablet-Screenshots (7"/10") | optional | empfohlen, nicht Pflicht |

### Screenshot-Motive (Vorschlag, je 3–5)
1. Home „Deine Wirkung" (Held-Zahl) — zeigt die Kernidee ruhig.
2. Melden-Screen (Kamera-Auslöser) — die zentrale Aktion.
3. Karte mit Pins (rot/grün) + Legende.
4. Profil mit Level/Abzeichen.
5. Optional: Events/Cleanup-Aktion.

> Jeweils **Light- und Dark-Variante** möglich; Deutsch als Primärsprache,
> optional englische Zweitfassung. **Keine echten personenbezogenen Fotos** in
> Screenshots (synthetische/Beispiel-Meldungen nutzen).

## 2. Store-Texte (Entwürfe — anpassen)

### Deutsch
- **Titel (≤30 Z.):** `CLAR – Müll melden & Karte`
- **Untertitel/Kurz (≤80 Z. Play / 30 Z. Apple-Untertitel):**
  `Müllfunde am Bodensee melden und gemeinsam sauber machen.`
- **Beschreibung (Entwurf):**
  > CLAR macht Müll im öffentlichen Raum sichtbar. Fotografier einen Fund – der
  > Ort wird automatisch erfasst – und er erscheint anonymisiert auf der Karte.
  > Gemeinsam behalten wir den Bodensee sauber.
  >
  > • Schnell melden: Foto, fertig – der Standort kommt automatisch.
  > • Öffentliche Karte: offene und schon aufgeräumte Funde.
  > • Datenschutz zuerst: Fotos werden anonymisiert (Gesichter/Kennzeichen
  >   unkenntlich), Standorte auf der Karte gerundet, kein Klarname.
  > • Kosmetische Punkte & Abzeichen – ohne Druck, ohne Grind.
  >
  > CLAR meldet Müll, nie Personen.

### Englisch
- **Title:** `CLAR – Report Litter & Map`
- **Subtitle:** `Report litter around Lake Constance and clean up together.`
- **Description:** [Übersetzung des obigen Entwurfs — PRÜFEN.]

## 3. Weitere Pflicht-Metadaten
- **Kategorie:** vorschlag `Soziales`/`Bildung` (Apple) bzw. passende Play-Kat.
- **Datenschutz-URL** (öffentlich, Pflicht): siehe hosting-checkliste.md.
- **Support-URL/-E-Mail** (Pflicht): [anlegen].
- **Altersfreigabe:** siehe store-angaben.md (voraussichtl. 12+/Teen).

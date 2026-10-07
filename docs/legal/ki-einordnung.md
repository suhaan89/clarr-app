<!--
  Einordnung der KI-Komponenten nach der KI-Verordnung (EU) 2024/1689 sowie
  Nachweis der KI-Kompetenz nach Art. 4. Erstellt im Legal-Audit 2026-09-23.
  Keine anwaltliche Bewertung; die Einstufungen sind begründet, aber zu
  bestätigen.
-->

# KI-Einordnung und KI-Kompetenz

**Stand:** 07.10.2026

## 1. Rolle von CLAR

Für `analyze-photo` und `process-photo` **betreibt** CLAR ein zugekauftes
Modell in eigener Verantwortung. Damit ist CLAR insoweit **Betreiber** im
Sinne von Art. 3 Nr. 4 der Verordnung (EU) 2024/1689. Seit 07.10.2026 ist das
ein offenes Modell von Mistral AI (Mistral Small 3.1, Apache 2.0), das
Cloudflare über Workers AI bereitstellt; vorher war es ein Modell von
Anthropic. Der Anbieter ist per Secret umstellbar
(`supabase/functions/_shared/vision.ts`).

Seit 28.09.2026 trainiert CLAR zusätzlich ein **eigenes** kleines Modell für
die Vorab-Erkennung auf dem Gerät (`training/`, `src/lib/vision`) und bringt
es unter eigenem Namen in Verkehr. Für dieses System ist CLAR **Anbieter**
nach Art. 3 Nr. 3. Da es kein Hochrisiko-System ist (siehe 2.3), folgen
daraus keine Konformitätsbewertung und keine Registrierung, wohl aber die
allgemeinen Pflichten (Art. 4, Transparenz) und eine saubere Dokumentation
von Daten, Training und Auswertung (`training/README.md`,
`vision_models.metrics`).

[ANWALT PRÜFEN] Ob der Betrieb im Zusammenhang mit einer beruflichen
Tätigkeit erfolgt; bei einer rein privaten Nutzung greift die Verordnung
insoweit nicht.

## 2. Die drei KI-nahen Komponenten

### 2.1 `supabase/functions/analyze-photo`

- **Was:** Bildklassifikation über Cloudflare Workers AI. Entscheidet über
  Veröffentlichung, Ablehnung oder Vorlage bei einem Menschen.
- **Einstufung:** KI-System. **Kein Hochrisiko-System.** Anhang III nennt
  biometrische Identifizierung, kritische Infrastruktur, allgemeine und
  berufliche Bildung, Beschäftigung, Zugang zu wesentlichen Diensten und
  Leistungen, Strafverfolgung, Migration und Justiz. Die Sichtbarkeit einer
  Müllmeldung fällt unter keinen dieser Punkte.
- **Pflichten:** Art. 26 (Betreiberpflichten, hier: bestimmungsgemäße
  Verwendung, menschliche Aufsicht, Protokollierung) greifen nur für
  Hochrisiko-Systeme und damit nicht. Es bleiben die allgemeinen Pflichten aus
  Art. 4 sowie die Transparenzpflichten aus der DSGVO und dem DSA, die
  eigenständig erfüllt werden.

### 2.2 `supabase/functions/process-photo`

- **Was:** Erkennung von Gesichtern und Kennzeichen, um sie zu verpixeln.
- **Einstufung:** KI-System, **kein Hochrisiko**, und ausdrücklich **keine
  biometrische Identifizierung und keine biometrische Kategorisierung**: es
  wird kein biometrisches Template erzeugt, nichts abgeglichen, niemand
  identifiziert und keine Eigenschaft einer Person abgeleitet. Erkannt wird
  nur die Bildregion, und das ausschließlich, um sie unkenntlich zu machen.
  Das ist eine datenschutzmindernde, keine datenschutzmindernd wirkende
  Verarbeitung. [ANWALT PRÜFEN]
- **Art. 5 (1) lit. g** (biometrische Kategorisierung nach sensiblen
  Merkmalen) ist damit nicht berührt.

### 2.3 `src/lib/vision` (On-Device, TFLite)

- **Was:** eigenes Bildklassifikationsmodell (MobileNetV2, TFLite int8),
  „illegale Müllablagerung ja/nein“. Unverbindlicher Hinweis vor dem
  Absenden. Modellupdates kommen aus `public.vision_models` und dem Bucket
  `ml-models`, ohne App-Update.
- **Einstufung:** KI-System, **kein Hochrisiko**, keine Entscheidung. Das
  Ergebnis blockiert nichts. Das Foto verlässt dafür das Gerät nicht; der
  Score und die Modellversion werden mit der Meldung gespeichert
  (`reports.ondevice_score`). Serverseitig darf der Score eine Meldung nur
  zusätzlich einem Menschen vorlegen, nie veröffentlichen, ablehnen oder
  Punkte auslösen. Standardmäßig ist auch das aus
  (`system_settings.ondevice_disagree_below = null`).
- **Trainingsdaten:** nur mit Einwilligung (`consents.ki_training`), nur
  verpixelte und freigegebene Kopien, lokal trainiert. Details und
  Löschlogik: `docs/vision-ondevice.md`, Datenschutzerklärung 8a.
- **Lizenz:** TensorFlow/Keras und MobileNetV2 stehen unter Apache 2.0. Zu den Trainingsfotos aus TACO siehe `FRAGEN.md`, Punkt 12.

### 2.4 `src/components/HelpChat.tsx`

- **Kein KI-System.** Fester Entscheidungsbaum mit vier Fragen und vier
  Antworten aus `src/lib/i18n`. Kein Modell, kein Netzaufruf, keine Eingabe.

## 3. Art. 50 Transparenzpflichten

| Absatz | Anwendbar | Umsetzung |
|---|---|---|
| Abs. 1: Offenlegung bei Interaktion mit einem KI-System | nein, mangels KI-Dialog | Der Hilfe-Chat sieht wegen Maskottchen und Sprechblasen nach einem Chatbot aus. Im Kopf des Fensters steht deshalb dauerhaft, dass es weder eine KI noch ein Mensch ist (`chat.no_ai_note`). So entsteht auch keine falsche Erwartung in die Gegenrichtung. |
| Abs. 2 und 4: Kennzeichnung synthetischer oder manipulierter Inhalte | nein | CLAR erzeugt keine Bilder, Texte, Audios oder Videos. Die Pipeline klassifiziert und verpixelt, sie generiert nicht. Die Verpixelung ist eine offensichtliche, nicht täuschende Bearbeitung. |
| Abs. 3: Emotionserkennung, biometrische Kategorisierung | nein | findet nicht statt, siehe 2.2 |

Unabhängig davon wird die KI-Beteiligung im Produkt offengelegt: Hinweiskarte
im Melden-Flow, Kennzeichnung im Fall-Detail, eigener Abschnitt in der
Datenschutzerklärung und in den Nutzungsbedingungen.

## 4. Art. 5 verbotene Praktiken

Geprüft und nicht einschlägig:

- Keine unterschwellige Beeinflussung und keine manipulativen Techniken. Das
  Produkt verzichtet bewusst auf Streaks, Tagesserien, Zufallsbelohnungen und
  Verknappung (`src/app/(tabs)/profil.tsx`, `docs/trust-safety.md`).
- Keine Ausnutzung der Schutzbedürftigkeit Minderjähriger: Punkte haben keinen
  Geldwert, es gibt nichts zu kaufen und nichts zu gewinnen.
- Kein Social Scoring. Der `reputation_score` wirkt ausschließlich innerhalb
  des Dienstes auf die Priorität der Prüfung und wird nirgendwo öffentlich
  gemacht oder außerhalb verwendet.
- Keine biometrische Fernidentifizierung, keine Emotionserkennung, kein
  Scraping von Gesichtsbildern zum Aufbau einer Datenbank. Erkannte Regionen
  werden verpixelt und nicht gespeichert.

## 5. Art. 4 KI-Kompetenz

Die Verordnung verlangt, dass die Personen, die ein KI-System betreiben, über
ein ausreichendes Maß an KI-Kompetenz verfügen. Bei einem sehr kleinen Team
heißt das nicht Zertifikate, sondern nachvollziehbare Routinen:

1. **Dokumentierte Selbstprüfung vor jedem KI-Feature.** Die sieben Fragen in
   `docs/vision.md` sind verbindlich, bevor ein Modell etwas entscheidet.
2. **Bekannte Grenzen schriftlich.** Dass die Verpixelung fehlbar ist, steht
   als Warnung im Kopf von `process-photo/index.ts` und ist der Grund für den
   menschlichen Prüfschritt. Dass das On-Device-Modell nur berät, steht im
   Kopf der Komponente.
3. **Vorsichtige Sprache im Produkt.** Die Hinweise sagen „könnte Müll sein",
   nicht „Müll erkannt". Ein Modell hat keine Gewissheit, und die Oberfläche
   soll das nicht behaupten.
4. **Stichprobe statt Blindvertrauen.** Rund fünf Prozent der automatisch
   veröffentlichten Meldungen gehen zusätzlich in die menschliche Prüfung.
   Damit fällt systematisches Fehlverhalten des Modells auf.
5. **Kosten- und Kill-Switch-Bewusstsein.** Jeder Modellaufruf wird budgetiert
   und protokolliert; bei Ausfall gilt fail-safe, also keine Veröffentlichung.
6. **Nachlesen bei Änderungen.** Vor einem Modellwechsel werden die
   Modellkarte des Anbieters und die eigenen Prompts erneut geprüft, weil
   Formulierungen im Prompt das Ergebnis mitbestimmen.
7. **Einarbeitung neuer Mitwirkender** erfolgt über `AGENTS.md`, `docs/vision.md`
   und dieses Dokument, bevor jemand an der Pipeline arbeitet.

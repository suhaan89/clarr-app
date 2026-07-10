# Foto-Pipeline (Paket 5)

## Bucket-Modell

| Bucket | Sichtbarkeit | Schreiben | Lesen |
|---|---|---|---|
| `originals` | privat | Eigentuemer (nur eigener Ordner `{user_id}/…`) + Service | Eigentuemer + Service; fuer Anzeige nur **kurzlebige Signed URLs** |
| `public-blurred` | oeffentlich lesbar | **nur Service-Role** (process-photo) | alle |

Oeffentliche Anzeige laeuft **ausschliesslich** ueber `public-blurred`.
Originale sind nie oeffentlich erreichbar (Bucket privat, keine Public-URL).

## Ablauf (Edge Function `process-photo`)

1. Client laedt Originale in `originals/{user_id}/…` und ruft nach
   `submit-report` die Funktion `process-photo` auf (fire-and-forget —
   ohne Verarbeitung bleibt das Foto schlicht privat, fail-safe).
2. Pro unverarbeitetem Foto:
   * **EXIF/GPS strippen** — Re-Encode ueber ImageScript (dekodiert nur
     Pixel, der neue JPEG enthaelt keinerlei Metadaten).
   * **pHash** (dHash, 64 bit, hex) berechnen → `report_photos.phash`
     (Duplikat-Erkennung, Index vorhanden).
   * **Gesichter + Kennzeichen**: Vision-Modell liefert Regionen
     (budgetiert ueber `reserve_vision_budget`, gleicher Deckel/Kill-Switch
     wie analyze-photo); Regionen werden mit 15 % Polster **pixeliert**
     (Mosaik, unumkehrbar).
   * Ergebnis → `public-blurred/{report_id}/{photo_id}.jpg`,
     Metadaten (`exif_stripped`, `faces_blurred`, `plates_blurred`,
     `blurred_path`, `processed_at`) an der DB-Zeile.

## Pruefschritt vor Veroeffentlichung — Blurring ist fehlbar

Automatische Erkennung kann Gesichter/Kennzeichen **uebersehen**. Deshalb:

* Meldet das Modell Personen oder Kennzeichen → `approved` bleibt `FALSE`,
  das Foto geht in die manuelle Review (Paket 8), obwohl gepixelt wurde.
* Erkennung nicht moeglich (Budget/Kill-Switch/API-Fehler) → **keine
  Veroeffentlichung** (fail-safe, `approved = FALSE`).
* Nur Fotos ganz ohne erkannte Personen/Kennzeichen werden automatisch
  freigegeben.

Das ist eine technische Vorsichtsmassnahme, keine rechtliche Bewertung —
so auch im Code markiert.

## Vorher/Nachher

`report_photos.kind` (`before`/`after`) existiert seit Migration 002;
submit-report legt `before`-Fotos an, Nachher-Fotos kommen mit dem
Fallabschluss (Paket 7).

## Loeschung

`process-photo` mit `{ action: "delete", photo_id }` (nur Eigentuemer):
entfernt **Original + Derivat in public-blurred + DB-Zeile** und schreibt
einen Audit-Eintrag. Zeilen-Loeschung via Account-Loeschung (CASCADE) raeumt
die DB auf; **offen**: Storage-Objekte geloeschter Accounts brauchen einen
separaten Aufraeum-Job (in NOTIZEN.md vermerkt).

## Altbestand

Der alte oeffentliche Bucket `report-photos` wird von neuem Code nicht mehr
beschrieben. Bestehende Reports mit vollen URLs funktionieren weiter
(analyze-photo unterstuetzt beide Formate). Abschalten/Migrieren des alten
Buckets ist ein manueller Schritt (nicht additiv).

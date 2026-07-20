<!--
  Betreiber-Checkliste. Kein Rechtstext. Schritte, um die öffentlich
  erreichbaren Rechts-URLs + die Web-Löschroute bereitzustellen.
-->

# Hosting-Checkliste — öffentliche Rechts-URLs & Web-Löschroute

Beide Stores verlangen eine **öffentlich erreichbare Datenschutz-URL** (ohne
Login, ohne App). Google Play verlangt zusätzlich eine **Web-Löschroute**.

## 1. Was gehostet werden muss

| Inhalt | Quelle im Repo | Pflicht |
|---|---|---|
| Datenschutzerklärung (öffentlich) | `docs/legal/datenschutzerklaerung.md` | **Ja** (beide Stores) |
| Impressum (öffentlich) | `docs/legal/impressum.md` | Ja (DE, § 5 DDG) |
| Web-Löschroute | Option A/B unten | **Ja** (Google Play) |
| Support-Seite/-E-Mail | [anlegen] | Ja (Store-Metadaten) |
| ToS/EULA (optional öffentlich) | `docs/legal/tos-eula.md` | empfohlen |

## 2. Hosting-Optionen (eine wählen)

- **Statische Seite** (empfohlen, einfach): Markdown → HTML rendern und auf
  einem statischen Host (GitHub Pages / Cloudflare Pages / Netlify / eigene
  Domain) unter z. B. `https://clar.app/datenschutz` und `/impressum`
  bereitstellen. Kosten ~0, HTTPS inklusive.
- **In den Expo-Web-Build integrieren:** Die App hat bereits einen Web-Build
  (`web.output: "single"`, SPA). Die In-App-Screens `legal/datenschutz` und
  `legal/impressum` sind dann unter der Web-Domain erreichbar — die **öffentliche
  Datenschutz-URL kann direkt auf den gehosteten Web-Build zeigen**. Dann müssen
  In-App-Text und öffentlicher Text identisch/geprüft sein.

## 3. Web-Löschroute (Google Play)

- **Option A – Web-Self-Service (empfohlen):** Expo-Web-Build öffentlich hosten;
  die Profil-Seite dort bietet Login + „Konto löschen" (nutzt die geprüfte
  `delete-account`-Function). URL z. B. `https://app.clar.app/` (oder direkt zur
  Profil-Route). Im Play-Console-Formular **„Data deletion" → Web-URL** eintragen.
- **Option B – Löschformular/-Anfrage:** Statische Seite `…/konto-loeschen` mit
  Anleitung (Löschanfrage per E-Mail von der Registrierungs-Adresse; Frist +
  Identitätsprüfung gegen Fremd-Löschung). Manueller, aber einfachster Weg.

## 4. URLs überall eintragen (nach dem Hosten)

- [ ] **App Store Connect** → App Privacy → Privacy Policy URL.
- [ ] **Play Console** → Store-Eintrag → Datenschutzerklärung-URL.
- [ ] **Play Console** → App-Inhalte → Data deletion → Web-URL + „löschbar: ja".
- [ ] **Datenschutzerklärung** Abschnitt 9 → echte Lösch-URL einsetzen.
- [ ] **In-App** `datenschutz.tsx`/`impressum.tsx` → geprüften Text übernehmen
      und ggf. auf die öffentliche URL verweisen.
- [ ] **Store-Metadaten** → Support-URL + (optional) Marketing-URL.

## 5. Prüfen vor Einreichung

- [ ] Datenschutz-URL **ohne Login** erreichbar, gültiges HTTPS-Zertifikat.
- [ ] Enthält Verantwortlichen, Datenarten, Empfänger, Rechte, Löschung,
      Minderjährige, Kontakt (siehe datenschutzerklaerung.md).
- [ ] Web-Löschroute funktioniert / Anfrageprozess dokumentiert.

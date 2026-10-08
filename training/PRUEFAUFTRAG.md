# Prüfauftrag: Trainingsfotos durchsehen

Dieser Text ist der Auftrag an die Person oder den KI-Agenten, der die
Trainingsfotos für das CLAR-Modell prüft. Ablauf drumherum:
`review_sheets.py` baut die Bögen, `apply_review.py` übernimmt die
Entscheidungen (siehe README, Abschnitt „Fotos durchsehen“).

## Deine Rolle

Du prüfst als erfahrene Fachkraft für Trainingsdaten einen Bilddatensatz. Du
weißt: Ein Modell lernt genau das, was in den Daten steckt, auch die Fehler.
Ein falsch beschriftetes oder zweideutiges Foto schadet mehr, als ein
fehlendes Foto nützt. **Im Zweifel fliegt ein Foto raus.**

## Wofür die Fotos sind

CLAR ist eine App, mit der Menschen in Deutschland illegal abgelagerten Müll
melden: Müllsäcke im Wald, Sperrmüll am Feldweg, Bauschutt, Reifen,
verstreuter Verpackungsmüll auf Wegen, Wiesen, an Ufern. Ein kleines Modell
auf dem Handy schaut auf das Foto und sagt „könnte Müll sein“ oder „wir
erkennen hier keinen Müll“. Es sieht das Foto **mittig quadratisch
zugeschnitten und auf 224 × 224 Pixel verkleinert**. Die Kacheln auf den
Bögen zeigen genau diesen Ausschnitt.

Zwei Klassen:

- **positiv**: Auf dem Foto liegt Müll herum, wo er nicht hingehört, und man
  erkennt ihn auch in der Kachel deutlich.
- **negativ**: alles, was keine Meldung sein soll. Dazu gehören ausdrücklich
  ordentliche Mülltonnen, Container und Papierkörbe, auch volle.

## Was du prüfst

Für jede Kachel zwei Fragen:

1. **Stimmt die Klasse?** Würde ein vernünftiger Mensch dieses Foto in der App
   als wilde Müllablagerung melden (positiv) oder nicht (negativ)?
2. **Ist das Foto als Lernbeispiel riskant?** Überlege selbst, was das Modell
   aus diesem Foto Falsches lernen könnte. Typische Risiken, die Liste ist
   nicht vollständig:
   - Der Müll ist in der Kachel winzig oder kaum zu erkennen. Dann lernt das
     Modell „Sand“, „Asphalt“ oder „Laub“ als Müll.
   - Der Müll liegt außerhalb des Ausschnitts.
   - Zweideutig: Deponie, Wertstoffhof, Schrottplatz, Recyclinganlage,
     Baustelle mit gelagertem Material, Sperrmüll ordentlich am Straßenrand,
     Müllsäcke neben einer Tonne am Abholtag, überquellende Tonne.
   - Kein Müll, sondern Zerstörung: Ruinen, Trümmer nach Brand, Krieg, Sturm.
   - Müll nur als Nebensache: Markt, Fest, Demo, Innenraum, Unordnung im
     Zimmer.
   - Menschen stehen im Mittelpunkt oder sind nah und erkennbar. Das Modell
     soll nicht „Mensch“ mit einer Klasse verknüpfen, und erkennbare Personen
     gehören aus Datenschutzgründen nicht ins Trainingsmaterial. Kleine
     Passanten im Hintergrund sind in Ordnung.
   - Kein echtes Foto: Zeichnung, Plakat, Schild, Collage, Screenshot mit
     Müll-Motiv, starkes Wasserzeichen, Text über dem Bild. (Screenshots und
     Text **ohne** Müll sind als negativ erwünscht.)
   - Unzulässiger Inhalt: Gewalt, Nacktheit, tote Tiere, Verletzte.
   - Stark verfremdet: Schwarz-Weiß, Infrarot, extreme Filter, Luftbild aus
     großer Höhe, Unterwasser.
   - Nahezu dasselbe Foto mehrfach auf einem Bogen: eines behalten, die
     anderen raus.
   - In **negativ**: Es liegt doch Müll herum. Ist er deutlich, umsortieren;
     ist er nur am Rand oder klein, raus.

## Entscheidungen

| Entscheidung | Wann |
|---|---|
| `behalten` | Klasse stimmt, kein nennenswertes Risiko |
| `umsortieren` | Das Foto gehört eindeutig in die andere Klasse und wäre dort ein sauberes Beispiel |
| `raus` | zweideutig, riskant oder unbrauchbar |

Maßstab für **positiv**: Der Müll ist das Thema der Kachel. Ein einzelnes
Teil reicht, wenn es klar erkennbar ist und nicht winzig. Faustregel: Nimmt
der Müll weniger als etwa ein Zwanzigstel der Kachel ein und springt nicht
ins Auge, dann raus.

Maßstab für **negativ**: Großzügig behalten. Ein Foto muss nicht schön oder
passend zum Schlagwort sein, es darf nur keinen herumliegenden Müll zeigen
und kein Risiko von oben tragen. Ein Auto auf einem Foto mit dem Schlagwort
„waste-container“ ist ein völlig brauchbares Negativbeispiel.

Erkennst du auf einer Kachel etwas nicht sicher, öffne das Originalfoto. Der
Dateiname steht in `data/review/index.csv`, die Datei liegt unter
`data/manual/<datei>`. Bleibt es unklar: raus.

## Arbeitsweise

1. Du bekommst eine Liste von Bögen (z. B. `positiv-001` bis `positiv-040`).
   Sie liegen unter `data/review/boegen/<bogen>.jpg`. Der Name sagt, in
   welcher Klasse die Fotos **gerade** liegen.
2. Öffne jeden Bogen einzeln und sieh ihn dir wirklich an. Die Kacheln sind
   von links nach rechts, oben nach unten nummeriert; die Nummer steht in der
   linken oberen Ecke. Ein Bogen kann am Ende leere Kacheln haben.
3. Schreibe für **jede** belegte Kachel eine Zeile. Nicht schätzen, nicht
   hochrechnen, keine Bögen überspringen. Schaffst du nicht alle, höre
   sauber nach einem ganzen Bogen auf und nenne im Bericht, welche fehlen.
4. Schreibe das Ergebnis als CSV nach
   `data/review/entscheidungen/<name>.csv` (den Namen bekommst du genannt),
   UTF-8, mit Kopfzeile, Grund in Anführungszeichen, wenn er ein Komma
   enthält:

   ```csv
   bogen,kachel,entscheidung,grund
   positiv-001,1,behalten,
   positiv-001,2,raus,"Flasche winzig, vor allem Asphalt"
   positiv-001,3,umsortieren,saubere Wiese ohne Müll
   ```

   Bei `behalten` darf der Grund leer sein, bei `raus` und `umsortieren`
   gehört ein kurzer Grund dazu.
5. Verschiebe, lösche oder ändere **keine** Fotos und keine anderen Dateien.
   Du schreibst nur diese eine CSV-Datei. Schreibe sie zwischendurch
   mehrfach neu (z. B. alle zehn Bögen), damit bei einem Abbruch nichts
   verloren geht.

## Bericht am Ende

Kurz und in Stichpunkten: wie viele Bögen und Kacheln geprüft, wie viele je
Entscheidung, die drei häufigsten Gründe für „raus“, und Muster, die dir
aufgefallen sind und die über einzelne Fotos hinausgehen (z. B. „fast alle
Fotos einer Quelle zeigen X“ oder „in negativ fehlen Fotos von Y“). Solche
Hinweise sind für das nächste Training wertvoll.

#!/usr/bin/env node
/* global __dirname, Buffer */
/**
 * Einmaliges Setup der On-Device-Bilderkennung (siehe docs/vision-ondevice.md).
 *
 *     node scripts/fetch-vision-model.js
 *
 * Lädt EINMAL (online) das Basismodell MobileNet v1 (uint8-quantisiert, 224px)
 * samt ImageNet-Labels nach `assets/vision/` und schaltet die Erkennung frei,
 * indem es `assets/vision/model.assets.ts` auf die gebündelten Dateien zeigen
 * lässt. Danach läuft die Erkennung vollständig OFFLINE — kein Cloud-Call zur
 * Laufzeit, kein API-Key.
 *
 * Eigenes (z. B. müll-spezifisches) Modell einspielen:
 *     MODEL_URL=https://…/model.tflite LABELS_URL=https://…/labels.txt \
 *       node scripts/fetch-vision-model.js
 * oder die Dateien manuell nach assets/vision/ legen (model.tflite + labels.json).
 *
 * Bewusst ohne npm-Zusatzabhängigkeit: ZIP-Entpacken via eingebautem zlib.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const https = require('https');

const OUT_DIR = path.join(__dirname, '..', 'assets', 'vision');
const MODEL_OUT = path.join(OUT_DIR, 'model.tflite');
const LABELS_OUT = path.join(OUT_DIR, 'labels.json');
const MANIFEST = path.join(OUT_DIR, 'model.assets.ts');

// Standard-Basismodell: MobileNet v1 1.0 224 quant + Labels (ein ZIP).
const DEFAULT_ZIP =
  'https://storage.googleapis.com/download.tensorflow.org/models/tflite/mobilenet_v1_1.0_224_quant_and_labels.zip';
// Direktes Modell/Labels überschreiben den ZIP-Weg, falls gesetzt.
const MODEL_URL = process.env.MODEL_URL || null;
const LABELS_URL = process.env.LABELS_URL || null;

function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return get(res.headers.location).then(resolve, reject);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode} bei ${url}`));
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      })
      .on('error', reject);
  });
}

/**
 * Minimaler ZIP-Reader über das Central Directory (robust auch bei
 * Data-Descriptor-Einträgen). Liefert { name, data } je Datei.
 */
function unzip(buf) {
  // End Of Central Directory rückwärts suchen.
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('ZIP: End-Of-Central-Directory nicht gefunden.');

  const count = buf.readUInt16LE(eocd + 10);
  let ptr = buf.readUInt32LE(eocd + 16);
  const files = [];
  for (let i = 0; i < count && buf.readUInt32LE(ptr) === 0x02014b50; i++) {
    const method = buf.readUInt16LE(ptr + 10);
    const compSize = buf.readUInt32LE(ptr + 20);
    const nameLen = buf.readUInt16LE(ptr + 28);
    const extraLen = buf.readUInt16LE(ptr + 30);
    const commentLen = buf.readUInt16LE(ptr + 32);
    const localOff = buf.readUInt32LE(ptr + 42);
    const name = buf.toString('utf8', ptr + 46, ptr + 46 + nameLen);

    // Datenbeginn steht am lokalen Header (dessen name/extra-Längen können abweichen).
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const comp = buf.subarray(dataStart, dataStart + compSize);
    const data = method === 8 ? zlib.inflateRawSync(comp) : Buffer.from(comp);
    files.push({ name, data });

    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

/** Text-Labelliste (eine pro Zeile) → String-Array. */
function parseLabels(text) {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  let labels;
  if (MODEL_URL) {
    console.log(`Lade Modell: ${MODEL_URL}`);
    fs.writeFileSync(MODEL_OUT, await get(MODEL_URL));
    if (!LABELS_URL) throw new Error('Bei eigenem MODEL_URL bitte auch LABELS_URL setzen.');
    console.log(`Lade Labels: ${LABELS_URL}`);
    labels = parseLabels((await get(LABELS_URL)).toString('utf8'));
  } else {
    console.log(`Lade Basismodell (ZIP): ${DEFAULT_ZIP}`);
    const entries = unzip(await get(DEFAULT_ZIP));
    const model = entries.find((e) => e.name.endsWith('.tflite'));
    const labelFile = entries.find((e) => e.name.endsWith('.txt'));
    if (!model) throw new Error('Kein .tflite im ZIP gefunden.');
    fs.writeFileSync(MODEL_OUT, model.data);
    labels = labelFile ? parseLabels(labelFile.data.toString('utf8')) : null;
    if (!labels) {
      // Fallback: bekannte MobileNet-v1-quant-Labels (1001, inkl. „background").
      const url =
        'https://raw.githubusercontent.com/tensorflow/tensorflow/master/tensorflow/lite/java/demo/app/src/main/assets/labels_mobilenet_quant_v1_224.txt';
      console.log(`Labels aus ZIP fehlen, lade: ${url}`);
      labels = parseLabels((await get(url)).toString('utf8'));
    }
  }

  fs.writeFileSync(LABELS_OUT, JSON.stringify(labels));
  const modelKB = Math.round(fs.statSync(MODEL_OUT).size / 1024);
  console.log(`✓ model.tflite (${modelKB} KB), ${labels.length} Labels → assets/vision/`);

  fs.writeFileSync(
    MANIFEST,
    `/**
 * AUTOMATISCH von scripts/fetch-vision-model.js erzeugt.
 * Verweist auf das gebündelte On-Device-Modell und seine Labels.
 * Zum Zurücksetzen: Datei auf \`null\`-Exporte stellen (siehe git history).
 */

export const MODEL_ASSET: number | null = require('./model.tflite');
export const LABELS: string[] | null = require('./labels.json');
`
  );
  console.log('✓ assets/vision/model.assets.ts aktualisiert — Erkennung ist jetzt aktiv.');
  console.log('  Danach einen Dev-Build erstellen: npx expo run:android | run:ios');
}

main().catch((err) => {
  console.error('Fehler beim Modell-Setup:', err.message);
  process.exit(1);
});

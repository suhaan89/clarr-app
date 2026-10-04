// Gibt die Liste fuer src/app/legal/lizenzen.tsx aus: direkte Abhaengigkeiten
// aus package.json mit installierter Version und Lizenz.
//
//   node scripts/lizenzen.mjs
//
// Ausgabe in das Array DEPENDENCIES kopieren.
import { readFileSync } from 'node:fs';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const names = Object.keys(read('../package.json').dependencies).sort();

for (const name of names) {
  const pkg = read(`../node_modules/${name}/package.json`);
  const license = typeof pkg.license === 'string' ? pkg.license : (pkg.license?.type ?? 'UNBEKANNT');
  console.log(`  { name: '${name}', version: '${pkg.version}', license: '${license}' },`);
}

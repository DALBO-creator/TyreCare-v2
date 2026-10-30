// Soglia sulla dimensione del codice caricato all'avvio (T070).
// Legge dist/index.html, somma i file JS e CSS caricati subito (script module, modulepreload,
// stylesheet), li comprime con gzip e fallisce (exit 1) se superano la soglia.
// I chunk delle pagine e la libreria Excel (import dinamici) non sono caricati all'avvio: non contano.
// Unità: 1 kB = 1000 byte. Alzare la soglia SOLO con un motivo scritto nel messaggio di commit.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const SOGLIA_JS_KB = 70; // 2026-10-30: misurati 60,7 kB gzip + 15%, arrotondato al kB superiore
const SOGLIA_CSS_KB = 40; // 2026-10-30: limite fisso per il CSS (gzip, 1 kB = 1000 byte)

const dist = new URL('../dist/', import.meta.url);
const indice = new URL('index.html', dist);

function esci(messaggio) {
  console.error(`dimensioni: ${messaggio}`);
  process.exit(1);
}

if (!existsSync(indice)) esci(`${fileURLToPath(indice)} non trovato: eseguire prima "vite build".`);
const html = readFileSync(indice, 'utf8');

const attributo = (tag, nome) =>
  tag.match(new RegExp(`\\s${nome}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1];

const js = new Set();
const css = new Set();
for (const [tag] of html.matchAll(/<(?:script|link)\b[^>]*>/gi)) {
  const nomeTag = tag.slice(1).split(/[\s>]/)[0].toLowerCase();
  let percorso;
  let insieme;
  if (nomeTag === 'script' && attributo(tag, 'type') === 'module') {
    percorso = attributo(tag, 'src');
    insieme = js;
  } else if (nomeTag === 'link') {
    const rel = (attributo(tag, 'rel') ?? '').toLowerCase().split(/\s+/);
    if (rel.includes('modulepreload')) insieme = js;
    else if (rel.includes('stylesheet')) insieme = css;
    percorso = attributo(tag, 'href');
  }
  if (insieme && percorso) insieme.add(percorso.split(/[?#]/)[0].replace(/^\//, ''));
}

function gzipKb(percorsi) {
  let byte = 0;
  for (const p of percorsi) {
    const file = new URL(p, dist);
    if (!existsSync(file)) esci(`file elencato in index.html ma assente: ${fileURLToPath(file)}`);
    byte += gzipSync(readFileSync(file)).length;
  }
  return byte / 1000;
}

if (js.size === 0) esci('nessun file JS iniziale trovato in dist/index.html.');

const jsKb = gzipKb(js);
const cssKb = gzipKb(css);
const fmt = (n) => n.toFixed(1).replace('.', ',');
console.log(
  `Codice iniziale (gzip, 1 kB = 1000 byte): JS ${fmt(jsKb)} kB / soglia ${SOGLIA_JS_KB} kB · ` +
    `CSS ${fmt(cssKb)} kB / soglia ${SOGLIA_CSS_KB} kB (${js.size + css.size} file)`,
);

const errori = [];
if (jsKb > SOGLIA_JS_KB) errori.push(`JS ${fmt(jsKb)} kB supera ${SOGLIA_JS_KB} kB`);
if (cssKb > SOGLIA_CSS_KB) errori.push(`CSS ${fmt(cssKb)} kB supera ${SOGLIA_CSS_KB} kB`);
if (errori.length) {
  console.error(
    `dimensioni: codice iniziale troppo grande: ${errori.join('; ')}.\n` +
      'Prima cerca di ridurlo (import dinamici, pigra() in main.ts). Se la crescita è giustificata, ' +
      'alza la costante in apps/web/scripts/dimensioni.mjs scrivendo il motivo nel messaggio di commit.',
  );
  process.exit(1);
}

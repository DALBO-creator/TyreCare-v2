import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const robotsUrl = new URL('../public/robots.txt', import.meta.url);
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf-8');
const vite = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf-8');

const inPublic = (file: string) =>
  existsSync(new URL(`../public/${file.replace(/^\//, '')}`, import.meta.url));

/** Valore di un attributo dentro il primo tag che combacia con `tag`. */
function attributo(tag: RegExp, nome: string): string | undefined {
  const trovato = html.match(tag)?.[0];
  return trovato?.match(new RegExp(`${nome}="([^"]*)"`))?.[1];
}

describe('robots.txt', () => {
  it("esiste in public/ (altrimenti Vercel serve la pagina dell'app)", () => {
    expect(existsSync(robotsUrl)).toBe(true);
  });

  it("ammette tutti i crawler e non blocca l'intero sito", () => {
    const testo = readFileSync(robotsUrl, 'utf-8');
    expect(testo).toMatch(/^\s*User-agent:\s*\*\s*$/im);
    expect(testo).toMatch(/^\s*Allow:\s*\/\s*$/im);
    expect(testo).not.toMatch(/^\s*Disallow:\s*\/\s*$/im);
  });
});

describe('index.html: requisiti di base Lighthouse', () => {
  it("ha la lingua italiana sull'elemento html", () => {
    expect(html).toMatch(/<html[^>]*\slang="it"/);
  });

  it('ha un titolo non vuoto', () => {
    const titolo = html.match(/<title>([^<]+)<\/title>/)?.[1];
    expect(titolo?.trim()).toBeTruthy();
  });

  it('ha una descrizione non vuota', () => {
    const d = attributo(/<meta[^>]*name="description"[^>]*>/, 'content');
    expect(d?.trim()).toBeTruthy();
  });

  it('ha il theme-color', () => {
    const c = attributo(/<meta[^>]*name="theme-color"[^>]*>/, 'content');
    expect(c?.trim()).toBeTruthy();
  });

  it('ha il viewport per i telefoni', () => {
    const v = attributo(/<meta[^>]*name="viewport"[^>]*>/, 'content');
    expect(v).toContain('width=device-width');
  });

  it("ha l'apple-touch-icon e il file esiste in public/", () => {
    const href = attributo(/<link[^>]*rel="apple-touch-icon"[^>]*>/, 'href');
    expect(href).toBeTruthy();
    expect(inPublic(href!), href).toBe(true);
  });
});

describe('vite.config.ts: file della PWA', () => {
  it('ogni icona del manifest esiste in public/', () => {
    const icone = [...vite.matchAll(/src:\s*'([^']+\.png)'/g)].map((m) => m[1] ?? '');
    expect(icone.length).toBeGreaterThanOrEqual(3);
    for (const icona of icone) expect(inPublic(icona), icona).toBe(true);
  });

  it('ogni voce di includeAssets esiste in public/', () => {
    const elenco = vite.match(/includeAssets:\s*\[([^\]]*)\]/)?.[1] ?? '';
    const file = [...elenco.matchAll(/'([^']+)'/g)].map((m) => m[1] ?? '');
    expect(file.length).toBeGreaterThan(0);
    for (const f of file) expect(inPublic(f), f).toBe(true);
  });
});

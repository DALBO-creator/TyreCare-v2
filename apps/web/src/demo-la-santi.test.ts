import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Controllo automatico dello script della demo di LA SANTI GOMME: ogni `insert into public.<tabella>`
// deve usare solo colonne che esistono in `Insert` dei tipi generati, e coprire quelle obbligatorie.
// Così una migrazione che cambia lo schema fa fallire i controlli veloci, non il SQL Editor della demo.
const sqlUrl = new URL('../../../supabase/demo/la-santi-gomme.sql', import.meta.url);
const tipiUrl = new URL('../../../packages/shared/src/database.types.ts', import.meta.url);

interface InsertSql {
  tabella: string;
  colonne: string[];
}
interface ColonnaTipo {
  nome: string;
  obbligatoria: boolean;
}

/** Gli `insert into public.<tabella> (<colonne>)` dello script, senza commenti `--` (le liste vanno a capo). */
function leggiInsert(sql: string): InsertSql[] {
  const senzaCommenti = sql.replace(/--[^\n]*/g, '');
  const re = /insert\s+into\s+public\.(\w+)\s*\(([^)]*)\)/gi;
  return [...senzaCommenti.matchAll(re)].map((m) => ({
    tabella: m[1]!,
    colonne: m[2]!
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean),
  }));
}

/** Dal testo che inizia dopo una `{` aperta, il contenuto fino alla `}` che la chiude (graffe bilanciate). */
function bloccoBilanciato(testo: string, daDopoApertura: number): string {
  let profondita = 1;
  for (let i = daDopoApertura; i < testo.length; i++) {
    if (testo[i] === '{') profondita++;
    else if (testo[i] === '}' && --profondita === 0) return testo.slice(daDopoApertura, i);
  }
  throw new Error('Graffe non bilanciate in database.types.ts');
}

/** Le chiavi al primo livello di un blocco: `nome?: …` (facoltativa) o `nome: …` (obbligatoria). */
function chiaviPrimoLivello(blocco: string): ColonnaTipo[] {
  const colonne: ColonnaTipo[] = [];
  let profondita = 0;
  for (const riga of blocco.split('\n')) {
    if (profondita === 0) {
      const m = riga.match(/^\s*"?(\w+)"?(\?)?:/);
      if (m) colonne.push({ nome: m[1]!, obbligatoria: !m[2] });
    }
    for (const c of riga) {
      if (c === '{') profondita++;
      else if (c === '}') profondita--;
    }
  }
  return colonne;
}

/** Per ogni tabella di `public.Tables` le colonne di `Insert` (si ferma prima di `Views:`). */
function leggiTabelle(tipi: string): Map<string, ColonnaTipo[]> {
  const inizioPublic = tipi.indexOf('\n  public: {');
  const inizioTables = tipi.indexOf('Tables: {', inizioPublic);
  const tables = bloccoBilanciato(tipi, inizioTables + 'Tables: {'.length);
  const risultato = new Map<string, ColonnaTipo[]>();
  const reTabella = /^ {6}(\w+): \{$/gm;
  for (const m of tables.matchAll(reTabella)) {
    const corpo = bloccoBilanciato(tables, m.index! + m[0].length);
    const ins = corpo.match(/^ {8}Insert: \{$/m);
    if (ins) {
      const dopo = corpo.indexOf(ins[0]) + ins[0].length;
      risultato.set(m[1]!, chiaviPrimoLivello(bloccoBilanciato(corpo, dopo)));
    }
  }
  return risultato;
}

describe('script demo LA SANTI GOMME: colonne coerenti con lo schema', () => {
  it('trova lo script e i tipi del database', () => {
    expect(existsSync(sqlUrl)).toBe(true);
    expect(existsSync(tipiUrl)).toBe(true);
  });

  const inserts = existsSync(sqlUrl) ? leggiInsert(readFileSync(sqlUrl, 'utf-8')) : [];
  const tabelle = existsSync(tipiUrl)
    ? leggiTabelle(readFileSync(tipiUrl, 'utf-8'))
    : new Map<string, ColonnaTipo[]>();

  it('il parsing non passa a vuoto: almeno 10 insert e tabelle dei tipi lette', () => {
    expect(inserts.length).toBeGreaterThanOrEqual(10);
    expect(tabelle.size).toBeGreaterThanOrEqual(10);
    const pren = tabelle.get('prenotazioni');
    expect(pren?.map((c) => c.nome)).toContain('officina_id');
    expect(pren?.find((c) => c.nome === 'officina_id')?.obbligatoria).toBe(true);
  });

  it('ogni tabella usata esiste in Tables', () => {
    const sconosciute = [...new Set(inserts.map((i) => i.tabella))].filter((t) => !tabelle.has(t));
    expect(sconosciute, 'tabelle non presenti in database.types.ts').toEqual([]);
  });

  it('ogni colonna scritta esiste in Insert', () => {
    const sconosciute: string[] = [];
    for (const { tabella, colonne } of inserts) {
      const note = new Set((tabelle.get(tabella) ?? []).map((c) => c.nome));
      for (const c of colonne) if (!note.has(c)) sconosciute.push(`${tabella}.${c}`);
    }
    expect(sconosciute, 'tabella.colonna non in Insert').toEqual([]);
  });

  it('le colonne obbligatorie di Insert compaiono in almeno un insert della tabella', () => {
    const mancanti: string[] = [];
    for (const tabella of new Set(inserts.map((i) => i.tabella))) {
      const scritte = new Set(
        inserts.filter((i) => i.tabella === tabella).flatMap((i) => i.colonne),
      );
      for (const c of tabelle.get(tabella) ?? [])
        if (c.obbligatoria && !scritte.has(c.nome)) mancanti.push(`${tabella}.${c.nome}`);
    }
    expect(mancanti, 'tabella.colonna obbligatoria mai scritta').toEqual([]);
  });
});

import { type ErroreImport, type Tabella } from './importa';
import { normalizzaTarga, oggiISO } from './officina';
import {
  PosizioneSchema,
  StagioneSchema,
  UsuraSchema,
  type Posizione,
  type Stagione,
  type Usura,
} from './pneumatici';

// Import dei controlli dal gestionale (T023, parte 2): lettura e controllo del file nel browser.
//
// Una riga del file = la misura di una ruota in un controllo. Più righe con lo stesso
// `codice_documento` sono le ruote dello stesso controllo (stessa targa e stessa data). Le righe
// valide hanno il formato della funzione SQL `importa_controlli` (T043), che rifiuta in blocco
// tutto l'import se una riga viola i vincoli del database: per questo ogni riga che li violerebbe
// finisce in `errori` e mai in `righe`.

/** Colonne del formato, nell'ordine dell'esportazione dei controlli. */
export const COLONNE_CONTROLLI = [
  'codice_documento',
  'targa',
  'data',
  'km',
  'posizione',
  'battistrada_mm',
  'pressione_bar',
  'usura',
  'danni',
  'stagione',
  'misura',
  'marca',
  'modello',
  'dot',
  'note',
] as const;
export type ColonnaControlli = (typeof COLONNE_CONTROLLI)[number];

/** Colonna di TyreCare → intestazione del file (testo esatto come nel file). */
export type MappaturaControlli = Partial<Record<ColonnaControlli, string>>;

/** Nomi delle colonne come li vede l'utente. */
export const ETICHETTE_COLONNE_CONTROLLI: Record<ColonnaControlli, string> = {
  codice_documento: 'Codice documento',
  targa: 'Targa',
  data: 'Data',
  km: 'Chilometri',
  posizione: 'Posizione',
  battistrada_mm: 'Battistrada (mm)',
  pressione_bar: 'Pressione (bar)',
  usura: 'Usura',
  danni: 'Danni',
  stagione: 'Stagione',
  misura: 'Misura',
  marca: 'Marca',
  modello: 'Modello',
  dot: 'DOT',
  note: 'Note',
};

/** Colonne senza le quali il file non si può importare. */
export const COLONNE_OBBLIGATORIE_CONTROLLI: readonly ColonnaControlli[] = [
  'codice_documento',
  'targa',
  'data',
  'posizione',
  'battistrada_mm',
];

/** Righe al massimo in un file. */
export const MAX_RIGHE_CONTROLLI = 5000;

// scelta A (R1); true = scelta B: solo l'ultimo controllo di ogni veicolo
export const IMPORT_CONTROLLI_SOLO_ULTIMO = false;

// Altri nomi con cui i gestionali chiamano le stesse colonne (già in forma normalizzata)
const SINONIMI: Record<string, ColonnaControlli> = {
  documento: 'codice_documento',
  n_documento: 'codice_documento',
  numero_documento: 'codice_documento',
  data_controllo: 'data',
  data_intervento: 'data',
  chilometri: 'km',
  pos: 'posizione',
  ruota: 'posizione',
  battistrada: 'battistrada_mm',
  profondita: 'battistrada_mm',
  mm: 'battistrada_mm',
  pressione: 'pressione_bar',
  bar: 'pressione_bar',
};

/** Nome di colonna confrontabile: "Data controllo" → "data_controllo". (Copia di quella di importa.ts.) */
function nomeColonna(intestazione: string): string {
  return intestazione
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

/** Associa le colonne alle intestazioni riconosciute (nome standard o sinonimo): vince la prima. */
export function mappaturaAutomaticaControlli(intestazioni: string[]): MappaturaControlli {
  const m: MappaturaControlli = {};
  for (const h of intestazioni) {
    const n = nomeColonna(h);
    const colonna = (COLONNE_CONTROLLI as readonly string[]).includes(n)
      ? (n as ColonnaControlli)
      : SINONIMI[n];
    if (colonna && m[colonna] === undefined) m[colonna] = h;
  }
  return m;
}

/**
 * Problemi di una mappatura: intestazione usata per due colonne, intestazione che nel file non c'è,
 * colonna obbligatoria non associata.
 */
export function erroriMappaturaControlli(m: MappaturaControlli, intestazioni: string[]): string[] {
  const errori: string[] = [];
  const usate = new Map<string, number>();
  for (const h of Object.values(m)) usate.set(h, (usate.get(h) ?? 0) + 1);
  for (const [h, volte] of usate) {
    if (volte > 1) errori.push(`La colonna «${h}» del file è associata due volte.`);
  }
  for (const colonna of COLONNE_CONTROLLI) {
    const h = m[colonna];
    if (h !== undefined && !intestazioni.includes(h)) {
      errori.push(
        `La colonna «${h}», associata a «${ETICHETTE_COLONNE_CONTROLLI[colonna]}», non esiste nel file.`,
      );
    }
  }
  for (const colonna of COLONNE_OBBLIGATORIE_CONTROLLI) {
    if (m[colonna] === undefined) {
      errori.push(`Manca la colonna «${ETICHETTE_COLONNE_CONTROLLI[colonna]}».`);
    }
  }
  return errori;
}

/** Riga valida, nel formato della funzione SQL `importa_controlli`, più la riga nel file. */
export interface RigaControlloImport {
  /** Riga del file. */
  numero: number;
  codice_documento: string;
  targa: string;
  /** `AAAA-MM-GG` */
  data: string;
  km: number | null;
  posizione: Posizione;
  battistrada_mm: number;
  pressione_bar: number | null;
  usura: Usura | null;
  danni: string;
  stagione: Stagione | null;
  misura: string;
  marca: string;
  modello: string;
  dot: string | null;
  note: string;
}

export type EsitoControlliImport =
  | { ok: false; messaggio: string }
  | {
      ok: true;
      righe: RigaControlloImport[];
      errori: ErroreImport[];
      /** Righe di dati nel file (valide, con errori, vuote). */
      lette: number;
      /** Righe vuote saltate e righe tolte da `soloUltimo`. */
      ignorate: number;
    };

// ---------------------------------------------------------------------------------------------------
// Singoli campi: ognuno restituisce il valore o un messaggio d'errore
// ---------------------------------------------------------------------------------------------------
type Letto<T> = { v: T } | { e: string };

const ANNO_MINIMO = 1900;

/** Data `AAAA-MM-GG` se esiste davvero (31/02 no), ricostruendola con `Date.UTC`. */
function dataIso(anno: number, mese: number, giorno: number): string | null {
  const d = new Date(Date.UTC(anno, mese - 1, giorno));
  if (
    anno < ANNO_MINIMO ||
    d.getUTCFullYear() !== anno ||
    d.getUTCMonth() !== mese - 1 ||
    d.getUTCDate() !== giorno
  ) {
    return null;
  }
  const mm = String(mese).padStart(2, '0');
  const gg = String(giorno).padStart(2, '0');
  return `${String(anno).padStart(4, '0')}-${mm}-${gg}`;
}

/**
 * Data in `AAAA-MM-GG` da: `AAAA-MM-GG`, `GG/MM/AAAA`, `GG-MM-AAAA`, `GG.MM.AAAA` (giorno e mese anche
 * di una cifra) o numero seriale di Excel (giorni dal 1899-12-30, l'epoca di Excel con il suo errore
 * sul 1900; intero tra 1 e 99999). Conti in UTC: il fuso orario non sposta il giorno.
 */
function leggiData(testo: string, oggi: string): Letto<string> {
  let iso: string | null = null;
  let m: RegExpMatchArray | null;
  if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(testo))) {
    iso = dataIso(+m[1]!, +m[2]!, +m[3]!);
  } else if ((m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(testo))) {
    iso = dataIso(+m[3]!, +m[2]!, +m[1]!);
  } else if (/^\d{1,5}$/.test(testo) && +testo >= 1) {
    const d = new Date(Date.UTC(1899, 11, 30) + +testo * 86_400_000);
    iso = dataIso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  if (iso === null) {
    return { e: `La data «${testo}» non è valida: scrivila come 25/10/2026 o 2026-10-25.` };
  }
  if (iso > oggi) return { e: 'La data è nel futuro.' };
  return { v: iso };
}

/** Numero con la virgola o il punto decimale ("4,5" → 4.5); `null` se non è un numero. */
function numero(testo: string): number | null {
  const t = testo.replace(',', '.');
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : null;
}

const unDecimale = (n: number) => Math.round(n * 10) / 10;

/** Chiave di confronto per i valori a elenco: senza accenti, maiuscole, spazi, `_` e `-`. */
function chiave(testo: string): string {
  return testo
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9]+/g, '');
}

const POSIZIONI: Record<string, Posizione> = {
  ANTSX: 'ANT_SX',
  AS: 'ANT_SX',
  ANTERIORESINISTRA: 'ANT_SX',
  ANTDX: 'ANT_DX',
  AD: 'ANT_DX',
  ANTERIOREDESTRA: 'ANT_DX',
  POSTSX: 'POST_SX',
  PS: 'POST_SX',
  POSTERIORESINISTRA: 'POST_SX',
  POSTDX: 'POST_DX',
  PD: 'POST_DX',
  POSTERIOREDESTRA: 'POST_DX',
  SCORTA: 'SCORTA',
  SC: 'SCORTA',
  RUOTADISCORTA: 'SCORTA',
};

const STAGIONI: Record<string, Stagione> = {
  ESTIVO: 'ESTIVO',
  ESTIVE: 'ESTIVO',
  E: 'ESTIVO',
  SUMMER: 'ESTIVO',
  INVERNALE: 'INVERNALE',
  INVERNALI: 'INVERNALE',
  I: 'INVERNALE',
  WINTER: 'INVERNALE',
  QUATTROSTAGIONI: 'QUATTRO_STAGIONI',
  '4STAGIONI': 'QUATTRO_STAGIONI',
  '4S': 'QUATTRO_STAGIONI',
  ALLSEASON: 'QUATTRO_STAGIONI',
  ALLSEASONS: 'QUATTRO_STAGIONI',
};

/** Stesso vincolo del database: settimana 01–53 e anno a due cifre. */
const DOT = /^(0[1-9]|[1-4][0-9]|5[0-3])[0-9]{2}$/;

const LIMITI_TESTO: [ColonnaControlli, number][] = [
  ['danni', 500],
  ['note', 2000],
  ['misura', 40],
  ['marca', 50],
  ['modello', 100],
];

// ---------------------------------------------------------------------------------------------------
// Controllo della tabella
// ---------------------------------------------------------------------------------------------------

/**
 * Controlla le righe di una tabella secondo la mappatura data. Un problema del file intero (mappatura
 * sbagliata, nessuna riga, troppe righe) dà `ok: false`; altrimenti le righe valide e, a parte, gli
 * errori delle altre (una riga con errori non finisce mai in `righe`).
 *
 * - `oggi` (`AAAA-MM-GG`): le date dopo `oggi` sono un errore.
 * - `soloUltimo`: per ogni targa resta solo il documento più recente; a parità di data vince il
 *   codice documento maggiore (confronto tra testi). Le righe tolte contano in `ignorate`.
 * - le righe del tutto vuote si saltano e contano in `ignorate`.
 */
export function controllaTabellaControlli(
  t: Tabella,
  m: MappaturaControlli,
  opzioni: { oggi?: string; soloUltimo?: boolean } = {},
): EsitoControlliImport {
  const oggi = opzioni.oggi ?? oggiISO();
  const soloUltimo = opzioni.soloUltimo ?? IMPORT_CONTROLLI_SOLO_ULTIMO;

  const errMappatura = erroriMappaturaControlli(m, t.intestazioni);
  if (errMappatura.length > 0) return { ok: false, messaggio: errMappatura.join(' ') };

  const dati = t.righe;
  if (dati.length === 0) return { ok: false, messaggio: 'Il file non ha righe di dati.' };
  if (dati.length > MAX_RIGHE_CONTROLLI) {
    return {
      ok: false,
      messaggio: `Il file ha ${dati.length} righe: al massimo ${MAX_RIGHE_CONTROLLI} per volta. Dividilo in più file.`,
    };
  }

  const indici = new Map<ColonnaControlli, number>();
  for (const colonna of COLONNE_CONTROLLI) {
    const h = m[colonna];
    if (h !== undefined) indici.set(colonna, t.intestazioni.indexOf(h));
  }

  let righe: RigaControlloImport[] = [];
  const errori: ErroreImport[] = [];
  let ignorate = 0;
  // Per ogni documento: targa e data della prima riga leggibile e posizioni già usate
  const documenti = new Map<
    string,
    { numero: number; targa: string; data: string; posizioni: Set<Posizione> }
  >();

  for (const { numero: n, celle } of dati) {
    if (celle.every((c) => c.trim() === '')) {
      ignorate++;
      continue;
    }
    if (celle.length > t.intestazioni.length) {
      errori.push({
        numero: n,
        messaggio:
          "La riga ha più colonne dell'intestazione: forse un testo contiene il separatore senza virgolette.",
      });
      continue;
    }
    const v = (c: ColonnaControlli) => {
      const i = indici.get(c);
      return i === undefined ? '' : (celle[i] ?? '').trim();
    };
    const messaggi: string[] = [];
    const richiesto = (c: ColonnaControlli) => {
      if (v(c) !== '') return true;
      messaggi.push(`Manca ${ETICHETTE_COLONNE_CONTROLLI[c].toLowerCase()}.`);
      return false;
    };

    const documento = v('codice_documento');
    if (richiesto('codice_documento') && documento.length > 50) {
      messaggi.push('Il codice documento può avere al massimo 50 caratteri.');
    }

    const targa = normalizzaTarga(v('targa'));
    let targaOk = false;
    if (richiesto('targa')) {
      if (/^[A-Z0-9]{2,10}$/.test(targa)) targaOk = true;
      else messaggi.push('La targa ha da 2 a 10 lettere e cifre.');
    }

    let data: string | null = null;
    if (richiesto('data')) {
      const r = leggiData(v('data'), oggi);
      if ('v' in r) data = r.v;
      else messaggi.push(r.e);
    }

    let km: number | null = null;
    if (v('km') !== '') {
      // Punto o spazio come separatore delle migliaia ("45.000"); niente decimali
      if (/^\d{1,3}([. ]\d{3})+$|^\d+$/.test(v('km'))) {
        km = Number(v('km').replace(/[. ]/g, ''));
        if (km > 2_000_000) {
          messaggi.push('I chilometri non possono superare 2.000.000.');
          km = null;
        }
      } else {
        messaggi.push('I chilometri devono essere un numero intero.');
      }
    }

    let posizione: Posizione | null = null;
    if (richiesto('posizione')) {
      const p = POSIZIONI[chiave(v('posizione'))];
      if (p && PosizioneSchema.safeParse(p).success) posizione = p;
      else {
        messaggi.push(
          `La posizione «${v('posizione')}» non è valida: usa anteriore/posteriore sinistra/destra o scorta (es. ANT_SX, PD, SCORTA).`,
        );
      }
    }

    let battistrada: number | null = null;
    if (richiesto('battistrada_mm')) {
      const n1 = numero(v('battistrada_mm'));
      if (n1 === null) messaggi.push('Il battistrada deve essere un numero (es. 4,5).');
      else if (unDecimale(n1) > 20) messaggi.push('Il battistrada va da 0 a 20 mm.');
      else battistrada = unDecimale(n1);
    }

    let pressione: number | null = null;
    if (v('pressione_bar') !== '') {
      const n1 = numero(v('pressione_bar'));
      if (n1 === null) messaggi.push('La pressione deve essere un numero (es. 2,2).');
      else if (unDecimale(n1) > 9.9) messaggi.push('La pressione va da 0 a 9,9 bar.');
      else pressione = unDecimale(n1);
    }

    let usura: Usura | null = null;
    if (v('usura') !== '') {
      const r = UsuraSchema.safeParse(chiave(v('usura')));
      if (r.success) usura = r.data;
      else {
        messaggi.push(
          `L'usura «${v('usura')}» non è valida: usa regolare, interna, esterna, centrale o bordi.`,
        );
      }
    }

    let stagione: Stagione | null = null;
    if (v('stagione') !== '') {
      const s = STAGIONI[chiave(v('stagione'))];
      if (s && StagioneSchema.safeParse(s).success) stagione = s;
      else {
        messaggi.push(
          `La stagione «${v('stagione')}» non è valida: usa estivo, invernale o quattro stagioni.`,
        );
      }
    }

    for (const [c, max] of LIMITI_TESTO) {
      if (v(c).length > max) {
        messaggi.push(
          `${ETICHETTE_COLONNE_CONTROLLI[c]}: al massimo ${max} caratteri (ce ne sono ${v(c).length}).`,
        );
      }
    }

    const dot = v('dot') === '' ? null : v('dot');
    if (dot !== null && !DOT.test(dot)) {
      messaggi.push('Il DOT deve avere 4 cifre: settimana (01-53) e anno, es. 2321.');
    }

    // Coerenza del documento: stessa targa e stessa data in tutte le sue righe, ogni posizione una volta
    if (documento !== '' && documento.length <= 50) {
      const d = documenti.get(documento);
      if (d && targaOk && data !== null) {
        if (targa !== d.targa) {
          messaggi.push(
            `Il documento ${documento} ha una targa diversa da quella della riga ${d.numero}.`,
          );
        } else if (data !== d.data) {
          messaggi.push(
            `Il documento ${documento} ha una data diversa da quella della riga ${d.numero}.`,
          );
        } else if (posizione !== null && d.posizioni.has(posizione)) {
          messaggi.push(`La posizione è ripetuta nel documento ${documento}.`);
        }
      } else if (!d && targaOk && data !== null) {
        documenti.set(documento, { numero: n, targa, data, posizioni: new Set() });
      }
    }

    if (messaggi.length > 0) {
      for (const msg of new Set(messaggi)) errori.push({ numero: n, messaggio: msg });
      continue;
    }
    documenti.get(documento)!.posizioni.add(posizione!);
    righe.push({
      numero: n,
      codice_documento: documento,
      targa,
      data: data!,
      km,
      posizione: posizione!,
      battistrada_mm: battistrada!,
      pressione_bar: pressione,
      usura,
      danni: v('danni'),
      stagione,
      misura: v('misura'),
      marca: v('marca'),
      modello: v('modello'),
      dot,
      note: v('note'),
    });
  }

  if (soloUltimo) {
    // Per ogni targa il documento più recente (a parità di data, il codice maggiore)
    const ultimo = new Map<string, { data: string; documento: string }>();
    for (const r of righe) {
      const u = ultimo.get(r.targa);
      if (!u || r.data > u.data || (r.data === u.data && r.codice_documento > u.documento)) {
        ultimo.set(r.targa, { data: r.data, documento: r.codice_documento });
      }
    }
    const prima = righe.length;
    righe = righe.filter((r) => ultimo.get(r.targa)!.documento === r.codice_documento);
    ignorate += prima - righe.length;
  }

  return { ok: true, righe, errori, lette: dati.length, ignorate };
}

/** Modello del file da scaricare: intestazione e una riga d'esempio, separate da punto e virgola. */
export function modelloCsvControlli(): string {
  return [
    COLONNE_CONTROLLI.join(';'),
    'D0001;AB123CD;25/10/2026;45000;ANT_SX;4,5;2,2;REGOLARE;;INVERNALE;205/55 R16;Pirelli;Cinturato;2321;',
  ].join('\r\n');
}

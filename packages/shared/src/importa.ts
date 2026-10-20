import { ClienteSchema, VeicoloSchema } from './officina';

// Import dal gestionale (PLAN P8): formato CSV standard di TyreCare per clienti e veicoli.
//
// Il file si legge e si controlla nel browser con queste funzioni; le righe valide vanno poi alla
// funzione SQL `importa_clienti_veicoli`, che le scrive in una sola transazione. Gli adattatori dei
// gestionali (es. GESTITYRE `.xls`) dovranno produrre le stesse colonne.
//
// Una riga = un veicolo con il suo cliente. Le colonne del cliente sono facoltative (veicolo senza
// cliente), la targa anche (cliente senza veicoli), ma serve almeno una delle due chiavi:
// - `codice_cliente`, il codice del cliente nel gestionale → `clienti_officina.codice_gestionale`;
// - `targa` → `veicoli.targa` (unica per officina).
// Reimportare lo stesso file non crea doppioni: le chiavi ritrovano i record già presenti.

/** Colonne del formato standard, nell'ordine del modello da scaricare. */
export const COLONNE_IMPORT = [
  'codice_cliente',
  'nome',
  'cognome',
  'ragione_sociale',
  'telefono',
  'email',
  'targa',
  'marca',
  'modello',
  'anno',
  'telaio',
] as const;
export type ColonnaImport = (typeof COLONNE_IMPORT)[number];

/** Righe al massimo in un file (stesso limite della funzione SQL). */
export const MAX_RIGHE_IMPORT = 5000;

// Altri nomi con cui i gestionali chiamano le stesse colonne (già in forma normalizzata)
const SINONIMI: Record<string, ColonnaImport> = {
  codice: 'codice_cliente',
  cod_cliente: 'codice_cliente',
  codice_gestionale: 'codice_cliente',
  cellulare: 'telefono',
  tel: 'telefono',
  e_mail: 'email',
  mail: 'email',
  vin: 'telaio',
  anno_immatricolazione: 'anno',
};

/** Nome di colonna confrontabile: "Ragione Sociale" → "ragione_sociale", "E-mail" → "e_mail". */
function nomeColonna(intestazione: string): string {
  return intestazione
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

// ---------------------------------------------------------------------------------------------------
// Lettura del CSV
// ---------------------------------------------------------------------------------------------------

/**
 * Separatore del file, dalla riga d'intestazione: Excel in italiano salva con il punto e virgola,
 * altri programmi con la virgola o il tabulatore. Vince il più frequente fuori dalle virgolette.
 */
export function separatoreCsv(testo: string): string {
  const conteggi = new Map([
    [';', 0],
    [',', 0],
    ['\t', 0],
  ]);
  let tra = false;
  for (const c of testo) {
    if (c === '"') tra = !tra;
    else if (!tra && (c === '\n' || c === '\r')) break;
    else if (!tra && conteggi.has(c)) conteggi.set(c, conteggi.get(c)! + 1);
  }
  return [...conteggi].reduce((a, b) => (b[1] > a[1] ? b : a))[0];
}

/**
 * Legge un CSV (RFC 4180): campi tra virgolette con separatori, a capo e `""` per le virgolette.
 * Restituisce le righe con il loro numero nel file (1 = intestazione); le righe vuote sono saltate.
 */
export function leggiCsv(testo: string): { numero: number; celle: string[] }[] {
  const t = testo.replace(/^\uFEFF/, '');
  const sep = separatoreCsv(t);
  const righe: { numero: number; celle: string[] }[] = [];
  let celle: string[] = [];
  let cella = '';
  let tra = false;
  let numero = 1;
  let inizio = 1;

  const chiudiRiga = () => {
    celle.push(cella);
    if (celle.some((c) => c.trim() !== '')) righe.push({ numero: inizio, celle });
    celle = [];
    cella = '';
  };

  for (let i = 0; i < t.length; i++) {
    const c = t[i]!;
    if (tra) {
      if (c === '"' && t[i + 1] === '"') {
        cella += '"';
        i++;
      } else if (c === '"') {
        tra = false;
      } else {
        if (c === '\n') numero++;
        cella += c;
      }
    } else if (c === '"') {
      tra = true;
    } else if (c === sep) {
      celle.push(cella);
      cella = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      chiudiRiga();
      numero++;
      inizio = numero;
    } else {
      cella += c;
    }
  }
  if (cella !== '' || celle.length > 0) chiudiRiga();
  return righe;
}

// ---------------------------------------------------------------------------------------------------
// Controllo delle righe
// ---------------------------------------------------------------------------------------------------

/** Cliente di una riga, con i nomi delle colonne di `clienti_officina`. */
export interface ClienteImport {
  codice_gestionale: string;
  nome: string;
  cognome: string;
  ragione_sociale: string | null;
  telefono: string | null;
  email: string | null;
}

export interface VeicoloImport {
  targa: string;
  marca: string;
  modello: string;
  anno: number | null;
  telaio: string | null;
}

/** Riga valida, pronta per la funzione SQL. `numero` è la riga nel file (per i messaggi). */
export interface RigaImport {
  numero: number;
  cliente: ClienteImport | null;
  veicolo: VeicoloImport | null;
}

export interface ErroreImport {
  numero: number;
  messaggio: string;
}

export type EsitoControllo =
  | { ok: false; messaggio: string }
  | {
      ok: true;
      righe: RigaImport[];
      errori: ErroreImport[];
      /** Righe di dati nel file (valide e no). */
      lette: number;
      /** Intestazioni non riconosciute: ignorate. */
      ignorate: string[];
    };

/** File letto: la riga d'intestazione e le righe di dati, ciascuna con il suo numero nel file. */
export interface Tabella {
  /** Intestazioni come scritte nel file (anche vuote). */
  intestazioni: string[];
  /** Righe di dati; `numero` è la riga nel file (l'intestazione ha il suo `numero`, di solito 1). */
  righe: { numero: number; celle: string[] }[];
}

/** Legge un CSV come tabella: la prima riga è l'intestazione. `null` se il file è vuoto. */
export function tabellaDaCsv(testo: string): Tabella | null {
  const [intestazione, ...righe] = leggiCsv(testo);
  if (!intestazione) return null;
  return { intestazioni: intestazione.celle, righe };
}

/** Colonna di TyreCare → intestazione del file (testo esatto come nel file). */
export type Mappatura = Partial<Record<ColonnaImport, string>>;

/** Nomi delle colonne come li vede l'utente. */
export const ETICHETTE_COLONNE_IMPORT: Record<ColonnaImport, string> = {
  codice_cliente: 'Codice cliente',
  nome: 'Nome',
  cognome: 'Cognome',
  ragione_sociale: 'Ragione sociale',
  telefono: 'Telefono',
  email: 'Email',
  targa: 'Targa',
  marca: 'Marca',
  modello: 'Modello',
  anno: 'Anno',
  telaio: 'Telaio',
};

/**
 * Associa le colonne di TyreCare alle intestazioni riconosciute (nome standard o sinonimo).
 * Se più intestazioni corrispondono alla stessa colonna vince la prima.
 */
export function mappaturaAutomatica(intestazioni: string[]): Mappatura {
  const m: Mappatura = {};
  for (const h of intestazioni) {
    const n = nomeColonna(h);
    const colonna = (COLONNE_IMPORT as readonly string[]).includes(n)
      ? (n as ColonnaImport)
      : SINONIMI[n];
    if (colonna && m[colonna] === undefined) m[colonna] = h;
  }
  return m;
}

/**
 * Problemi di una mappatura rispetto alle intestazioni del file: intestazione usata per due
 * colonne, intestazione che nel file non c'è, mancano sia la targa sia il codice cliente.
 */
export function erroriMappatura(m: Mappatura, intestazioni: string[]): string[] {
  const errori: string[] = [];
  const usate = new Map<string, number>();
  for (const h of Object.values(m)) usate.set(h, (usate.get(h) ?? 0) + 1);
  for (const [h, volte] of usate) {
    if (volte > 1) errori.push(`La colonna «${h}» del file è associata due volte.`);
  }
  for (const colonna of COLONNE_IMPORT) {
    const h = m[colonna];
    if (h !== undefined && !intestazioni.includes(h)) {
      errori.push(
        `La colonna «${h}», associata a «${ETICHETTE_COLONNE_IMPORT[colonna]}», non esiste nel file.`,
      );
    }
  }
  if (m.targa === undefined && m.codice_cliente === undefined) {
    errori.push('Associa almeno la colonna della targa o del codice cliente.');
  }
  return errori;
}

/**
 * Ritrova una mappatura salvata nel file: `null` se anche una sola delle sue intestazioni manca.
 * Il confronto ignora maiuscole, accenti e punteggiatura; restituisce l'intestazione come scritta
 * nel file.
 */
export function applicaMappatura(salvata: Mappatura, intestazioni: string[]): Mappatura | null {
  const m: Mappatura = {};
  for (const colonna of COLONNE_IMPORT) {
    const h = salvata[colonna];
    if (h === undefined) continue;
    const n = nomeColonna(h);
    const trovata = intestazioni.find((x) => nomeColonna(x) === n);
    if (trovata === undefined) return null;
    m[colonna] = trovata;
  }
  return m;
}

/**
 * Controlla un CSV nel formato standard. Un problema del file intero (es. manca la colonna della
 * targa) dà `ok: false`; altrimenti le righe valide e, a parte, gli errori delle altre.
 */
export function controllaImport(testo: string): EsitoControllo {
  const tabella = tabellaDaCsv(testo);
  if (!tabella) return { ok: false, messaggio: 'Il file è vuoto.' };
  const mappatura = mappaturaAutomatica(tabella.intestazioni);
  if (!mappatura.targa && !mappatura.codice_cliente) {
    return {
      ok: false,
      messaggio:
        'Nella prima riga non troviamo le colonne "targa" o "codice_cliente": controlla di aver ' +
        'scelto il file giusto, oppure parti dal modello.',
    };
  }
  return controllaTabella(tabella, mappatura);
}

/**
 * Controlla le righe di una tabella secondo la mappatura data (automatica o scelta a mano).
 * `ignorate` = intestazioni non vuote che la mappatura non usa.
 */
export function controllaTabella(t: Tabella, m: Mappatura): EsitoControllo {
  const errMappatura = erroriMappatura(m, t.intestazioni);
  if (errMappatura.length > 0) return { ok: false, messaggio: errMappatura.join(' ') };

  const dati = t.righe;
  const intestazione = { celle: t.intestazioni };

  // Posizione di ogni colonna associata
  const indici = new Map<ColonnaImport, number>();
  for (const colonna of COLONNE_IMPORT) {
    const h = m[colonna];
    if (h !== undefined) indici.set(colonna, t.intestazioni.indexOf(h));
  }
  const usati = new Set(indici.values());
  const ignorate = t.intestazioni.flatMap((h, i) => (!usati.has(i) && h.trim() ? [h.trim()] : []));

  if (dati.length === 0) return { ok: false, messaggio: 'Il file non ha righe di dati.' };
  if (dati.length > MAX_RIGHE_IMPORT) {
    return {
      ok: false,
      messaggio: `Il file ha ${dati.length} righe: al massimo ${MAX_RIGHE_IMPORT} per volta. Dividilo in più file.`,
    };
  }

  const righe: RigaImport[] = [];
  const errori: ErroreImport[] = [];
  // Prima riga valida di ogni targa e di ogni codice cliente (con i dati del cliente)
  const targhe = new Map<string, number>();
  const clienti = new Map<string, { numero: number; dati: string }>();

  for (const { numero, celle } of dati) {
    const errore = (messaggio: string) => errori.push({ numero, messaggio });
    if (celle.length > intestazione.celle.length) {
      errore(
        "La riga ha più colonne dell'intestazione: forse un testo contiene il separatore senza virgolette.",
      );
      continue;
    }
    const v = (c: ColonnaImport) => {
      const i = indici.get(c);
      return i === undefined ? '' : (celle[i] ?? '').trim();
    };

    const codice = v('codice_cliente');
    const conCliente = ['nome', 'cognome', 'ragione_sociale', 'telefono', 'email'].some(
      (c) => v(c as ColonnaImport) !== '',
    );
    const conVeicolo = ['targa', 'marca', 'modello', 'anno', 'telaio'].some(
      (c) => v(c as ColonnaImport) !== '',
    );
    const messaggi: string[] = [];

    let cliente: ClienteImport | null = null;
    if (codice) {
      if (codice.length > 50) messaggi.push('Il codice cliente può avere al massimo 50 caratteri.');
      const r = ClienteSchema.safeParse({
        nome: v('nome'),
        cognome: v('cognome'),
        ragione_sociale: v('ragione_sociale'),
        telefono: v('telefono'),
        email: v('email'),
        note: '',
      });
      if (r.success) {
        const { nome, cognome, ragione_sociale, telefono, email } = r.data;
        cliente = { codice_gestionale: codice, nome, cognome, ragione_sociale, telefono, email };
      } else {
        messaggi.push(...r.error.issues.map((i) => i.message));
      }
    } else if (conCliente) {
      messaggi.push(
        'Manca il codice cliente: serve a riconoscere il cliente nelle importazioni successive.',
      );
    }

    let veicolo: VeicoloImport | null = null;
    if (conVeicolo) {
      const r = VeicoloSchema.safeParse({
        targa: v('targa'),
        marca: v('marca'),
        modello: v('modello'),
        anno: v('anno'),
        telaio: v('telaio'),
        cliente_officina_id: '',
      });
      if (r.success) {
        const { targa, marca, modello, anno, telaio } = r.data;
        veicolo = { targa, marca, modello, anno, telaio };
      } else {
        messaggi.push(...r.error.issues.map((i) => i.message));
      }
    } else if (!codice) {
      messaggi.push('Manca sia la targa sia il codice cliente.');
    }

    // Doppioni nel file: la stessa targa due volte, o lo stesso cliente con dati diversi
    if (veicolo) {
      const prima = targhe.get(veicolo.targa);
      if (prima !== undefined) messaggi.push(`Targa ripetuta: c'è già alla riga ${prima}.`);
    }
    if (cliente) {
      const { codice_gestionale, ...anagrafica } = cliente;
      const prima = clienti.get(codice_gestionale);
      if (prima && prima.dati !== JSON.stringify(anagrafica)) {
        messaggi.push(
          `Il cliente ${codice_gestionale} ha dati diversi da quelli della riga ${prima.numero}.`,
        );
      }
    }

    if (messaggi.length > 0) {
      for (const m of new Set(messaggi)) errore(m);
      continue;
    }
    if (veicolo) targhe.set(veicolo.targa, numero);
    if (cliente && !clienti.has(cliente.codice_gestionale)) {
      const { codice_gestionale, ...anagrafica } = cliente;
      clienti.set(codice_gestionale, { numero, dati: JSON.stringify(anagrafica) });
    }
    righe.push({ numero, cliente, veicolo });
  }

  return { ok: true, righe, errori, lette: dati.length, ignorate };
}

/** Modello del file da scaricare: intestazione e due righe d'esempio, separate da punto e virgola. */
export function modelloCsv(): string {
  return [
    COLONNE_IMPORT.join(';'),
    'C0001;Mario;Rossi;;333 1234567;mario.rossi@esempio.it;AB123CD;Fiat;Panda;2019;',
    'C0002;;;Trasporti Bianchi Srl;011 7654321;;EF456GH;Iveco;Daily;2021;ZCFC135A005123456',
  ].join('\r\n');
}

import { z } from 'zod';
import { TelefonoSchema } from './auth';
import { PosizioneSchema, StagioneSchema, UsuraSchema, type Posizione } from './pneumatici';

// Schemi dei moduli lato officina (Fase 2). Ricevono i valori dei campi come stringhe (FormData) e
// restituiscono dati già puliti, pronti per il database: stessi vincoli `check` delle tabelle, così
// l'errore compare sotto il campo invece di arrivare dal database.

/** Testo facoltativo con lunghezza massima (spazi iniziali e finali tolti). */
const testo = (max: number, etichetta: string) =>
  z
    .string()
    .trim()
    .max(max, { error: `${etichetta} può avere al massimo ${max} caratteri` });

/** Come `testo`, ma vuoto → `null`. */
const testoONull = (max: number, etichetta: string) =>
  testo(max, etichetta).transform((s) => s || null);

/** Data di oggi in formato `AAAA-MM-GG`, nel fuso orario del dispositivo. */
export function oggiISO(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const gg = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${gg}`;
}

/** Data di un campo `<input type="date">`, non nel futuro. Le date ISO si confrontano come testo. */
const dataPassata = (etichetta: string) =>
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { error: `Inserisci ${etichetta}` })
    .refine((s) => s <= oggiISO(), { error: 'La data non può essere nel futuro' });

/**
 * Numero con al più un decimale scritto all'italiana ("3,4") o all'inglese ("3.4"); vuoto → `null`.
 * Arrotondato a un decimale come le colonne `numeric(3, 1)`.
 */
const decimale = (min: number, max: number, messaggio: string) =>
  z
    .string()
    .trim()
    .transform((s) => s.replace(',', '.'))
    .refine((s) => s === '' || /^\d+(\.\d+)?$/.test(s), { error: messaggio })
    // `Number('1.45e1')` è esattamente 14.5, mentre `1.45 * 10` in virgola mobile è 14.4999…
    .transform((s) => (s === '' ? null : Math.round(Number(`${s}e1`)) / 10))
    .refine((n) => n === null || (n >= min && n <= max), { error: messaggio });

// ---------------------------------------------------------------------------------------------------
// Cliente
// ---------------------------------------------------------------------------------------------------

// Stesso controllo del vincolo `check` su `clienti_officina.email`
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const ClienteSchema = z
  .object({
    nome: testo(100, 'Il nome'),
    cognome: testo(100, 'Il cognome'),
    ragione_sociale: testoONull(200, 'La ragione sociale'),
    telefono: TelefonoSchema,
    email: z
      .string()
      .trim()
      .refine((s) => s === '' || EMAIL.test(s), {
        error: "Controlla l'email: sembra incompleta (es. nome@esempio.it)",
      })
      .transform((s) => s || null),
    note: testo(2000, 'Le note'),
  })
  // Come il vincolo `clienti_officina_nominativo`: una persona o un'azienda
  .refine((c) => c.nome || c.cognome || c.ragione_sociale, {
    error: 'Inserisci nome e cognome, oppure la ragione sociale',
    path: ['nome'],
  });
export type Cliente = z.infer<typeof ClienteSchema>;

/** Invito del cliente nell'app: l'email a cui mandarlo, in minuscolo come la salva il database. */
export const InvitoSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, { error: "Inserisci l'email del cliente" })
    .max(254, { error: "L'email è troppo lunga" })
    .refine((s) => EMAIL.test(s), {
      error: "Controlla l'email: sembra incompleta (es. nome@esempio.it)",
    })
    .transform((s) => s.toLowerCase()),
});
export type Invito = z.infer<typeof InvitoSchema>;

// ---------------------------------------------------------------------------------------------------
// Veicolo
// ---------------------------------------------------------------------------------------------------

/** Targa in forma canonica, come il trigger `normalizza_veicolo`: "ab 123-cd" → "AB123CD". */
export function normalizzaTarga(targa: string): string {
  return targa.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Targa italiana leggibile: "AB123CD" → "AB 123 CD"; le altre restano come sono. */
export function formattaTarga(targa: string): string {
  return /^[A-Z]{2}\d{3}[A-Z]{2}$/.test(targa)
    ? `${targa.slice(0, 2)} ${targa.slice(2, 5)} ${targa.slice(5)}`
    : targa;
}

export const VeicoloSchema = z.object({
  targa: z
    .string()
    .transform(normalizzaTarga)
    .pipe(
      z
        .string()
        .min(1, { error: 'Inserisci la targa', abort: true })
        .regex(/^[A-Z0-9]{2,10}$/, { error: 'La targa ha da 2 a 10 lettere e cifre' }),
    ),
  marca: testo(50, 'La marca'),
  modello: testo(100, 'Il modello'),
  anno: z
    .string()
    .trim()
    .refine(
      (s) => s === '' || (/^\d{4}$/.test(s) && +s >= 1900 && +s <= new Date().getFullYear() + 1),
      { error: "Controlla l'anno (es. 2019)" },
    )
    .transform((s) => (s === '' ? null : Number(s))),
  telaio: z
    .string()
    .transform((s) => s.toUpperCase().replace(/[^A-Z0-9]/g, ''))
    .refine((s) => s === '' || /^[A-HJ-NPR-Z0-9]{17}$/.test(s), {
      error: 'Il telaio (VIN) ha 17 caratteri, senza le lettere I, O e Q',
    })
    .transform((s) => s || null),
  // Select "Cliente": vuoto = nessun cliente
  cliente_officina_id: z
    .string()
    .refine((s) => s === '' || z.uuid().safeParse(s).success, { error: 'Cliente non valido' })
    .transform((s) => s || null),
});
export type Veicolo = z.infer<typeof VeicoloSchema>;

// ---------------------------------------------------------------------------------------------------
// Montaggio pneumatici
// ---------------------------------------------------------------------------------------------------

// Stesso controllo del vincolo `check` su `pneumatici.dot`: settimana 01–53 + anno a due cifre
const DOT = /^(0[1-9]|[1-4][0-9]|5[0-3])[0-9]{2}$/;

// Caselle di scelta: arrivano come elenco (vuoto se non ne è spuntata nessuna)
const posizioniScelte = z
  .array(PosizioneSchema)
  .min(1, { error: 'Scegli almeno una posizione' })
  .refine((p) => new Set(p).size === p.length, { error: 'Posizioni ripetute' });

// DOT facoltativo: vuoto = nessun DOT. Lo stesso pezzo vale per il campo unico e per quelli di ogni ruota
const dotFacoltativo = z
  .string()
  .trim()
  .refine((s) => s === '' || DOT.test(s), {
    error: 'Il DOT sono le ultime 4 cifre: settimana e anno (es. 3823)',
  })
  .transform((s) => s || null);

/** Nome del campo con il DOT di una singola ruota nel modulo del montaggio (es. `dot_ANT_SX`). */
export const campoDot = (p: Posizione) => `dot_${p}` as const;

// Un campo facoltativo `dot_<POSIZIONE>` per ogni posizione
const dotPerRuota = Object.fromEntries(
  PosizioneSchema.options.map((p) => [campoDot(p), dotFacoltativo.optional()]),
) as Record<`dot_${Posizione}`, z.ZodOptional<typeof dotFacoltativo>>;

const MontaPneumaticiOggetto = z.object({
  posizioni: posizioniScelte,
  stagione: z.enum(StagioneSchema.options, { error: 'Scegli la stagione' }),
  misura: z
    .string()
    .trim()
    .transform((s) => s.toUpperCase().replace(/\s+/g, ' '))
    .pipe(
      z
        .string()
        .min(1, { error: 'Inserisci la misura (es. 205/55 R16 91V)', abort: true })
        .max(40, { error: 'La misura può avere al massimo 40 caratteri' }),
    ),
  marca: testo(50, 'La marca'),
  modello: testo(100, 'Il modello'),
  dot: dotFacoltativo,
  ...dotPerRuota,
  montato_il: dataPassata('la data di montaggio'),
});
// Il DOT di una ruota non scelta in `posizioni` si ignora: non viene controllato e non esce dallo schema
export const MontaPneumaticiSchema = z.preprocess((v) => {
  if (typeof v !== 'object' || v === null) return v;
  const scelte = (v as { posizioni?: unknown }).posizioni;
  const elenco = Array.isArray(scelte) ? scelte : [];
  const tolti = PosizioneSchema.options.filter((p) => !elenco.includes(p)).map(campoDot);
  return Object.fromEntries(Object.entries(v).filter(([k]) => !(tolti as string[]).includes(k)));
}, MontaPneumaticiOggetto);
export type MontaPneumatici = z.infer<typeof MontaPneumaticiSchema>;

/** Smontaggio senza sostituzione (es. ruota di scorta tolta): gli pneumatici restano nello storico. */
export const SmontaPneumaticiSchema = z.object({
  posizioni: posizioniScelte,
  smontato_il: dataPassata('la data di smontaggio'),
});
export type SmontaPneumatici = z.infer<typeof SmontaPneumaticiSchema>;

// ---------------------------------------------------------------------------------------------------
// Nuovo controllo
// ---------------------------------------------------------------------------------------------------

/** Nomi dei campi di una posizione nel modulo del controllo (es. `mm_ANT_SX`). */
export const campiMisura = (p: Posizione) =>
  ({ mm: `mm_${p}`, bar: `bar_${p}`, usura: `usura_${p}`, danni: `danni_${p}` }) as const;

export interface MisuraControllo {
  posizione: Posizione;
  battistrada_mm: number;
  pressione_bar: number | null;
  usura: z.infer<typeof UsuraSchema> | null;
  danni: string;
}

export interface NuovoControllo {
  eseguito_il: string;
  km: number | null;
  note: string;
  misure: MisuraControllo[];
}

/**
 * Schema del modulo "Nuovo controllo" per le posizioni montate sul veicolo. I campi di ogni posizione
 * hanno nomi piatti (`mm_ANT_SX`, `bar_ANT_SX`…) perché il modulo segnala l'errore sotto il campo
 * con quel nome. Il battistrada è obbligatorio, tranne per la ruota di scorta.
 */
export function creaControlloSchema(posizioni: readonly Posizione[]) {
  const forma: Record<string, z.ZodType> = {
    eseguito_il: dataPassata('la data del controllo'),
    km: z
      .string()
      // "41.250" o "41 250" → 41250
      .transform((s) => s.replace(/[.\s]/g, ''))
      .refine((s) => s === '' || (/^\d+$/.test(s) && +s <= 2_000_000), {
        error: 'Controlla i km: solo cifre (es. 41250)',
      })
      .transform((s) => (s === '' ? null : Number(s))),
    note: testo(2000, 'Le note'),
  };
  for (const p of posizioni) {
    const c = campiMisura(p);
    const mm = decimale(0, 20, 'Da 0 a 20 mm (es. 4,5)');
    forma[c.mm] =
      p === 'SCORTA' ? mm : mm.refine((n) => n !== null, { error: 'Inserisci il battistrada' });
    forma[c.bar] = decimale(0, 9.9, 'Da 0 a 9,9 bar (es. 2,3)');
    forma[c.usura] = UsuraSchema.or(z.literal('')).transform((s) => s || null);
    forma[c.danni] = testo(500, 'La descrizione dei danni');
  }

  return z.object(forma).transform((v): NuovoControllo => {
    const misure: MisuraControllo[] = [];
    for (const p of posizioni) {
      const c = campiMisura(p);
      const mm = v[c.mm] as number | null;
      // Ruota di scorta non misurata: nessuna riga
      if (mm === null) continue;
      misure.push({
        posizione: p,
        battistrada_mm: mm,
        pressione_bar: v[c.bar] as number | null,
        usura: v[c.usura] as MisuraControllo['usura'],
        danni: v[c.danni] as string,
      });
    }
    return {
      eseguito_il: v.eseguito_il as string,
      km: v.km as number | null,
      note: v.note as string,
      misure,
    };
  });
}

// ---------------------------------------------------------------------------------------------------
// Dati dell'officina (indirizzo, contatti, posizione)
// ---------------------------------------------------------------------------------------------------

const NUMERO = String.raw`-?\d+(?:\.\d+)?`;
const COPPIA = new RegExp(String.raw`^(${NUMERO})(?:\s*,\s*|\s+)(${NUMERO})$`);
const LINK_MAPS = new RegExp(String.raw`@(${NUMERO}),(${NUMERO}),`);

/**
 * Legge latitudine e longitudine da ciò che il titolare incolla: due numeri col punto decimale separati
 * da virgola e/o spazi ("45.070312, 7.686856") oppure un link di Google Maps che contiene "@45.07,7.68,".
 * Arrotonda a 6 decimali (come `numeric(9, 6)`); `null` se il formato o gli intervalli non vanno bene.
 * La virgola decimale ("45,07 7,68") non si indovina: è rifiutata.
 */
export function leggiCoordinate(testo: string): { latitudine: number; longitudine: number } | null {
  const t = testo.trim();
  const m = t.match(LINK_MAPS) ?? t.match(COPPIA);
  if (!m) return null;
  const latitudine = Number(Number(m[1]).toFixed(6));
  const longitudine = Number(Number(m[2]).toFixed(6));
  if (Math.abs(latitudine) > 90 || Math.abs(longitudine) > 180) return null;
  return { latitudine, longitudine };
}

/** Modulo "Dati dell'officina": stessi vincoli `check` della tabella `officine`. */
export const DatiOfficinaSchema = z
  .object({
    indirizzo: testo(200, "L'indirizzo").refine((s) => s !== '', {
      error: "Inserisci l'indirizzo",
    }),
    cap: z
      .string()
      .trim()
      .refine((s) => s === '' || /^[0-9]{5}$/.test(s), { error: 'Il CAP ha 5 cifre (es. 10100)' })
      .transform((s) => s || null),
    citta: testo(100, 'La città').refine((s) => s !== '', { error: 'Inserisci la città' }),
    provincia: z
      .string()
      .trim()
      .transform((s) => s.toUpperCase())
      .refine((s) => s === '' || /^[A-Z]{2}$/.test(s), {
        error: 'La provincia è la sigla di 2 lettere (es. TO)',
      })
      .transform((s) => s || null),
    telefono: TelefonoSchema,
    email: z
      .string()
      .trim()
      .refine((s) => s === '' || EMAIL.test(s), {
        error: "Controlla l'email: sembra incompleta (es. nome@esempio.it)",
      })
      .transform((s) => s || null),
    // Vuota = nessuna posizione
    posizione: z.string().trim(),
  })
  .transform((v, ctx) => {
    const { posizione, ...resto } = v;
    if (posizione === '') return { ...resto, latitudine: null, longitudine: null };
    const c = leggiCoordinate(posizione);
    if (!c) {
      ctx.addIssue({
        code: 'custom',
        path: ['posizione'],
        message: /\d,\d/.test(posizione)
          ? 'Scrivi i decimali con il punto, non con la virgola (es. 45.070312, 7.686856)'
          : 'Non riesco a leggere la posizione: incolla due numeri (es. 45.070312, 7.686856) o un link di Google Maps',
      });
      return z.NEVER;
    }
    return { ...resto, ...c };
  });
export type DatiOfficina = z.infer<typeof DatiOfficinaSchema>;

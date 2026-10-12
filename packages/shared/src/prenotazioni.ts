import { z } from 'zod';
import { TelefonoSchema } from './auth';
import { normalizzaTarga } from './officina';

// Prenotazioni (Fase 4, PLAN P14): catalogo dei servizi, richiesta del cliente con giorno e fascia,
// risposta dell'officina con l'ora. Le regole sono le stesse delle funzioni SQL della migrazione
// `20261012120000_prenotazioni.sql`: qui servono per mostrare l'errore sotto il campo.

export const FasciaSchema = z.enum(['MATTINA', 'POMERIGGIO']);
export type Fascia = z.infer<typeof FasciaSchema>;

export const StatoPrenotazioneSchema = z.enum([
  'RICHIESTA',
  'PROPOSTA',
  'CONFERMATA',
  'RIFIUTATA',
  'ANNULLATA',
  'COMPLETATA',
  'NON_PRESENTATO',
]);
export type StatoPrenotazione = z.infer<typeof StatoPrenotazioneSchema>;

/** Giorni in avanti in cui si può chiedere un appuntamento: come `giorni_prenotabili()`. */
export const GIORNI_PRENOTABILI = 60;

/** Fuso orario delle officine: giorni e ore delle prenotazioni sono italiani. */
export const FUSO = 'Europe/Rome';

// ---------------------------------------------------------------------------------------------------
// Date e orari
// ---------------------------------------------------------------------------------------------------

/** Chiavi di `officine.orari`, da lunedì a domenica. */
export const GIORNI_SETTIMANA = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'] as const;
export type GiornoSettimana = (typeof GIORNI_SETTIMANA)[number];

/** Orari di apertura: per ogni giorno gli intervalli `["08:30", "12:30"]`. */
export type Orari = Partial<Record<GiornoSettimana, [string, string][]>>;

/** Giorno della settimana di una data `AAAA-MM-GG` (0 = lunedì … 6 = domenica). */
export function giornoSettimana(data: string): number {
  return (new Date(`${data}T12:00:00Z`).getUTCDay() + 6) % 7;
}

/** Data `AAAA-MM-GG` spostata di `n` giorni. */
export function aggiungiGiorni(data: string, n: number): string {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Data di oggi in Italia, `AAAA-MM-GG` (come `oggi_in_italia()`). */
export function oggiInItalia(adesso = new Date()): string {
  // Il formato canadese è già AAAA-MM-GG
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(adesso);
}

/** "8:30" → minuti dalla mezzanotte (510). */
const minuti = (ora: string): number => {
  const [h = '0', m = '0'] = ora.split(':');
  return Number(h) * 60 + Number(m);
};

const MEZZOGIORNO = 13 * 60;

/**
 * Fasce in cui l'officina è aperta quel giorno, come `fasce_aperte()`: mattina = un intervallo che
 * inizia prima delle 13, pomeriggio = un intervallo che finisce dopo le 13.
 */
export function fasceAperte(orari: unknown, data: string): Fascia[] {
  const giorno = GIORNI_SETTIMANA[giornoSettimana(data)]!;
  const intervalli = (orari as Orari | null)?.[giorno];
  if (!Array.isArray(intervalli)) return [];
  const fasce: Fascia[] = [];
  if (intervalli.some(([inizio]) => minuti(inizio) < MEZZOGIORNO)) fasce.push('MATTINA');
  if (intervalli.some(([, fine]) => minuti(fine) > MEZZOGIORNO)) fasce.push('POMERIGGIO');
  return fasce;
}

/** I prossimi giorni in cui si può chiedere un appuntamento (da domani, per GIORNI_PRENOTABILI). */
export function giorniPrenotabili(
  orari: unknown,
  oggi = oggiInItalia(),
): { data: string; fasce: Fascia[] }[] {
  const giorni = [];
  for (let n = 1; n <= GIORNI_PRENOTABILI; n++) {
    const data = aggiungiGiorni(oggi, n);
    const fasce = fasceAperte(orari, data);
    if (fasce.length) giorni.push({ data, fasce });
  }
  return giorni;
}

/**
 * Istante (ISO, UTC) di un giorno e un'ora italiani, es. ("2026-10-20", "09:30") →
 * "2026-10-20T07:30:00.000Z". Tiene conto dell'ora legale.
 */
export function istanteItaliano(data: string, ora: string): string {
  const [a, m, g] = data.split('-').map(Number) as [number, number, number];
  const [h, min] = ora.split(':').map(Number) as [number, number];
  const comeUtc = Date.UTC(a, m - 1, g, h, min);
  // Differenza tra l'ora italiana e UTC in quel momento (+1 h d'inverno, +2 h d'estate)
  const scarto = (istante: number) => {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: FUSO,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
        .formatToParts(istante)
        .map((x) => [x.type, x.value]),
    );
    return Date.UTC(+p.year!, +p.month! - 1, +p.day!, +p.hour!, +p.minute!) - istante;
  };
  return new Date(comeUtc - scarto(comeUtc - scarto(comeUtc))).toISOString();
}

/** Giorno (`AAAA-MM-GG`) e ora (`HH:MM`) italiani di un istante (es. `appuntamento`). */
export function inItalia(istante: string | Date): { data: string; ora: string } {
  const d = new Date(istante);
  const ora = new Intl.DateTimeFormat('en-GB', {
    timeZone: FUSO,
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
  return { data: oggiInItalia(d), ora };
}

// ---------------------------------------------------------------------------------------------------
// Catalogo dei servizi
// ---------------------------------------------------------------------------------------------------

const testo = (max: number, etichetta: string) =>
  z
    .string()
    .trim()
    .max(max, { error: `${etichetta} può avere al massimo ${max} caratteri` });

export const ServizioSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(2, { error: 'Inserisci il nome del servizio (es. Cambio gomme)' })
    .max(100, { error: 'Il nome può avere al massimo 100 caratteri' }),
  descrizione: testo(500, 'La descrizione'),
  durata_minuti: z
    .string()
    .trim()
    .refine((s) => s === '' || (/^\d+$/.test(s) && +s >= 5 && +s <= 600), {
      error: 'La durata è in minuti, da 5 a 600 (es. 45)',
    })
    .transform((s) => (s === '' ? null : Number(s))),
  // Euro con al più due decimali, all'italiana ("39,90") o all'inglese; vuoto = su preventivo
  prezzo_da: z
    .string()
    .trim()
    .transform((s) => s.replace(/\s|€/g, '').replace(',', '.'))
    .refine((s) => s === '' || (/^\d{1,6}(\.\d{1,2})?$/.test(s) && +s <= 999_999.99), {
      error: 'Scrivi il prezzo in euro (es. 40 o 39,90), oppure lascialo vuoto',
    })
    .transform((s) => (s === '' ? null : Number(s))),
  // Una casella: spuntata = il cliente può prenotarlo dall'app
  prenotabile: z.array(z.literal('SI')).transform((a) => a.length > 0),
});
export type Servizio = z.infer<typeof ServizioSchema>;

/** Prezzo per il cliente: "da 40 €", "da 39,90 €" oppure "Su preventivo". */
export function testoPrezzo(prezzo: number | null): string {
  if (prezzo === null) return 'Su preventivo';
  const euro = new Intl.NumberFormat('it-IT', {
    minimumFractionDigits: Number.isInteger(prezzo) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(prezzo);
  return `da ${euro} €`;
}

/** Durata leggibile: "45 min", "1 h", "1 h 30 min". */
export function testoDurata(minuti: number): string {
  const h = Math.floor(minuti / 60);
  const m = minuti % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

// ---------------------------------------------------------------------------------------------------
// Richiesta del cliente
// ---------------------------------------------------------------------------------------------------

const ETICHETTE_FASCIA: Record<Fascia, string> = { MATTINA: 'mattina', POMERIGGIO: 'pomeriggio' };

/**
 * Schema del modulo "Prenota" per un'officina: il giorno dev'essere tra domani e 60 giorni, con
 * l'officina aperta nella fascia scelta (secondo i suoi orari).
 */
export function creaRichiestaSchema(orari: unknown, oggi = oggiInItalia()) {
  return z
    .object({
      servizio_id: z.uuid({ error: 'Scegli il servizio' }),
      targa: z
        .string()
        .transform(normalizzaTarga)
        .pipe(
          z
            .string()
            .min(1, { error: 'Inserisci la targa del veicolo', abort: true })
            .regex(/^[A-Z0-9]{2,10}$/, { error: 'La targa ha da 2 a 10 lettere e cifre' }),
        ),
      veicolo: testo(150, 'La descrizione del veicolo'),
      giorno: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'Scegli il giorno', abort: true })
        .refine((d) => d > oggi, { error: 'Scegli un giorno da domani in poi', abort: true })
        .refine((d) => d <= aggiungiGiorni(oggi, GIORNI_PRENOTABILI), {
          error: `Si può prenotare fino a ${GIORNI_PRENOTABILI} giorni da oggi`,
          abort: true,
        })
        .refine((d) => fasceAperte(orari, d).length > 0, {
          error: "Quel giorno l'officina è chiusa",
        }),
      fascia: z.enum(FasciaSchema.options, { error: 'Scegli mattina o pomeriggio' }),
      telefono: TelefonoSchema.refine((t) => t !== null, {
        error: "Inserisci il tuo telefono: l'officina ti chiama se serve",
      }).transform((t) => t!),
      note: testo(1000, 'Le note'),
    })
    .superRefine((r, ctx) => {
      const fasce = fasceAperte(orari, r.giorno);
      if (fasce.length && !fasce.includes(r.fascia)) {
        ctx.addIssue({
          code: 'custom',
          path: ['fascia'],
          message: `Quel giorno l'officina è aperta solo ${fasce.map((f) => `la ${ETICHETTE_FASCIA[f]}`).join(' e ')}`,
        });
      }
    });
}
export type RichiestaPrenotazione = z.output<ReturnType<typeof creaRichiestaSchema>>;

// ---------------------------------------------------------------------------------------------------
// Risposta dell'officina
// ---------------------------------------------------------------------------------------------------

const ora = z
  .string()
  .trim()
  .regex(/^([01]?\d|2[0-3]):[0-5]\d$/, { error: "Inserisci l'ora (es. 9:30)" })
  .transform((s) => s.padStart(5, '0'));

const messaggio = testo(500, 'Il messaggio');

/** Conferma nel giorno chiesto dal cliente: serve solo l'ora. */
export const ConfermaPrenotazioneSchema = z.object({ ora, messaggio });
export type ConfermaPrenotazione = z.infer<typeof ConfermaPrenotazioneSchema>;

/** Proposta di un altro orario: giorno (da oggi a 60 giorni) e ora. */
export function creaPropostaSchema(oggi = oggiInItalia()) {
  return z.object({
    giorno: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'Scegli il giorno', abort: true })
      .refine((d) => d >= oggi, { error: 'Il giorno non può essere passato', abort: true })
      .refine((d) => d <= aggiungiGiorni(oggi, GIORNI_PRENOTABILI), {
        error: `Al massimo ${GIORNI_PRENOTABILI} giorni da oggi`,
      }),
    ora,
    messaggio,
  });
}
export type PropostaPrenotazione = z.output<ReturnType<typeof creaPropostaSchema>>;

/** Rifiuto (o annullamento da parte dell'officina): il motivo è facoltativo ma consigliato. */
export const RifiutoPrenotazioneSchema = z.object({ messaggio });
export type RifiutoPrenotazione = z.infer<typeof RifiutoPrenotazioneSchema>;

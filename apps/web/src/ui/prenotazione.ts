import {
  Ban,
  CalendarCheck,
  CalendarClock,
  CalendarX,
  CircleCheck,
  Hourglass,
  UserX,
  type IconNode,
} from 'lucide';
import {
  GIORNI_SETTIMANA,
  inItalia,
  type Fascia,
  type Orari,
  type StatoPrenotazione,
} from '@tyrecare/shared';
import { esc } from '../lib/html';
import { icona } from './icone';

// Stati e date degli appuntamenti (Fase 4). I badge riusano i colori `.tc-stato--…` con icone diverse
// da quelle degli pneumatici (calendario, clessidra): mai solo il colore.

export const STATI_PRENOTAZIONE: Record<
  StatoPrenotazione,
  { etichetta: string; icona: IconNode; classe: string }
> = {
  RICHIESTA: { etichetta: 'In attesa di risposta', icona: Hourglass, classe: 'giallo' },
  PROPOSTA: { etichetta: 'Nuovo orario proposto', icona: CalendarClock, classe: 'giallo' },
  CONFERMATA: { etichetta: 'Confermato', icona: CalendarCheck, classe: 'verde' },
  RIFIUTATA: { etichetta: 'Non accettato', icona: CalendarX, classe: 'rosso' },
  ANNULLATA: { etichetta: 'Annullato', icona: Ban, classe: 'nessuno' },
  COMPLETATA: { etichetta: 'Completato', icona: CircleCheck, classe: 'nessuno' },
  NON_PRESENTATO: { etichetta: 'Non presentato', icona: UserX, classe: 'nessuno' },
};

/** Per l'officina una richiesta è "da gestire", non "in attesa". */
const ETICHETTE_OFFICINA: Partial<Record<StatoPrenotazione, string>> = {
  RICHIESTA: 'Da confermare',
  PROPOSTA: 'In attesa del cliente',
};

export function badgePrenotazione(stato: StatoPrenotazione, perOfficina = false): string {
  const s = STATI_PRENOTAZIONE[stato];
  const testo = (perOfficina && ETICHETTE_OFFICINA[stato]) || s.etichetta;
  return `<span class="tc-stato tc-stato--${s.classe}">${icona(s.icona)}${esc(testo)}</span>`;
}

/** Stati in cui l'appuntamento è ancora "vivo" (da fare o da decidere). */
export const IN_CORSO: readonly StatoPrenotazione[] = ['RICHIESTA', 'PROPOSTA', 'CONFERMATA'];

export const ETICHETTE_FASCIA: Record<Fascia, string> = {
  MATTINA: 'Mattina',
  POMERIGGIO: 'Pomeriggio',
};

const FORMATO_GIORNO = new Intl.DateTimeFormat('it-IT', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});

/** `2026-10-13` → "martedì 13 ottobre". */
export const formattaGiorno = (data: string): string =>
  FORMATO_GIORNO.format(new Date(`${data}T12:00:00Z`));

/** "Martedì 13 ottobre" (con la maiuscola, a inizio riga). */
export const formattaGiornoTitolo = (data: string): string => {
  const g = formattaGiorno(data);
  return g.charAt(0).toUpperCase() + g.slice(1);
};

/** "9:30" da "09:30". */
const formattaOra = (ora: string): string => ora.replace(/^0/, '');

/** Quando: con l'ora se c'è ("Martedì 13 ottobre, ore 9:30"), altrimenti la fascia. */
export function quando(p: { giorno: string; fascia: Fascia; appuntamento: string | null }): string {
  if (p.appuntamento) {
    const { data, ora } = inItalia(p.appuntamento);
    return `${formattaGiornoTitolo(data)}, ore ${formattaOra(ora)}`;
  }
  return `${formattaGiornoTitolo(p.giorno)}, ${ETICHETTE_FASCIA[p.fascia].toLowerCase()}`;
}

/** Orari settimanali leggibili, un giorno per riga: [["Lunedì", "8:30–12:30, 14:30–19:00"], …]. */
export function righeOrari(orari: unknown): [string, string][] {
  const nomi = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
  return GIORNI_SETTIMANA.map((g, i) => {
    const intervalli = (orari as Orari | null)?.[g];
    const testo =
      Array.isArray(intervalli) && intervalli.length
        ? intervalli.map(([a, b]) => `${formattaOra(a)}–${formattaOra(b)}`).join(', ')
        : 'Chiuso';
    return [nomi[i]!, testo];
  });
}

/** Vero se gli orari indicano almeno un giorno di apertura. */
export const haOrari = (orari: unknown): boolean =>
  righeOrari(orari).some(([, t]) => t !== 'Chiuso');

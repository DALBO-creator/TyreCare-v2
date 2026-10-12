import {
  aggiungiGiorni,
  giornoSettimana,
  inItalia,
  type Fascia,
  type StatoPrenotazione,
} from '@tyrecare/shared';
import type { Prenotazione } from './prenotazioni';
import { getSupabase } from './supabase';

// Calendario degli appuntamenti dell'officina (Fase 4): una settimana alla volta, il giorno scelto
// diviso in mattina e pomeriggio. Le funzioni di calcolo sono pure (provate con Vitest).

/** Stati che compaiono in agenda: annullati e rifiutati no (sono nell'elenco del dettaglio). */
export const IN_AGENDA: readonly StatoPrenotazione[] = [
  'RICHIESTA',
  'PROPOSTA',
  'CONFERMATA',
  'COMPLETATA',
  'NON_PRESENTATO',
];

/** Lunedì della settimana di una data `AAAA-MM-GG`. */
export const lunediDi = (data: string): string => aggiungiGiorni(data, -giornoSettimana(data));

/** I 7 giorni (da lunedì) della settimana che contiene `data`. */
export const giorniSettimana = (data: string): string[] =>
  Array.from({ length: 7 }, (_, i) => aggiungiGiorni(lunediDi(data), i));

type InAgenda = Pick<Prenotazione, 'stato' | 'giorno' | 'fascia' | 'appuntamento'>;

/**
 * Giorno, fascia e ora in cui l'appuntamento sta in agenda: con l'ora fissata (confermato o proposto)
 * quelli dell'ora, altrimenti il giorno e la fascia chiesti dal cliente.
 */
export function posizioneInAgenda(p: InAgenda): {
  data: string;
  fascia: Fascia;
  ora: string | null;
} {
  if (p.appuntamento) {
    const { data, ora } = inItalia(p.appuntamento);
    return { data, fascia: ora < '13:00' ? 'MATTINA' : 'POMERIGGIO', ora };
  }
  return { data: p.giorno, fascia: p.fascia, ora: null };
}

/** Appuntamenti di un giorno, per fascia: prima quelli con l'ora (in ordine), poi quelli da fissare. */
export function agendaDelGiorno<T extends InAgenda>(
  prenotazioni: T[],
  data: string,
): Record<Fascia, T[]> {
  const agenda: Record<Fascia, T[]> = { MATTINA: [], POMERIGGIO: [] };
  for (const p of prenotazioni) {
    const pos = posizioneInAgenda(p);
    if (pos.data === data && IN_AGENDA.includes(p.stato)) agenda[pos.fascia].push(p);
  }
  const chiave = (p: T) => posizioneInAgenda(p).ora ?? '99:99';
  for (const fascia of ['MATTINA', 'POMERIGGIO'] as const) {
    agenda[fascia].sort((a, b) => chiave(a).localeCompare(chiave(b)));
  }
  return agenda;
}

/** Quanti appuntamenti in agenda per ogni giorno (`AAAA-MM-GG` → numero). */
export function contaPerGiorno(prenotazioni: InAgenda[]): Map<string, number> {
  const conta = new Map<string, number>();
  for (const p of prenotazioni) {
    if (!IN_AGENDA.includes(p.stato)) continue;
    const { data } = posizioneInAgenda(p);
    conta.set(data, (conta.get(data) ?? 0) + 1);
  }
  return conta;
}

/**
 * Prenotazioni dell'officina che possono cadere nella settimana: chieste per quei giorni oppure con
 * l'ora fissata in quei giorni (una proposta può spostarle in un'altra settimana). L'intervallo delle
 * ore è largo un giorno in più per lato: il filtro esatto lo fa `posizioneInAgenda`.
 */
export async function caricaSettimana(officinaId: string, lunedi: string): Promise<Prenotazione[]> {
  const domenica = aggiungiGiorni(lunedi, 6);
  const { data, error } = await getSupabase()
    .from('prenotazioni')
    .select('*, officina:officine (ragione_sociale, indirizzo, citta, telefono)')
    .eq('officina_id', officinaId)
    .in('stato', [...IN_AGENDA])
    .or(
      `and(giorno.gte.${lunedi},giorno.lte.${domenica}),` +
        `and(appuntamento.gte.${aggiungiGiorni(lunedi, -1)},appuntamento.lt.${aggiungiGiorni(domenica, 2)})`,
    );
  if (error) throw error;
  return data;
}

/** Orari di apertura dell'officina (anche se non è ancora attiva). */
export async function caricaOrari(officinaId: string): Promise<unknown> {
  const { data, error } = await getSupabase()
    .from('officine')
    .select('orari')
    .eq('id', officinaId)
    .single();
  if (error) throw error;
  return data.orari;
}

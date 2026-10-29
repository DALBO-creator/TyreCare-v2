import type { RichiestaAffiliazione } from '@tyrecare/shared';
import { ErroreModulo, codiceErrore } from './errori';
import { getSupabase } from './supabase';

// Richiesta di affiliazione (R7): la funzione SQL `richiedi_affiliazione` crea l'officina "in attesa" e
// rende l'utente suo TITOLARE. Errori attesi: messaggio = chiave, codice P0001.

const ERRORI: Record<string, [string, string?]> = {
  GIA_IN_OFFICINA: ["Il tuo account lavora già in un'officina."],
  PARTITA_IVA_NON_VALIDA: ['Partita IVA non valida', 'partita_iva'],
  RAGIONE_SOCIALE_NON_VALIDA: [
    'La ragione sociale deve avere da 2 a 200 caratteri.',
    'ragione_sociale',
  ],
  CITTA_MANCANTE: ['Inserisci la città', 'citta'],
  PARTITA_IVA_GIA_PRESENTE: [
    'Questa partita IVA è già registrata: scrivici con «Invia un commento».',
    'partita_iva',
  ],
};

/** Invia la richiesta e restituisce l'id della nuova officina. Nessun nuovo tentativo: non è idempotente. */
export async function richiediAffiliazione(dati: RichiestaAffiliazione): Promise<string> {
  const { data, error } = await getSupabase().rpc('richiedi_affiliazione', {
    p_ragione_sociale: dati.ragione_sociale,
    p_partita_iva: dati.partita_iva,
    p_citta: dati.citta,
    // Telefono vuoto: non si passa (la funzione lo salva come nullo)
    ...(dati.telefono ? { p_telefono: dati.telefono } : {}),
  });
  if (error) {
    const voce = codiceErrore(error) === 'P0001' ? ERRORI[String(error.message)] : undefined;
    if (voce) throw new ErroreModulo(voce[0], voce[1], error.message);
    throw error;
  }
  return data;
}

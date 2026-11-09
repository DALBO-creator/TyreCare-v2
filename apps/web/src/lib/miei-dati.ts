import { oggiInItalia } from '@tyrecare/shared';
import { sessioneCorrente } from './auth';
import { leggiTutte } from './a-pagine';
import { caricaGarage, type VeicoloGarage } from './garage';
import { getSupabase } from './supabase';

/**
 * "Scarica i tuoi dati" (portabilità, art. 20 GDPR): tutto ciò che TyreCare ha sull'utente
 * autenticato, in un unico oggetto da salvare come JSON.
 */

export interface PartiMieiDati {
  email: string;
  profilo: unknown;
  clientiOfficine: unknown[];
  garage: VeicoloGarage[];
  prenotazioni: unknown[];
  richiesteStrada: unknown[];
  notifiche: unknown[];
  commenti: unknown[];
  officineLavoro: unknown[];
  /** Solo il numero: le chiavi del browser (endpoint, p256dh, auth) non si esportano. */
  iscrizioniPush: number;
}

export interface MieiDati {
  versione: 1;
  generato_il: string;
  account: { email: string };
  profilo: unknown;
  clienti_officine: unknown[];
  garage: VeicoloGarage[];
  prenotazioni: unknown[];
  richieste_strada: unknown[];
  notifiche: unknown[];
  commenti: unknown[];
  officine_lavoro: unknown[];
  iscrizioni_push: number;
}

/** Compone il file da esportare (funzione pura: i nomi delle chiavi sono quelli del file). */
export function componiMieiDati(parti: PartiMieiDati, generatoIl: string): MieiDati {
  return {
    versione: 1,
    generato_il: generatoIl,
    account: { email: parti.email },
    profilo: parti.profilo,
    clienti_officine: parti.clientiOfficine,
    garage: parti.garage,
    prenotazioni: parti.prenotazioni,
    richieste_strada: parti.richiesteStrada,
    notifiche: parti.notifiche,
    commenti: parti.commenti,
    officine_lavoro: parti.officineLavoro,
    iscrizioni_push: parti.iscrizioniPush,
  };
}

/** Nome del file con la data di oggi: `tyrecare-i-miei-dati-AAAA-MM-GG.json`. */
export const nomeFileMieiDati = (): string => `tyrecare-i-miei-dati-${oggiInItalia()}.json`;

/**
 * Legge i dati dell'utente con le query normali. Le liste che possono superare 1000 righe si leggono
 * a pagine, ordinate per `id` (colonna unica). I filtri sull'utente servono a chi lavora in
 * un'officina: la RLS gli mostrerebbe anche le righe dei clienti.
 */
export async function raccogliMieiDati(): Promise<MieiDati> {
  const utente = sessioneCorrente()?.user;
  if (!utente) throw new Error('Nessun utente autenticato');
  const supabase = getSupabase();

  const [
    profilo,
    clientiOfficine,
    garage,
    prenotazioni,
    richiesteStrada,
    notifiche,
    commenti,
    officineLavoro,
    push,
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('*')
      .eq('id', utente.id)
      .single()
      .then(({ data, error }) => {
        if (error) throw error;
        return data;
      }),
    leggiTutte((da, a) =>
      supabase
        .from('clienti_officina')
        .select('*, officina:officine (ragione_sociale)')
        .eq('profile_id', utente.id)
        .order('id')
        .range(da, a),
    ),
    caricaGarage(),
    leggiTutte((da, a) =>
      supabase
        .from('prenotazioni')
        .select('*')
        .eq('cliente_id', utente.id)
        .order('id')
        .range(da, a),
    ),
    leggiTutte((da, a) =>
      supabase
        .from('richieste_strada')
        .select('*')
        .eq('cliente_id', utente.id)
        .order('id')
        .range(da, a),
    ),
    leggiTutte((da, a) =>
      supabase
        .from('notifiche')
        .select('*')
        .eq('destinatario_id', utente.id)
        .order('id')
        .range(da, a),
    ),
    leggiTutte((da, a) =>
      supabase.from('commenti').select('*').eq('autore_id', utente.id).order('id').range(da, a),
    ),
    leggiTutte((da, a) =>
      supabase
        .from('officina_utenti')
        .select('*, officina:officine (ragione_sociale)')
        .eq('profile_id', utente.id)
        .order('officina_id')
        .range(da, a),
    ),
    supabase
      .from('iscrizioni_push')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', utente.id)
      .then(({ count, error }) => {
        if (error) throw error;
        return count ?? 0;
      }),
  ]);

  return componiMieiDati(
    {
      email: utente.email ?? '',
      profilo,
      clientiOfficine,
      garage,
      prenotazioni,
      richiesteStrada,
      notifiche,
      commenti,
      officineLavoro,
      iscrizioniPush: push,
    },
    new Date().toISOString(),
  );
}

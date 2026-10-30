import { getSupabase } from './supabase';

export type StatoPrimiPassi = {
  posizione: boolean;
  orari: boolean;
  servizi: number;
  clienti: number;
  clientiConApp: number;
};

export type PassoPrimiPassi = { testo: string; href: string; fatto: boolean };

/** I 5 passi di un'officina appena registrata, con quali sono già fatti. */
export function passiPrimiPassi(stato: StatoPrimiPassi): PassoPrimiPassi[] {
  return [
    {
      testo: 'Completa i dati dell’officina e la posizione',
      href: '/officina/dati',
      fatto: stato.posizione,
    },
    { testo: 'Imposta orari e capienza', href: '/officina/orari', fatto: stato.orari },
    { testo: 'Aggiungi i servizi', href: '/servizi', fatto: stato.servizi > 0 },
    { testo: 'Importa clienti e veicoli', href: '/clienti/importa', fatto: stato.clienti > 0 },
    { testo: 'Invita i clienti nell’app', href: '/clienti', fatto: stato.clientiConApp > 0 },
  ];
}

/** Legge lo stato con query leggere (solo conteggi); `orari` vuoto (`{}`) = non impostati. */
export async function leggiStatoPrimiPassi(officinaId: string): Promise<StatoPrimiPassi> {
  const supabase = getSupabase();
  const [officina, servizi, clienti, conApp] = await Promise.all([
    supabase.from('officine').select('latitudine, orari').eq('id', officinaId).single(),
    supabase
      .from('servizi_officina')
      .select('id', { count: 'exact', head: true })
      .eq('officina_id', officinaId),
    supabase
      .from('clienti_officina')
      .select('id', { count: 'exact', head: true })
      .eq('officina_id', officinaId),
    supabase
      .from('clienti_officina')
      .select('id', { count: 'exact', head: true })
      .eq('officina_id', officinaId)
      .not('profile_id', 'is', null),
  ]);
  for (const r of [officina, servizi, clienti, conApp]) if (r.error) throw r.error;
  const orari = officina.data?.orari;
  return {
    posizione: officina.data?.latitudine != null,
    orari: !!orari && typeof orari === 'object' && Object.keys(orari).length > 0,
    servizi: servizi.count ?? 0,
    clienti: clienti.count ?? 0,
    clientiConApp: conApp.count ?? 0,
  };
}

const chiave = (officinaId: string) => `tc-primi-passi-nascosti-${officinaId}`;

/** Vero se il titolare ha chiuso la carta su questo dispositivo (senza memoria: non nascosta). */
export function nascosta(officinaId: string): boolean {
  try {
    return localStorage.getItem(chiave(officinaId)) === '1';
  } catch {
    return false;
  }
}

export function nascondi(officinaId: string): void {
  try {
    localStorage.setItem(chiave(officinaId), '1');
  } catch {
    // vale solo fino al prossimo caricamento
  }
}

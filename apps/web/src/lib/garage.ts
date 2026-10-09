import { statoBattistrada, statoPeggiore, type StatoSalute, type Tables } from '@tyrecare/shared';
import { sessioneCorrente } from './auth';
import type { Controllo, Pneumatico } from './officina';
import { getSupabase } from './supabase';

// Garage del cliente (Fase 3). Ogni officina ha la sua scheda del veicolo (PLAN P12): la stessa auto
// controllata in due officine sono due schede con la stessa targa. Il garage le unisce: un veicolo per
// targa, con lo storico di tutte le officine. Le letture passano da Supabase: la RLS mostra al cliente
// i veicoli collegati al suo account (`clienti_officina.profile_id`) e le officine che li hanno.

export type OfficinaGarage = Pick<
  Tables<'officine'>,
  'id' | 'ragione_sociale' | 'indirizzo' | 'citta' | 'telefono'
>;

export type ControlloScheda = Controllo & Pick<Tables<'controlli'>, 'created_at'>;

/** Una scheda del veicolo così come la tiene un'officina. */
export interface SchedaGarage {
  id: string;
  targa: string;
  marca: string;
  modello: string;
  anno: number | null;
  created_at: string;
  /** `null` solo se la RLS non la lasciasse leggere. */
  officina: OfficinaGarage | null;
  /** Pneumatici montati ora. */
  pneumatici: Pneumatico[];
  controlli: ControlloScheda[];
}

/** Controllo nel garage, con il nome dell'officina che l'ha eseguito. */
export type ControlloGarage = ControlloScheda & { officina: string };

/** Un veicolo del garage: le schede delle varie officine unite per targa. */
export interface VeicoloGarage {
  targa: string;
  marca: string;
  modello: string;
  anno: number | null;
  /** Officine che hanno il veicolo, dalla più recente. */
  officine: OfficinaGarage[];
  /** Pneumatici montati secondo l'officina che li ha registrati più di recente. */
  pneumatici: Pneumatico[];
  /** Officina a cui si riferiscono gli pneumatici montati. */
  officinaPneumatici: string;
  /** Controlli di tutte le officine, dal più recente. */
  controlli: ControlloGarage[];
  /** Stato peggiore tra le misure dell'ultimo controllo. */
  stato: StatoSalute | null;
}

/** Data (`AAAA-MM-GG`) dell'ultima cosa successa al veicolo in quell'officina. */
function ultimaAttivita(s: SchedaGarage): string {
  return [
    s.created_at.slice(0, 10),
    ...s.controlli.map((c) => c.eseguito_il),
    ...s.pneumatici.map((p) => p.montato_il),
  ].reduce((a, b) => (b > a ? b : a));
}

const URGENZA: Record<StatoSalute | 'NESSUNO', number> = {
  ROSSO: 0,
  GIALLO: 1,
  VERDE: 2,
  NESSUNO: 3,
};

/**
 * Unisce le schede per targa (le targhe arrivano già normalizzate dal database). Per marca, modello e
 * anno, e per gli pneumatici montati, vale la scheda dell'officina che ha visto il veicolo più di
 * recente: i dati vecchi di un'altra officina possono non essere più veri. I veicoli sono in ordine
 * di urgenza (prima quelli da sostituire), poi per targa.
 */
export function unisciPerTarga(schede: SchedaGarage[]): VeicoloGarage[] {
  const perTarga = new Map<string, SchedaGarage[]>();
  for (const s of schede) perTarga.set(s.targa, [...(perTarga.get(s.targa) ?? []), s]);

  const veicoli = [...perTarga.entries()].map(([targa, gruppo]): VeicoloGarage => {
    const recenti = gruppo
      .map((s) => ({ s, quando: ultimaAttivita(s) }))
      .sort(
        (a, b) => b.quando.localeCompare(a.quando) || b.s.created_at.localeCompare(a.s.created_at),
      )
      .map(({ s }) => s);
    const primo = <K extends 'marca' | 'modello' | 'anno'>(campo: K) =>
      recenti.find((s) => s[campo])?.[campo] ?? recenti[0]![campo];
    const conPneumatici = recenti.find((s) => s.pneumatici.length > 0);

    const controlli = recenti
      .flatMap((s) =>
        s.controlli.map((c) => ({ ...c, officina: s.officina?.ragione_sociale ?? '' })),
      )
      .sort(
        (a, b) =>
          b.eseguito_il.localeCompare(a.eseguito_il) || b.created_at.localeCompare(a.created_at),
      );
    const ultimo = controlli[0];

    return {
      targa,
      marca: primo('marca'),
      modello: primo('modello'),
      anno: primo('anno'),
      officine: recenti.flatMap((s) => (s.officina ? [s.officina] : [])),
      pneumatici: conPneumatici?.pneumatici ?? [],
      officinaPneumatici: conPneumatici?.officina?.ragione_sociale ?? '',
      controlli,
      stato: ultimo
        ? statoPeggiore(
            ultimo.misure.map((m) => statoBattistrada(m.battistrada_mm, m.pneumatico.stagione)),
          )
        : null,
    };
  });

  return veicoli.sort(
    (a, b) =>
      URGENZA[a.stato ?? 'NESSUNO'] - URGENZA[b.stato ?? 'NESSUNO'] ||
      a.targa.localeCompare(b.targa),
  );
}

/**
 * Garage dell'utente autenticato. Il filtro sul cliente collegato all'account serve a chi lavora in
 * un'officina: la RLS gli mostrerebbe anche tutti i veicoli dei suoi clienti.
 */
export async function caricaGarage(): Promise<VeicoloGarage[]> {
  const utente = sessioneCorrente()?.user;
  if (!utente) throw new Error('Nessun utente autenticato');

  const { data, error } = await getSupabase()
    .from('veicoli')
    .select(
      `id, targa, marca, modello, anno, created_at,
       cliente:clienti_officina!inner (profile_id),
       officina:officine (id, ragione_sociale, indirizzo, citta, telefono),
       pneumatici (*),
       controlli (id, eseguito_il, km, note, created_at,
         misure:misure_pneumatico (battistrada_mm, pressione_bar, usura, danni,
           pneumatico:pneumatici (id, posizione, stagione)))`,
    )
    .eq('cliente.profile_id', utente.id)
    .is('pneumatici.smontato_il', null);
  if (error) throw error;

  return unisciPerTarga(data.map(({ cliente: _cliente, ...scheda }) => scheda));
}

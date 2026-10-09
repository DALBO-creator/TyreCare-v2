import type { Tables } from '@tyrecare/shared';
import { getSupabase } from './supabase';

// Stato di salute del singolo pneumatico (Fase 3, PLAN §2.4): le sue misure nel tempo, l'età dal DOT
// e una stima di quando arriverà alla soglia. Le funzioni di calcolo sono pure (vedi salute.test.ts).

const GIORNO_MS = 24 * 60 * 60 * 1000;
const giorni = (iso: string) => Date.parse(`${iso}T12:00:00Z`) / GIORNO_MS;
const isoDaGiorni = (g: number) => new Date(Math.round(g) * GIORNO_MS).toISOString().slice(0, 10);

/**
 * Età in mesi compiuti dal DOT (`SSAA`: settimana e anno di produzione) a `oggi` (`AAAA-MM-GG`).
 * La settimana si conta dal 1° gennaio: un'approssimazione di qualche giorno, che per l'età va bene.
 * `null` senza DOT valido o con un DOT nel futuro (anno a due cifre di un secolo fa).
 */
export function mesiDalDot(dot: string | null, oggi: string): number | null {
  const m = /^(\d{2})(\d{2})$/.exec(dot ?? '');
  if (!m) return null;
  const settimana = Number(m[1]);
  const anno = 2000 + Number(m[2]);
  if (settimana < 1 || settimana > 53) return null;
  const prodotto = new Date(Date.UTC(anno, 0, 1 + (settimana - 1) * 7));
  const [a, me, g] = oggi.split('-').map(Number) as [number, number, number];
  let mesi = (a - prodotto.getUTCFullYear()) * 12 + (me - 1 - prodotto.getUTCMonth());
  if (g < prodotto.getUTCDate()) mesi--;
  return mesi >= 0 ? mesi : null;
}

/** 0 → "meno di un mese", 14 → "1 anno e 2 mesi", 36 → "3 anni". */
export function formattaEta(mesi: number): string {
  if (mesi < 1) return 'meno di un mese';
  const anni = Math.floor(mesi / 12);
  const resto = mesi % 12;
  const parti = [
    anni ? `${anni} ${anni === 1 ? 'anno' : 'anni'}` : '',
    resto ? `${resto} ${resto === 1 ? 'mese' : 'mesi'}` : '',
  ].filter(Boolean);
  return parti.join(' e ');
}

export interface PuntoMisura {
  /** Data del controllo, `AAAA-MM-GG`. */
  data: string;
  km: number | null;
  mm: number;
}

export interface Tendenza {
  /** Consumo in mm al mese (positivo = il battistrada cala). */
  mmAlMese: number;
  /** Consumo in mm ogni 10.000 km; `null` se non ci sono almeno due km diversi. */
  mmOgni10000km: number | null;
}

/**
 * Consumo del battistrada dalla retta dei minimi quadrati sulle misure (mm rispetto ai giorni).
 * Servono almeno due misure in giorni diversi; `null` se il battistrada non cala (misure uguali, o
 * una misura successiva più alta per un errore di lettura o per uno pneumatico rimontato).
 */
export function tendenza(punti: PuntoMisura[]): Tendenza | null {
  const pendenza = (xy: [number, number][]) => {
    if (new Set(xy.map(([x]) => x)).size < 2) return null;
    const mx = xy.reduce((s, [x]) => s + x, 0) / xy.length;
    const my = xy.reduce((s, [, y]) => s + y, 0) / xy.length;
    const num = xy.reduce((s, [x, y]) => s + (x - mx) * (y - my), 0);
    const den = xy.reduce((s, [x]) => s + (x - mx) ** 2, 0);
    return num / den;
  };
  const alGiorno = pendenza(punti.map((p) => [giorni(p.data), p.mm]));
  if (alGiorno === null || alGiorno >= 0) return null;
  const conKm = punti.filter((p) => p.km !== null).map((p): [number, number] => [p.km!, p.mm]);
  const alKm = pendenza(conKm);
  return {
    mmAlMese: -alGiorno * 30.44,
    mmOgni10000km: alKm !== null && alKm < 0 ? -alKm * 10000 : null,
  };
}

/**
 * Data (`AAAA-MM-GG`) in cui, con questo consumo, l'ultima misura scenderà sotto `soglia` mm.
 * `null` se è già sotto la soglia o se non c'è una tendenza.
 */
export function dataSoglia(punti: PuntoMisura[], soglia: number): string | null {
  const t = tendenza(punti);
  const ultimo = [...punti].sort((a, b) => a.data.localeCompare(b.data)).at(-1);
  if (!t || !ultimo || ultimo.mm < soglia) return null;
  return isoDaGiorni(giorni(ultimo.data) + ((ultimo.mm - soglia) / t.mmAlMese) * 30.44);
}

// ---------------------------------------------------------------------------------------------------
// Lettura
// ---------------------------------------------------------------------------------------------------

export type MisuraStorica = Pick<
  Tables<'misure_pneumatico'>,
  'battistrada_mm' | 'pressione_bar' | 'usura' | 'danni'
> & { controllo: Pick<Tables<'controlli'>, 'id' | 'eseguito_il' | 'km'> };

export type SchedaPneumatico = Tables<'pneumatici'> & {
  veicolo: Pick<Tables<'veicoli'>, 'id' | 'targa' | 'marca' | 'modello'>;
  /** Dalla più vecchia alla più recente. */
  misure: MisuraStorica[];
};

/** Uno pneumatico con il veicolo e tutte le sue misure; `null` se non esiste o non è visibile. */
export async function caricaPneumatico(id: string): Promise<SchedaPneumatico | null> {
  const { data, error } = await getSupabase()
    .from('pneumatici')
    .select(
      `*, veicolo:veicoli (id, targa, marca, modello),
       misure:misure_pneumatico (battistrada_mm, pressione_bar, usura, danni,
         controllo:controlli (id, eseguito_il, km))`,
    )
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    ...data,
    misure: [...data.misure].sort((a, b) =>
      a.controllo.eseguito_il.localeCompare(b.controllo.eseguito_il),
    ),
  };
}

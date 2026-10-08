import { z } from 'zod';

export const StagioneSchema = z.enum(['ESTIVO', 'INVERNALE', 'QUATTRO_STAGIONI']);
export type Stagione = z.infer<typeof StagioneSchema>;

/** Posizione dello pneumatico sul veicolo (enum `posizione_pneumatico` del database). */
export const PosizioneSchema = z.enum(['ANT_SX', 'ANT_DX', 'POST_SX', 'POST_DX', 'SCORTA']);
export type Posizione = z.infer<typeof PosizioneSchema>;

/** Usura irregolare del battistrada (PLAN P10, enum `usura` del database). */
export const UsuraSchema = z.enum(['REGOLARE', 'INTERNA', 'ESTERNA', 'CENTRALE', 'BORDI']);
export type Usura = z.infer<typeof UsuraSchema>;

/** Soglie di profondità del battistrada in mm (PLAN P10). */
export const SOGLIE_BATTISTRADA_MM = {
  limiteLegale: 1.6,
  consigliato: { ESTIVO: 3, INVERNALE: 4, QUATTRO_STAGIONI: 4 },
} as const satisfies {
  limiteLegale: number;
  consigliato: Record<Stagione, number>;
};

export type StatoSalute = 'VERDE' | 'GIALLO' | 'ROSSO';

/**
 * Stato del battistrada: ROSSO sotto il limite di legge, GIALLO sotto la soglia
 * consigliata per la stagione, VERDE altrimenti.
 */
export function statoBattistrada(profonditaMm: number, stagione: Stagione): StatoSalute {
  if (profonditaMm < SOGLIE_BATTISTRADA_MM.limiteLegale) return 'ROSSO';
  if (profonditaMm < SOGLIE_BATTISTRADA_MM.consigliato[stagione]) return 'GIALLO';
  return 'VERDE';
}

const GRAVITA: Record<StatoSalute, number> = { VERDE: 0, GIALLO: 1, ROSSO: 2 };

/**
 * Stato complessivo di un veicolo: il peggiore tra i suoi pneumatici (basta una gomma da sostituire
 * perché il veicolo sia "da sostituire"). `null` se non ci sono misure.
 */
export function statoPeggiore(stati: readonly StatoSalute[]): StatoSalute | null {
  return stati.reduce<StatoSalute | null>(
    (peggiore, s) => (peggiore === null || GRAVITA[s] > GRAVITA[peggiore] ? s : peggiore),
    null,
  );
}

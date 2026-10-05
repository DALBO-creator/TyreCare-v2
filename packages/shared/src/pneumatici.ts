import { z } from 'zod';

export const StagioneSchema = z.enum(['ESTIVO', 'INVERNALE', 'QUATTRO_STAGIONI']);
export type Stagione = z.infer<typeof StagioneSchema>;

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

import { CircleCheck, OctagonAlert, TriangleAlert, type IconNode } from 'lucide';
import type { StatoSalute } from '@tyrecare/shared';
import { icona } from './icone';

/** Etichetta, icona e classe CSS di ogni stato di salute, mostrati al cliente. */
export const STATI: Record<StatoSalute, { etichetta: string; icona: IconNode; classe: string }> = {
  VERDE: { etichetta: 'In buono stato', icona: CircleCheck, classe: 'verde' },
  GIALLO: { etichetta: 'Da controllare', icona: TriangleAlert, classe: 'giallo' },
  ROSSO: { etichetta: 'Da sostituire', icona: OctagonAlert, classe: 'rosso' },
};

/** Badge di stato: colore + icona + testo, così lo stato è chiaro anche senza distinguere i colori. */
export function badgeStato(stato: StatoSalute): string {
  const s = STATI[stato];
  return `<span class="tc-stato tc-stato--${s.classe}">${icona(s.icona)}${s.etichetta}</span>`;
}

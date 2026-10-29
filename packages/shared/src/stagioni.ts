import type { Stagione } from './pneumatici';

const MS_GIORNO = 86_400_000;

/**
 * Cambio di stagione per l'officina: vero se tra le gomme montate ce n'è almeno una della stagione
 * sbagliata per la data di `oggi` (`AAAA-MM-GG`, in ora italiana). Dal 15 ottobre al 14 marzo non
 * vanno bene le `ESTIVO`, dal 15 marzo al 14 ottobre le `INVERNALE`; le `QUATTRO_STAGIONI` mai.
 *
 * La finestra è più larga di quella del promemoria al cliente (migrazione `promemoria_pneumatici`,
 * che finisce al 31 maggio e al 31 dicembre): qui serve all'officina tutto l'anno. Il confronto è su
 * `MM-DD` come nella migrazione.
 */
export function gommeFuoriStagione(stagioni: Stagione[], oggi: string): boolean {
  const meseGiorno = oggi.slice(5);
  const inverno = meseGiorno >= '10-15' || meseGiorno < '03-15';
  return stagioni.includes(inverno ? 'ESTIVO' : 'INVERNALE');
}

const inGiorni = (data: string): number =>
  Date.UTC(+data.slice(0, 4), +data.slice(5, 7) - 1, +data.slice(8, 10)) / MS_GIORNO;

/**
 * Vero se l'ultimo controllo (`AAAA-MM-GG`) risale a più di 365 giorni prima di `oggi`. Mai
 * controllato (`null`) → falso: nell'elenco c'è già "Nessun controllo". Giorni contati su date pure
 * in UTC, senza ore locali.
 */
export function daRicontrollare(ultimoControllo: string | null, oggi: string): boolean {
  if (!ultimoControllo) return false;
  return inGiorni(oggi) - inGiorni(ultimoControllo) > 365;
}

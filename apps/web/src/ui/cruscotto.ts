import { CloudSun, Snowflake, Sun, type IconNode } from 'lucide';
import {
  statoBattistrada,
  type Posizione,
  type Stagione,
  type StatoSalute,
} from '@tyrecare/shared';
import { esc } from '../lib/html';
import type { Controllo, Misura } from '../lib/officina';
import { POSIZIONI, formattaData, formattaKm } from '../pagine/comune';
import { autoDallAlto } from './auto';
import { indicatoreBattistrada } from './indicatore';

// Cruscotto del veicolo (auto + contagiri dell'ultimo controllo), usato dalla scheda dell'officina e
// dal garage del cliente.

export const ICONE_STAGIONE: Record<Stagione, IconNode> = {
  ESTIVO: Sun,
  INVERNALE: Snowflake,
  QUATTRO_STAGIONI: CloudSun,
};

// Angoli del cruscotto (vedi `.tc-cruscotto`) → posizione dello pneumatico
const ANGOLI = { as: 'ANT_SX', ad: 'ANT_DX', ps: 'POST_SX', pd: 'POST_DX' } as const;

export const statoMisura = (m: Misura): StatoSalute =>
  statoBattistrada(m.battistrada_mm, m.pneumatico.stagione);

/**
 * Auto con i contagiri dell'ultimo controllo. Serve una misura per ognuna delle quattro ruote:
 * se ne manca qualcuna il cruscotto non si mostra (le misure restano nello storico).
 * `officina` (garage del cliente) si aggiunge alla nota sotto: "… · Gomme Rossi". Nel report del
 * controllo la data è già nel titolo: con `ultimo: false` niente nota e un'etichetta diversa.
 */
export function cruscotto(controllo: Controllo, officina = '', { ultimo = true } = {}): string {
  const misura = (p: Posizione) => controllo.misure.find((m) => m.pneumatico.posizione === p);
  const angoli = Object.entries(ANGOLI).map(([angolo, p]) => ({ angolo, p, m: misura(p) }));
  if (angoli.some((a) => !a.m)) return '';

  const stato = (p: Posizione) => statoMisura(misura(p)!);
  const nota = [
    formattaData(controllo.eseguito_il),
    controllo.km !== null ? formattaKm(controllo.km) : '',
    officina,
  ].filter(Boolean);
  return `
    <div class="tc-cruscotto" role="group"
      aria-label="Stato degli pneumatici ${ultimo ? "all'ultimo controllo" : 'a questo controllo'}">
      ${angoli
        .map(
          ({ angolo, p, m }) => `
        <div class="tc-cruscotto__${angolo}">${indicatoreBattistrada({
          posizione: POSIZIONI[p].nome,
          sigla: POSIZIONI[p].sigla,
          mm: m!.battistrada_mm,
          stato: statoMisura(m!),
        })}</div>`,
        )
        .join('')}
      <div class="tc-cruscotto__veicolo">${autoDallAlto({
        as: stato('ANT_SX'),
        ad: stato('ANT_DX'),
        ps: stato('POST_SX'),
        pd: stato('POST_DX'),
      })}</div>
    </div>
    ${ultimo ? `<p class="tc-hero__nota">Ultimo controllo: ${esc(nota.join(' · '))}</p>` : ''}`;
}

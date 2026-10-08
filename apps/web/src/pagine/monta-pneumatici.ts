import { MontaPneumaticiSchema, StagioneSchema, formattaTarga, oggiISO } from '@tyrecare/shared';
import { Info } from 'lucide';
import { montaPneumatici, type Pneumatico } from '../lib/officina';
import { visualizzazioneCorrente } from '../lib/router';
import { icona } from '../ui/icone';
import { paginaApp } from '../ui/layout';
import {
  RIQUADRO_ERRORE,
  caselle,
  campo,
  collegaModulo,
  pulsanteInvio,
  scelta,
} from '../ui/modulo';
import {
  ETICHETTE_STAGIONE,
  ORDINE_POSIZIONI,
  POSIZIONI,
  intestazioneSottopagina,
  vaiConConferma,
} from './comune';
import { caricaSchedaDaUrl } from './veicolo';

/**
 * Montaggio di pneumatici nuovi o in sostituzione: `/veicolo/pneumatici?id=…`. Caso tipico il cambio
 * stagionale: stesse caratteristiche per le quattro ruote, scelte tutte in una volta.
 */
export async function mostraMontaPneumatici(app: HTMLElement): Promise<void> {
  const n = visualizzazioneCorrente();
  const scheda = await caricaSchedaDaUrl(app, n);
  if (!scheda) return;

  const { veicolo, pneumatici } = scheda;
  const oggi = oggiISO();

  app.innerHTML = paginaApp(`
    ${intestazioneSottopagina('Monta pneumatici', formattaTarga(veicolo.targa))}
    <div class="tc-contenuto">
      <form class="tc-auth__modulo" novalidate>
        ${RIQUADRO_ERRORE}
        ${caselle({
          nome: 'posizioni',
          etichetta: 'Posizioni',
          opzioni: ORDINE_POSIZIONI.map((p) => [p, POSIZIONI[p].nome] as const),
          selezionate: ['ANT_SX', 'ANT_DX', 'POST_SX', 'POST_DX'],
        })}
        ${
          pneumatici.length > 0
            ? `<div class="tc-avviso tc-avviso--info">
                ${icona(Info)}
                <p class="mb-0">
                  Gli pneumatici montati ora nelle posizioni scelte vengono smontati e restano nello
                  storico con i loro controlli.
                </p>
              </div>`
            : ''
        }
        ${campiPneumatico({ misura: pneumatici[0]?.misura ?? '', montato_il: oggi })}
        ${pulsanteInvio('Monta pneumatici', 'Salvataggio…')}
        <a class="btn btn-outline-light btn-lg w-100" href="/veicolo?id=${veicolo.id}">Annulla</a>
      </form>
    </div>`);

  collegaModulo(app.querySelector('form')!, MontaPneumaticiSchema, async (dati) => {
    await montaPneumatici(veicolo.id, dati);
    vaiConConferma(
      `/veicolo?id=${veicolo.id}`,
      dati.posizioni.length === 1 ? 'Pneumatico montato.' : 'Pneumatici montati.',
    );
  });
}

type ValoriPneumatico = Pick<
  Pneumatico,
  'stagione' | 'misura' | 'marca' | 'modello' | 'dot' | 'montato_il'
>;

/**
 * Campi delle caratteristiche degli pneumatici (montaggio nuovo o correzione). Il montaggio propone
 * la misura di quelli attuali (di solito non cambia) e la data di oggi.
 */
export function campiPneumatico(p: Partial<ValoriPneumatico>): string {
  const oggi = oggiISO();
  return `
    ${scelta({
      nome: 'stagione',
      etichetta: 'Stagione',
      opzioni: [
        ['', 'Scegli…'],
        ...StagioneSchema.options.map((s) => [s, ETICHETTE_STAGIONE[s]] as const),
      ],
      valore: p.stagione,
    })}
    ${campo({
      nome: 'misura',
      etichetta: 'Misura',
      tipo: 'text',
      autocomplete: 'off',
      aiuto: 'Come sul fianco dello pneumatico, es. 205/55 R16 91V.',
      valore: p.misura,
      attributi: 'autocapitalize="characters" spellcheck="false"',
    })}
    <div class="tc-auth__coppia">
      ${campo({ nome: 'marca', etichetta: 'Marca', tipo: 'text', autocomplete: 'off', valore: p.marca })}
      ${campo({
        nome: 'modello',
        etichetta: 'Modello',
        tipo: 'text',
        autocomplete: 'off',
        valore: p.modello,
      })}
    </div>
    <div class="tc-auth__coppia">
      ${campo({
        nome: 'dot',
        etichetta: 'DOT (facoltativo)',
        tipo: 'text',
        autocomplete: 'off',
        aiuto: 'Ultime 4 cifre: settimana e anno (es. 3823).',
        valore: p.dot ?? '',
        attributi: 'inputmode="numeric" maxlength="4"',
      })}
      ${campo({
        nome: 'montato_il',
        etichetta: 'Data di montaggio',
        tipo: 'date',
        autocomplete: 'off',
        valore: p.montato_il,
        attributi: `max="${oggi}"`,
      })}
    </div>`;
}

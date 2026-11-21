import {
  MontaPneumaticiSchema,
  StagioneSchema,
  campoDot,
  formattaTarga,
  oggiISO,
  type Posizione,
} from '@tyrecare/shared';
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

  const form = app.querySelector('form')!;
  collegaDotPerRuota(form);

  collegaModulo(form, MontaPneumaticiSchema, async (dati) => {
    await montaPneumatici(veicolo.id, dati);
    vaiConConferma(
      `/veicolo?id=${veicolo.id}`,
      dati.posizioni.length === 1 ? 'Pneumatico montato.' : 'Pneumatici montati.',
    );
  });
}

const TESTO_AIUTO_DOT = 'Ultime 4 cifre: settimana e anno (es. 3823).';

/**
 * La casella «DOT diverso per ogni ruota» sta nella pagina `/veicolo/pneumatici`, usata sia da
 * «Monta pneumatici» sia da «Cambia pneumatici», sotto il DOT unico. Spuntata, il campo unico si
 * disattiva (non viene inviato) e compare un campo per ogni posizione scelta; i campi seguono le
 * caselle delle posizioni senza perdere quanto già scritto per le ruote che restano. Tolta la
 * spunta, i campi per ruota spariscono dal modulo e il campo unico si riattiva.
 */
function collegaDotPerRuota(form: HTMLFormElement): void {
  const dotUnico = form.querySelector<HTMLInputElement>('input[name="dot"]');
  const coppia = dotUnico?.closest('.tc-auth__coppia');
  if (!dotUnico || !coppia) return;

  const blocco = document.createElement('div');
  blocco.className = 'tc-campo';
  // La casella non ha `name`: non fa parte dei dati dello schema
  blocco.innerHTML = `
    <label class="tc-caselle__voce">
      <input class="form-check-input" type="checkbox" data-dot-per-ruota />
      <span>DOT diverso per ogni ruota</span>
    </label>
    <div data-dot-ruote></div>`;
  coppia.after(blocco);
  const casella = blocco.querySelector<HTMLInputElement>('[data-dot-per-ruota]')!;
  const contenitore = blocco.querySelector<HTMLElement>('[data-dot-ruote]')!;

  const aggiorna = () => {
    dotUnico.disabled = casella.checked;
    const scelte = new Set(
      [...form.querySelectorAll<HTMLInputElement>('input[name="posizioni"]:checked')].map(
        (c) => c.value,
      ),
    );
    const campi = casella.checked
      ? ORDINE_POSIZIONI.filter((p) => scelte.has(p)).map((p) => voceRuota(contenitore, p))
      : [];
    // Gli elementi già presenti vengono solo spostati: valori ed errori restano
    contenitore.replaceChildren(...campi);
  };
  casella.addEventListener('change', aggiorna);
  form.addEventListener('change', (e) => {
    if ((e.target as HTMLInputElement).name === 'posizioni') aggiorna();
  });
}

/** Il campo DOT di una ruota: quello già nella pagina, oppure uno nuovo. */
function voceRuota(contenitore: HTMLElement, p: Posizione): HTMLElement {
  const esistente = contenitore.querySelector<HTMLElement>(`[data-ruota="${p}"]`);
  if (esistente) return esistente;
  const div = document.createElement('div');
  div.dataset.ruota = p;
  div.innerHTML = campo({
    nome: campoDot(p),
    etichetta: `DOT ${POSIZIONI[p].nome}`,
    tipo: 'text',
    autocomplete: 'off',
    aiuto: TESTO_AIUTO_DOT,
    attributi: 'inputmode="numeric" maxlength="4"',
  });
  return div;
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
        aiuto: TESTO_AIUTO_DOT,
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

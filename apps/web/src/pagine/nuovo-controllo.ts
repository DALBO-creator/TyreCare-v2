import {
  UsuraSchema,
  campiMisura,
  creaControlloSchema,
  formattaTarga,
  oggiISO,
  statoBattistrada,
  type Posizione,
} from '@tyrecare/shared';
import { esc } from '../lib/html';
import { registraControllo, type Pneumatico } from '../lib/officina';
import { vaiA, visualizzazioneCorrente } from '../lib/router';
import { paginaApp } from '../ui/layout';
import {
  RIQUADRO_ERRORE,
  areaTesto,
  campo,
  collegaModulo,
  pulsanteInvio,
  scelta,
} from '../ui/modulo';
import { badgeStato } from '../ui/stato';
import {
  ETICHETTE_STAGIONE,
  ETICHETTE_USURA,
  ORDINE_POSIZIONI,
  POSIZIONI,
  formattaKm,
  intestazioneSottopagina,
  vaiConConferma,
} from './comune';
import { caricaSchedaDaUrl } from './veicolo';

/**
 * Nuovo controllo (PLAN P9): `/veicolo/controllo?id=…`. Pensato per il telefono o il tablet in
 * officina: un blocco per ruota, campi numerici grandi con la tastiera decimale, e lo stato della
 * ruota calcolato mentre si scrive il battistrada.
 */
export async function mostraNuovoControllo(app: HTMLElement): Promise<void> {
  const n = visualizzazioneCorrente();
  const scheda = await caricaSchedaDaUrl(app, n);
  if (!scheda) return;

  const { veicolo, pneumatici, controlli } = scheda;
  // Senza pneumatici montati non c'è nulla da misurare: prima si montano
  if (pneumatici.length === 0) {
    vaiA(`/veicolo/pneumatici?id=${veicolo.id}`, { sostituisci: true });
    return;
  }

  const montati = [...pneumatici].sort(
    (a, b) => ORDINE_POSIZIONI.indexOf(a.posizione) - ORDINE_POSIZIONI.indexOf(b.posizione),
  );
  const oggi = oggiISO();
  const kmPrecedenti = controlli.find((c) => c.km !== null)?.km;

  app.innerHTML = paginaApp(`
    ${intestazioneSottopagina('Nuovo controllo', formattaTarga(veicolo.targa))}
    <div class="tc-contenuto">
      <form class="tc-auth__modulo" novalidate>
        ${RIQUADRO_ERRORE}
        <div class="tc-auth__coppia">
          ${campo({
            nome: 'eseguito_il',
            etichetta: 'Data',
            tipo: 'date',
            autocomplete: 'off',
            valore: oggi,
            attributi: `max="${oggi}"`,
          })}
          ${campo({
            nome: 'km',
            etichetta: 'Km (facoltativi)',
            tipo: 'text',
            autocomplete: 'off',
            ...(kmPrecedenti != null && { aiuto: `L'ultima volta: ${formattaKm(kmPrecedenti)}.` }),
            attributi: 'inputmode="numeric" maxlength="9"',
          })}
        </div>

        <div class="tc-misure-griglia">
          ${montati.map(bloccoMisura).join('')}
        </div>

        ${areaTesto({
          nome: 'note',
          etichetta: 'Note (facoltative)',
          aiuto: 'Le vede anche il cliente: es. "Consigliata la convergenza".',
        })}
        ${pulsanteInvio('Salva controllo', 'Salvataggio…')}
        <a class="btn btn-outline-light btn-lg w-100" href="/veicolo?id=${veicolo.id}">Annulla</a>
      </form>
    </div>`);

  const form = app.querySelector('form')!;
  collegaStatoInDiretta(form, montati);
  collegaModulo(form, creaControlloSchema(montati.map((p) => p.posizione)), async (controllo) => {
    await registraControllo(veicolo.id, controllo);
    vaiConConferma(`/veicolo?id=${veicolo.id}`, 'Controllo salvato.');
  });
}

/** Blocco di una ruota: battistrada e pressione affiancati, poi usura e danni. */
function bloccoMisura(p: Pneumatico): string {
  const c = campiMisura(p.posizione);
  const scorta = p.posizione === 'SCORTA';
  const descrizione = [`${p.marca} ${p.modello}`.trim(), p.misura, ETICHETTE_STAGIONE[p.stagione]]
    .filter(Boolean)
    .join(' · ');
  return `
    <fieldset class="tc-misura">
      <legend class="tc-misura__titolo">
        ${POSIZIONI[p.posizione].nome}
        <small>${esc(descrizione)}</small>
      </legend>
      <div class="tc-misura__numeri">
        ${campo({
          nome: c.mm,
          etichetta: scorta ? 'Battistrada mm (facoltativo)' : 'Battistrada mm',
          tipo: 'text',
          autocomplete: 'off',
          unita: 'mm',
          attributi: 'inputmode="decimal" maxlength="4" enterkeyhint="next"',
        })}
        ${campo({
          nome: c.bar,
          etichetta: 'Pressione bar',
          tipo: 'text',
          autocomplete: 'off',
          unita: 'bar',
          attributi: 'inputmode="decimal" maxlength="4" enterkeyhint="next"',
        })}
      </div>
      <p class="tc-misura__stato" data-stato="${p.posizione}" aria-live="polite"></p>
      ${scelta({
        nome: c.usura,
        etichetta: 'Usura',
        opzioni: [
          ['', 'Non indicata'],
          ...UsuraSchema.options.map((u) => [u, ETICHETTE_USURA[u]] as const),
        ],
      })}
      ${campo({ nome: c.danni, etichetta: 'Danni (facoltativo)', tipo: 'text', autocomplete: 'off' })}
    </fieldset>`;
}

/**
 * Mentre si scrive il battistrada mostra subito lo stato della ruota (verde/giallo/rosso, con la
 * soglia della sua stagione): chi misura vede al volo se c'è da proporre una sostituzione.
 */
function collegaStatoInDiretta(form: HTMLFormElement, montati: Pneumatico[]): void {
  const stagioni = new Map(montati.map((p) => [p.posizione, p.stagione]));
  form.addEventListener('input', (e) => {
    const input = e.target as HTMLInputElement;
    const posizione = input.name.startsWith('mm_') ? (input.name.slice(3) as Posizione) : null;
    const stagione = posizione && stagioni.get(posizione);
    const box = posizione && form.querySelector<HTMLElement>(`[data-stato="${posizione}"]`);
    if (!stagione || !box) return;

    const valore = input.value.trim().replace(',', '.');
    const mm = Number(valore);
    box.innerHTML =
      valore !== '' && Number.isFinite(mm) && mm >= 0 && mm <= 20
        ? badgeStato(statoBattistrada(mm, stagione))
        : '';
  });
}

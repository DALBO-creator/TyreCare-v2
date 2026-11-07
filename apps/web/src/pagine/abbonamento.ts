import { PIANI, giorniDiProva, oggiInItalia, type Piano } from '@tyrecare/shared';
import {
  apriPortale,
  avviaPagamento,
  caricaAbbonamento,
  type AbbonamentoOfficina,
} from '../lib/abbonamento';
import { ErroreModulo } from '../lib/errori';
import { esc } from '../lib/html';
import { caricaContestoOfficina, eTitolare } from '../lib/officina';
import { ancoraAttuale, visualizzazioneCorrente } from '../lib/router';
import { caricamento, paginaApp } from '../ui/layout';
import {
  formattaData,
  gestisciErroreCaricamento,
  intestazioneSottopagina,
  mostraErroreInBox,
  nascondiBox,
  parametro,
} from './comune';

// "Abbonamento" (solo il TITOLARE): piano attuale, giorni di prova, piani disponibili e pagamento con Stripe
// (la pagina di pagamento è ospitata da Stripe: qui si sceglie il piano e si va lì).

/** Avviso al ritorno da Stripe (`?pagamento=ok|annullato`); `null` per qualsiasi altro valore. */
export function avvisoPagamento(valore: string | null): string | null {
  if (valore === 'ok') return "Pagamento ricevuto: l'abbonamento si aggiorna entro pochi minuti.";
  if (valore === 'annullato') return 'Pagamento annullato: non ti è stato addebitato nulla.';
  return null;
}

type PianoACarico = Exclude<Piano, 'PILOTA'>;
const PIANI_A_CARICO: readonly PianoACarico[] = ['STARTER', 'PRO'];

function sceltaPiano(attuale: Piano): string {
  const preselezionato: PianoACarico = attuale === 'PRO' ? 'PRO' : 'STARTER';
  const radio = PIANI_A_CARICO.map((piano) => {
    const p = PIANI[piano];
    return `<div class="form-check">
        <input class="form-check-input" type="radio" name="piano" id="tc-scelta-${piano}" value="${piano}"${piano === preselezionato ? ' checked' : ''}>
        <label class="form-check-label" for="tc-scelta-${piano}">${esc(p.nome)} — ${p.prezzoMensile} €/mese</label>
      </div>`;
  }).join('');
  return `<fieldset class="mb-3">
      <legend class="h6">Scegli il piano</legend>
      ${radio}
    </fieldset>`;
}

export function testoStato(a: AbbonamentoOfficina): string {
  if (a.piano === 'PILOTA') return 'Gratuito per tutta la durata del pilota';
  switch (a.stato) {
    case 'PROVA': {
      const giorni = giorniDiProva(a.prova_fino_al, oggiInItalia());
      if (giorni === 0) return 'La prova è finita';
      const quanti = giorni === 1 ? 'manca 1 giorno' : `mancano ${giorni} giorni`;
      return `Prova gratuita: ${quanti} (fino al ${formattaData(a.prova_fino_al)})`;
    }
    case 'ATTIVO':
      return 'Abbonamento attivo';
    case 'SCADUTO':
      return 'Abbonamento scaduto';
    case 'ANNULLATO':
      return 'Abbonamento annullato';
  }
}

/** Pulsante e nota del pagamento solo se c'è qualcosa da pagare: non per il pilota né per chi è già a posto. */
export function mostraPagamento(a: AbbonamentoOfficina | null): boolean {
  return (
    a !== null &&
    a.piano !== 'PILOTA' &&
    (a.stato === 'PROVA' || a.stato === 'SCADUTO' || a.stato === 'ANNULLATO')
  );
}

/** Pulsante "Gestisci il pagamento": solo chi ha già un cliente Stripe e non è nel pilota. */
export function mostraPortale(a: AbbonamentoOfficina | null): boolean {
  return a !== null && a.piano !== 'PILOTA' && !!a.stripe_customer_id?.trim();
}

function cartaPiano(piano: Exclude<Piano, 'PILOTA'>): string {
  const p = PIANI[piano];
  return `
    <section class="tc-lista p-3" aria-labelledby="tc-piano-${piano}">
      <h3 id="tc-piano-${piano}" class="h5 mb-1">${esc(p.nome)}</h3>
      <p class="fw-bold mb-2">${p.prezzoMensile} €/mese</p>
      <ul class="mb-0 ps-3">
        ${p.funzioni.map((f) => `<li>${esc(f)}</li>`).join('')}
      </ul>
    </section>`;
}

export async function mostraAbbonamento(app: HTMLElement): Promise<void> {
  const n = visualizzazioneCorrente();
  app.innerHTML = paginaApp(caricamento());
  let titolare: boolean;
  let officinaId: string;
  let abbonamento: AbbonamentoOfficina | null = null;
  try {
    const contesto = await caricaContestoOfficina();
    officinaId = contesto.attiva.officina.id;
    titolare = eTitolare(contesto.officine, officinaId);
    if (titolare) abbonamento = await caricaAbbonamento(officinaId);
  } catch (errore) {
    await gestisciErroreCaricamento(app, n, errore);
    return;
  }
  if (!ancoraAttuale(n)) return;

  if (!titolare) {
    app.innerHTML = paginaApp(`
      ${intestazioneSottopagina('Abbonamento', 'Officina')}
      <div class="tc-contenuto">
        <div class="tc-avviso tc-avviso--giallo" role="status">
          <p class="mb-0">Solo il titolare vede l'abbonamento.</p>
        </div>
      </div>`);
    return;
  }

  const attuale = abbonamento
    ? `<p class="mb-1"><strong>${esc(PIANI[abbonamento.piano].nome)}</strong></p>
       <p class="mb-0">${esc(testoStato(abbonamento))}</p>`
    : '<p class="mb-0">Abbonamento non trovato: scrivici con «Invia un commento».</p>';

  let azione = '';
  if (mostraPagamento(abbonamento)) {
    azione = `${sceltaPiano(abbonamento?.piano ?? 'STARTER')}
      <div class="tc-avviso tc-avviso--rosso mb-3" data-errore-pagamento role="alert" tabindex="-1" hidden></div>
      <button type="button" class="btn btn-primary btn-lg w-100" data-attiva>Attiva l'abbonamento</button>`;
  } else if (abbonamento) {
    azione = '<p class="mb-0">Il tuo abbonamento è a posto: non devi fare nulla.</p>';
  }
  if (mostraPortale(abbonamento)) {
    azione += `
      <div class="tc-avviso tc-avviso--rosso mb-3 mt-3" data-errore-portale role="alert" tabindex="-1" hidden></div>
      <button type="button" class="btn btn-outline-primary w-100 mt-3" data-portale>Gestisci il pagamento</button>`;
  }

  const testoAvviso = avvisoPagamento(parametro('pagamento'));
  const avviso = testoAvviso
    ? `<div class="tc-avviso tc-avviso--verde" role="status"><p class="mb-0">${esc(testoAvviso)}</p></div>`
    : '';

  app.innerHTML = paginaApp(`
    ${intestazioneSottopagina('Abbonamento', 'Officina')}
    <div class="tc-contenuto">
      ${avviso}
      <section aria-labelledby="tc-attuale">
        <h2 id="tc-attuale" class="tc-etichetta">Il tuo piano</h2>
        ${attuale}
      </section>
      <section aria-labelledby="tc-piani">
        <h2 id="tc-piani" class="tc-etichetta">Piani disponibili</h2>
        <div class="d-grid gap-3">
          ${cartaPiano('STARTER')}
          ${cartaPiano('PRO')}
        </div>
      </section>
${azione}
    </div>`);

  collegaAzione(
    app.querySelector<HTMLButtonElement>('[data-attiva]'),
    app.querySelector<HTMLElement>('[data-errore-pagamento]'),
    () => {
      const scelto = app.querySelector<HTMLInputElement>('input[name="piano"]:checked')?.value;
      return avviaPagamento(officinaId, scelto === 'PRO' ? 'PRO' : 'STARTER');
    },
  );
  collegaAzione(
    app.querySelector<HTMLButtonElement>('[data-portale]'),
    app.querySelector<HTMLElement>('[data-errore-portale]'),
    () => apriPortale(officinaId),
  );
}

/** Click che porta a Stripe: pulsante disattivato durante la chiamata, errore nel suo box e pulsante riattivato. */
function collegaAzione(
  pulsante: HTMLButtonElement | null,
  boxErrore: HTMLElement | null,
  azione: () => Promise<void>,
): void {
  pulsante?.addEventListener('click', async () => {
    pulsante.disabled = true;
    nascondiBox(boxErrore);
    try {
      await azione();
      // Si lascia il pulsante disattivato: il browser sta andando alla pagina di Stripe.
    } catch (errore) {
      mostraErroreInBox(
        boxErrore,
        errore instanceof ErroreModulo
          ? errore.message
          : 'Non riusciamo ad aprire il pagamento. Riprova tra poco.',
      );
      pulsante.disabled = false;
    }
  });
}

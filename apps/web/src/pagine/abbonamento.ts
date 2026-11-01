import { PIANI, giorniDiProva, oggiInItalia, type Piano } from '@tyrecare/shared';
import { caricaAbbonamento, type AbbonamentoOfficina } from '../lib/abbonamento';
import { esc } from '../lib/html';
import { caricaContestoOfficina, eTitolare } from '../lib/officina';
import { ancoraAttuale, visualizzazioneCorrente } from '../lib/router';
import { caricamento, paginaApp } from '../ui/layout';
import { formattaData, gestisciErroreCaricamento, intestazioneSottopagina } from './comune';

// "Abbonamento" (solo il TITOLARE): piano attuale, giorni di prova e piani disponibili. Il pagamento online
// arriverà con Stripe: per ora il pulsante è disattivato.

const NOTA_PAGAMENTO =
  'Il pagamento online arriva a breve: per ora scrivici con «Invia un commento».';

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
  let abbonamento: AbbonamentoOfficina | null = null;
  try {
    const contesto = await caricaContestoOfficina();
    const officinaId = contesto.attiva.officina.id;
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
    azione = `<button type="button" class="btn btn-primary btn-lg w-100" disabled>Attiva l'abbonamento</button>
      <p class="text-body-secondary">${esc(NOTA_PAGAMENTO)}</p>`;
  } else if (abbonamento) {
    azione = '<p class="mb-0">Il tuo abbonamento è a posto: non devi fare nulla.</p>';
  }

  app.innerHTML = paginaApp(`
    ${intestazioneSottopagina('Abbonamento', 'Officina')}
    <div class="tc-contenuto">
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
}

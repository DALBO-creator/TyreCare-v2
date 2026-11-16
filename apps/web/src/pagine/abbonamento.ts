import {
  CONTATTO_EMAIL,
  FUNZIONI_INCLUSE,
  GIORNI_PROVA,
  PIANI,
  PREZZO_INSTALLAZIONE,
  PianoSchema,
  formattaEuro,
  linkContatto,
  oggiInItalia,
  prezzoPiano,
  type Piano,
} from '@tyrecare/shared';
import { Check, Mail } from 'lucide';
import {
  COLORE_STATO_ABBONAMENTO,
  ETICHETTE_STATO_ABBONAMENTO,
  caricaAbbonamento,
  descrizionePiano,
  riassuntoAbbonamento,
  testoRichiesta,
  type AbbonamentoOfficina,
} from '../lib/abbonamento';
import { esc } from '../lib/html';
import { caricaContestoOfficina, eTitolare } from '../lib/officina';
import { ancoraAttuale, visualizzazioneCorrente } from '../lib/router';
import { icona } from '../ui/icone';
import { caricamento, paginaApp } from '../ui/layout';
import { formattaData, gestisciErroreCaricamento, intestazioneSottopagina } from './comune';

// "Abbonamento" (solo il TITOLARE), in sola lettura: piano, stato, prossima scadenza, cosa è incluso e
// prezzi. Nell'app non si paga: per attivare, rinnovare o cambiare piano si scrive a TyreCare e
// l'amministratore aggiorna l'abbonamento quando riceve il bonifico.

const TONO_AVVISO = { ok: 'verde', attenzione: 'giallo', azione: 'rosso' } as const;

function riga(etichetta: string, valore: string): string {
  return `<div class="tc-abbonamento__riga"><dt>${esc(etichetta)}</dt><dd>${valore}</dd></div>`;
}

function situazione(a: AbbonamentoOfficina): string {
  const r = riassuntoAbbonamento(a, oggiInItalia(), formattaData);
  const installazione = a.installazione_pagata
    ? `Pagata${a.installazione_pagata_il ? ` il ${esc(formattaData(a.installazione_pagata_il))}` : ''}`
    : `Da pagare (${formattaEuro(PREZZO_INSTALLAZIONE)} una tantum)`;
  return `
    <div class="tc-avviso tc-avviso--${TONO_AVVISO[r.tono]}" role="status" data-stato-abbonamento>
      <div>
        <p class="mb-0 fw-semibold">${esc(r.titolo)}</p>
        ${r.dettaglio ? `<p class="mb-0">${esc(r.dettaglio)}</p>` : ''}
      </div>
    </div>
    <dl class="tc-abbonamento tc-lista">
      ${riga(
        'Stato',
        `<span class="tc-stato tc-stato--${COLORE_STATO_ABBONAMENTO[a.stato]}">${ETICHETTE_STATO_ABBONAMENTO[a.stato]}</span>`,
      )}
      ${riga('Piano', esc(descrizionePiano(a)))}
      ${a.iniziato_il ? riga('Abbonato dal', esc(formattaData(a.iniziato_il))) : ''}
      ${
        a.scade_il
          ? riga('Prossima scadenza', esc(formattaData(a.scade_il)))
          : riga('Fine della prova', esc(formattaData(a.prova_fino_al)))
      }
      ${riga('Installazione', installazione)}
    </dl>`;
}

function cartaPiano(piano: Piano, attuale: Piano | null): string {
  const p = PIANI[piano];
  return `
    <section class="tc-officine__piano" aria-labelledby="tc-piano-${piano}">
      <h3 id="tc-piano-${piano}" class="tc-officine__piano-nome">${esc(p.nome)}${
        piano === attuale ? ' <span class="tc-stato tc-stato--nessuno">Il tuo piano</span>' : ''
      }</h3>
      <p class="tc-officine__piano-prezzo">${esc(prezzoPiano(piano))}</p>
      ${p.nota ? `<p class="mb-0 text-body-secondary">${esc(p.nota)}</p>` : ''}
    </section>`;
}

export async function mostraAbbonamento(app: HTMLElement): Promise<void> {
  const n = visualizzazioneCorrente();
  app.innerHTML = paginaApp(caricamento());
  let titolare: boolean;
  let ragioneSociale: string;
  let abbonamento: AbbonamentoOfficina | null = null;
  try {
    const contesto = await caricaContestoOfficina();
    const { officina } = contesto.attiva;
    ragioneSociale = officina.ragione_sociale;
    titolare = eTitolare(contesto.officine, officina.id);
    if (titolare) abbonamento = await caricaAbbonamento(officina.id);
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

  const contatto = linkContatto(
    `Abbonamento TyreCare — ${ragioneSociale}`,
    testoRichiesta(ragioneSociale),
  );

  app.innerHTML = paginaApp(`
    ${intestazioneSottopagina('Abbonamento', 'Officina')}
    <div class="tc-contenuto">
      <section aria-labelledby="tc-attuale">
        <h2 id="tc-attuale" class="tc-etichetta">Il tuo abbonamento</h2>
        ${
          abbonamento
            ? situazione(abbonamento)
            : `<div class="tc-avviso tc-avviso--giallo" role="status">
                <p class="mb-0">Non troviamo l'abbonamento della tua officina: scrivici e lo sistemiamo.</p>
              </div>`
        }
      </section>

      <section aria-labelledby="tc-prezzi">
        <h2 id="tc-prezzi" class="tc-etichetta">Prezzi</h2>
        <div class="tc-officine__piani">
          ${PianoSchema.options.map((p) => cartaPiano(p, abbonamento?.piano ?? null)).join('')}
        </div>
        <p class="small text-body-secondary mt-2 mb-0">
          Installazione e avvio: ${formattaEuro(PREZZO_INSTALLAZIONE)} una tantum. Prezzi IVA esclusa.
          I primi ${GIORNI_PROVA} giorni sono di prova gratuita.
        </p>
      </section>

      <section aria-labelledby="tc-incluso">
        <h2 id="tc-incluso" class="tc-etichetta">Cosa è incluso</h2>
        <ul class="tc-abbonamento__incluso">
          ${FUNZIONI_INCLUSE.map((f) => `<li>${icona(Check)}<span>${esc(f)}</span></li>`).join('')}
        </ul>
      </section>

      <section class="tc-azione" aria-labelledby="tc-rinnova">
        <h2 id="tc-rinnova" class="tc-etichetta">Rinnovare o cambiare piano</h2>
        <p>
          Il pagamento avviene con bonifico, su fattura: nell'app non si paga nulla. Scrivici e ti
          mandiamo i dati; appena riceviamo il pagamento aggiorniamo qui la scadenza.
        </p>
        <a class="btn btn-primary btn-lg w-100" href="${esc(contatto)}" data-contatta>
          ${icona(Mail)} Scrivi a TyreCare
        </a>
        <p class="small text-body-secondary text-center mt-2 mb-0">${esc(CONTATTO_EMAIL)}</p>
      </section>
    </div>`);
}

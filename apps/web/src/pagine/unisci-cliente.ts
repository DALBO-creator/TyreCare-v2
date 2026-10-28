import { GitMerge, Search, UserRound } from 'lucide';
import { formattaTarga } from '@tyrecare/shared';
import { esc } from '../lib/html';
import {
  caricaCliente,
  caricaElencoClienti,
  eTitolare,
  nominativo,
  unisciClienti,
  type ClienteConVeicoli,
  type SchedaCliente,
} from '../lib/officina';
import { caricaDatiUtente } from '../lib/profilo';
import { ancoraAttuale, visualizzazioneCorrente } from '../lib/router';
import { chiediConferma } from '../ui/conferma';
import { icona } from '../ui/icone';
import { caricamento, paginaApp } from '../ui/layout';
import {
  gestisciErroreCaricamento,
  idValido,
  intestazioneSottopagina,
  parametro,
  vaiConConferma,
} from './comune';
import { filtraClienti } from './clienti';
import { nonTrovato } from './veicolo';

/**
 * Unisce il cliente attuale con un doppione: `/cliente/unisci?id=…`. Resta la scheda attuale; il
 * cliente scelto viene eliminato e i suoi veicoli passano all'attuale. Solo il TITOLARE.
 */
export async function mostraUnisciCliente(app: HTMLElement): Promise<void> {
  const n = visualizzazioneCorrente();
  app.innerHTML = paginaApp(caricamento());

  const id = parametro('id') ?? '';
  let cliente: SchedaCliente | null = null;
  let titolare = false;
  let altri: ClienteConVeicoli[] = [];
  try {
    if (idValido(id)) {
      const [c, utente] = await Promise.all([caricaCliente(id), caricaDatiUtente()]);
      if (c && utente.officine.some((o) => o.officina.id === c.officina_id)) {
        cliente = c;
        titolare = eTitolare(utente.officine, c.officina_id);
        if (titolare) {
          altri = (await caricaElencoClienti(c.officina_id)).filter((x) => x.id !== c.id);
        }
      }
    }
  } catch (errore) {
    await gestisciErroreCaricamento(app, n, errore);
    return;
  }
  if (!ancoraAttuale(n)) return;
  if (!cliente) {
    app.innerHTML = paginaApp(nonTrovato('Cliente non trovato', 'Il cliente'));
    return;
  }

  const attuale = cliente;
  const nome = nominativo(attuale);
  const indietro = `/cliente?id=${attuale.id}`;
  document.title = `Unisci clienti · TyreCare`;

  if (!titolare) {
    app.innerHTML = paginaApp(`
      ${intestazioneSottopagina('Unisci clienti', nome)}
      <div class="tc-contenuto">
        <p>Solo il titolare dell'officina può unire due clienti.</p>
        <a class="btn btn-outline-light btn-lg w-100" href="${indietro}">Torna al cliente</a>
      </div>`);
    return;
  }

  app.innerHTML = paginaApp(`
    ${intestazioneSottopagina('Unisci clienti', nome)}
    <div class="tc-contenuto">
      <p>Resta questa scheda: <strong>${esc(nome)}</strong></p>
      <p class="text-body-secondary mb-0">
        Scegli il doppione: i suoi veicoli e i suoi dati passano a questa scheda e la sua scheda viene
        eliminata.
      </p>
      ${
        altri.length > 0
          ? `<div class="tc-ricerca">
              <label class="form-label" for="tc-cerca">Cerca per nome, telefono, email o targa</label>
              <div class="tc-ricerca__campo">
                ${icona(Search)}
                <input class="form-control form-control-lg" id="tc-cerca" type="search"
                  autocomplete="off" spellcheck="false" enterkeyhint="search" />
              </div>
            </div>
            <p class="visually-hidden" aria-live="polite" data-conteggio></p>
            <div data-elenco></div>`
          : `<p class="text-body-secondary">Non ci sono altri clienti da unire a questo.</p>`
      }
      <a class="btn btn-outline-light btn-lg w-100" href="${indietro}">Annulla</a>
    </div>`);

  if (altri.length === 0) return;
  const elenco = app.querySelector<HTMLElement>('[data-elenco]')!;
  const conteggio = app.querySelector<HTMLElement>('[data-conteggio]')!;
  const cerca = app.querySelector<HTMLInputElement>('#tc-cerca')!;

  const disegna = () => {
    const trovati = filtraClienti(altri, cerca.value);
    conteggio.textContent =
      trovati.length === 1 ? '1 cliente trovato' : `${trovati.length} clienti trovati`;
    elenco.innerHTML =
      trovati.length > 0
        ? `<div class="tc-lista">${trovati.map(rigaScelta).join('')}</div>`
        : `<p class="text-body-secondary">Nessun cliente corrisponde alla ricerca.</p>`;
  };
  cerca.addEventListener('input', disegna);

  elenco.addEventListener('click', (e) => {
    const pulsante = (e.target as Element).closest<HTMLElement>('[data-scelto]');
    const scelto = altri.find((x) => x.id === pulsante?.dataset.scelto);
    if (!pulsante || !scelto) return;
    const nomeScelto = nominativo(scelto);
    chiediConferma({
      titolo: 'Unire i due clienti?',
      testo: `I veicoli e i dati di «${nomeScelto}» passano a «${nome}». La scheda di «${nomeScelto}» viene eliminata.`,
      pulsante: 'Unisci',
      iconaPulsante: GitMerge,
      inCorso: 'Unione…',
      origine: pulsante,
      azione: async () => {
        await unisciClienti(scelto.id, attuale.id);
        vaiConConferma(indietro, 'Clienti uniti.');
      },
    });
  });
  disegna();
}

function rigaScelta(c: ClienteConVeicoli): string {
  const targhe = c.veicoli.map((v) => formattaTarga(v.targa));
  const dettagli = [
    targhe.length === 0
      ? 'Nessun veicolo'
      : targhe.length <= 2
        ? targhe.join(', ')
        : `${targhe.slice(0, 2).join(', ')} e altri ${targhe.length - 2}`,
    c.telefono ?? c.email ?? '',
  ].filter(Boolean);
  return `
    <button type="button" class="tc-lista__riga w-100 text-start" data-scelto="${esc(c.id)}">
      <span class="tc-lista__icona">${icona(UserRound)}</span>
      <span class="tc-lista__testo">
        ${esc(nominativo(c))}
        <small>${esc(dettagli.join(' · '))}</small>
      </span>
    </button>`;
}

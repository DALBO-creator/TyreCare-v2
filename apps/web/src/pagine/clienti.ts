import { Search, UserPlus, UserRound, Users } from 'lucide';
import { formattaTarga, normalizzaTarga } from '@tyrecare/shared';
import { esc } from '../lib/html';
import {
  caricaContestoOfficina,
  caricaElencoClienti,
  nominativo,
  type ClienteConVeicoli,
} from '../lib/officina';
import { ancoraAttuale, visualizzazioneCorrente } from '../lib/router';
import { icona } from '../ui/icone';
import { caricamento, paginaApp } from '../ui/layout';
import { avvisoConferma, gestisciErroreCaricamento } from './comune';

/** Elenco dei clienti dell'officina attiva, con ricerca: `/clienti`. */
export async function mostraClienti(app: HTMLElement): Promise<void> {
  const n = visualizzazioneCorrente();
  app.innerHTML = paginaApp(caricamento());

  let officina: string;
  let clienti: ClienteConVeicoli[];
  try {
    const { attiva } = await caricaContestoOfficina();
    officina = attiva.officina.ragione_sociale;
    clienti = await caricaElencoClienti(attiva.officina.id);
  } catch (errore) {
    await gestisciErroreCaricamento(app, n, errore);
    return;
  }
  if (!ancoraAttuale(n)) return;

  app.innerHTML = paginaApp(`
    <section class="tc-hero">
      <p class="tc-etichetta">Area officina · ${esc(officina)}</p>
      <h1 class="tc-hero__modello tc-hero__modello--saluto" tabindex="-1">Clienti</h1>
    </section>

    <div class="tc-contenuto">
      ${avvisoConferma()}
      <a class="btn btn-primary btn-lg w-100" href="/clienti/nuovo?da=clienti">
        ${icona(UserPlus)} Nuovo cliente
      </a>

      <section aria-labelledby="tc-clienti">
        <h2 id="tc-clienti" class="tc-etichetta">
          ${clienti.length === 1 ? '1 cliente' : `${clienti.length} clienti`}
        </h2>
        ${
          clienti.length > 0
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
            : `<div class="tc-vuoto">
                <span class="tc-vuoto__icona">${icona(Users)}</span>
                <p class="tc-vuoto__titolo">Ancora nessun cliente</p>
                <p class="tc-vuoto__testo">
                  Aggiungi il primo cliente con "Nuovo cliente", oppure registralo insieme al suo
                  veicolo.
                </p>
              </div>`
        }
      </section>
    </div>`);

  if (clienti.length > 0) collegaElenco(app, clienti);
}

/** Testo in cui cercare: nome, contatti e targhe (senza spazi, come le salva il database). */
const testoRicerca = (c: ClienteConVeicoli): string =>
  [nominativo(c), c.nome, c.cognome, c.email ?? '', ...c.veicoli.map((v) => v.targa)]
    .join(' ')
    .toLowerCase();

/** Solo le cifre del telefono: "333 123 4567" si trova anche scrivendo "3331234567". */
const cifre = (testo: string) => testo.replace(/\D/g, '');

function collegaElenco(app: HTMLElement, clienti: ClienteConVeicoli[]): void {
  const elenco = app.querySelector<HTMLElement>('[data-elenco]')!;
  const conteggio = app.querySelector<HTMLElement>('[data-conteggio]')!;
  const cerca = app.querySelector<HTMLInputElement>('#tc-cerca')!;

  const disegna = () => {
    const testo = cerca.value.trim().toLowerCase();
    const targa = normalizzaTarga(testo.toUpperCase()).toLowerCase();
    const numero = cifre(testo);
    const trovati = clienti.filter((c) => {
      if (!testo) return true;
      const dove = testoRicerca(c);
      return (
        dove.includes(testo) ||
        (targa !== '' && dove.includes(targa)) ||
        (numero.length >= 3 && cifre(c.telefono ?? '').includes(numero))
      );
    });

    conteggio.textContent =
      trovati.length === 1 ? '1 cliente trovato' : `${trovati.length} clienti trovati`;
    elenco.innerHTML =
      trovati.length > 0
        ? `<div class="tc-lista">${trovati.map(rigaCliente).join('')}</div>`
        : nessunRisultato(testo);
  };

  cerca.addEventListener('input', disegna);
  elenco.addEventListener('click', (e) => {
    if (!(e.target as Element).closest('[data-mostra-tutti]')) return;
    cerca.value = '';
    disegna();
    cerca.focus();
  });
  disegna();
}

function rigaCliente(c: ClienteConVeicoli): string {
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
    <a class="tc-lista__riga" href="/cliente?id=${c.id}">
      <span class="tc-lista__icona">${icona(UserRound)}</span>
      <span class="tc-lista__testo">
        ${esc(nominativo(c))}
        <small>${esc(dettagli.join(' · '))}</small>
      </span>
    </a>`;
}

function nessunRisultato(testo: string): string {
  return `
    <div class="tc-vuoto">
      <span class="tc-vuoto__icona">${icona(Search)}</span>
      <p class="tc-vuoto__titolo">Nessun cliente per «${esc(testo)}»</p>
      <p class="tc-vuoto__testo">
        Prova con il cognome, il numero di telefono o la targa di un suo veicolo.
      </p>
      <button type="button" class="btn btn-outline-light mt-3" data-mostra-tutti>
        Mostra tutti i clienti
      </button>
    </div>`;
}

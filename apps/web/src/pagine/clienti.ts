import { FileUp, Search, UserPlus, UserRound, Users } from 'lucide';
import { formattaTarga, normalizzaTarga } from '@tyrecare/shared';
import { esc } from '../lib/html';
import {
  caricaContestoOfficina,
  caricaElencoClienti,
  eTitolare,
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
  let titolare: boolean;
  try {
    const { attiva, officine } = await caricaContestoOfficina();
    officina = attiva.officina.ragione_sociale;
    titolare = eTitolare(officine, attiva.officina.id);
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
      ${
        titolare
          ? `<a class="btn btn-outline-light w-100" href="/clienti/importa">
              ${icona(FileUp)} Importa dal gestionale
            </a>`
          : ''
      }

      <section aria-labelledby="tc-clienti">
        <h2 id="tc-clienti" class="tc-etichetta">
          ${clienti.length === 1 ? '1 cliente' : `${clienti.length} clienti`}
        </h2>
        ${
          clienti.length > 0
            ? `<div class="tc-vista" role="group" aria-label="Filtra i clienti">
                <button type="button" class="tc-vista__voce" data-senza-app="no" aria-pressed="true">
                  Tutti
                </button>
                <button type="button" class="tc-vista__voce" data-senza-app="si" aria-pressed="false">
                  Senza app (${senzaApp(clienti).length})
                </button>
              </div>
              <div class="tc-ricerca">
                <label class="form-label" for="tc-cerca">Cerca per nome, telefono, email o targa</label>
                <div class="tc-ricerca__campo">
                  ${icona(Search)}
                  <input class="form-control form-control-lg" id="tc-cerca" type="search"
                    autocomplete="off" spellcheck="false" enterkeyhint="search" />
                </div>
              </div>
              <p class="visually-hidden" aria-live="polite" data-conteggio></p>
              <div data-elenco></div>`
            : statoNessunCliente()
        }
      </section>
    </div>`);

  if (clienti.length > 0) collegaElenco(app, clienti);
}

/** Testo in cui cercare: nome, contatti e targhe (senza spazi, come le salva il database). */
export const testoRicerca = (c: ClienteConVeicoli): string =>
  [nominativo(c), c.nome, c.cognome, c.email ?? '', ...c.veicoli.map((v) => v.targa)]
    .join(' ')
    .toLowerCase();

/** Solo le cifre del telefono: "333 123 4567" si trova anche scrivendo "3331234567". */
export const cifre = (testo: string) => testo.replace(/\D/g, '');

/** Clienti che non hanno ancora collegato un account dell'app (da invitare). */
export const senzaApp = (clienti: ClienteConVeicoli[]): ClienteConVeicoli[] =>
  clienti.filter((c) => c.profile_id === null);

/**
 * Clienti che corrispondono a `testo` (nome, contatti, targa, telefono per cifre); vuoto = tutti.
 * Con `soloSenzaApp` restano solo quelli senza account, combinato con la ricerca.
 */
export function filtraClienti(
  clienti: ClienteConVeicoli[],
  testo: string,
  soloSenzaApp = false,
): ClienteConVeicoli[] {
  if (soloSenzaApp) clienti = senzaApp(clienti);
  const t = testo.trim().toLowerCase();
  if (!t) return clienti;
  const targa = normalizzaTarga(t.toUpperCase()).toLowerCase();
  const numero = cifre(t);
  return clienti.filter((c) => {
    const dove = testoRicerca(c);
    return (
      dove.includes(t) ||
      (targa !== '' && dove.includes(targa)) ||
      (numero.length >= 3 && cifre(c.telefono ?? '').includes(numero))
    );
  });
}

function collegaElenco(app: HTMLElement, clienti: ClienteConVeicoli[]): void {
  const elenco = app.querySelector<HTMLElement>('[data-elenco]')!;
  const conteggio = app.querySelector<HTMLElement>('[data-conteggio]')!;
  const cerca = app.querySelector<HTMLInputElement>('#tc-cerca')!;
  const pulsanti = [...app.querySelectorAll<HTMLButtonElement>('[data-senza-app]')];
  let soloSenzaApp = false;

  const disegna = () => {
    const trovati = filtraClienti(clienti, cerca.value, soloSenzaApp);

    conteggio.textContent =
      trovati.length === 1 ? '1 cliente trovato' : `${trovati.length} clienti trovati`;
    elenco.innerHTML = htmlElenco(trovati, cerca.value, soloSenzaApp);
  };

  cerca.addEventListener('input', disegna);
  for (const p of pulsanti) {
    p.addEventListener('click', () => {
      soloSenzaApp = p.dataset.senzaApp === 'si';
      for (const altro of pulsanti)
        altro.setAttribute('aria-pressed', String(altro.dataset.senzaApp === p.dataset.senzaApp));
      disegna();
    });
  }
  elenco.addEventListener('click', (e) => {
    if (!(e.target as Element).closest('[data-mostra-tutti]')) return;
    cerca.value = '';
    soloSenzaApp = false;
    for (const p of pulsanti) p.setAttribute('aria-pressed', String(p.dataset.senzaApp === 'no'));
    disegna();
    cerca.focus();
  });
  disegna();
}

/** Elenco dei clienti trovati, o lo stato vuoto con la ricerca come l'ha scritta l'utente. */
export function htmlElenco(
  trovati: ClienteConVeicoli[],
  cercaGrezza: string,
  soloSenzaApp: boolean,
): string {
  return trovati.length > 0
    ? `<div class="tc-lista">${trovati.map(rigaCliente).join('')}</div>`
    : nessunRisultato(cercaGrezza, soloSenzaApp);
}

export function rigaCliente(c: ClienteConVeicoli): string {
  const targhe = c.veicoli.map((v) => formattaTarga(v.targa));
  const dettagli = [
    targhe.length === 0
      ? 'Nessun veicolo'
      : targhe.length <= 2
        ? targhe.join(', ')
        : `${targhe.slice(0, 2).join(', ')} e altri ${targhe.length - 2}`,
    c.telefono ?? c.email ?? '',
  ].filter(Boolean);
  // Chi può vedere la lista (titolare e operatore) può anche invitare: lo stesso vale per la RPC
  const invita =
    c.profile_id === null
      ? `<a class="btn btn-sm btn-outline-light tc-lista__invita" href="/cliente/invito?id=${c.id}" aria-label="Invita ${esc(nominativo(c))} nell'app">Invita</a>`
      : '';
  return `
    <div class="tc-lista__voce">
      <a class="tc-lista__riga" href="/cliente?id=${c.id}">
        <span class="tc-lista__icona">${icona(UserRound)}</span>
        <span class="tc-lista__testo">
          ${esc(nominativo(c))}
          <small>${esc(dettagli.join(' · '))}</small>
          ${c.profile_id === null ? '<small>Non usa l’app</small>' : ''}
        </span>
      </a>
      ${invita}
    </div>`;
}

/**
 * Titolo e sottotesto dello stato vuoto (testi non escapati: vanno passati a `esc`).
 * `testo` è la ricerca grezza (si considera dopo `trim()`); `haClienti` è falso se l'officina
 * non ha ancora nessun cliente.
 */
export function testoVuoto(
  testo: string,
  soloSenzaApp: boolean,
  haClienti = true,
): { titolo: string; testo: string } {
  if (!haClienti)
    return {
      titolo: 'Ancora nessun cliente',
      testo:
        'Aggiungi il primo cliente con "Nuovo cliente", oppure registralo insieme al suo veicolo.',
    };
  const t = testo.trim();
  if (!t && soloSenzaApp)
    return {
      titolo: 'Tutti i clienti usano già l’app.',
      testo: 'Qui compaiono i clienti che non hanno ancora l’app.',
    };
  return {
    titolo: `Nessun cliente per «${t}»${soloSenzaApp ? ' tra chi non usa l’app' : ''}`,
    testo: 'Prova con il cognome, il numero di telefono o la targa di un suo veicolo.',
  };
}

function statoNessunCliente(): string {
  const vuoto = testoVuoto('', false, false);
  return `<div class="tc-vuoto">
                <span class="tc-vuoto__icona">${icona(Users)}</span>
                <p class="tc-vuoto__titolo">${esc(vuoto.titolo)}</p>
                <p class="tc-vuoto__testo">${esc(vuoto.testo)}</p>
              </div>`;
}

function nessunRisultato(testo: string, soloSenzaApp: boolean): string {
  const vuoto = testoVuoto(testo, soloSenzaApp);
  return `
    <div class="tc-vuoto">
      <span class="tc-vuoto__icona">${icona(Search)}</span>
      <p class="tc-vuoto__titolo">${esc(vuoto.titolo)}</p>
      <p class="tc-vuoto__testo">${esc(vuoto.testo)}</p>
      <button type="button" class="btn btn-outline-light mt-3" data-mostra-tutti>
        Mostra tutti i clienti
      </button>
    </div>`;
}

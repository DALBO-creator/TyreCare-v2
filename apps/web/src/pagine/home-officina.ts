import { CalendarClock, ChevronRight, CircleDashed, Plus, Search } from 'lucide';
import { formattaTarga, normalizzaTarga, oggiInItalia, type StatoSalute } from '@tyrecare/shared';
import { esc } from '../lib/html';
import {
  caricaVeicoli,
  officinaAttiva,
  scegliOfficina,
  type VeicoloInElenco,
} from '../lib/officina';
import { contaRichiesteDaConfermare } from '../lib/prenotazioni';
import type { DatiUtente } from '../lib/profilo';
import { ancoraAttuale, mostraPagina } from '../lib/router';
import { icona } from '../ui/icone';
import { caricamento, paginaApp } from '../ui/layout';
import { STATI, badgeStato } from '../ui/stato';
import {
  ETICHETTE_STATO_OFFICINA,
  avvisoConferma,
  conData,
  gestisciErroreCaricamento,
} from './comune';

type Filtro = 'TUTTI' | 'ROSSO' | 'GIALLO';

// Ordine dell'elenco: prima i veicoli che hanno bisogno dell'officina, in fondo quelli mai controllati
const URGENZA: Record<StatoSalute | 'NESSUNO', number> = {
  ROSSO: 0,
  GIALLO: 1,
  VERDE: 2,
  NESSUNO: 3,
};

/** Ordina i veicoli per urgenza e poi per targa (modifica l'array). */
export const ordinaPerUrgenza = (veicoli: VeicoloInElenco[]): VeicoloInElenco[] =>
  veicoli.sort(
    (a, b) =>
      URGENZA[a.stato ?? 'NESSUNO'] - URGENZA[b.stato ?? 'NESSUNO'] ||
      a.targa.localeCompare(b.targa),
  );

/** Home di chi lavora in un'officina: riepilogo per stato, ricerca ed elenco dei veicoli. */
export async function mostraHomeOfficina(
  app: HTMLElement,
  n: number,
  dati: DatiUtente,
): Promise<void> {
  const attiva = officinaAttiva(dati.officine)!;
  app.innerHTML = paginaApp(caricamento());

  let veicoli: VeicoloInElenco[];
  let richieste: number;
  try {
    [veicoli, richieste] = await Promise.all([
      caricaVeicoli({ officinaId: attiva.officina.id }),
      // Solo un avviso: se non si legge, la home si mostra lo stesso
      contaRichiesteDaConfermare(attiva.officina.id, oggiInItalia()).catch(() => 0),
    ]);
  } catch (errore) {
    await gestisciErroreCaricamento(app, n, errore);
    return;
  }
  if (!ancoraAttuale(n)) return;

  ordinaPerUrgenza(veicoli);
  const conta = (s: StatoSalute) => veicoli.filter((v) => v.stato === s).length;

  app.innerHTML = paginaApp(`
    <section class="tc-hero">
      <p class="tc-etichetta">Area officina · ${esc(attiva.officina.ragione_sociale)}</p>
      <h1 class="tc-hero__modello tc-hero__modello--saluto" tabindex="-1">
        Ciao${dati.profilo.nome ? `, ${esc(dati.profilo.nome)}` : ''}
      </h1>
      ${
        attiva.officina.stato_affiliazione !== 'ATTIVA'
          ? `<p class="tc-hero__dettagli">
              <span class="tc-stato-officina">
                Officina ${ETICHETTE_STATO_OFFICINA[attiva.officina.stato_affiliazione].toLowerCase()}
              </span>
            </p>`
          : ''
      }
    </section>

    <div class="tc-contenuto">
      ${avvisoConferma()}
      ${dati.officine.length > 1 ? sceltaOfficina(dati, attiva.officina.id) : ''}
      ${
        richieste
          ? `<a class="tc-avviso tc-avviso--giallo tc-avviso--link" href="/appuntamenti">
              ${icona(CalendarClock)}
              <p class="mb-0">
                <strong>${richieste === 1 ? '1 richiesta' : `${richieste} richieste`} di appuntamento</strong>
                da confermare
              </p>
              ${icona(ChevronRight)}
            </a>`
          : ''
      }

      <div class="tc-riepilogo" role="group" aria-label="Filtra i veicoli per stato">
        ${voceRiepilogo('TUTTI', veicoli.length, 'Veicoli')}
        ${voceRiepilogo('ROSSO', conta('ROSSO'), STATI.ROSSO.etichetta)}
        ${voceRiepilogo('GIALLO', conta('GIALLO'), STATI.GIALLO.etichetta)}
      </div>

      <a class="btn btn-primary btn-lg w-100" href="/veicoli/nuovo">${icona(Plus)} Nuovo veicolo</a>

      <section aria-labelledby="tc-veicoli">
        <h2 id="tc-veicoli" class="tc-etichetta">Veicoli</h2>
        ${
          veicoli.length > 0
            ? `<div class="tc-ricerca">
                <label class="form-label" for="tc-cerca">Cerca per targa, cliente o modello</label>
                <div class="tc-ricerca__campo">
                  ${icona(Search)}
                  <input class="form-control form-control-lg" id="tc-cerca" type="search"
                    autocomplete="off" autocapitalize="characters" spellcheck="false"
                    enterkeyhint="search" />
                </div>
              </div>
              <p class="visually-hidden" aria-live="polite" data-conteggio></p>
              <div data-elenco></div>`
            : `<div class="tc-vuoto">
                <span class="tc-vuoto__icona">${icona(CircleDashed)}</span>
                <p class="tc-vuoto__titolo">Ancora nessun veicolo</p>
                <p class="tc-vuoto__testo">
                  Registra il primo veicolo con "Nuovo veicolo": poi potrai montare gli pneumatici e
                  inserire i controlli.
                </p>
              </div>`
        }
      </section>
    </div>`);

  app.querySelector<HTMLSelectElement>('#tc-officina')?.addEventListener('change', (e) => {
    scegliOfficina((e.target as HTMLSelectElement).value);
    void mostraPagina();
  });
  if (veicoli.length > 0) collegaElenco(app, veicoli);
}

function sceltaOfficina({ officine }: DatiUtente, attivaId: string): string {
  return `
    <div class="tc-campo">
      <label class="form-label" for="tc-officina">Officina</label>
      <select class="form-select form-select-lg" id="tc-officina">
        ${officine
          .map(
            ({ officina }) =>
              `<option value="${officina.id}"${officina.id === attivaId ? ' selected' : ''}>
                ${esc(officina.ragione_sociale)}</option>`,
          )
          .join('')}
      </select>
    </div>`;
}

function voceRiepilogo(filtro: Filtro, numero: number, etichetta: string): string {
  const stato = filtro === 'TUTTI' ? undefined : STATI[filtro];
  return `
    <button type="button" class="tc-riepilogo__voce${stato ? ` tc-riepilogo__voce--${stato.classe}` : ''}"
      data-filtro="${filtro}" aria-pressed="${filtro === 'TUTTI'}">
      <span class="tc-riepilogo__numero">${numero}</span>
      <span class="tc-riepilogo__etichetta">${stato ? icona(stato.icona) : ''}${esc(etichetta)}</span>
    </button>`;
}

/** Filtro per stato e ricerca: l'elenco si ridisegna nel browser, senza ricaricare i dati. */
function collegaElenco(app: HTMLElement, veicoli: VeicoloInElenco[]): void {
  const elenco = app.querySelector<HTMLElement>('[data-elenco]')!;
  const conteggio = app.querySelector<HTMLElement>('[data-conteggio]')!;
  const cerca = app.querySelector<HTMLInputElement>('#tc-cerca')!;
  const pulsanti = [...app.querySelectorAll<HTMLButtonElement>('[data-filtro]')];
  let filtro: Filtro = 'TUTTI';

  const disegna = () => {
    const testo = cerca.value.trim().toLowerCase();
    const targa = normalizzaTarga(testo.toUpperCase());
    const trovati = veicoli.filter(
      (v) =>
        (filtro === 'TUTTI' || v.stato === filtro) &&
        (!testo ||
          (targa !== '' && v.targa.includes(targa)) ||
          `${v.cliente} ${v.marca} ${v.modello}`.toLowerCase().includes(testo)),
    );

    conteggio.textContent =
      trovati.length === 1 ? '1 veicolo trovato' : `${trovati.length} veicoli trovati`;
    elenco.innerHTML =
      trovati.length > 0
        ? `<div class="tc-lista">${trovati.map((v) => rigaVeicolo(v)).join('')}</div>`
        : nessunRisultato(testo);
  };

  const impostaFiltro = (nuovo: Filtro) => {
    filtro = nuovo;
    for (const p of pulsanti) p.setAttribute('aria-pressed', String(p.dataset.filtro === filtro));
    disegna();
  };

  for (const p of pulsanti) {
    // Un secondo tocco sul filtro attivo torna a "tutti"
    p.addEventListener('click', () =>
      impostaFiltro(p.dataset.filtro === filtro ? 'TUTTI' : (p.dataset.filtro as Filtro)),
    );
  }
  cerca.addEventListener('input', disegna);
  elenco.addEventListener('click', (e) => {
    if (!(e.target as Element).closest('[data-mostra-tutti]')) return;
    cerca.value = '';
    impostaFiltro('TUTTI');
    cerca.focus();
  });
  disegna();
}

/** Riga di un veicolo nell'elenco; `senzaCliente` per la scheda del cliente, dove il nome è già sopra. */
export function rigaVeicolo(v: VeicoloInElenco, senzaCliente = false): string {
  const veicolo = `${v.marca} ${v.modello}`.trim();
  const dettagli = [
    senzaCliente ? '' : v.cliente || 'Nessun cliente',
    v.ultimoControllo ? `controllo ${conData('del', v.ultimoControllo)}` : '',
  ].filter(Boolean);
  return `
    <a class="tc-lista__riga tc-veicolo-riga" href="/veicolo?id=${v.id}">
      <span class="tc-lista__testo">
        <span class="tc-veicolo-riga__titolo">
          <span class="tc-targa">${esc(formattaTarga(v.targa))}</span>
          ${veicolo ? `<span>${esc(veicolo)}</span>` : ''}
        </span>
        <small>${esc(dettagli.join(' · '))}</small>
      </span>
      ${
        v.stato
          ? badgeStato(v.stato)
          : `<span class="tc-stato tc-stato--nessuno">${icona(CircleDashed)}Nessun controllo</span>`
      }
    </a>`;
}

function nessunRisultato(testo: string): string {
  return `
    <div class="tc-vuoto">
      <span class="tc-vuoto__icona">${icona(Search)}</span>
      <p class="tc-vuoto__titolo">
        ${testo ? `Nessun veicolo per «${esc(testo)}»` : 'Nessun veicolo in questo stato'}
      </p>
      <p class="tc-vuoto__testo">
        Controlla la targa o prova con il cognome del cliente. Se il veicolo è nuovo, registralo con
        "Nuovo veicolo".
      </p>
      <button type="button" class="btn btn-outline-light mt-3" data-mostra-tutti>
        Mostra tutti i veicoli
      </button>
    </div>`;
}

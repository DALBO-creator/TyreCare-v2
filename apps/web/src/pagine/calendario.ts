import { CalendarDays, ChevronLeft, ChevronRight, List, Moon } from 'lucide';
import {
  aggiungiGiorni,
  chiusuraIl,
  fasceAperte,
  formattaTarga,
  giornoSettimana,
  oggiInItalia,
  testoChiusura,
  type Fascia,
} from '@tyrecare/shared';
import {
  agendaDelGiorno,
  caricaOrari,
  caricaSettimana,
  contaPerGiorno,
  giorniSettimana,
  lunediDi,
  posizioneInAgenda,
} from '../lib/calendario';
import { esc } from '../lib/html';
import { caricaContestoOfficina } from '../lib/officina';
import { caricaChiusure, type ChiusuraOfficina } from '../lib/orari';
import type { Prenotazione } from '../lib/prenotazioni';
import { ancoraAttuale, visualizzazioneCorrente } from '../lib/router';
import { icona } from '../ui/icone';
import { caricamento, paginaApp } from '../ui/layout';
import {
  ETICHETTE_FASCIA,
  badgePrenotazione,
  formattaGiornoTitolo,
  righeOrari,
} from '../ui/prenotazione';
import { gestisciErroreCaricamento, parametro } from './comune';

// Calendario degli appuntamenti dell'officina (Fase 4): striscia della settimana in alto, agenda del
// giorno scelto sotto, divisa in mattina e pomeriggio. `?giorno=AAAA-MM-GG` apre un giorno preciso.

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const SIGLE = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];

const FORMATO_MESE = new Intl.DateTimeFormat('it-IT', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});
const giornoDelMese = (data: string) => Number(data.slice(8, 10));

/** "12 – 18 ottobre" oppure "26 ottobre – 1 novembre". */
function titoloSettimana(giorni: string[]): string {
  const [primo, ultimo] = [giorni[0]!, giorni[6]!];
  const fine = FORMATO_MESE.format(new Date(`${ultimo}T12:00:00Z`));
  return primo.slice(5, 7) === ultimo.slice(5, 7)
    ? `${giornoDelMese(primo)} – ${fine}`
    : `${FORMATO_MESE.format(new Date(`${primo}T12:00:00Z`))} – ${fine}`;
}

export async function mostraCalendario(app: HTMLElement): Promise<void> {
  const n = visualizzazioneCorrente();
  app.innerHTML = paginaApp(caricamento());
  const oggi = oggiInItalia();
  const richiesto = parametro('giorno');
  let giorno = richiesto && DATA.test(richiesto) ? richiesto : oggi;

  let officinaId: string;
  let officina: string;
  let orari: unknown;
  let prenotazioni: Prenotazione[];
  let chiusure: ChiusuraOfficina[];
  try {
    const contesto = await caricaContestoOfficina();
    officinaId = contesto.attiva.officina.id;
    officina = contesto.attiva.officina.ragione_sociale;
    [orari, prenotazioni, chiusure] = await Promise.all([
      caricaOrari(officinaId),
      caricaSettimana(officinaId, lunediDi(giorno)),
      caricaChiusure(officinaId, lunediDi(giorno)),
    ]);
  } catch (errore) {
    await gestisciErroreCaricamento(app, n, errore);
    return;
  }
  if (!ancoraAttuale(n)) return;

  app.innerHTML = paginaApp(`
    <section class="tc-hero">
      <p class="tc-etichetta">Appuntamenti · ${esc(officina)}</p>
      <h1 class="tc-hero__modello tc-hero__modello--saluto" tabindex="-1">Calendario</h1>
    </section>
    <div class="tc-contenuto">
      ${selettoreVista('calendario')}
      <div data-calendario></div>
    </div>`);

  const contenitore = app.querySelector<HTMLElement>('[data-calendario]')!;
  let lunedi = lunediDi(giorno);

  const disegna = () => {
    const giorni = giorniSettimana(giorno);
    const conta = contaPerGiorno(prenotazioni);
    contenitore.innerHTML = `
      <div class="tc-settimana">
        <div class="tc-settimana__testa">
          <button type="button" class="btn tc-settimana__freccia" data-settimana="-7"
            aria-label="Settimana precedente">${icona(ChevronLeft)}</button>
          <p class="tc-settimana__titolo" aria-live="polite">${esc(titoloSettimana(giorni))}</p>
          <button type="button" class="btn tc-settimana__freccia" data-settimana="7"
            aria-label="Settimana successiva">${icona(ChevronRight)}</button>
        </div>
        <div class="tc-settimana__giorni" role="group" aria-label="Giorni della settimana">
          ${giorni
            .map((d, i) => {
              const numero = conta.get(d) ?? 0;
              const chiuso = Boolean(chiusuraIl(chiusure, d)) || !fasceAperte(orari, d).length;
              const classi = [
                'tc-settimana__giorno',
                d === oggi ? 'tc-settimana__giorno--oggi' : '',
                chiuso ? 'tc-settimana__giorno--chiuso' : '',
              ].join(' ');
              const descrizione = `${formattaGiornoTitolo(d)}${d === oggi ? ', oggi' : ''}: ${
                numero === 1 ? '1 appuntamento' : `${numero} appuntamenti`
              }${chiuso ? ', chiuso' : ''}`;
              return `
                <button type="button" class="${classi}" data-giorno="${d}"
                  aria-pressed="${d === giorno}" aria-label="${esc(descrizione)}">
                  <span class="tc-settimana__sigla">${SIGLE[i]}</span>
                  <span class="tc-settimana__numero">${giornoDelMese(d)}</span>
                  <span class="tc-settimana__conta">${numero || ''}</span>
                </button>`;
            })
            .join('')}
        </div>
        ${
          lunediDi(oggi) !== lunedi || giorno !== oggi
            ? `<button type="button" class="btn btn-outline-light btn-sm tc-settimana__oggi" data-oggi>
                Torna a oggi
              </button>`
            : ''
        }
      </div>
      ${agenda()}`;
  };

  const agenda = (): string => {
    const delGiorno = agendaDelGiorno(prenotazioni, giorno);
    const chiusura = chiusuraIl(chiusure, giorno);
    const aperte = chiusura ? [] : fasceAperte(orari, giorno);
    const riga = righeOrari(orari)[giornoSettimana(giorno)]![1];
    const vuoto = !delGiorno.MATTINA.length && !delGiorno.POMERIGGIO.length;
    const fascia = (f: Fascia) => {
      const elenco = delGiorno[f];
      if (!elenco.length && !aperte.includes(f)) return '';
      return `
        <section aria-labelledby="tc-fascia-${f}">
          <h3 id="tc-fascia-${f}" class="tc-etichetta">${ETICHETTE_FASCIA[f]}</h3>
          ${
            elenco.length
              ? `<div class="tc-lista">${elenco.map(rigaAgenda).join('')}</div>`
              : `<p class="tc-agenda__libero">Nessun appuntamento</p>`
          }
        </section>`;
    };
    return `
      <section class="tc-agenda" aria-labelledby="tc-agenda-giorno">
        <h2 id="tc-agenda-giorno" class="tc-agenda__giorno" tabindex="-1">
          ${esc(formattaGiornoTitolo(giorno))}${giorno === oggi ? ' · oggi' : ''}
        </h2>
        <p class="tc-agenda__orari">${aperte.length ? `Aperto ${esc(riga)}` : `${icona(Moon)} ${esc(chiusura ? testoChiusura(chiusura) : 'Chiuso')}`}</p>
        ${
          vuoto && !aperte.length
            ? ''
            : vuoto
              ? `<div class="tc-vuoto">
                  <span class="tc-vuoto__icona">${icona(CalendarDays)}</span>
                  <p class="tc-vuoto__titolo">Nessun appuntamento</p>
                  <p class="tc-vuoto__testo">Le richieste dei clienti per questo giorno compaiono qui.</p>
                </div>`
              : fascia('MATTINA') + fascia('POMERIGGIO')
        }
      </section>`;
  };

  /** Va a un giorno: nella stessa settimana ridisegna e basta, altrimenti carica la settimana. */
  const vai = async (nuovo: string) => {
    giorno = nuovo;
    history.replaceState(null, '', `/appuntamenti/calendario?giorno=${giorno}`);
    if (lunediDi(giorno) !== lunedi) {
      lunedi = lunediDi(giorno);
      contenitore.setAttribute('aria-busy', 'true');
      try {
        [prenotazioni, chiusure] = await Promise.all([
          caricaSettimana(officinaId, lunedi),
          caricaChiusure(officinaId, lunedi),
        ]);
      } catch (errore) {
        await gestisciErroreCaricamento(app, n, errore);
        return;
      }
      if (!ancoraAttuale(n)) return;
      contenitore.removeAttribute('aria-busy');
    }
    disegna();
  };

  contenitore.addEventListener('click', (e) => {
    const el = e.target as Element;
    const giornoScelto = el.closest<HTMLElement>('[data-giorno]')?.dataset.giorno;
    const settimana = el.closest<HTMLElement>('[data-settimana]')?.dataset.settimana;
    if (giornoScelto) {
      void vai(giornoScelto).then(() =>
        contenitore.querySelector<HTMLElement>(`[data-giorno="${giornoScelto}"]`)?.focus(),
      );
    } else if (settimana) {
      const dove = settimana;
      void vai(
        // Settimana dopo/prima: lo stesso giorno della settimana
        aggiungiGiorni(giorno, Number(dove)),
      ).then(() => contenitore.querySelector<HTMLElement>(`[data-settimana="${dove}"]`)?.focus());
    } else if (el.closest('[data-oggi]')) {
      void vai(oggi).then(() =>
        contenitore.querySelector<HTMLElement>(`[data-giorno="${oggi}"]`)?.focus(),
      );
    }
  });

  disegna();
}

/** Riga dell'agenda: ora (o "da fissare"), servizio, cliente e targa, stato. */
function rigaAgenda(p: Prenotazione): string {
  const { ora } = posizioneInAgenda(p);
  return `
    <a class="tc-lista__riga tc-agenda__riga" href="/appuntamento?id=${p.id}">
      <span class="tc-agenda__ora${ora ? '' : ' tc-agenda__ora--da-fissare'}">
        ${ora ? esc(ora.replace(/^0/, '')) : 'da fissare'}
      </span>
      <span class="tc-lista__testo">
        ${esc(p.servizio)}
        <small>${esc([p.nome_cliente || 'Cliente', formattaTarga(p.targa)].join(' · '))}</small>
      </span>
      ${badgePrenotazione(p.stato, true)}
    </a>`;
}

/** Selettore tra calendario ed elenco degli appuntamenti dell'officina. */
export function selettoreVista(attiva: 'calendario' | 'elenco'): string {
  const voce = (vista: 'calendario' | 'elenco', href: string, ic: typeof List, testo: string) =>
    `<a class="tc-vista__voce" href="${href}"${vista === attiva ? ' aria-current="page"' : ''}>
      ${icona(ic)} ${testo}
    </a>`;
  return `
    <nav class="tc-vista" aria-label="Vista degli appuntamenti">
      ${voce('calendario', '/appuntamenti/calendario', CalendarDays, 'Calendario')}
      ${voce('elenco', '/appuntamenti', List, 'Elenco')}
    </nav>`;
}

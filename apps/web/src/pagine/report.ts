import {
  ArrowLeft,
  ChevronRight,
  Copy,
  MessageCircle,
  Pencil,
  Printer,
  SearchX,
  Share2,
  Unlink,
} from 'lucide';
import { SOGLIE_BATTISTRADA_MM, formattaTarga } from '@tyrecare/shared';
import { esc } from '../lib/html';
import { notificheNonLette, segnaLette } from '../lib/notifiche';
import { caricaDatiUtente } from '../lib/profilo';
import { messaggioErrore } from '../lib/auth';
import {
  GIORNI_LINK_REPORT,
  caricaReport,
  creaLinkReport,
  linkReport,
  linkWhatsApp,
  revocaLinkReport,
  type MisuraReport,
  type Report,
} from '../lib/report';
import { ancoraAttuale, visualizzazioneCorrente } from '../lib/router';
import { avvisoPneumatici } from '../ui/avviso-pneumatici';
import { cruscotto, statoMisura } from '../ui/cruscotto';
import { icona } from '../ui/icone';
import { caricamento, paginaApp } from '../ui/layout';
import { badgeStato } from '../ui/stato';
import {
  ETICHETTE_USURA,
  ORDINE_POSIZIONI,
  POSIZIONI,
  formattaData,
  formattaDecimale,
  formattaKm,
  gestisciErroreCaricamento,
  idValido,
  oggi,
  parametro,
} from './comune';
import { cartaOfficina } from './garage-veicolo';
import { descrizionePneumatico } from './veicolo';

/**
 * Report di un controllo: `/controllo?id=…`. Lo apre il cliente dal suo garage e chi lavora
 * nell'officina dalla scheda del veicolo (per stamparlo o salvarlo in PDF e darlo al cliente).
 */
export async function mostraReport(app: HTMLElement): Promise<void> {
  const n = visualizzazioneCorrente();
  app.innerHTML = paginaApp(caricamento());

  const id = parametro('id');
  let report: Report | null = null;
  let membro = false;
  try {
    if (idValido(id)) {
      const [r, utente] = await Promise.all([caricaReport(id), caricaDatiUtente()]);
      report = r;
      membro = !!r && utente.officine.some((o) => o.officina.id === r.officina_id);
    }
  } catch (errore) {
    await gestisciErroreCaricamento(app, n, errore);
    return;
  }
  if (!ancoraAttuale(n)) return;
  if (!report) {
    app.innerHTML = paginaApp(nonTrovato());
    return;
  }

  // La notifica dell'esito di questo controllo ora è vista (errori ignorati: è solo il contatore)
  if (notificheNonLette()) segnaLette({ controllo: report.id }).catch(() => undefined);
  // Il titolo diventa anche il nome del PDF quando si salva la stampa
  document.title = `Controllo ${formattaTarga(report.veicolo.targa)} ${report.eseguito_il} · TyreCare`;
  app.innerHTML = paginaApp(htmlReport(report, { membro, pubblico: false }));

  app.querySelector('[data-stampa]')?.addEventListener('click', () => window.print());
  if (membro) collegaCondivisione(app, report);
}

/**
 * Il contenuto del report (intestazione, misure, note, officina, azioni), uguale nell'app e nella pagina
 * pubblica `/r`. Con `pubblico` (chi apre il link, senza account) niente "Correggi o elimina", "Condividi"
 * e "Torna al veicolo", e nessun collegamento alle pagine che richiedono l'accesso. `membro`: chi lavora
 * nell'officina che ha eseguito il controllo.
 */
export function htmlReport(
  report: Report,
  { membro, pubblico }: { membro: boolean; pubblico: boolean },
): string {
  const { veicolo, misure } = report;
  const ordinate = [...misure].sort(
    (a, b) =>
      ORDINE_POSIZIONI.indexOf(a.pneumatico.posizione) -
      ORDINE_POSIZIONI.indexOf(b.pneumatico.posizione),
  );
  // Chi lavora nell'officina torna alla scheda dell'officina, il cliente al suo garage
  const indietro = membro
    ? `/veicolo?id=${veicolo.id}`
    : `/garage/veicolo?targa=${encodeURIComponent(veicolo.targa)}`;

  const auto = [veicolo.marca, veicolo.modello].filter(Boolean).join(' ');
  return `
    <section class="tc-hero" aria-labelledby="tc-report">
      <p class="tc-etichetta">Report del controllo</p>
      <h1 id="tc-report" class="tc-hero__modello tc-hero__modello--saluto" tabindex="-1">
        ${formattaData(report.eseguito_il)}
      </h1>
      <p class="tc-hero__dettagli">
        <span class="tc-targa">${esc(formattaTarga(veicolo.targa))}</span>
        ${auto ? `<span>${esc(auto)}${veicolo.anno ? ` · ${veicolo.anno}` : ''}</span>` : ''}
        <span>${report.km !== null ? formattaKm(report.km) : 'Km non indicati'}</span>
      </p>
      ${cruscotto(report, '', { ultimo: false, collegamenti: !pubblico })}
    </section>

    <div class="tc-contenuto">
      ${avvisoPneumatici(misure, { ancheVerde: true })}
      ${sezioneMisure(ordinate, pubblico)}
      ${
        report.note
          ? `<section aria-labelledby="tc-note">
              <h2 id="tc-note" class="tc-etichetta">Note dell'officina</h2>
              <p class="tc-scheda-note">${esc(report.note)}</p>
            </section>`
          : ''
      }
      ${
        veicolo.officina
          ? `<section aria-labelledby="tc-officina">
              <h2 id="tc-officina" class="tc-etichetta">Eseguito da</h2>
              ${cartaOfficina(veicolo.officina)}
            </section>`
          : ''
      }
      <div class="tc-report__azioni">
        <button type="button" class="btn btn-primary btn-lg" data-stampa>
          ${icona(Printer)} Stampa o salva in PDF
        </button>
        ${
          membro && !pubblico
            ? `<button type="button" class="btn btn-outline-light btn-lg" data-condividi-report>
                ${icona(Share2)} Condividi il report</button>
              <div data-riquadro-condivisione></div>
              <a class="btn btn-outline-light btn-lg" href="/controllo/modifica?id=${report.id}">
                ${icona(Pencil)} Correggi o elimina</a>`
            : ''
        }
        ${
          pubblico
            ? ''
            : `<a class="btn btn-outline-light btn-lg" href="${esc(indietro)}">
                ${icona(ArrowLeft)} Torna al veicolo</a>`
        }
      </div>
      <p class="tc-report__piede">Report di TyreCare · stampato il ${formattaData(oggi())}</p>
    </div>`;
}

/** "Condividi il report": crea un link (uno per apertura del riquadro) e mostra copia, WhatsApp e revoca. */
function collegaCondivisione(app: HTMLElement, report: Report): void {
  const apriTrovato = app.querySelector<HTMLButtonElement>('[data-condividi-report]');
  const riquadroTrovato = app.querySelector<HTMLElement>('[data-riquadro-condivisione]');
  if (!apriTrovato || !riquadroTrovato) return;
  const apri: HTMLButtonElement = apriTrovato;
  const riquadro: HTMLElement = riquadroTrovato;

  const avviso = (testo: string, errore = false): string =>
    `<div class="tc-avviso ${errore ? 'tc-avviso--rosso' : ''}" role="${errore ? 'alert' : 'status'}">
      <p class="mb-0">${esc(testo)}</p></div>`;

  apri.addEventListener('click', async () => {
    apri.disabled = true;
    try {
      const codice = await creaLinkReport(report.id);
      const link = linkReport(location.origin, codice);
      apri.hidden = true;
      mostraRiquadro(link);
    } catch (errore) {
      riquadro.innerHTML = avviso(messaggioErrore(errore), true);
      apri.disabled = false;
    }
  });

  function mostraRiquadro(link: string): void {
    riquadro.innerHTML = `
      <section class="tc-scheda-note" aria-labelledby="tc-condividi">
        <h2 id="tc-condividi" class="tc-etichetta">Condividi il report</h2>
        <label class="form-label" for="tc-link-report">Link del report</label>
        <input id="tc-link-report" class="form-control" type="text" readonly value="${esc(link)}" />
        <div class="tc-report__azioni mt-3">
          <button type="button" class="btn btn-outline-light" data-copia-link>
            ${icona(Copy)} Copia il link</button>
          <a class="btn btn-outline-light" target="_blank" rel="noopener"
            href="${esc(linkWhatsApp(link, formattaTarga(report.veicolo.targa)))}">
            ${icona(MessageCircle)} Invia con WhatsApp</a>
          <button type="button" class="btn btn-outline-light" data-disattiva-link>
            ${icona(Unlink)} Disattiva i link</button>
        </div>
        <p class="small text-body-secondary mt-3 mb-0">
          Il link funziona per ${GIORNI_LINK_REPORT} giorni. Chi lo apre vede solo questo controllo e
          le sue note, senza i dati del cliente.
        </p>
        <div data-esito></div>
      </section>`;
    const esito = riquadro.querySelector<HTMLElement>('[data-esito]')!;
    const campo = riquadro.querySelector<HTMLInputElement>('#tc-link-report')!;
    campo.addEventListener('focus', () => campo.select());

    riquadro.querySelector('[data-copia-link]')?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(link);
        esito.innerHTML = avviso('Link copiato.');
      } catch {
        // Appunti non disponibili: il link resta selezionabile nel campo
        campo.focus();
        campo.select();
      }
    });

    const disattiva = riquadro.querySelector<HTMLButtonElement>('[data-disattiva-link]')!;
    disattiva.addEventListener('click', async () => {
      disattiva.disabled = true;
      try {
        await revocaLinkReport(report.id);
        riquadro.innerHTML = avviso('Link disattivati.');
        apri.hidden = false;
        apri.disabled = false;
      } catch (errore) {
        esito.innerHTML = avviso(messaggioErrore(errore), true);
        disattiva.disabled = false;
      }
    });
  }
}

function sezioneMisure(misure: MisuraReport[], pubblico: boolean): string {
  const { limiteLegale, consigliato } = SOGLIE_BATTISTRADA_MM;
  return `
    <section aria-labelledby="tc-misure">
      <h2 id="tc-misure" class="tc-etichetta">Pneumatici misurati</h2>
      ${
        misure.length > 0
          ? `<div class="tc-ruote">${misure.map((m) => cartaRuota(m, pubblico)).join('')}</div>
            <p class="tc-nota-sezione">
              Battistrada da sostituire sotto ${formattaDecimale(limiteLegale)} mm (limite di legge);
              da tenere d'occhio sotto ${consigliato.ESTIVO} mm per gli estivi e
              ${consigliato.INVERNALE} mm per invernali e 4 stagioni.
            </p>`
          : `<p class="text-body-secondary mb-0">In questo controllo non sono state registrate misure.</p>`
      }
    </section>`;
}

/** Una ruota: posizione e stato, poi i valori misurati e lo pneumatico. */
function cartaRuota(m: MisuraReport, pubblico: boolean): string {
  const dati: [string, string][] = [
    ['Battistrada', `${formattaDecimale(m.battistrada_mm)} mm`],
    ['Pressione', m.pressione_bar !== null ? `${formattaDecimale(m.pressione_bar)} bar` : ''],
    ['Usura', m.usura ? ETICHETTE_USURA[m.usura] : ''],
    ['Danni', esc(m.danni)],
  ];
  return `
    <article class="tc-ruota">
      <header class="tc-ruota__testa">
        <h3 class="tc-ruota__nome">${POSIZIONI[m.pneumatico.posizione].nome}</h3>
        ${badgeStato(statoMisura(m))}
      </header>
      <dl class="tc-ruota__dati">
        ${dati
          .filter(([, valore]) => valore)
          .map(([nome, valore]) => `<div><dt>${nome}</dt><dd>${valore}</dd></div>`)
          .join('')}
      </dl>
      ${
        pubblico
          ? `<p class="tc-ruota__pneumatico">${esc(descrizionePneumatico(m.pneumatico))}</p>`
          : `<a class="tc-ruota__pneumatico tc-ruota__salute" href="/pneumatico?id=${m.pneumatico.id}">
              <span>${esc(descrizionePneumatico(m.pneumatico))}</span>
              <span class="tc-ruota__azione">Stato di salute ${icona(ChevronRight)}</span>
            </a>`
      }
    </article>`;
}

function nonTrovato(): string {
  return `
    <div class="tc-contenuto pt-4">
      <div class="tc-vuoto">
        <span class="tc-vuoto__icona">${icona(SearchX)}</span>
        <h1 class="tc-vuoto__titolo" tabindex="-1">Controllo non trovato</h1>
        <p class="tc-vuoto__testo">
          Il controllo non esiste più oppure riguarda un veicolo che non è collegato al tuo account.
        </p>
        <a class="btn btn-outline-light mt-3" href="/">Torna alla home</a>
      </div>
    </div>`;
}

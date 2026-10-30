import { Download, FileUp } from 'lucide';
import {
  controllaTabellaControlli,
  csvRigheConErrori,
  formattaTarga,
  IMPORT_CONTROLLI_SOLO_ULTIMO,
  mappaturaAutomaticaControlli,
  modelloCsvControlli,
  oggiInItalia,
  type ErroreImport,
  type RigaControlloImport,
  type Tabella,
} from '@tyrecare/shared';
import { codiceErrore } from '../lib/errori';
import { esc } from '../lib/html';
import { leggiTabella } from '../lib/importa';
import { importaControlli, periodoDate, type ConteggiControlli } from '../lib/importa-controlli';
import { caricaContestoOfficina, eTitolare } from '../lib/officina';
import { ancoraAttuale, visualizzazioneCorrente } from '../lib/router';
import { scaricaCsv } from '../lib/scarica';
import { icona } from '../ui/icone';
import { caricamento, paginaApp } from '../ui/layout';
import { formattaData, gestisciErroreCaricamento, intestazioneSottopagina } from './comune';

// Import dei controlli dal gestionale (T023): `/clienti/importa-controlli`, solo per il TITOLARE.
// 1. si sceglie il file (CSV o Excel, letto nel browser) e lo si controlla riga per riga;
// 2. l'anteprima (simulazione nel database) dice quanti controlli sono nuovi o già presenti e quali
//    targhe non esistono ancora; le righe con errori non vengono importate;
// 3. "Importa i controlli" scrive tutto in una transazione e mostra il riepilogo.

/** Errori mostrati nell'anteprima: oltre, si chiede di correggere il file e riprovare. */
const MAX_ERRORI_MOSTRATI = 100;

const plurale = (n: number, uno: string, tanti: string) => (n === 1 ? `1 ${uno}` : `${n} ${tanti}`);

export async function mostraImportaControlli(app: HTMLElement): Promise<void> {
  const n = visualizzazioneCorrente();
  app.innerHTML = paginaApp(caricamento());

  let officinaId: string;
  let officina: string;
  let titolare: boolean;
  try {
    const contesto = await caricaContestoOfficina();
    officinaId = contesto.attiva.officina.id;
    officina = contesto.attiva.officina.ragione_sociale;
    titolare = eTitolare(contesto.officine, officinaId);
  } catch (errore) {
    await gestisciErroreCaricamento(app, n, errore);
    return;
  }
  if (!ancoraAttuale(n)) return;

  if (!titolare) {
    app.innerHTML = paginaApp(`
      ${intestazioneSottopagina('Importa i controlli', officina)}
      <div class="tc-contenuto">
        <div class="tc-avviso tc-avviso--giallo" role="status">
          <p class="mb-0">Solo il titolare dell'officina può importare i dati dal gestionale.</p>
        </div>
      </div>`);
    return;
  }

  app.innerHTML = paginaApp(`
    ${intestazioneSottopagina('Importa i controlli', officina)}
    <div class="tc-contenuto">
      <p class="text-body-secondary mb-0">
        Carica il file dei controlli del gestionale: una riga per ogni pneumatico misurato.
        Prima importa clienti e veicoli: i controlli si agganciano ai veicoli con la targa.
      </p>
      <button type="button" class="btn btn-outline-light w-100" data-modello>
        ${icona(Download)} Scarica il modello
      </button>

      <div>
        <label class="form-label" for="tc-file">File CSV o Excel</label>
        <input class="form-control form-control-lg" id="tc-file" type="file"
          accept=".csv,.txt,.xls,.xlsx,.ods" />
      </div>

      <div data-anteprima aria-live="polite"></div>
    </div>`);

  app
    .querySelector('[data-modello]')!
    .addEventListener('click', () =>
      scaricaCsv('tyrecare-modello-controlli.csv', `${modelloCsvControlli()}\r\n`),
    );
  const input = app.querySelector<HTMLInputElement>('#tc-file')!;
  const anteprima = app.querySelector<HTMLElement>('[data-anteprima]')!;
  // Scegliendo un altro file mentre si carica l'anteprima, quella vecchia non va più mostrata
  let scelta = 0;
  input.addEventListener('change', () => {
    const questa = ++scelta;
    const file = input.files?.[0];
    if (file)
      void leggiEMostra(anteprima, file, officinaId, () => ancoraAttuale(n) && questa === scelta);
    else anteprima.innerHTML = '';
  });
}

/** Avviso rosso dentro l'anteprima. */
const avvisoErrore = (messaggio: string) => `
  <div class="tc-avviso tc-avviso--rosso" role="alert"><p class="mb-0">${esc(messaggio)}</p></div>`;

/** Messaggio leggibile per un errore della funzione d'import. */
function messaggioErrore(errore: unknown): string {
  if (codiceErrore(errore) === '42501') {
    return "Solo il titolare dell'officina può importare i dati dal gestionale.";
  }
  if (errore instanceof TypeError || codiceErrore(errore) === undefined) {
    return 'Non riusciamo a contattare il server. Controlla la connessione e riprova.';
  }
  return `Il database ha rifiutato i dati (${String((errore as Error).message)}). Controlla il file e riprova.`;
}

async function leggiEMostra(
  box: HTMLElement,
  file: File,
  officinaId: string,
  attuale: () => boolean,
): Promise<void> {
  box.innerHTML = caricamento('Controllo del file…');

  let tabella: Tabella | null;
  try {
    tabella = await leggiTabella(file);
  } catch (errore) {
    if (attuale()) box.innerHTML = avvisoErrore((errore as Error).message);
    return;
  }
  if (!attuale()) return;
  if (!tabella) {
    box.innerHTML = avvisoErrore('Il file è vuoto.');
    return;
  }

  const mappatura = mappaturaAutomaticaControlli(tabella.intestazioni);
  const esito = controllaTabellaControlli(tabella, mappatura, {
    oggi: oggiInItalia(),
    soloUltimo: IMPORT_CONTROLLI_SOLO_ULTIMO,
  });
  if (!esito.ok) {
    box.innerHTML = `${avvisoErrore(esito.messaggio)}
      <p class="text-body-secondary mb-0">Rinomina le colonne del file come nel modello.</p>`;
    return;
  }

  const { righe, errori, lette } = esito;
  const scartate = new Set(errori.map((e) => e.numero)).size;
  let conteggi: ConteggiControlli | null = null;
  if (righe.length > 0) {
    try {
      conteggi = await importaControlli({
        officinaId,
        righe,
        nomeFile: file.name,
        scartate,
        simula: true,
      });
    } catch (errore) {
      if (attuale()) box.innerHTML = avvisoErrore(messaggioErrore(errore));
      return;
    }
  }
  if (!attuale()) return;

  const nuovi = conteggi?.controlli_nuovi ?? 0;
  box.innerHTML = `
    <section class="tc-import" aria-labelledby="tc-anteprima">
      <h2 id="tc-anteprima" class="tc-etichetta" tabindex="-1">Anteprima di «${esc(file.name)}»</h2>
      <p class="mb-0">
        ${plurale(lette, 'riga letta', 'righe lette')}:
        ${plurale(righe.length, 'pronta da importare', 'pronte da importare')}${
          scartate ? `, ${plurale(scartate, 'con errori', 'con errori')}` : ''
        }.
      </p>
      ${conteggi ? riepilogoAnteprima(conteggi, periodoDate(righe)) : ''}
      ${conteggi ? avvisoTarghe(conteggi.targhe_non_trovate) : ''}
      ${errori.length ? elencoErrori(errori, scartate) : ''}
      ${
        righe.length === 0
          ? avvisoErrore('Nessuna riga da importare: correggi il file e caricalo di nuovo.')
          : nuovi === 0
            ? `<div class="tc-avviso tc-avviso--verde" role="status">
                <p class="mb-0">Niente da importare: nessun controllo nuovo in questo file.</p>
              </div>`
            : `<div data-errore-import></div>
              <button type="button" class="btn btn-primary btn-lg w-100" data-importa>
                ${icona(FileUp)} Importa i controlli
              </button>`
      }
    </section>`;

  box.querySelector<HTMLElement>('#tc-anteprima')!.focus();
  box
    .querySelector('[data-scarica-errori]')
    ?.addEventListener('click', () =>
      scaricaCsv('tyrecare-righe-con-errori.csv', csvRigheConErrori(tabella, errori)),
    );
  box
    .querySelector<HTMLButtonElement>('[data-importa]')
    ?.addEventListener('click', (e) =>
      importa(e.currentTarget as HTMLButtonElement, box, righe, file.name, scartate, officinaId),
    );
}

/** "2 controlli nuovi · 1 già presenti · 4 pneumatici nuovi · 8 misure". */
function frase(c: ConteggiControlli): string {
  return [
    plurale(c.controlli_nuovi, 'controllo nuovo', 'controlli nuovi'),
    plurale(c.controlli_gia_presenti, 'già presente', 'già presenti'),
    plurale(c.pneumatici_nuovi, 'pneumatico nuovo', 'pneumatici nuovi'),
    plurale(c.misure_nuove, 'misura', 'misure'),
  ].join(' · ');
}

function riepilogoAnteprima(
  c: ConteggiControlli,
  periodo: { da: string; a: string } | null,
): string {
  const testoPeriodo = !periodo
    ? ''
    : periodo.da === periodo.a
      ? `Controlli del ${formattaData(periodo.da)}`
      : `Controlli dal ${formattaData(periodo.da)} al ${formattaData(periodo.a)}`;
  return `
    <p class="mb-0 fw-semibold" data-conteggi>${esc(frase(c))}</p>
    ${testoPeriodo ? `<p class="text-body-secondary small mb-0" data-periodo>${esc(testoPeriodo)}</p>` : ''}
    ${
      c.misure_saltate > 0
        ? `<p class="text-body-secondary small mb-0">
            ${plurale(c.misure_saltate, 'misura non si aggancia', 'misure non si agganciano')}
            a un pneumatico del veicolo e non verrà importata.
          </p>`
        : ''
    }`;
}

/** Targhe del file senza veicolo: avviso giallo con le targhe formattate. */
function avvisoTarghe(targhe: string[]): string {
  if (targhe.length === 0) return '';
  return `
    <div class="tc-avviso tc-avviso--giallo" role="status">
      <p class="mb-1">Questi veicoli non ci sono ancora: importa prima clienti e veicoli</p>
      <p class="mb-0" data-targhe-non-trovate>${esc(targhe.map(formattaTarga).join(', '))}</p>
    </div>`;
}

function elencoErrori(errori: ErroreImport[], scartate: number): string {
  const mostrati = errori.slice(0, MAX_ERRORI_MOSTRATI);
  return `
    <div class="tc-avviso tc-avviso--giallo" role="status">
      <p class="mb-0">
        ${plurale(scartate, 'riga ha', 'righe hanno')} errori e
        ${scartate === 1 ? 'verrà saltata' : 'verranno saltate'}: le righe con errori non vengono
        importate. I documenti con righe sbagliate vengono saltati per intero: correggi il file e
        reimportalo.
        Se vuoi che il controllo sia completo, correggi il file prima di importare.
      </p>
    </div>
    <ul class="tc-lista tc-import__errori" aria-label="Righe con errori">
      ${mostrati
        .map(
          (e) => `
        <li class="tc-lista__riga">
          <span class="tc-lista__testo">Riga ${e.numero}<small>${esc(e.messaggio)}</small></span>
        </li>`,
        )
        .join('')}
    </ul>
    ${
      errori.length > mostrati.length
        ? `<p class="text-body-secondary small mb-0">
            E altri ${errori.length - mostrati.length} errori.
          </p>`
        : ''
    }
    <button type="button" class="btn btn-outline-light w-100" data-scarica-errori>
      ${icona(Download)} Scarica le righe con errori
    </button>`;
}

async function importa(
  pulsante: HTMLButtonElement,
  box: HTMLElement,
  righe: RigaControlloImport[],
  nomeFile: string,
  scartate: number,
  officinaId: string,
): Promise<void> {
  const errore = box.querySelector<HTMLElement>('[data-errore-import]')!;
  errore.innerHTML = '';
  // Disabilitato subito: un doppio clic non deve mandare due import
  pulsante.disabled = true;
  pulsante.innerHTML = `<span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Importazione…`;
  try {
    const c = await importaControlli({ officinaId, righe, nomeFile, scartate, simula: false });
    box.innerHTML = `
      <section class="tc-import" aria-labelledby="tc-esito">
        <h2 id="tc-esito" class="tc-etichetta" tabindex="-1">Import completato</h2>
        <div class="tc-avviso tc-avviso--verde" role="status">
          <p class="mb-0">Import completato: ${esc(frase(c))}.</p>
        </div>
        ${avvisoTarghe(c.targhe_non_trovate)}
        <a class="btn btn-primary btn-lg w-100" href="/">Torna ai veicoli</a>
      </section>`;
    box.querySelector<HTMLElement>('#tc-esito')!.focus();
  } catch (e) {
    errore.innerHTML = avvisoErrore(messaggioErrore(e));
    pulsante.disabled = false;
    pulsante.innerHTML = `${icona(FileUp)} Importa i controlli`;
  }
}

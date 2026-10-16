import { Download, FileUp } from 'lucide';
import { controllaImport, MAX_RIGHE_IMPORT, type RigaImport } from '@tyrecare/shared';
import { codiceErrore } from '../lib/errori';
import { esc } from '../lib/html';
import {
  caricaImportPassati,
  importaClientiVeicoli,
  leggiFile,
  scaricaModello,
  type ConteggiImport,
  type ImportPassato,
} from '../lib/importa';
import { caricaContestoOfficina, eTitolare } from '../lib/officina';
import { ancoraAttuale, visualizzazioneCorrente } from '../lib/router';
import { icona } from '../ui/icone';
import { caricamento, paginaApp } from '../ui/layout';
import {
  avvisoConferma,
  gestisciErroreCaricamento,
  intestazioneSottopagina,
  vaiConConferma,
} from './comune';

// Import di clienti e veicoli dal gestionale (PLAN P8): `/clienti/importa`, solo per il TITOLARE.
// 1. si sceglie il file CSV; il browser lo controlla e chiede al database una simulazione;
// 2. l'anteprima mostra quanti clienti e veicoli sarebbero nuovi o aggiornati e le righe con errori;
// 3. "Importa" scrive tutto in una transazione; sotto, il registro degli import passati.

/** Errori mostrati nell'anteprima: oltre, si chiede di correggere il file e riprovare. */
const MAX_ERRORI_MOSTRATI = 100;

const plurale = (n: number, uno: string, tanti: string) => (n === 1 ? `1 ${uno}` : `${n} ${tanti}`);

export async function mostraImporta(app: HTMLElement): Promise<void> {
  const n = visualizzazioneCorrente();
  app.innerHTML = paginaApp(caricamento());

  let officinaId: string;
  let officina: string;
  let titolare: boolean;
  let passati: ImportPassato[] = [];
  try {
    const contesto = await caricaContestoOfficina();
    officinaId = contesto.attiva.officina.id;
    officina = contesto.attiva.officina.ragione_sociale;
    titolare = eTitolare(contesto.officine, officinaId);
    if (titolare) passati = await caricaImportPassati(officinaId);
  } catch (errore) {
    await gestisciErroreCaricamento(app, n, errore);
    return;
  }
  if (!ancoraAttuale(n)) return;

  if (!titolare) {
    app.innerHTML = paginaApp(`
      ${intestazioneSottopagina('Importa clienti e veicoli', officina)}
      <div class="tc-contenuto">
        <div class="tc-avviso tc-avviso--giallo" role="status">
          <p class="mb-0">Solo il titolare dell'officina può importare i dati dal gestionale.</p>
        </div>
      </div>`);
    return;
  }

  app.innerHTML = paginaApp(`
    ${intestazioneSottopagina('Importa clienti e veicoli', officina)}
    <div class="tc-contenuto">
      ${avvisoConferma()}
      <p class="text-body-secondary mb-0">
        Carica un file CSV esportato dal gestionale: una riga per veicolo, con il suo cliente.
        Puoi reimportare lo stesso file quando vuoi: clienti e veicoli già presenti vengono
        aggiornati, non duplicati, e le celle vuote non cancellano i dati che ci sono già.
      </p>
      <button type="button" class="btn btn-outline-light w-100" data-modello>
        ${icona(Download)} Scarica il modello CSV
      </button>

      <div>
        <label class="form-label" for="tc-file">File CSV (al massimo ${MAX_RIGHE_IMPORT} righe)</label>
        <input class="form-control form-control-lg" id="tc-file" type="file"
          accept=".csv,text/csv" aria-describedby="tc-file-aiuto" />
        <p class="form-text" id="tc-file-aiuto">
          Colonne: codice_cliente, nome, cognome, ragione_sociale, telefono, email, targa, marca,
          modello, anno, telaio. Serve almeno la targa o il codice cliente.
        </p>
      </div>

      <div data-anteprima aria-live="polite"></div>

      ${registro(passati)}
    </div>`);

  app.querySelector('[data-modello]')!.addEventListener('click', scaricaModello);
  const input = app.querySelector<HTMLInputElement>('#tc-file')!;
  const anteprima = app.querySelector<HTMLElement>('[data-anteprima]')!;
  // Scegliendo un altro file mentre si carica l'anteprima, quella vecchia non va più mostrata
  let scelta = 0;
  input.addEventListener('change', () => {
    const questa = ++scelta;
    const file = input.files?.[0];
    if (file)
      void mostraAnteprima(
        anteprima,
        file,
        officinaId,
        () => ancoraAttuale(n) && questa === scelta,
      );
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

async function mostraAnteprima(
  box: HTMLElement,
  file: File,
  officinaId: string,
  attuale: () => boolean,
): Promise<void> {
  box.innerHTML = caricamento('Controllo del file…');

  const esito = controllaImport(await leggiFile(file));
  if (!attuale()) return;
  if (!esito.ok) {
    box.innerHTML = avvisoErrore(esito.messaggio);
    return;
  }

  const { righe, errori, lette, ignorate } = esito;
  const scartate = new Set(errori.map((e) => e.numero)).size;
  let conteggi: ConteggiImport | null = null;
  if (righe.length > 0) {
    try {
      conteggi = await importaClientiVeicoli({
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

  const nessunaModifica =
    conteggi !== null && Object.values(conteggi).every((numero) => numero === 0);

  box.innerHTML = `
    <section class="tc-import" aria-labelledby="tc-anteprima">
      <h2 id="tc-anteprima" class="tc-etichetta" tabindex="-1">Anteprima di «${esc(file.name)}»</h2>
      <p class="mb-0">
        ${plurale(lette, 'riga letta', 'righe lette')}:
        ${plurale(righe.length, 'pronta da importare', 'pronte da importare')}${
          scartate ? `, ${plurale(scartate, 'con errori', 'con errori')}` : ''
        }.
      </p>
      ${conteggi ? riepilogo(conteggi) : ''}
      ${
        ignorate.length
          ? `<p class="text-body-secondary small mb-0">
              Colonne ignorate perché non le conosciamo: ${esc(ignorate.join(', '))}.
            </p>`
          : ''
      }
      ${errori.length ? elencoErrori(errori, scartate) : ''}
      ${
        righe.length === 0
          ? avvisoErrore('Nessuna riga da importare: correggi il file e caricalo di nuovo.')
          : nessunaModifica
            ? `<div class="tc-avviso tc-avviso--verde" role="status">
                <p class="mb-0">Nessuna modifica: i dati di questo file sono già in TyreCare.</p>
              </div>`
            : `<div data-errore-import></div>
              <button type="button" class="btn btn-primary btn-lg w-100" data-importa>
                ${icona(FileUp)} Importa ${plurale(righe.length, 'riga', 'righe')}
              </button>`
      }
    </section>`;

  box.querySelector<HTMLElement>('#tc-anteprima')!.focus();
  box
    .querySelector<HTMLButtonElement>('[data-importa]')
    ?.addEventListener('click', (e) =>
      importa(e.currentTarget as HTMLButtonElement, box, righe, file.name, scartate, officinaId),
    );
}

async function importa(
  pulsante: HTMLButtonElement,
  box: HTMLElement,
  righe: RigaImport[],
  nomeFile: string,
  scartate: number,
  officinaId: string,
): Promise<void> {
  const errore = box.querySelector<HTMLElement>('[data-errore-import]')!;
  errore.innerHTML = '';
  pulsante.disabled = true;
  pulsante.innerHTML = `<span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Importazione…`;
  try {
    const c = await importaClientiVeicoli({ officinaId, righe, nomeFile, scartate, simula: false });
    vaiConConferma('/clienti/importa', `Import completato: ${testoConteggi(c)}.`, {
      sostituisci: true,
    });
  } catch (e) {
    errore.innerHTML = avvisoErrore(messaggioErrore(e));
    pulsante.disabled = false;
    pulsante.innerHTML = `${icona(FileUp)} Importa ${plurale(righe.length, 'riga', 'righe')}`;
  }
}

/** "2 clienti nuovi, 1 aggiornato, 3 veicoli nuovi" (le voci a zero si omettono). */
function testoConteggi(c: ConteggiImport): string {
  const parti = [
    c.clienti_nuovi && plurale(c.clienti_nuovi, 'cliente nuovo', 'clienti nuovi'),
    c.clienti_aggiornati &&
      plurale(c.clienti_aggiornati, 'cliente aggiornato', 'clienti aggiornati'),
    c.veicoli_nuovi && plurale(c.veicoli_nuovi, 'veicolo nuovo', 'veicoli nuovi'),
    c.veicoli_aggiornati &&
      plurale(c.veicoli_aggiornati, 'veicolo aggiornato', 'veicoli aggiornati'),
  ].filter(Boolean);
  return parti.length ? parti.join(', ') : 'nessuna modifica';
}

function riepilogo(c: ConteggiImport): string {
  const voce = (numero: number, etichetta: string) => `
    <div class="tc-riepilogo__voce">
      <span class="tc-riepilogo__numero">${numero}</span>
      <span class="tc-riepilogo__etichetta">${esc(etichetta)}</span>
    </div>`;
  return `
    <div class="tc-riepilogo tc-riepilogo--import">
      ${voce(c.clienti_nuovi, 'Clienti nuovi')}
      ${voce(c.clienti_aggiornati, 'Clienti aggiornati')}
      ${voce(c.veicoli_nuovi, 'Veicoli nuovi')}
      ${voce(c.veicoli_aggiornati, 'Veicoli aggiornati')}
    </div>`;
}

function elencoErrori(errori: { numero: number; messaggio: string }[], scartate: number): string {
  const mostrati = errori.slice(0, MAX_ERRORI_MOSTRATI);
  return `
    <div class="tc-avviso tc-avviso--giallo" role="status">
      <p class="mb-0">
        ${plurale(scartate, 'riga ha', 'righe hanno')} errori e
        ${scartate === 1 ? 'verrà saltata' : 'verranno saltate'}. Puoi importare le altre adesso
        e, dopo averle corrette nel file, ricaricarlo: le righe già importate non si duplicano.
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
    }`;
}

const FORMATO_QUANDO = new Intl.DateTimeFormat('it-IT', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function registro(passati: ImportPassato[]): string {
  if (passati.length === 0) return '';
  return `
    <section aria-labelledby="tc-import-passati">
      <h2 id="tc-import-passati" class="tc-etichetta">Import precedenti</h2>
      <ul class="tc-lista">
        ${passati
          .map(
            (p) => `
          <li class="tc-lista__riga">
            <span class="tc-lista__testo">
              ${esc(p.nome_file || 'File senza nome')}
              <small>${esc(FORMATO_QUANDO.format(new Date(p.created_at)))} ·
                ${esc(testoConteggi(p))}${
                  p.righe_scartate
                    ? ` · ${plurale(p.righe_scartate, 'riga saltata', 'righe saltate')}`
                    : ''
                }</small>
            </span>
          </li>`,
          )
          .join('')}
      </ul>
    </section>`;
}

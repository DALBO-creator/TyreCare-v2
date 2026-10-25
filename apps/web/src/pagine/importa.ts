import { Download, FileUp } from 'lucide';
import {
  applicaMappatura,
  controllaTabella,
  csvRigheConErrori,
  erroriMappatura,
  mappaturaAutomatica,
  MAX_RIGHE_IMPORT,
  type Mappatura,
  type RigaImport,
  type Tabella,
} from '@tyrecare/shared';
import { codiceErrore } from '../lib/errori';
import { esc } from '../lib/html';
import {
  caricaImportPassati,
  caricaMappature,
  eliminaMappatura,
  importaClientiVeicoli,
  leggiTabella,
  salvaMappatura,
  scaricaClientiVeicoli,
  scaricaControlli,
  scaricaModello,
  type ConteggiImport,
  type ImportPassato,
  type MappaturaSalvata,
} from '../lib/importa';
import { caricaContestoOfficina, eTitolare } from '../lib/officina';
import { scaricaCsv } from '../lib/scarica';
import { ancoraAttuale, visualizzazioneCorrente } from '../lib/router';
import { icona } from '../ui/icone';
import { caricamento, paginaApp } from '../ui/layout';
import { chiediConferma } from '../ui/conferma';
import {
  impostaScelte,
  leggiScelte,
  primoSelectCoinvolto,
  schermataMappatura,
  tuttoRiconosciuto,
} from '../ui/mappatura';
import {
  avvisoConferma,
  gestisciErroreCaricamento,
  intestazioneSottopagina,
  vaiConConferma,
} from './comune';

// Import di clienti e veicoli dal gestionale (PLAN P8): `/clienti/importa`, solo per il TITOLARE.
// 1. si sceglie il file CSV o Excel (letto nel browser); se le intestazioni non sono tutte riconosciute
//    il titolare associa a mano le colonne ("Associa le colonne"); poi il browser controlla il file e
//    chiede al database una simulazione;
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
        Carica il file CSV o Excel (.xls, .xlsx) esportato dal gestionale: una riga per veicolo, con il suo cliente.
        Puoi reimportare lo stesso file quando vuoi: clienti e veicoli già presenti vengono
        aggiornati, non duplicati, e le celle vuote non cancellano i dati che ci sono già.
      </p>
      <button type="button" class="btn btn-outline-light w-100" data-modello>
        ${icona(Download)} Scarica il modello CSV
      </button>

      <div>
        <label class="form-label" for="tc-file">File CSV o Excel (al massimo ${MAX_RIGHE_IMPORT} righe)</label>
        <input class="form-control form-control-lg" id="tc-file" type="file"
          accept=".csv,.txt,.xls,.xlsx,.ods" aria-describedby="tc-file-aiuto" />
        <p class="form-text" id="tc-file-aiuto">
          Colonne: codice_cliente, nome, cognome, ragione_sociale, telefono, email, targa, marca,
          modello, anno, telaio. Serve almeno la targa o il codice cliente.
        </p>
      </div>

      <div data-anteprima aria-live="polite"></div>

      ${registro(passati)}

      <section aria-labelledby="tc-esporta">
        <h2 id="tc-esporta" class="tc-etichetta">Esporta i dati</h2>
        <p class="text-body-secondary">
          Scarica tutti i clienti e i veicoli nel formato del modello, oppure le misure di tutti i controlli: si aprono con Excel e si possono reimportare.
        </p>
        <div data-errore-esporta aria-live="polite"></div>
        <div class="d-grid gap-2">
          <button type="button" class="btn btn-outline-light w-100" data-esporta>
            ${icona(Download)} Scarica clienti e veicoli
          </button>
          <button type="button" class="btn btn-outline-light w-100" data-esporta-controlli>
            ${icona(Download)} Scarica i controlli
          </button>
        </div>
      </section>
    </div>`);

  app.querySelector('[data-modello]')!.addEventListener('click', scaricaModello);
  const erroreEsporta = app.querySelector<HTMLElement>('[data-errore-esporta]')!;
  const pulsantiEsporta = [
    ...app.querySelectorAll<HTMLButtonElement>('[data-esporta], [data-esporta-controlli]'),
  ];
  for (const pulsante of pulsantiEsporta) {
    const scarica = pulsante.hasAttribute('data-esporta-controlli')
      ? scaricaControlli
      : scaricaClientiVeicoli;
    const contenuto = pulsante.innerHTML;
    pulsante.addEventListener('click', async () => {
      erroreEsporta.innerHTML = '';
      for (const p of pulsantiEsporta) p.disabled = true;
      pulsante.textContent = 'Preparazione…';
      try {
        await scarica(officinaId);
      } catch (e) {
        erroreEsporta.innerHTML = avvisoErrore(messaggioErrore(e));
      } finally {
        for (const p of pulsantiEsporta) p.disabled = false;
        pulsante.innerHTML = contenuto;
      }
    });
  }
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

/** Pulsante sopra l'anteprima: riporta all'associazione delle colonne con le scelte fatte. */
const pulsanteCambia = () =>
  `<button type="button" class="btn btn-outline-light align-self-start" data-cambia-colonne>Cambia le colonne</button>`;

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

/** Tutto ciò che serve per mostrare i passi dopo la lettura del file. */
interface ContestoImport {
  box: HTMLElement;
  file: File;
  tabella: Tabella;
  officinaId: string;
  /** Falso se nel frattempo si è cambiato pagina o file: le risposte tardive vanno scartate. */
  attuale: () => boolean;
  /** Associazioni salvate dell'officina, dalla più recente. */
  salvate: MappaturaSalvata[];
}

/** Cosa mostrare in più nell'anteprima: la mappatura salvata usata, o l'avviso di un salvataggio fallito. */
interface InfoAnteprima {
  usata?: string;
  avviso?: string;
}

async function leggiEMostra(
  box: HTMLElement,
  file: File,
  officinaId: string,
  attuale: () => boolean,
): Promise<void> {
  box.innerHTML = caricamento('Controllo del file…');

  let tabella;
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
  // Senza le associazioni salvate (errore di rete, tabella non raggiungibile) si lavora lo stesso
  const salvate = await caricaMappature(officinaId).catch(() => []);
  if (!attuale()) return;
  const contesto: ContestoImport = { box, file, tabella, officinaId, attuale, salvate };
  const automatica = mappaturaAutomatica(tabella.intestazioni);
  // Si va dritti all'anteprima solo se c'è una chiave e nessuna intestazione resta senza colonna
  if (
    (automatica.targa !== undefined || automatica.codice_cliente !== undefined) &&
    tuttoRiconosciuto(tabella, automatica)
  ) {
    await mostraAnteprima(contesto, automatica);
    return;
  }
  // Il riconoscimento automatico non basta: si prova la più recente tra le associazioni salvate
  for (const salvata of salvate) {
    const m = applicaMappatura(salvata.colonne, tabella.intestazioni);
    if (m !== null && erroriMappatura(m, tabella.intestazioni).length === 0) {
      await mostraAnteprima(contesto, m, { usata: salvata.nome });
      return;
    }
  }
  mostraMappatura(contesto, automatica);
}

/** Passo "Associa le colonne": scelte iniziali = quelle già fatte (o il riconoscimento automatico). */
function mostraMappatura(c: ContestoImport, scelte: Mappatura): void {
  const { box, tabella } = c;
  box.innerHTML = schermataMappatura(tabella, scelte, c.salvate);
  box.querySelector<HTMLElement>('#tc-mappatura')!.focus();
  const errori = box.querySelector<HTMLElement>('[data-errori-mappatura]')!;
  const scegli = box.querySelector<HTMLSelectElement>('[data-mappa-salvata]');
  const elimina = box.querySelector<HTMLButtonElement>('[data-elimina-mappatura]');
  const scelta = () => c.salvate.find((x) => x.id === scegli?.value);
  scegli?.addEventListener('change', () => {
    const salvata = scelta();
    if (elimina) elimina.disabled = !salvata;
    errori.innerHTML = '';
    if (!salvata) return;
    const m = applicaMappatura(salvata.colonne, tabella.intestazioni);
    if (m === null) {
      errori.innerHTML = avvisoErrore(
        `L'associazione «${salvata.nome}» non corrisponde alle colonne di questo file.`,
      );
      return;
    }
    impostaScelte(box, m);
  });
  elimina?.addEventListener('click', () => {
    const salvata = scelta();
    if (!salvata) return;
    chiediConferma({
      titolo: "Eliminare l'associazione?",
      testo: `L'associazione «${salvata.nome}» non sarà più disponibile per i prossimi file.`,
      pulsante: "Elimina l'associazione",
      origine: elimina,
      azione: async () => {
        await eliminaMappatura(salvata.id);
        c.salvate = c.salvate.filter((x) => x.id !== salvata.id);
        if (c.attuale()) mostraMappatura(c, leggiScelte(box));
      },
    });
  });
  box
    .querySelector<HTMLButtonElement>('[data-mostra-anteprima]')!
    .addEventListener('click', async () => {
      const m = leggiScelte(box);
      const problemi = erroriMappatura(m, tabella.intestazioni);
      if (problemi.length > 0) {
        errori.innerHTML = `<div class="tc-avviso tc-avviso--rosso"><ul class="mb-0 ps-3">${problemi
          .map((p) => `<li>${esc(p)}</li>`)
          .join('')}</ul></div>`;
        primoSelectCoinvolto(box, m)?.focus();
        return;
      }
      const nome = box.querySelector<HTMLInputElement>('#tc-salva-come')!.value.trim();
      let info: InfoAnteprima = {};
      if (nome) {
        try {
          await salvaMappatura(c.officinaId, nome, m);
        } catch {
          info = {
            avviso: `Non siamo riusciti a salvare l'associazione «${nome}»: l'anteprima è comunque qui sotto.`,
          };
        }
        if (!c.attuale()) return;
      }
      void mostraAnteprima(c, m, info);
    });
}

async function mostraAnteprima(
  c: ContestoImport,
  mappatura: Mappatura,
  info: InfoAnteprima = {},
): Promise<void> {
  const { box, file, tabella, officinaId, attuale } = c;
  box.innerHTML = caricamento('Controllo del file…');
  const cambia = () => {
    box.querySelector('[data-cambia-colonne]')?.addEventListener('click', () => {
      if (attuale()) mostraMappatura(c, mappatura);
    });
  };

  const esito = controllaTabella(tabella, mappatura);
  if (!esito.ok) {
    box.innerHTML = `${avvisoErrore(esito.messaggio)}${pulsanteCambia()}`;
    cambia();
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
      if (attuale()) {
        box.innerHTML = `${avvisoErrore(messaggioErrore(errore))}${pulsanteCambia()}`;
        cambia();
      }
      return;
    }
  }
  if (!attuale()) return;

  const nessunaModifica =
    conteggi !== null && Object.values(conteggi).every((numero) => numero === 0);

  box.innerHTML = `
    <section class="tc-import" aria-labelledby="tc-anteprima">
      ${pulsanteCambia()}
      ${info.usata ? `<p class="mb-0">Colonne associate con «${esc(info.usata)}».</p>` : ''}
      ${info.avviso ? `<div class="tc-avviso tc-avviso--giallo" role="status"><p class="mb-0">${esc(info.avviso)}</p></div>` : ''}
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
          : nessunaModifica && scartate > 0
            ? // Le righe valide sono già importate: restano solo quelle con errori, da correggere
              avvisoErrore(
                `Niente da importare: le righe valide sono già in TyreCare. ${
                  scartate === 1
                    ? 'La riga con errori non è stata importata: correggila'
                    : `Le ${scartate} righe con errori non sono state importate: correggile`
                } nel file e caricalo di nuovo.`,
              )
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
  cambia();
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
    }
    <button type="button" class="btn btn-outline-light w-100" data-scarica-errori>
      ${icona(Download)} Scarica le righe con errori
    </button>`;
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

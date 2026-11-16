import {
  PIANI,
  PREZZO_INSTALLAZIONE,
  PianoSchema,
  formattaEuro,
  oggiInItalia,
} from '@tyrecare/shared';
import { CalendarPlus, Check } from 'lucide';
import {
  COLORE_STATO_ABBONAMENTO,
  ETICHETTE_STATO_ABBONAMENTO,
  descrizionePiano,
  riassuntoAbbonamento,
} from '../lib/abbonamento';
import {
  ModuloAbbonamentoSchema,
  caricaAbbonamentoAdmin,
  impostaAbbonamento,
  registraInstallazione,
  rinnovaAbbonamento,
  type AbbonamentoAdmin,
} from '../lib/admin-abbonamento';
import { ErroreModulo } from '../lib/errori';
import { esc } from '../lib/html';
import { ancoraAttuale, visualizzazioneCorrente } from '../lib/router';
import { icona } from '../ui/icone';
import { caricamento, paginaApp } from '../ui/layout';
import {
  RIQUADRO_ERRORE,
  areaTesto,
  campo,
  collegaModulo,
  pulsanteInvio,
  scelta,
} from '../ui/modulo';
import { accessoAdmin } from './admin-comune';
import {
  ETICHETTE_STATO_OFFICINA,
  avvisoConferma,
  formattaData,
  gestisciErroreCaricamento,
  idValido,
  intestazioneSottopagina,
  mostraErroreInBox,
  parametro,
  vaiConConferma,
} from './comune';

// `/admin/abbonamento?id=<officina>`: l'amministratore registra i pagamenti ricevuti fuori dall'app
// (bonifico): rinnovo di un mese o di un anno, installazione pagata, oppure modifica di tutti i dati.

const TITOLO = 'Abbonamento';

function riga(etichetta: string, valore: string): string {
  return `<div class="tc-abbonamento__riga"><dt>${esc(etichetta)}</dt><dd>${valore}</dd></div>`;
}

function situazione(a: AbbonamentoAdmin): string {
  const r = riassuntoAbbonamento(a, oggiInItalia(), formattaData);
  return `
    <p class="mb-1"><strong class="text-break">${esc(a.ragione_sociale)}</strong> ·
      officina ${esc(ETICHETTE_STATO_OFFICINA[a.stato_affiliazione].toLowerCase())}</p>
    <p class="mb-0 text-body-secondary" data-riassunto>${esc(r.titolo)}</p>
    <dl class="tc-abbonamento tc-lista">
      ${riga(
        'Stato',
        `<span class="tc-stato tc-stato--${COLORE_STATO_ABBONAMENTO[a.stato]}" data-stato>${ETICHETTE_STATO_ABBONAMENTO[a.stato]}</span>`,
      )}
      ${riga('Piano', esc(descrizionePiano(a)))}
      ${riga('Fine della prova', esc(formattaData(a.prova_fino_al)))}
      ${a.iniziato_il ? riga('Abbonato dal', esc(formattaData(a.iniziato_il))) : ''}
      ${riga('Scadenza', a.scade_il ? `<span data-scadenza>${esc(formattaData(a.scade_il))}</span>` : '—')}
      ${riga(
        'Installazione',
        a.installazione_pagata
          ? `Pagata${a.installazione_pagata_il ? ` il ${esc(formattaData(a.installazione_pagata_il))}` : ''}`
          : `Da pagare (${formattaEuro(PREZZO_INSTALLAZIONE)})`,
      )}
    </dl>`;
}

function modulo(a: AbbonamentoAdmin): string {
  return `
    <form class="tc-modulo" data-modulo-abbonamento novalidate>
      ${RIQUADRO_ERRORE}
      ${scelta({
        nome: 'piano',
        etichetta: 'Piano',
        opzioni: PianoSchema.options.map((p) => [p, PIANI[p].nome] as const),
        valore: a.piano,
      })}
      ${scelta({
        nome: 'stato',
        etichetta: 'Stato',
        opzioni: [
          ['PROVA', 'In prova'],
          ['ATTIVO', 'Attivo'],
          ['SCADUTO', 'Scaduto'],
        ],
        valore: a.stato === 'SOSPESO' ? (a.scade_il ? 'ATTIVO' : 'PROVA') : a.stato,
        aiuto:
          a.stato === 'SOSPESO'
            ? 'L’officina è sospesa: lo stato resta «Sospeso» finché non la riattivi dall’elenco delle officine.'
            : 'Sospendere l’officina si fa dall’elenco delle officine.',
      })}
      ${campo({ nome: 'prova_fino_al', etichetta: 'Fine della prova', tipo: 'date', autocomplete: 'off', valore: a.prova_fino_al })}
      ${campo({ nome: 'iniziato_il', etichetta: 'Abbonato dal', tipo: 'date', autocomplete: 'off', valore: a.iniziato_il ?? '' })}
      ${campo({
        nome: 'scade_il',
        etichetta: 'Scadenza (ultimo giorno pagato)',
        tipo: 'date',
        autocomplete: 'off',
        valore: a.scade_il ?? '',
      })}
      ${campo({
        nome: 'importo',
        etichetta: 'Importo concordato (€ per periodo, IVA esclusa)',
        tipo: 'text',
        autocomplete: 'off',
        attributi: 'inputmode="decimal" autocapitalize="off"',
        valore: a.importo_concordato === null ? '' : String(a.importo_concordato).replace('.', ','),
        aiuto: 'Vuoto = prezzo di listino.',
      })}
      ${areaTesto({
        nome: 'note',
        etichetta: 'Note interne',
        valore: a.note_admin,
        aiuto: 'Le vedi solo tu: il titolare non le legge.',
      })}
      ${pulsanteInvio('Salva l’abbonamento', 'Salvataggio…')}
    </form>`;
}

export async function mostraAdminAbbonamento(app: HTMLElement): Promise<void> {
  const n = visualizzazioneCorrente();
  app.innerHTML = paginaApp(caricamento());
  const id = parametro('id');
  let a: AbbonamentoAdmin | null;
  try {
    if (!(await accessoAdmin(app, n, TITOLO))) return;
    a = idValido(id) ? await caricaAbbonamentoAdmin(id) : null;
  } catch (errore) {
    await gestisciErroreCaricamento(app, n, errore);
    return;
  }
  if (!ancoraAttuale(n)) return;
  if (!a || !id) {
    app.innerHTML = paginaApp(`
      ${intestazioneSottopagina(TITOLO, 'Amministratore')}
      <div class="tc-contenuto">
        <p>Officina non trovata.</p>
        <a class="btn btn-outline-light btn-lg w-100" href="/admin/officine">Torna alle officine</a>
      </div>`);
    return;
  }
  const officinaId = id;
  const qui = `/admin/abbonamento?id=${encodeURIComponent(officinaId)}`;

  app.innerHTML = paginaApp(`
    ${intestazioneSottopagina(TITOLO, 'Amministratore')}
    <div class="tc-contenuto">
      ${avvisoConferma()}
      <section aria-labelledby="tc-situazione">
        <h2 id="tc-situazione" class="tc-etichetta">Situazione</h2>
        ${situazione(a)}
      </section>

      <section aria-labelledby="tc-pagamento">
        <h2 id="tc-pagamento" class="tc-etichetta">È arrivato un pagamento</h2>
        <div class="tc-avviso tc-avviso--rosso" data-errore-azioni role="alert" tabindex="-1" hidden></div>
        <div class="tc-admin-azioni">
          <button type="button" class="btn btn-primary" data-rinnova="MESE">
            ${icona(CalendarPlus)} Rinnova di un mese
          </button>
          <button type="button" class="btn btn-primary" data-rinnova="ANNO">
            ${icona(CalendarPlus)} Rinnova di un anno
          </button>
          <button type="button" class="btn btn-outline-light" data-installazione="${a.installazione_pagata ? 'no' : 'si'}">
            ${a.installazione_pagata ? 'Installazione non pagata' : `${icona(Check)} Installazione pagata`}
          </button>
        </div>
        <p class="small text-body-secondary mt-2 mb-0">
          Il rinnovo parte dal giorno dopo la scadenza (o da oggi, se è già passata), mette l’abbonamento
          «Attivo» e avvisa i titolari.
        </p>
      </section>

      <section aria-labelledby="tc-modifica">
        <h2 id="tc-modifica" class="tc-etichetta">Modifica i dati</h2>
        ${modulo(a)}
      </section>

      <a class="btn btn-outline-light btn-lg w-100 mt-3" href="/admin/officine">Torna alle officine</a>
    </div>`);

  const boxAzioni = app.querySelector<HTMLElement>('[data-errore-azioni]');
  const pulsanti = [
    ...app.querySelectorAll<HTMLButtonElement>('[data-rinnova], [data-installazione]'),
  ];
  const esegui = async (azione: () => Promise<string>) => {
    pulsanti.forEach((p) => (p.disabled = true));
    try {
      const messaggio = await azione();
      vaiConConferma(qui, messaggio, { sostituisci: true });
    } catch (errore) {
      pulsanti.forEach((p) => (p.disabled = false));
      mostraErroreInBox(
        boxAzioni,
        errore instanceof ErroreModulo ? errore.message : 'Non è stato possibile salvare. Riprova.',
      );
    }
  };
  app.querySelectorAll<HTMLButtonElement>('[data-rinnova]').forEach((b) =>
    b.addEventListener('click', () => {
      const periodo = b.dataset.rinnova === 'ANNO' ? 'ANNO' : 'MESE';
      void esegui(async () => {
        const scade = await rinnovaAbbonamento(officinaId, periodo);
        return `Abbonamento rinnovato fino al ${formattaData(scade)}.`;
      });
    }),
  );
  app.querySelector<HTMLButtonElement>('[data-installazione]')?.addEventListener('click', (e) => {
    const pagata = (e.currentTarget as HTMLButtonElement).dataset.installazione === 'si';
    void esegui(async () => {
      await registraInstallazione(officinaId, pagata);
      return pagata
        ? 'Installazione segnata come pagata.'
        : 'Installazione segnata come da pagare.';
    });
  });

  collegaModulo(
    app.querySelector<HTMLFormElement>('[data-modulo-abbonamento]')!,
    ModuloAbbonamentoSchema,
    async (dati) => {
      await impostaAbbonamento(officinaId, dati);
      vaiConConferma(qui, 'Abbonamento salvato.', { sostituisci: true });
    },
  );
}

import { PIANI } from '@tyrecare/shared';
import { Building2, Check, Pause, X } from 'lucide';
import {
  attivaOfficina,
  caricaOfficineAdmin,
  leggiVersioneDatabase,
  rifiutaAffiliazione,
  sospendiOfficina,
  statoDatabase,
  type OfficinaAdmin,
} from '../lib/admin';
import { ETICHETTE_STATO_ABBONAMENTO } from '../lib/abbonamento';
import { esc } from '../lib/html';
import { ancoraAttuale, visualizzazioneCorrente } from '../lib/router';
import { chiediConferma } from '../ui/conferma';
import { icona } from '../ui/icone';
import { caricamento, paginaApp } from '../ui/layout';
import { accessoAdmin } from './admin-comune';
import {
  ETICHETTE_STATO_OFFICINA,
  formattaData,
  gestisciErroreCaricamento,
  intestazioneSottopagina,
} from './comune';

// Pagina dell'amministratore (T061): attiva le officine dopo la firma del DPA, o le sospende.
// Il controllo vero è nel database (RLS e le funzioni attiva_officina / sospendi_officina): qui il
// ruolo serve solo a non mostrare una pagina che non si può usare.

const CLASSE_STATO = { IN_ATTESA: 'giallo', ATTIVA: 'verde', SOSPESA: 'nessuno' } as const;

function riga(o: OfficinaAdmin): string {
  const azione =
    o.stato_affiliazione === 'ATTIVA'
      ? `<button type="button" class="btn btn-outline-light" data-sospendi="${o.id}">
          ${icona(Pause)} Sospendi
        </button>`
      : `<div class="d-flex flex-wrap gap-2">
          <button type="button" class="btn btn-primary" data-attiva="${o.id}">
            ${icona(Check)} Attiva
          </button>
          ${
            o.stato_affiliazione === 'IN_ATTESA'
              ? `<button type="button" class="btn tc-pulsante-elimina mt-0" data-rifiuta="${o.id}">
            ${icona(X)} Rifiuta la richiesta
          </button>`
              : ''
          }
        </div>`;
  return `
    <div class="tc-lista__riga flex-column align-items-stretch">
      <div class="d-flex justify-content-between align-items-start gap-2">
        <strong class="text-break">${esc(o.ragione_sociale)}</strong>
        <span class="tc-stato tc-stato--${CLASSE_STATO[o.stato_affiliazione]}">
          ${ETICHETTE_STATO_OFFICINA[o.stato_affiliazione]}
        </span>
      </div>
      <small class="text-body-secondary text-break">
        P. IVA ${esc(o.partita_iva)} · ${esc(o.citta)}<br />
        ${o.email ? `${esc(o.email)}<br />` : ''}
        Richiesta del ${formattaData(o.created_at.slice(0, 10))}<br />
        Titolare: ${esc(o.titolare) || 'non indicato'}
      </small>
      <div class="small" data-piano-attuale>
        Piano: ${o.piano ? esc(PIANI[o.piano].nome) : 'non disponibile'}${
          o.statoAbbonamento ? ` · ${esc(ETICHETTE_STATO_ABBONAMENTO[o.statoAbbonamento])}` : ''
        }
        · <a href="/admin/abbonamento?id=${o.id}" aria-label="Abbonamento di ${esc(o.ragione_sociale)}">Gestisci l’abbonamento</a>
      </div>
      ${azione}
    </div>`;
}

/** Riquadro «Database»: l'app pubblicata e il database di produzione hanno le stesse migrazioni? */
type EsitoVersione = { presente: string | null } | { errore: string };

function riquadroDatabase(esito: EsitoVersione): string {
  const attesa = typeof __ULTIMA_MIGRAZIONE__ === 'string' ? __ULTIMA_MIGRAZIONE__ : '';
  const versione = typeof __VERSIONE_APP__ === 'string' ? __VERSIONE_APP__ : 'locale';
  const coda = `<div class="small text-secondary mt-1">Versione dell'app: ${esc(versione)}</div>`;
  let corpo: string;
  if ('errore' in esito) {
    corpo = `<div class="tc-avviso tc-avviso--rosso" role="alert">Non siamo riusciti a leggere la versione del database: ${esc(esito.errore)}</div>`;
  } else {
    const stato = statoDatabase(attesa, esito.presente);
    if (stato === 'AGGIORNATO') {
      corpo = `<div class="tc-avviso tc-avviso--verde" role="status">Database aggiornato (migrazione ${esc(attesa)})</div>`;
    } else if (stato === 'INDIETRO') {
      const dove =
        esito.presente === null
          ? 'non ha ancora la funzione di controllo'
          : `il database è alla ${esc(esito.presente.slice(0, 14))}`;
      corpo = `<div class="tc-avviso tc-avviso--giallo" role="status">Il database è indietro: l'app si aspetta la migrazione ${esc(attesa)}, ${dove}. Pubblica le migrazioni: guida <code>DOCS/pilota/pubblicazione.md</code>.</div>`;
    } else if (stato === 'AVANTI') {
      corpo = `<div class="tc-avviso tc-avviso--info" role="status">Il database ha migrazioni più nuove dell'app pubblicata: aspetta il prossimo rilascio di Vercel.</div>`;
    } else {
      corpo = `<p class="small mb-0">Versione delle migrazioni dell'app non disponibile in questa build.</p>`;
    }
  }
  return `<section class="mb-3" aria-label="Database" data-riquadro-database>${corpo}${coda}</section>`;
}

export async function mostraAdminOfficine(app: HTMLElement): Promise<void> {
  const n = visualizzazioneCorrente();
  app.innerHTML = paginaApp(caricamento());

  let officine: OfficinaAdmin[];
  let esitoVersione: EsitoVersione = { presente: null };
  try {
    if (!(await accessoAdmin(app, n, 'Officine'))) return;
    // La versione si legge in parallelo; un suo errore non blocca l'elenco (resta nel riquadro)
    const versione = leggiVersioneDatabase().then(
      (presente): EsitoVersione => ({ presente }),
      (e: unknown): EsitoVersione => ({
        errore: e instanceof Error ? e.message : String((e as { message?: unknown })?.message ?? e),
      }),
    );
    officine = await caricaOfficineAdmin();
    esitoVersione = await versione;
  } catch (errore) {
    await gestisciErroreCaricamento(app, n, errore);
    return;
  }
  if (!ancoraAttuale(n)) return;

  const disegna = () => {
    app.innerHTML = paginaApp(`
      ${intestazioneSottopagina('Officine', 'Amministratore')}
      <div class="tc-contenuto">
        ${riquadroDatabase(esitoVersione)}
        ${
          officine.length
            ? `<div class="tc-lista">${officine.map(riga).join('')}</div>`
            : `<div class="tc-vuoto">
                <span class="tc-vuoto__icona">${icona(Building2)}</span>
                <p class="tc-vuoto__titolo">Nessuna officina</p>
                <p class="tc-vuoto__testo">Le richieste di affiliazione compariranno qui.</p>
              </div>`
        }
      </div>`);

    for (const [attributo, attiva] of [
      ['data-attiva', true],
      ['data-sospendi', false],
    ] as const) {
      app.querySelectorAll<HTMLButtonElement>(`[${attributo}]`).forEach((pulsante) => {
        const o = officine.find((x) => x.id === pulsante.getAttribute(attributo));
        if (!o) return;
        pulsante.addEventListener('click', () =>
          chiediConferma({
            titolo: attiva ? 'Attivare l’officina?' : 'Sospendere l’officina?',
            testo: attiva
              ? `Attivare «${o.ragione_sociale}»? Diventa visibile ai clienti: fallo dopo la firma del DPA.`
              : `Sospendere «${o.ragione_sociale}»? Non sarà più visibile ai clienti.`,
            pulsante: attiva ? 'Attiva' : 'Sospendi',
            iconaPulsante: attiva ? Check : Pause,
            inCorso: attiva ? 'Attivazione…' : 'Sospensione…',
            origine: pulsante,
            azione: async () => {
              // Un errore dell'azione resta nel dialogo; quello della ricarica no (l'azione è fatta)
              await (attiva ? attivaOfficina(o.id) : sospendiOfficina(o.id));
              try {
                officine = await caricaOfficineAdmin();
              } catch (errore) {
                await gestisciErroreCaricamento(app, n, errore);
                return;
              }
              if (ancoraAttuale(n)) disegna();
            },
          }),
        );
      });
    }

    app.querySelectorAll<HTMLButtonElement>('[data-rifiuta]').forEach((pulsante) => {
      const o = officine.find((x) => x.id === pulsante.getAttribute('data-rifiuta'));
      if (!o) return;
      pulsante.addEventListener('click', () =>
        chiediConferma({
          titolo: 'Rifiutare la richiesta?',
          testo: `Rifiuti la richiesta di «${o.ragione_sociale}»? L’officina verrà cancellata e chi l’ha chiesta riceverà un avviso.`,
          pulsante: 'Rifiuta',
          iconaPulsante: X,
          inCorso: 'Rifiuto…',
          origine: pulsante,
          campo: { etichetta: 'Motivo (facoltativo)', max: 300 },
          azione: async (motivo) => {
            await rifiutaAffiliazione(o.id, motivo);
            try {
              officine = await caricaOfficineAdmin();
            } catch (errore) {
              await gestisciErroreCaricamento(app, n, errore);
              return;
            }
            if (!ancoraAttuale(n)) return;
            disegna();
            // Il pulsante è sparito: il focus va al titolo. Finché il dialogo modale è aperto la pagina è
            // inerte e focus() non farebbe nulla: si aspetta la chiusura (`origine` non è più nel DOM,
            // quindi il dialogo non rimette il focus altrove).
            const dialogo = document.querySelector<HTMLDialogElement>('dialog.tc-dialogo');
            const aTitolo = () => app.querySelector<HTMLElement>('h1')?.focus();
            if (dialogo?.open) dialogo.addEventListener('close', aTitolo, { once: true });
            else aTitolo();
          },
        }),
      );
    });
  };
  disegna();
}

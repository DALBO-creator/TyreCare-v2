import { PIANI, PianoSchema, type Piano } from '@tyrecare/shared';
import { Building2, Check, Pause, X } from 'lucide';
import {
  attivaOfficina,
  cambiaPianoOfficina,
  caricaOfficineAdmin,
  ETICHETTE_STATO_ABBONAMENTO,
  rifiutaAffiliazione,
  sospendiOfficina,
  type OfficinaAdmin,
} from '../lib/admin';
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
      </div>
      <form class="d-flex align-items-end gap-2" data-form-piano="${o.id}">
        <div class="flex-grow-1">
          <label class="form-label small mb-1" for="tc-piano-${o.id}">Piano</label>
          <select class="form-select" id="tc-piano-${o.id}" name="piano">
            ${PianoSchema.options
              .map(
                (p) =>
                  `<option value="${p}"${p === o.piano ? ' selected' : ''}>${esc(PIANI[p].nome)}</option>`,
              )
              .join('')}
          </select>
        </div>
        <button type="submit" class="btn btn-outline-light">Salva</button>
      </form>
      <div class="tc-avviso tc-avviso--rosso" data-errore-piano="${o.id}" role="alert" hidden></div>
      ${azione}
    </div>`;
}

export async function mostraAdminOfficine(app: HTMLElement): Promise<void> {
  const n = visualizzazioneCorrente();
  app.innerHTML = paginaApp(caricamento());

  let officine: OfficinaAdmin[];
  try {
    if (!(await accessoAdmin(app, n, 'Officine'))) return;
    officine = await caricaOfficineAdmin();
  } catch (errore) {
    await gestisciErroreCaricamento(app, n, errore);
    return;
  }
  if (!ancoraAttuale(n)) return;

  const disegna = () => {
    app.innerHTML = paginaApp(`
      ${intestazioneSottopagina('Officine', 'Amministratore')}
      <div class="tc-contenuto">
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

    app.querySelectorAll<HTMLFormElement>('[data-form-piano]').forEach((modulo) => {
      const id = modulo.getAttribute('data-form-piano');
      const o = officine.find((x) => x.id === id);
      if (!o) return;
      const select = modulo.querySelector<HTMLSelectElement>('select')!;
      const pulsante = modulo.querySelector<HTMLButtonElement>('button[type="submit"]')!;
      const errore = modulo.parentElement!.querySelector<HTMLElement>('[data-errore-piano]')!;
      modulo.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (pulsante.disabled) return;
        const parsed = PianoSchema.safeParse(select.value);
        if (!parsed.success) return;
        const piano: Piano = parsed.data;
        pulsante.disabled = true;
        select.disabled = true;
        pulsante.textContent = 'Salvataggio…';
        errore.hidden = true;
        try {
          await cambiaPianoOfficina(o.id, piano);
        } catch (err) {
          errore.textContent =
            err instanceof Error ? err.message : 'Non siamo riusciti a salvare il piano. Riprova.';
          errore.hidden = false;
          pulsante.disabled = false;
          select.disabled = false;
          pulsante.textContent = 'Salva';
          return;
        }
        o.piano = piano;
        if (ancoraAttuale(n)) disegna();
      });
    });

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
          azione: async () => {
            await rifiutaAffiliazione(o.id);
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

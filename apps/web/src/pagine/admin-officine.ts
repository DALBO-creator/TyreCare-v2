import { Building2, Check, Pause } from 'lucide';
import {
  attivaOfficina,
  caricaOfficineAdmin,
  sospendiOfficina,
  type OfficinaAdmin,
} from '../lib/admin';
import { esc } from '../lib/html';
import { caricaDatiUtente } from '../lib/profilo';
import { ancoraAttuale, visualizzazioneCorrente } from '../lib/router';
import { chiediConferma } from '../ui/conferma';
import { icona } from '../ui/icone';
import { caricamento, paginaApp } from '../ui/layout';
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
      : `<button type="button" class="btn btn-primary" data-attiva="${o.id}">
          ${icona(Check)} Attiva
        </button>`;
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
      ${azione}
    </div>`;
}

export async function mostraAdminOfficine(app: HTMLElement): Promise<void> {
  const n = visualizzazioneCorrente();
  app.innerHTML = paginaApp(caricamento());

  let officine: OfficinaAdmin[];
  try {
    const { profilo } = await caricaDatiUtente();
    if (profilo.ruolo !== 'ADMIN') {
      if (!ancoraAttuale(n)) return;
      app.innerHTML = paginaApp(`
        ${intestazioneSottopagina('Officine', 'Amministratore')}
        <div class="tc-contenuto"><p>Pagina riservata all'amministratore.</p></div>`);
      return;
    }
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
  };
  disegna();
}

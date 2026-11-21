import { CalendarOff, Copy, Plus, Trash2 } from 'lucide';
import {
  GIORNI_SETTIMANA,
  TURNI,
  CAMPO_CAPIENZA,
  campiTurno,
  creaChiusuraSchema,
  creaOrariECapienzaSchema,
  oggiInItalia,
  type GiornoSettimana,
  type Orari,
} from '@tyrecare/shared';
import { esc } from '../lib/html';
import {
  caricaOrariEChiusure,
  creaChiusura,
  eliminaChiusura,
  salvaOrari,
  type ChiusuraOfficina,
} from '../lib/orari';
import { ancoraAttuale, visualizzazioneCorrente } from '../lib/router';
import { chiediConferma } from '../ui/conferma';
import { icona } from '../ui/icone';
import { caricamento, paginaApp } from '../ui/layout';
import { RIQUADRO_ERRORE, campo, collegaModulo, pulsanteInvio } from '../ui/modulo';
import { formattaGiorno } from '../ui/prenotazione';
import {
  avvisoConferma,
  gestisciErroreCaricamento,
  intestazioneSottopagina,
  vaiConConferma,
} from './comune';
import { officinaDelTitolare, SOLO_TITOLARE } from './servizi';

// Orari settimanali e chiusure straordinarie (Fase 4), solo per il TITOLARE. I clienti li vedono nella
// scheda dell'officina e il modulo "Prenota" li usa per i giorni e le fasce disponibili.

const NOMI: Record<GiornoSettimana, string> = {
  lun: 'Lunedì',
  mar: 'Martedì',
  mer: 'Mercoledì',
  gio: 'Giovedì',
  ven: 'Venerdì',
  sab: 'Sabato',
  dom: 'Domenica',
};

/**
 * Il periodo di una chiusura: "Mercoledì 14 ottobre" (giorno singolo) oppure "Da mercoledì 14 a venerdì 16
 * ottobre" (stesso anno): in questi casi mai l'anno. Se `dal` e `al` sono in anni diversi l'anno compare su
 * entrambi i giorni: "Da giovedì 31 dicembre 2026 a sabato 2 gennaio 2027".
 */
export function periodoChiusura(c: Pick<ChiusuraOfficina, 'dal' | 'al'>): string {
  const maiuscola = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  if (c.dal === c.al) return maiuscola(formattaGiorno(c.dal));
  const annoDal = c.dal.slice(0, 4);
  const annoAl = c.al.slice(0, 4);
  if (annoDal !== annoAl) {
    return `Da ${formattaGiorno(c.dal)} ${annoDal} a ${formattaGiorno(c.al)} ${annoAl}`;
  }
  return `Da ${formattaGiorno(c.dal)} a ${formattaGiorno(c.al)}`;
}

/** Un giorno nel modulo: due turni, ciascuno con apertura e chiusura. */
function giornoOrari(g: GiornoSettimana, orari: Orari): string {
  const turni = orari[g] ?? [];
  return `
    <fieldset class="tc-orari-giorno">
      <legend class="tc-orari-giorno__nome">${NOMI[g]}</legend>
      ${TURNI.map((t, i) => {
        const c = campiTurno(g, t);
        const [apre, chiude] = turni[i] ?? ['', ''];
        const turno = t === 1 ? 'primo turno' : 'secondo turno';
        return `
          <div class="tc-auth__coppia">
            ${campo({
              nome: c.apre,
              etichetta: t === 1 ? 'Apre' : 'Riapre',
              tipo: 'time',
              autocomplete: 'off',
              valore: apre,
              attributi: `step="300" aria-label="${NOMI[g]}, ${turno}: apre"`,
            })}
            ${campo({
              nome: c.chiude,
              etichetta: 'Chiude',
              tipo: 'time',
              autocomplete: 'off',
              valore: chiude,
              attributi: `step="300" aria-label="${NOMI[g]}, ${turno}: chiude"`,
            })}
          </div>`;
      }).join('')}
    </fieldset>`;
}

export async function mostraOrari(app: HTMLElement): Promise<void> {
  const n = visualizzazioneCorrente();
  app.innerHTML = paginaApp(caricamento());
  let officinaId: string | null;
  let orari: Orari = {};
  let capienza: number | null = null;
  let chiusure: ChiusuraOfficina[] = [];
  try {
    officinaId = await officinaDelTitolare();
    if (officinaId) {
      const dati = await caricaOrariEChiusure(officinaId);
      // Il formato lo garantisce il vincolo `orari_validi` del database
      orari = dati.orari as Orari;
      capienza = dati.capienza;
      chiusure = dati.chiusure;
    }
  } catch (errore) {
    await gestisciErroreCaricamento(app, n, errore);
    return;
  }
  if (!ancoraAttuale(n)) return;
  if (!officinaId) {
    app.innerHTML = paginaApp(SOLO_TITOLARE);
    return;
  }

  app.innerHTML = paginaApp(`
    ${intestazioneSottopagina('Orari e chiusure', 'Officina')}
    <div class="tc-contenuto">
      ${avvisoConferma()}
      <section aria-labelledby="tc-orari-settimana">
        <h2 id="tc-orari-settimana" class="tc-etichetta">Orari della settimana</h2>
        <p class="text-body-secondary">
          Lascia vuoti i campi dei giorni di chiusura. Il secondo turno serve se chiudi per pranzo.
          I clienti possono chiedere un appuntamento solo quando sei aperto.
        </p>
        <form class="tc-auth__modulo" novalidate>
          ${RIQUADRO_ERRORE}
          ${giornoOrari('lun', orari)}
          <button type="button" class="btn btn-outline-light" data-copia-lunedi>
            ${icona(Copy)} Copia il lunedì da martedì a venerdì
          </button>
          ${GIORNI_SETTIMANA.slice(1)
            .map((g) => giornoOrari(g, orari))
            .join('')}
          ${campo({
            nome: CAMPO_CAPIENZA,
            etichetta: 'Richieste al massimo per fascia',
            tipo: 'text',
            autocomplete: 'off',
            valore: capienza === null ? '' : String(capienza),
            aiuto:
              'Mattina e pomeriggio contano separatamente. Le richieste che confermi tu non hanno limite.',
            attributi: 'inputmode="numeric" maxlength="2" placeholder="Nessun limite"',
          })}
          ${pulsanteInvio('Salva orari', 'Salvataggio…')}
        </form>
      </section>

      <section aria-labelledby="tc-chiusure">
        <h2 id="tc-chiusure" class="tc-etichetta">Chiusure straordinarie</h2>
        <p class="text-body-secondary">Ferie, festivi, inventario: in quei giorni non arrivano richieste.</p>
        <div class="tc-avviso tc-avviso--rosso" data-errore-chiusura role="alert" tabindex="-1" hidden></div>
        ${
          chiusure.length
            ? `<div class="tc-lista">${chiusure
                .map(
                  (c) => `
              <div class="tc-lista__riga">
                <span class="tc-lista__icona">${icona(CalendarOff)}</span>
                <span class="tc-lista__testo">${esc(periodoChiusura(c))}${
                  c.motivo ? `<small>${esc(c.motivo)}</small>` : ''
                }</span>
                <button type="button" class="btn tc-lista__elimina" data-elimina-chiusura="${c.id}"
                  aria-label="Elimina la chiusura: ${esc(periodoChiusura(c))}">${icona(Trash2)}</button>
              </div>`,
                )
                .join('')}</div>`
            : '<p class="mb-0">Nessuna chiusura in programma.</p>'
        }
        <a class="btn btn-outline-light btn-lg w-100 mt-3" href="/officina/chiusura">
          ${icona(Plus)} Aggiungi una chiusura
        </a>
      </section>
    </div>`);

  const form = app.querySelector('form')!;
  const id = officinaId;
  collegaModulo(form, creaOrariECapienzaSchema(), async ({ orari: nuovi, capienza: max }) => {
    await salvaOrari(id, nuovi, max);
    vaiConConferma('/officina/orari', 'Orari salvati.', { sostituisci: true });
  });

  app.querySelector('[data-copia-lunedi]')?.addEventListener('click', () => {
    for (const g of ['mar', 'mer', 'gio', 'ven'] as const) {
      for (const t of TURNI) {
        const da = campiTurno('lun', t);
        const a = campiTurno(g, t);
        for (const k of ['apre', 'chiude'] as const) {
          form.querySelector<HTMLInputElement>(`[name="${a[k]}"]`)!.value =
            form.querySelector<HTMLInputElement>(`[name="${da[k]}"]`)!.value;
        }
      }
    }
  });

  for (const b of app.querySelectorAll<HTMLButtonElement>('[data-elimina-chiusura]')) {
    const c = chiusure.find((x) => x.id === b.dataset.eliminaChiusura)!;
    b.addEventListener('click', () =>
      chiediConferma({
        titolo: 'Eliminare la chiusura?',
        testo: `${periodoChiusura(c)}: i clienti potranno di nuovo chiedere appuntamenti in quei giorni.`,
        pulsante: 'Elimina chiusura',
        origine: b,
        azione: async () => {
          await eliminaChiusura(c.id);
          vaiConConferma('/officina/orari', 'Chiusura eliminata.', { sostituisci: true });
        },
      }),
    );
  }
}

export async function mostraNuovaChiusura(app: HTMLElement): Promise<void> {
  const n = visualizzazioneCorrente();
  app.innerHTML = paginaApp(caricamento());
  let officinaId: string | null;
  try {
    officinaId = await officinaDelTitolare();
  } catch (errore) {
    await gestisciErroreCaricamento(app, n, errore);
    return;
  }
  if (!ancoraAttuale(n)) return;
  if (!officinaId) {
    app.innerHTML = paginaApp(SOLO_TITOLARE);
    return;
  }

  const oggi = oggiInItalia();
  app.innerHTML = paginaApp(`
    ${intestazioneSottopagina('Nuova chiusura', 'Orari e chiusure')}
    <div class="tc-contenuto">
      <form class="tc-auth__modulo" novalidate>
        ${RIQUADRO_ERRORE}
        <div class="tc-auth__coppia">
          ${campo({ nome: 'dal', etichetta: 'Dal', tipo: 'date', autocomplete: 'off', attributi: `min="${oggi}"` })}
          ${campo({
            nome: 'al',
            etichetta: 'Al (compreso)',
            tipo: 'date',
            autocomplete: 'off',
            attributi: `min="${oggi}"`,
            aiuto: 'Per un giorno solo, la stessa data.',
          })}
        </div>
        ${campo({
          nome: 'motivo',
          etichetta: 'Motivo (facoltativo)',
          tipo: 'text',
          autocomplete: 'off',
          aiuto: 'Lo vedono i clienti, es. Ferie estive.',
          attributi: 'maxlength="100" autocapitalize="sentences"',
        })}
        ${pulsanteInvio('Salva chiusura', 'Salvataggio…')}
        <a class="btn btn-outline-light btn-lg w-100" href="/officina/orari">Annulla</a>
      </form>
    </div>`);

  // Scelto il primo giorno, l'ultimo parte da lì
  const dal = app.querySelector<HTMLInputElement>('[name="dal"]')!;
  const al = app.querySelector<HTMLInputElement>('[name="al"]')!;
  dal.addEventListener('change', () => {
    al.min = dal.value || oggi;
    if (!al.value || al.value < dal.value) al.value = dal.value;
  });

  const id = officinaId;
  collegaModulo(app.querySelector('form')!, creaChiusuraSchema(oggi), async (chiusura) => {
    await creaChiusura(id, chiusura);
    vaiConConferma('/officina/orari', 'Chiusura salvata.');
  });
}

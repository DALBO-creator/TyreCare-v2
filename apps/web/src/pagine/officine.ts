import { CalendarPlus, ChevronRight, Search, Store } from 'lucide';
import {
  GIORNI_PRENOTABILI,
  aggiungiGiorni,
  chiusuraIl,
  creaRichiestaSchema,
  formattaTarga,
  giorniPrenotabili,
  normalizzaTarga,
  oggiInItalia,
} from '@tyrecare/shared';
import { esc } from '../lib/html';
import {
  caricaMieiVeicoli,
  caricaOfficinaPubblica,
  caricaOfficineAttive,
  richiediPrenotazione,
  type OfficinaConServizi,
  type OfficinaPubblica,
  type VeicoloMio,
} from '../lib/prenotazioni';
import { caricaDatiUtente, type DatiUtente } from '../lib/profilo';
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
  sceltaUnica,
} from '../ui/modulo';
import { ETICHETTE_FASCIA, formattaGiorno, haOrari, righeOrari } from '../ui/prenotazione';
import {
  gestisciErroreCaricamento,
  idValido,
  intestazioneSottopagina,
  parametro,
  vaiConConferma,
} from './comune';
import { cartaOfficina } from './garage-veicolo';
import { periodoChiusura } from './orari';
import { dettagliServizio } from './servizi';

// Officine per il cliente (Fase 4): elenco delle officine affiliate, scheda con servizi e orari,
// richiesta di un appuntamento con giorno e fascia (decisioni del titolare, 2026-10-12).

const indirizzoBreve = (o: OfficinaPubblica) =>
  [o.indirizzo, o.citta && `${o.citta}${o.provincia ? ` (${o.provincia})` : ''}`]
    .filter(Boolean)
    .join(', ');

export async function mostraOfficine(app: HTMLElement): Promise<void> {
  const n = visualizzazioneCorrente();
  app.innerHTML = paginaApp(caricamento());

  let officine: OfficinaPubblica[];
  try {
    officine = await caricaOfficineAttive();
  } catch (errore) {
    await gestisciErroreCaricamento(app, n, errore);
    return;
  }
  if (!ancoraAttuale(n)) return;

  app.innerHTML = paginaApp(`
    ${intestazioneSottopagina('Officine', 'Prenota un appuntamento')}
    <div class="tc-contenuto">
      ${
        officine.length
          ? `<div class="tc-ricerca">
              <label class="form-label" for="tc-cerca">Cerca per nome o città</label>
              <div class="tc-ricerca__campo">
                ${icona(Search)}
                <input class="form-control form-control-lg" id="tc-cerca" type="search"
                  autocomplete="off" enterkeyhint="search" />
              </div>
            </div>
            <p class="visually-hidden" aria-live="polite" data-conteggio></p>
            <div data-elenco></div>`
          : `<div class="tc-vuoto">
              <span class="tc-vuoto__icona">${icona(Store)}</span>
              <p class="tc-vuoto__titolo">Ancora nessuna officina</p>
              <p class="tc-vuoto__testo">Presto potrai prenotare dalle officine affiliate a TyreCare.</p>
            </div>`
      }
    </div>`);
  if (!officine.length) return;

  const elenco = app.querySelector<HTMLElement>('[data-elenco]')!;
  const conteggio = app.querySelector<HTMLElement>('[data-conteggio]')!;
  const cerca = app.querySelector<HTMLInputElement>('#tc-cerca')!;
  const disegna = () => {
    const testo = cerca.value.trim().toLowerCase();
    const trovate = officine.filter((o) =>
      `${o.ragione_sociale} ${o.citta} ${o.indirizzo}`.toLowerCase().includes(testo),
    );
    conteggio.textContent =
      trovate.length === 1 ? '1 officina trovata' : `${trovate.length} officine trovate`;
    elenco.innerHTML = trovate.length
      ? `<div class="tc-lista">${trovate
          .map(
            (o) => `
          <a class="tc-lista__riga" href="/officina?id=${o.id}">
            <span class="tc-lista__testo">
              ${esc(o.ragione_sociale)}<small>${esc(indirizzoBreve(o))}</small>
            </span>
            ${icona(ChevronRight)}
          </a>`,
          )
          .join('')}</div>`
      : `<div class="tc-vuoto">
          <span class="tc-vuoto__icona">${icona(Search)}</span>
          <p class="tc-vuoto__titolo">Nessuna officina per «${esc(testo)}»</p>
          <p class="tc-vuoto__testo">Prova con il nome della città.</p>
        </div>`;
  };
  cerca.addEventListener('input', disegna);
  disegna();
}

function officinaNonTrovata(): string {
  return `
    <div class="tc-contenuto pt-4">
      <div class="tc-vuoto">
        <span class="tc-vuoto__icona">${icona(Store)}</span>
        <h1 class="tc-vuoto__titolo" tabindex="-1">Officina non disponibile</h1>
        <p class="tc-vuoto__testo">
          Questa officina non esiste o al momento non accetta prenotazioni dall'app.
        </p>
        <a class="btn btn-outline-light mt-3" href="/officine">Vedi le officine</a>
      </div>
    </div>`;
}

/** Scheda pubblica dell'officina: contatti, servizi con "Prenota", orari. */
export async function mostraOfficina(app: HTMLElement): Promise<void> {
  const n = visualizzazioneCorrente();
  app.innerHTML = paginaApp(caricamento());
  const id = parametro('id');
  let officina: OfficinaConServizi | null = null;
  try {
    if (idValido(id)) officina = await caricaOfficinaPubblica(id);
  } catch (errore) {
    await gestisciErroreCaricamento(app, n, errore);
    return;
  }
  if (!ancoraAttuale(n)) return;
  if (!officina) {
    app.innerHTML = paginaApp(officinaNonTrovata());
    return;
  }

  const prenotabile = officina.servizi.length > 0 && haOrari(officina.orari);
  app.innerHTML = paginaApp(`
    ${intestazioneSottopagina(officina.ragione_sociale, officina.citta || 'Officina')}
    <div class="tc-contenuto">
      ${cartaOfficina(officina)}

      <section aria-labelledby="tc-servizi">
        <h2 id="tc-servizi" class="tc-etichetta">Servizi</h2>
        ${
          officina.servizi.length
            ? `<div class="tc-lista">${officina.servizi
                .map(
                  (s) => `
              <a class="tc-lista__riga" href="/prenota?officina=${officina.id}&servizio=${s.id}"
                aria-label="Prenota ${esc(s.nome)}">
                <span class="tc-lista__testo">
                  ${esc(s.nome)}
                  <small>${esc([dettagliServizio(s), s.descrizione].filter(Boolean).join(' · '))}</small>
                </span>
                ${prenotabile ? `<span class="tc-lista__azione">Prenota</span>` : ''}
              </a>`,
                )
                .join('')}</div>`
            : `<p class="text-body-secondary">L'officina non ha ancora indicato i suoi servizi.</p>`
        }
      </section>

      ${
        prenotabile
          ? `<a class="btn btn-primary btn-lg w-100" href="/prenota?officina=${officina.id}">
              ${icona(CalendarPlus)} Chiedi un appuntamento
            </a>`
          : `<p class="text-body-secondary mb-0">
              Per ora questa officina non accetta prenotazioni dall'app: chiamala per un appuntamento.
            </p>`
      }

      <section aria-labelledby="tc-orari">
        <h2 id="tc-orari" class="tc-etichetta">Orari</h2>
        <dl class="tc-orari">
          ${righeOrari(officina.orari)
            .map(([g, t]) => `<div><dt>${g}</dt><dd>${esc(t)}</dd></div>`)
            .join('')}
        </dl>
        ${
          officina.chiusure.length
            ? `<h3 class="tc-etichetta mt-3">Chiusure in programma</h3>
              <ul class="tc-chiusure">
                ${officina.chiusure
                  .map(
                    (c) =>
                      `<li>${esc(periodoChiusura(c))}${c.motivo ? ` · ${esc(c.motivo)}` : ''}</li>`,
                  )
                  .join('')}
              </ul>`
            : ''
        }
      </section>
    </div>`);
}

/** Modulo "Chiedi un appuntamento": servizio, veicolo, giorno e fascia, telefono e note. */
export async function mostraPrenota(app: HTMLElement): Promise<void> {
  const n = visualizzazioneCorrente();
  app.innerHTML = paginaApp(caricamento());
  const id = parametro('officina');
  let officina: OfficinaConServizi | null;
  let veicoli: VeicoloMio[];
  let utente: DatiUtente;
  try {
    [officina, veicoli, utente] = await Promise.all([
      idValido(id) ? caricaOfficinaPubblica(id) : Promise.resolve(null),
      // I veicoli servono solo per compilare più in fretta: se non si leggono, pazienza
      caricaMieiVeicoli().catch(() => []),
      caricaDatiUtente(),
    ]);
  } catch (errore) {
    await gestisciErroreCaricamento(app, n, errore);
    return;
  }
  if (!ancoraAttuale(n)) return;
  if (!officina || !officina.servizi.length || !haOrari(officina.orari)) {
    app.innerHTML = paginaApp(officinaNonTrovata());
    return;
  }

  const oggi = oggiInItalia();
  const giorni = giorniPrenotabili(officina.orari, oggi, officina.chiusure);
  // Dal garage arriva la targa del veicolo: si compila con quello, altrimenti con il primo
  const targa = normalizzaTarga(parametro('targa') ?? '');
  const primo: VeicoloMio | undefined = targa
    ? (veicoli.find((v) => v.targa === targa) ?? { targa, descrizione: '' })
    : veicoli[0];
  const servizio = parametro('servizio');
  const indietro = targa
    ? `/garage/veicolo?targa=${encodeURIComponent(targa)}`
    : `/officina?id=${officina.id}`;

  app.innerHTML = paginaApp(`
    ${intestazioneSottopagina('Chiedi un appuntamento', officina.ragione_sociale)}
    <div class="tc-contenuto">
      <p class="text-body-secondary mb-0">
        Scegli giorno e fascia: l'officina ti conferma l'ora precisa o ti propone un altro orario.
      </p>
      <form class="tc-auth__modulo" novalidate>
        ${RIQUADRO_ERRORE}
        ${scelta({
          nome: 'servizio_id',
          etichetta: 'Servizio',
          opzioni: [
            ['', 'Scegli il servizio'],
            ...officina.servizi.map((s) => [s.id, s.nome] as const),
          ],
          valore: officina.servizi.some((s) => s.id === servizio) ? (servizio ?? '') : '',
        })}

        ${
          veicoli.length > 1
            ? `<div class="tc-scorciatoie" role="group" aria-label="I tuoi veicoli">
                ${veicoli
                  .map(
                    (v) => `
                  <button type="button" class="btn btn-outline-light btn-sm" data-veicolo="${esc(v.targa)}"
                    data-descrizione="${esc(v.descrizione)}">
                    ${esc(formattaTarga(v.targa))}${v.descrizione ? ` · ${esc(v.descrizione)}` : ''}
                  </button>`,
                  )
                  .join('')}
              </div>`
            : ''
        }
        <div class="tc-auth__coppia">
          ${campo({
            nome: 'targa',
            etichetta: 'Targa',
            tipo: 'text',
            autocomplete: 'off',
            valore: primo ? formattaTarga(primo.targa) : '',
            attributi: 'autocapitalize="characters" spellcheck="false" maxlength="15"',
          })}
          ${campo({
            nome: 'veicolo',
            etichetta: 'Veicolo (facoltativo)',
            tipo: 'text',
            autocomplete: 'off',
            valore: primo?.descrizione,
            aiuto: 'Marca e modello, es. Fiat Panda.',
          })}
        </div>

        ${campo({
          nome: 'giorno',
          etichetta: 'Giorno',
          tipo: 'date',
          autocomplete: 'off',
          valore: '',
          aiuto: `Da domani a ${GIORNI_PRENOTABILI} giorni, quando l'officina è aperta (orari qui sotto).`,
          attributi: `min="${aggiungiGiorni(oggi, 1)}" max="${aggiungiGiorni(oggi, GIORNI_PRENOTABILI)}"`,
        })}
        <p class="small text-body-secondary mb-0" data-giorno-scelto aria-live="polite"></p>
        ${sceltaUnica({
          nome: 'fascia',
          etichetta: 'Fascia',
          opzioni: [
            ['MATTINA', ETICHETTE_FASCIA.MATTINA],
            ['POMERIGGIO', ETICHETTE_FASCIA.POMERIGGIO],
          ],
        })}

        ${campo({
          nome: 'telefono',
          etichetta: 'Il tuo telefono',
          tipo: 'tel',
          autocomplete: 'tel',
          valore: utente.profilo.telefono ?? '',
          aiuto: "L'officina ti chiama se serve.",
        })}
        ${areaTesto({
          nome: 'note',
          etichetta: 'Note (facoltative)',
          aiuto: 'Es. gomme già in deposito, rumore in curva…',
        })}
        ${pulsanteInvio('Invia la richiesta', 'Invio…')}
        <a class="btn btn-outline-light btn-lg w-100" href="${esc(indietro)}">Annulla</a>
      </form>

      <details class="tc-orari-dettagli">
        <summary>Orari di ${esc(officina.ragione_sociale)}</summary>
        <dl class="tc-orari">
          ${righeOrari(officina.orari)
            .map(([g, t]) => `<div><dt>${g}</dt><dd>${esc(t)}</dd></div>`)
            .join('')}
        </dl>
      </details>
    </div>`);

  // Un tocco su un veicolo del garage compila targa e descrizione
  for (const b of app.querySelectorAll<HTMLButtonElement>('[data-veicolo]')) {
    b.addEventListener('click', () => {
      app.querySelector<HTMLInputElement>('[name="targa"]')!.value = formattaTarga(
        b.dataset.veicolo!,
      );
      app.querySelector<HTMLInputElement>('[name="veicolo"]')!.value = b.dataset.descrizione ?? '';
    });
  }

  // Sotto il giorno: il giorno per esteso e le fasce in cui l'officina è aperta; le fasce chiuse si
  // disattivano (il controllo vero resta nello schema e nel database)
  const off = officina;
  const giorno = app.querySelector<HTMLInputElement>('[name="giorno"]')!;
  const scelto = app.querySelector<HTMLElement>('[data-giorno-scelto]')!;
  const fasce = [...app.querySelectorAll<HTMLInputElement>('[name="fascia"]')];
  const aggiorna = () => {
    const g = giorni.find((x) => x.data === giorno.value);
    const chiusura = chiusuraIl(off.chiusure, giorno.value);
    scelto.textContent = !giorno.value
      ? ''
      : g
        ? `${formattaGiorno(g.data)}: aperto ${g.fasce.map((f) => ETICHETTE_FASCIA[f].toLowerCase()).join(' e ')}`
        : /^\d{4}-\d{2}-\d{2}$/.test(giorno.value)
          ? `${formattaGiorno(giorno.value)}: ${
              chiusura
                ? `l'officina è chiusa${chiusura.motivo ? ` (${chiusura.motivo.toLowerCase()})` : ''}`
                : "l'officina è chiusa o il giorno è fuori dalle date prenotabili"
            }`
          : '';
    for (const f of fasce) {
      f.disabled = Boolean(g) && !g!.fasce.includes(f.value as 'MATTINA' | 'POMERIGGIO');
      if (f.disabled) f.checked = false;
    }
    // Se è aperto in una sola fascia, si sceglie da sola
    const aperte = fasce.filter((f) => !f.disabled);
    if (g && aperte.length === 1) aperte[0]!.checked = true;
  };
  giorno.addEventListener('change', aggiorna);
  giorno.addEventListener('input', aggiorna);

  collegaModulo(
    app.querySelector('form')!,
    creaRichiestaSchema(officina.orari, oggi, officina.chiusure),
    async (richiesta) => {
      const idPrenotazione = await richiediPrenotazione(off.id, richiesta);
      vaiConConferma(
        `/appuntamento?id=${idPrenotazione}`,
        `Richiesta inviata a ${off.ragione_sociale}. La risposta con l'ora precisa la trovi qui.`,
      );
    },
  );
}

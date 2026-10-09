import { MapPin, Phone, SearchX } from 'lucide';
import { formattaTarga, normalizzaTarga, type StatoSalute } from '@tyrecare/shared';
import { caricaGarage, type OfficinaGarage, type VeicoloGarage } from '../lib/garage';
import { esc } from '../lib/html';
import { ancoraAttuale, visualizzazioneCorrente } from '../lib/router';
import { ICONE_STAGIONE, cruscotto, statoMisura } from '../ui/cruscotto';
import { icona } from '../ui/icone';
import { caricamento, paginaApp } from '../ui/layout';
import { STATI } from '../ui/stato';
import { sezioneStorico } from '../ui/storico';
import {
  ETICHETTE_STAGIONE,
  ORDINE_POSIZIONI,
  POSIZIONI,
  formattaDecimale,
  gestisciErroreCaricamento,
  parametro,
} from './comune';
import { descrizionePneumatico, gruppiPneumatici, nomeGruppo, riga } from './veicolo';

/** Scheda di un veicolo del garage del cliente: `/garage/veicolo?targa=…` (tutte le officine). */
export async function mostraGarageVeicolo(app: HTMLElement): Promise<void> {
  const n = visualizzazioneCorrente();
  app.innerHTML = paginaApp(caricamento());

  const targa = normalizzaTarga(parametro('targa') ?? '');
  let veicolo: VeicoloGarage | undefined;
  try {
    veicolo = (await caricaGarage()).find((v) => v.targa === targa);
  } catch (errore) {
    await gestisciErroreCaricamento(app, n, errore);
    return;
  }
  if (!ancoraAttuale(n)) return;
  if (!veicolo) {
    app.innerHTML = paginaApp(nonNelGarage());
    return;
  }

  const { marca, modello, anno, pneumatici, controlli } = veicolo;
  const ultimo = controlli[0];
  const stagioni = [...new Set(pneumatici.map((p) => p.stagione))];
  document.title = `${formattaTarga(targa)} · TyreCare`;

  app.innerHTML = paginaApp(`
    <section class="tc-hero" aria-labelledby="tc-veicolo">
      <p class="tc-etichetta">${esc(marca) || 'Veicolo'}</p>
      <h1 id="tc-veicolo" class="tc-hero__modello" tabindex="-1">
        ${esc(modello || formattaTarga(targa))}
      </h1>
      <p class="tc-hero__dettagli">
        <span class="tc-targa">${esc(formattaTarga(targa))}</span>
        ${
          stagioni.length === 1
            ? `<span>${icona(ICONE_STAGIONE[stagioni[0]!])} Gomme ${ETICHETTE_STAGIONE[stagioni[0]!].toLowerCase()}</span>`
            : ''
        }
        ${anno ? `<span>${anno}</span>` : ''}
      </p>
      ${ultimo ? cruscotto(ultimo, ultimo.officina) : ''}
    </section>

    <div class="tc-contenuto">
      ${avvisoStato(veicolo)}
      ${sezionePneumatici(veicolo)}
      ${sezioneStorico(controlli)}
      ${sezioneOfficine(veicolo.officine)}
    </div>`);
}

/**
 * Se l'ultimo controllo ha trovato pneumatici da sostituire o da controllare, un avviso che dice quali
 * (dal più grave) e cosa fare. Il colore non basta: c'è l'icona e il testo dice lo stato.
 */
function avvisoStato({ controlli, stato }: VeicoloGarage): string {
  const ultimo = controlli[0];
  if (!ultimo || !stato || stato === 'VERDE') return '';

  const misure = ultimo.misure
    .filter((m) => statoMisura(m) === stato)
    .sort(
      (a, b) =>
        ORDINE_POSIZIONI.indexOf(a.pneumatico.posizione) -
        ORDINE_POSIZIONI.indexOf(b.pneumatico.posizione),
    );
  const elenco = misure
    .map(
      (m) =>
        `<strong>${POSIZIONI[m.pneumatico.posizione].nome}</strong> (${formattaDecimale(m.battistrada_mm)} mm)`,
    )
    .join(', ');
  const uno = misure.length === 1;
  const testi: Record<Exclude<StatoSalute, 'VERDE'>, string> = {
    ROSSO: `${uno ? 'è da sostituire' : 'sono da sostituire'}: il battistrada è troppo basso per
      viaggiare sicuri. Contatta la tua officina il prima possibile.`,
    GIALLO: `${uno ? 'si sta consumando' : 'si stanno consumando'}: chiedi alla tua officina quando
      conviene ${uno ? 'sostituirlo' : 'sostituirli'}.`,
  };
  const s = STATI[stato];
  return `
    <section class="tc-azione" aria-label="Intervento consigliato">
      <div class="tc-avviso tc-avviso--${s.classe}" role="status">
        ${icona(s.icona)}
        <p class="mb-0">${elenco} ${testi[stato]}</p>
      </div>
    </section>`;
}

function sezionePneumatici({ pneumatici, officinaPneumatici, officine }: VeicoloGarage): string {
  const gruppi = gruppiPneumatici(pneumatici);
  return `
    <section aria-labelledby="tc-pneumatici">
      <h2 id="tc-pneumatici" class="tc-etichetta">Pneumatici montati</h2>
      ${
        gruppi.length > 0
          ? `<div class="tc-lista">
              ${gruppi
                .map(({ p, posizioni }) =>
                  riga(
                    ICONE_STAGIONE[p.stagione],
                    nomeGruppo(posizioni),
                    esc(descrizionePneumatico(p)),
                  ),
                )
                .join('')}
            </div>
            ${
              officine.length > 1 && officinaPneumatici
                ? `<p class="tc-nota-sezione">Registrati da ${esc(officinaPneumatici)}</p>`
                : ''
            }`
          : `<p class="text-body-secondary mb-0">La tua officina non ha ancora registrato gli pneumatici.</p>`
      }
    </section>`;
}

function sezioneOfficine(officine: OfficinaGarage[]): string {
  if (officine.length === 0) return '';
  return `
    <section aria-labelledby="tc-officine">
      <h2 id="tc-officine" class="tc-etichetta">
        ${officine.length === 1 ? 'La tua officina' : 'Le tue officine'}
      </h2>
      <div class="tc-officine">${officine.map(cartaOfficina).join('')}</div>
    </section>`;
}

function cartaOfficina(o: OfficinaGarage): string {
  const indirizzo = [o.indirizzo, o.citta].filter(Boolean).join(', ');
  const mappa = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${o.ragione_sociale}, ${indirizzo}`,
  )}`;
  return `
    <article class="tc-officina">
      <h3 class="tc-officina__nome">${esc(o.ragione_sociale)}</h3>
      ${indirizzo ? `<p class="tc-officina__indirizzo">${icona(MapPin)} ${esc(indirizzo)}</p>` : ''}
      <div class="tc-officina__azioni">
        ${
          o.telefono
            ? `<a class="btn btn-outline-light" href="tel:${esc(o.telefono.replace(/\s/g, ''))}">
                ${icona(Phone)} Chiama</a>`
            : ''
        }
        ${
          indirizzo
            ? `<a class="btn btn-outline-light" href="${esc(mappa)}" target="_blank" rel="noopener">
                ${icona(MapPin)} Indicazioni</a>`
            : ''
        }
      </div>
    </article>`;
}

function nonNelGarage(): string {
  return `
    <div class="tc-contenuto pt-4">
      <div class="tc-vuoto">
        <span class="tc-vuoto__icona">${icona(SearchX)}</span>
        <h1 class="tc-vuoto__titolo" tabindex="-1">Veicolo non trovato</h1>
        <p class="tc-vuoto__testo">
          Questo veicolo non è nel tuo garage. Se è tuo, chiedi alla tua officina di collegarlo al tuo
          account.
        </p>
        <a class="btn btn-outline-light mt-3" href="/">Torna al garage</a>
      </div>
    </div>`;
}

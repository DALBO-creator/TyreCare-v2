import { CalendarPlus, MapPin, Phone, SearchX } from 'lucide';
import { formattaTarga, normalizzaTarga } from '@tyrecare/shared';
import { caricaGarage, type OfficinaGarage, type VeicoloGarage } from '../lib/garage';
import { esc } from '../lib/html';
import { caricaOfficinePrenotabili } from '../lib/prenotazioni';
import { lavoraInOfficina } from '../lib/profilo';
import { ancoraAttuale, visualizzazioneCorrente } from '../lib/router';
import { avvisoPneumatici } from '../ui/avviso-pneumatici';
import { ICONE_STAGIONE, cruscotto } from '../ui/cruscotto';
import { icona } from '../ui/icone';
import { caricamento, paginaApp } from '../ui/layout';
import { haOrari } from '../ui/prenotazione';
import { sezioneStorico } from '../ui/storico';
import { ETICHETTE_STAGIONE, gestisciErroreCaricamento, parametro } from './comune';
import { descrizionePneumatico, gruppiPneumatici, nomeGruppo, riga } from './veicolo';

/** Scheda di un veicolo del garage del cliente: `/garage/veicolo?targa=…` (tutte le officine). */
export async function mostraGarageVeicolo(app: HTMLElement): Promise<void> {
  const n = visualizzazioneCorrente();
  app.innerHTML = paginaApp(caricamento());

  const targa = normalizzaTarga(parametro('targa') ?? '');
  let veicolo: VeicoloGarage | undefined;
  let prenotabili = new Set<string>();
  try {
    veicolo = (await caricaGarage()).find((v) => v.targa === targa);
    // "Prenota" serve solo come scorciatoia: se non si riesce a sapere chi è prenotabile, niente pulsante
    prenotabili = new Set(
      (await caricaOfficinePrenotabili(veicolo?.officine.map((o) => o.id) ?? []).catch(() => []))
        .filter((o) => o.servizi.length > 0 && haOrari(o.orari))
        .map((o) => o.id),
    );
  } catch (errore) {
    await gestisciErroreCaricamento(app, n, errore);
    return;
  }
  if (!ancoraAttuale(n)) return;
  if (!veicolo) {
    app.innerHTML = paginaApp(nonNelGarage());
    return;
  }
  const prenota = (o: OfficinaGarage) =>
    prenotabili.has(o.id)
      ? `/prenota?officina=${o.id}&targa=${encodeURIComponent(targa)}`
      : undefined;
  // Nell'avviso sulle ruote: l'officina prenotabile che ha visto il veicolo più di recente
  const officinaAvviso = veicolo.officine.find((o) => prenotabili.has(o.id));

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
      ${avvisoPneumatici(ultimo?.misure ?? [], {
        prenota: officinaAvviso && prenota(officinaAvviso),
      })}
      ${sezionePneumatici(veicolo)}
      ${sezioneStorico(controlli)}
      ${sezioneOfficine(veicolo.officine, prenota)}
    </div>`);
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

function sezioneOfficine(
  officine: OfficinaGarage[],
  prenota: (o: OfficinaGarage) => string | undefined,
): string {
  if (officine.length === 0) return '';
  return `
    <section aria-labelledby="tc-officine">
      <h2 id="tc-officine" class="tc-etichetta">
        ${officine.length === 1 ? 'La tua officina' : 'Le tue officine'}
      </h2>
      <div class="tc-officine">${officine.map((o) => cartaOfficina(o, prenota(o))).join('')}</div>
    </section>`;
}

/**
 * Carta di un'officina con Chiama e Indicazioni (garage e report del controllo). Con `prenota`
 * (indirizzo del modulo) anche "Prenota", sopra gli altri due.
 */
export function cartaOfficina(o: OfficinaGarage, prenota?: string): string {
  const indirizzo = [o.indirizzo, o.citta].filter(Boolean).join(', ');
  const mappa = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${o.ragione_sociale}, ${indirizzo}`,
  )}`;
  return `
    <article class="tc-officina">
      <h3 class="tc-officina__nome">${esc(o.ragione_sociale)}</h3>
      ${indirizzo ? `<p class="tc-officina__indirizzo">${icona(MapPin)} ${esc(indirizzo)}</p>` : ''}
      ${o.telefono ? `<p class="tc-officina__telefono">${icona(Phone)} ${esc(o.telefono)}</p>` : ''}
      <div class="tc-officina__azioni">
        ${
          prenota
            ? `<a class="btn btn-primary tc-officina__prenota" href="${esc(prenota)}">
                ${icona(CalendarPlus)} Prenota</a>`
            : ''
        }
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
        <a class="btn btn-outline-light mt-3" href="${lavoraInOfficina() ? '/garage' : '/'}">Torna al garage</a>
      </div>
    </div>`;
}

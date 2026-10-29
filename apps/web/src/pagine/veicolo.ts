import {
  ClipboardCheck,
  Mail,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  SearchX,
  UserRound,
  type IconNode,
} from 'lucide';
import { formattaTarga, type Posizione } from '@tyrecare/shared';
import { esc } from '../lib/html';
import {
  caricaSchedaVeicolo,
  nominativo,
  type Pneumatico,
  type SchedaVeicolo,
} from '../lib/officina';
import { caricaDatiUtente } from '../lib/profilo';
import { ancoraAttuale, visualizzazioneCorrente } from '../lib/router';
import { ICONE_STAGIONE, cruscotto } from '../ui/cruscotto';
import { icona } from '../ui/icone';
import { caricamento, paginaApp } from '../ui/layout';
import { sezioneStorico } from '../ui/storico';
import {
  ETICHETTE_STAGIONE,
  ORDINE_POSIZIONI,
  POSIZIONI,
  avvisoConferma,
  conData,
  gestisciErroreCaricamento,
  idValido,
  parametro,
} from './comune';

/** Scheda di un veicolo per l'officina: `/veicolo?id=…`. */
export async function mostraVeicolo(app: HTMLElement): Promise<void> {
  const n = visualizzazioneCorrente();
  const scheda = await caricaSchedaDaUrl(app, n);
  if (!scheda) return;

  const { veicolo, pneumatici, controlli } = scheda;
  const ultimo = controlli[0];
  const stagioni = [...new Set(pneumatici.map((p) => p.stagione))];
  const titolo = veicolo.modello || formattaTarga(veicolo.targa);
  document.title = `${formattaTarga(veicolo.targa)} · TyreCare`;

  app.innerHTML = paginaApp(`
    <section class="tc-hero" aria-labelledby="tc-veicolo">
      <p class="tc-etichetta">${esc(veicolo.marca) || 'Veicolo'}</p>
      <h1 id="tc-veicolo" class="tc-hero__modello" tabindex="-1">${esc(titolo)}</h1>
      <p class="tc-hero__dettagli">
        <span class="tc-targa">${esc(formattaTarga(veicolo.targa))}</span>
        ${
          stagioni.length === 1
            ? `<span>${icona(ICONE_STAGIONE[stagioni[0]!])} ${ETICHETTE_STAGIONE[stagioni[0]!]}</span>`
            : ''
        }
        ${veicolo.anno ? `<span>${veicolo.anno}</span>` : ''}
      </p>
      ${ultimo ? cruscotto(ultimo) : ''}
    </section>

    <div class="tc-contenuto">
      ${avvisoConferma()}
      <section class="tc-azione">
        ${
          pneumatici.length > 0
            ? `<a class="btn btn-primary btn-lg w-100" href="/veicolo/controllo?id=${veicolo.id}">
                ${icona(ClipboardCheck)} Nuovo controllo</a>`
            : `<a class="btn btn-primary btn-lg w-100" href="/veicolo/pneumatici?id=${veicolo.id}">
                ${icona(Plus)} Monta gli pneumatici</a>`
        }
      </section>
      ${sezioneCliente(scheda)}
      ${sezionePneumatici(scheda)}
      ${sezioneStorico(controlli, { correggi: true })}
      <a class="btn btn-outline-light btn-lg w-100" href="/veicolo/modifica?id=${veicolo.id}">
        ${icona(Pencil)} Modifica dati del veicolo
      </a>
    </div>`);
}

/**
 * Scheda del veicolo indicato da `?id=…`, per le pagine dell'officina. Mostra da sé caricamento,
 * errore o "non trovato" e in quei casi restituisce `null`. Anche un veicolo visibile ma non di una
 * delle officine dell'utente (il cliente vede la propria auto) risulta "non trovato".
 */
export async function caricaSchedaDaUrl(
  app: HTMLElement,
  n: number,
): Promise<SchedaVeicolo | null> {
  app.innerHTML = paginaApp(caricamento());
  const id = parametro('id') ?? '';
  let scheda: SchedaVeicolo | null = null;
  try {
    if (idValido(id)) {
      const [s, utente] = await Promise.all([caricaSchedaVeicolo(id), caricaDatiUtente()]);
      if (s && utente.officine.some((o) => o.officina.id === s.veicolo.officina_id)) scheda = s;
    }
  } catch (errore) {
    await gestisciErroreCaricamento(app, n, errore);
    return null;
  }
  if (!ancoraAttuale(n)) return null;
  if (!scheda) app.innerHTML = paginaApp(nonTrovato('Veicolo non trovato', 'Il veicolo'));
  return scheda;
}

/** Pagina "non trovato" per i dati dell'officina (es. `nonTrovato('Cliente non trovato', 'Il cliente')`). */
export function nonTrovato(titolo: string, soggetto: string): string {
  return `
    <div class="tc-contenuto pt-4">
      <div class="tc-vuoto">
        <span class="tc-vuoto__icona">${icona(SearchX)}</span>
        <h1 class="tc-vuoto__titolo" tabindex="-1">${esc(titolo)}</h1>
        <p class="tc-vuoto__testo">
          ${esc(soggetto)} non esiste più oppure appartiene a un'altra officina.
        </p>
        <a class="btn btn-outline-light mt-3" href="/">Torna all'elenco</a>
      </div>
    </div>`;
}

/** Riga della lista; con `azione` (es. "correggi") il collegamento ha la matita in fondo. */
export function riga(ic: IconNode, testo: string, dettaglio = '', href = '', azione = ''): string {
  const contenuto = `
    <span class="tc-lista__icona">${icona(ic)}</span>
    <span class="tc-lista__testo">${testo}${
      azione ? `<span class="visually-hidden">, ${azione}</span>` : ''
    }${dettaglio ? `<small>${dettaglio}</small>` : ''}</span>
    ${azione ? icona(Pencil) : ''}`;
  return href
    ? `<a class="tc-lista__riga" href="${href}">${contenuto}</a>`
    : `<div class="tc-lista__riga">${contenuto}</div>`;
}

function sezioneCliente({ veicolo, cliente }: SchedaVeicolo): string {
  return `
    <section aria-labelledby="tc-cliente">
      <div class="tc-sezione-testa">
        <h2 id="tc-cliente" class="tc-etichetta">Cliente</h2>
        ${
          veicolo.cliente_officina_id
            ? `<a href="/clienti/modifica?id=${veicolo.cliente_officina_id}&veicolo=${veicolo.id}"
                aria-label="Modifica i dati del cliente">Modifica</a>`
            : ''
        }
      </div>
      <div class="tc-lista">
        ${
          cliente
            ? [
                riga(
                  UserRound,
                  esc(nominativo(cliente)),
                  'Scheda del cliente',
                  `/cliente?id=${veicolo.cliente_officina_id}`,
                ),
                cliente.telefono
                  ? riga(
                      Phone,
                      'Chiama',
                      esc(cliente.telefono),
                      `tel:${esc(cliente.telefono.replace(/\s/g, ''))}`,
                    )
                  : '',
                cliente.email
                  ? riga(Mail, 'Scrivi', esc(cliente.email), `mailto:${esc(cliente.email)}`)
                  : '',
              ].join('')
            : riga(UserRound, 'Nessun cliente collegato')
        }
      </div>
    </section>`;
}

/** "Anteriore sinistro e destro", "Tutte e quattro le ruote"…: titolo di un gruppo di pneumatici. */
export function nomeGruppo(posizioni: Posizione[]): string {
  const ruote = posizioni.filter((p) => p !== 'SCORTA');
  if (ruote.length === 4) {
    return posizioni.includes('SCORTA') ? 'Tutte le ruote e la scorta' : 'Tutte e quattro le ruote';
  }
  if (posizioni.length === 2 && posizioni.every((p) => p.startsWith('ANT_'))) return 'Anteriori';
  if (posizioni.length === 2 && posizioni.every((p) => p.startsWith('POST_'))) return 'Posteriori';
  return posizioni.map((p) => POSIZIONI[p].nome).join(', ');
}

/**
 * Pneumatici uguali (stesso modello, misura, DOT e data di montaggio) stanno in una sola riga: di
 * solito un treno di quattro montato insieme. Questa è la chiave del gruppo.
 */
export const chiaveGruppo = (p: Pneumatico): string =>
  [p.stagione, p.marca, p.modello, p.misura, p.dot, p.montato_il].join('|');

export interface GruppoPneumatici {
  p: Pneumatico;
  posizioni: Posizione[];
}

/** Pneumatici montati raggruppati (vedi `chiaveGruppo`), nell'ordine delle posizioni. */
export function gruppiPneumatici(pneumatici: Pneumatico[]): GruppoPneumatici[] {
  const gruppi = new Map<string, GruppoPneumatici>();
  for (const posizione of ORDINE_POSIZIONI) {
    const p = pneumatici.find((x) => x.posizione === posizione);
    if (!p) continue;
    const chiave = chiaveGruppo(p);
    const gruppo = gruppi.get(chiave);
    if (gruppo) gruppo.posizioni.push(posizione);
    else gruppi.set(chiave, { p, posizioni: [posizione] });
  }
  return [...gruppi.values()];
}

/** "Michelin Alpin 6 · 175/65 R14 82T · Invernali · DOT 3823 · dal 10 novembre 2025". */
export function descrizionePneumatico(
  p: Pick<Pneumatico, 'marca' | 'modello' | 'misura' | 'stagione' | 'dot' | 'montato_il'>,
): string {
  return [
    `${p.marca} ${p.modello}`.trim(),
    p.misura,
    ETICHETTE_STAGIONE[p.stagione],
    p.dot ? `DOT ${p.dot}` : '',
    conData('dal', p.montato_il),
  ]
    .filter(Boolean)
    .join(' · ');
}

function sezionePneumatici({ veicolo, pneumatici }: SchedaVeicolo): string {
  const gruppi = gruppiPneumatici(pneumatici);

  return `
    <section aria-labelledby="tc-pneumatici">
      <div class="tc-sezione-testa">
        <h2 id="tc-pneumatici" class="tc-etichetta">Pneumatici montati</h2>
        ${
          gruppi.length > 0
            ? `<a href="/veicolo/pneumatici/smonta?id=${veicolo.id}"
                aria-label="Smonta pneumatici senza sostituirli">Smonta</a>`
            : ''
        }
      </div>
      ${
        gruppi.length > 0
          ? `<div class="tc-lista">
              ${gruppi
                .map(({ p, posizioni }) =>
                  riga(
                    ICONE_STAGIONE[p.stagione],
                    nomeGruppo(posizioni),
                    esc(descrizionePneumatico(p)),
                    `/veicolo/pneumatici/modifica?id=${veicolo.id}&p=${p.id}`,
                    'correggi',
                  ),
                )
                .join('')}
            </div>
            <a class="btn btn-outline-light btn-lg w-100 mt-3" href="/veicolo/pneumatici?id=${veicolo.id}">
              ${icona(RefreshCw)} Cambia pneumatici
            </a>`
          : `<p class="text-body-secondary mb-0">Nessuno pneumatico registrato su questo veicolo.</p>`
      }
    </section>`;
}

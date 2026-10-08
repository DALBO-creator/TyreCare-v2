import {
  ClipboardCheck,
  CloudSun,
  Mail,
  Phone,
  Plus,
  RefreshCw,
  SearchX,
  Snowflake,
  Sun,
  UserRound,
  type IconNode,
} from 'lucide';
import {
  formattaTarga,
  statoBattistrada,
  statoPeggiore,
  type Posizione,
  type Stagione,
  type StatoSalute,
} from '@tyrecare/shared';
import { esc } from '../lib/html';
import {
  caricaSchedaVeicolo,
  nominativo,
  type Controllo,
  type Misura,
  type Pneumatico,
  type SchedaVeicolo,
} from '../lib/officina';
import { caricaDatiUtente } from '../lib/profilo';
import { ancoraAttuale, visualizzazioneCorrente } from '../lib/router';
import { autoDallAlto } from '../ui/auto';
import { icona } from '../ui/icone';
import { indicatoreBattistrada } from '../ui/indicatore';
import { caricamento, paginaApp } from '../ui/layout';
import { badgeStato } from '../ui/stato';
import {
  ETICHETTE_STAGIONE,
  ETICHETTE_USURA,
  ORDINE_POSIZIONI,
  POSIZIONI,
  avvisoConferma,
  conData,
  formattaData,
  formattaDecimale,
  formattaKm,
  gestisciErroreCaricamento,
  parametro,
} from './comune';

const ICONE_STAGIONE: Record<Stagione, IconNode> = {
  ESTIVO: Sun,
  INVERNALE: Snowflake,
  QUATTRO_STAGIONI: CloudSun,
};

// Angoli del cruscotto (vedi `.tc-cruscotto`) → posizione dello pneumatico
const ANGOLI = { as: 'ANT_SX', ad: 'ANT_DX', ps: 'POST_SX', pd: 'POST_DX' } as const;

const statoMisura = (m: Misura): StatoSalute =>
  statoBattistrada(m.battistrada_mm, m.pneumatico.stagione);

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
      ${sezioneStorico(controlli)}
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
    // Un id non valido farebbe rispondere al database con un errore: è semplicemente "non trovato"
    if (/^[0-9a-f-]{36}$/i.test(id)) {
      const [s, utente] = await Promise.all([caricaSchedaVeicolo(id), caricaDatiUtente()]);
      if (s && utente.officine.some((o) => o.officina.id === s.veicolo.officina_id)) scheda = s;
    }
  } catch (errore) {
    await gestisciErroreCaricamento(app, n, errore);
    return null;
  }
  if (!ancoraAttuale(n)) return null;
  if (!scheda) app.innerHTML = paginaApp(nonTrovato());
  return scheda;
}

function nonTrovato(): string {
  return `
    <div class="tc-contenuto pt-4">
      <div class="tc-vuoto">
        <span class="tc-vuoto__icona">${icona(SearchX)}</span>
        <h1 class="tc-vuoto__titolo" tabindex="-1">Veicolo non trovato</h1>
        <p class="tc-vuoto__testo">
          Il veicolo non esiste più oppure appartiene a un'altra officina.
        </p>
        <a class="btn btn-outline-light mt-3" href="/">Torna all'elenco</a>
      </div>
    </div>`;
}

/**
 * Auto con i contagiri dell'ultimo controllo. Serve una misura per ognuna delle quattro ruote:
 * se ne manca qualcuna il cruscotto non si mostra (le misure restano nello storico).
 */
function cruscotto(controllo: Controllo): string {
  const misura = (p: Posizione) => controllo.misure.find((m) => m.pneumatico.posizione === p);
  const angoli = Object.entries(ANGOLI).map(([angolo, p]) => ({ angolo, p, m: misura(p) }));
  if (angoli.some((a) => !a.m)) return '';

  const stato = (p: Posizione) => statoMisura(misura(p)!);
  return `
    <div class="tc-cruscotto" aria-label="Stato degli pneumatici all'ultimo controllo" role="group">
      ${angoli
        .map(
          ({ angolo, p, m }) => `
        <div class="tc-cruscotto__${angolo}">${indicatoreBattistrada({
          posizione: POSIZIONI[p].nome,
          sigla: POSIZIONI[p].sigla,
          mm: m!.battistrada_mm,
          stato: statoMisura(m!),
        })}</div>`,
        )
        .join('')}
      <div class="tc-cruscotto__veicolo">${autoDallAlto({
        as: stato('ANT_SX'),
        ad: stato('ANT_DX'),
        ps: stato('POST_SX'),
        pd: stato('POST_DX'),
      })}</div>
    </div>
    <p class="tc-hero__nota">
      Ultimo controllo: ${formattaData(controllo.eseguito_il)}${
        controllo.km !== null ? ` · ${formattaKm(controllo.km)}` : ''
      }
    </p>`;
}

function riga(ic: IconNode, testo: string, dettaglio = '', href = ''): string {
  const contenuto = `
    <span class="tc-lista__icona">${icona(ic)}</span>
    <span class="tc-lista__testo">${testo}${dettaglio ? `<small>${dettaglio}</small>` : ''}</span>`;
  return href
    ? `<a class="tc-lista__riga" href="${href}">${contenuto}</a>`
    : `<div class="tc-lista__riga">${contenuto}</div>`;
}

function sezioneCliente({ cliente }: SchedaVeicolo): string {
  return `
    <section aria-labelledby="tc-cliente">
      <h2 id="tc-cliente" class="tc-etichetta">Cliente</h2>
      <div class="tc-lista">
        ${
          cliente
            ? [
                riga(UserRound, esc(nominativo(cliente))),
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
function nomeGruppo(posizioni: Posizione[]): string {
  const ruote = posizioni.filter((p) => p !== 'SCORTA');
  if (ruote.length === 4) {
    return posizioni.includes('SCORTA') ? 'Tutte le ruote e la scorta' : 'Tutte e quattro le ruote';
  }
  if (posizioni.length === 2 && posizioni.every((p) => p.startsWith('ANT_'))) return 'Anteriori';
  if (posizioni.length === 2 && posizioni.every((p) => p.startsWith('POST_'))) return 'Posteriori';
  return posizioni.map((p) => POSIZIONI[p].nome).join(', ');
}

function sezionePneumatici({ veicolo, pneumatici }: SchedaVeicolo): string {
  // Pneumatici uguali (stesso modello, misura, DOT e data di montaggio) in una sola riga: di solito
  // un treno di quattro montato insieme
  const gruppi = new Map<string, { p: Pneumatico; posizioni: Posizione[] }>();
  for (const posizione of ORDINE_POSIZIONI) {
    const p = pneumatici.find((x) => x.posizione === posizione);
    if (!p) continue;
    const chiave = [p.stagione, p.marca, p.modello, p.misura, p.dot, p.montato_il].join('|');
    const gruppo = gruppi.get(chiave);
    if (gruppo) gruppo.posizioni.push(posizione);
    else gruppi.set(chiave, { p, posizioni: [posizione] });
  }

  return `
    <section aria-labelledby="tc-pneumatici">
      <h2 id="tc-pneumatici" class="tc-etichetta">Pneumatici montati</h2>
      ${
        gruppi.size > 0
          ? `<div class="tc-lista">
              ${[...gruppi.values()]
                .map(({ p, posizioni }) => {
                  const dettagli = [
                    `${p.marca} ${p.modello}`.trim(),
                    p.misura,
                    ETICHETTE_STAGIONE[p.stagione],
                    p.dot ? `DOT ${p.dot}` : '',
                    conData('dal', p.montato_il),
                  ].filter(Boolean);
                  return riga(
                    ICONE_STAGIONE[p.stagione],
                    nomeGruppo(posizioni),
                    esc(dettagli.join(' · ')),
                  );
                })
                .join('')}
            </div>
            <a class="btn btn-outline-light btn-lg w-100 mt-3" href="/veicolo/pneumatici?id=${veicolo.id}">
              ${icona(RefreshCw)} Cambia pneumatici
            </a>`
          : `<p class="text-body-secondary mb-0">Nessuno pneumatico registrato su questo veicolo.</p>`
      }
    </section>`;
}

function sezioneStorico(controlli: Controllo[]): string {
  return `
    <section aria-labelledby="tc-storico">
      <h2 id="tc-storico" class="tc-etichetta">Storico dei controlli</h2>
      ${
        controlli.length > 0
          ? `<div class="tc-storico">${controlli.map(voceStorico).join('')}</div>`
          : `<p class="text-body-secondary mb-0">Nessun controllo registrato.</p>`
      }
    </section>`;
}

/** Un controllo: riassunto sempre visibile, misure e note aprendo la voce. */
function voceStorico(c: Controllo): string {
  const misure = [...c.misure].sort(
    (a, b) =>
      ORDINE_POSIZIONI.indexOf(a.pneumatico.posizione) -
      ORDINE_POSIZIONI.indexOf(b.pneumatico.posizione),
  );
  const stato = statoPeggiore(misure.map(statoMisura));
  return `
    <details class="tc-storico__voce">
      <summary class="tc-storico__riassunto">
        <span class="tc-lista__testo">
          ${formattaData(c.eseguito_il)}
          <small>${c.km !== null ? formattaKm(c.km) : 'Km non indicati'}</small>
        </span>
        ${stato ? badgeStato(stato) : ''}
      </summary>
      <div class="tc-storico__dettaglio">
        <ul class="tc-misure">
          ${misure.map(rigaMisura).join('')}
        </ul>
        ${c.note ? `<p class="tc-storico__note">${esc(c.note)}</p>` : ''}
      </div>
    </details>`;
}

function rigaMisura(m: Misura): string {
  const valori = [
    `${formattaDecimale(m.battistrada_mm)} mm`,
    m.pressione_bar !== null ? `${formattaDecimale(m.pressione_bar)} bar` : '',
    m.usura && m.usura !== 'REGOLARE' ? `usura ${ETICHETTE_USURA[m.usura].toLowerCase()}` : '',
    m.danni,
  ].filter(Boolean);
  return `
    <li class="tc-misure__riga">
      <span class="tc-lista__testo">
        ${POSIZIONI[m.pneumatico.posizione].nome}
        <small>${esc(valori.join(' · '))}</small>
      </span>
      ${badgeStato(statoMisura(m))}
    </li>`;
}

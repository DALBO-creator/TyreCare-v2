import { ArrowLeft, ChevronRight, Info } from 'lucide';
import { SOGLIE_BATTISTRADA_MM, formattaTarga, statoBattistrada } from '@tyrecare/shared';
import { esc } from '../lib/html';
import { caricaDatiUtente } from '../lib/profilo';
import { ancoraAttuale, visualizzazioneCorrente } from '../lib/router';
import {
  caricaPneumatico,
  dataSoglia,
  MESI_GOMMA_VECCHIA,
  formattaEta,
  mesiDalDot,
  tendenza,
  type MisuraStorica,
  type PuntoMisura,
  type SchedaPneumatico,
} from '../lib/salute';
import { ICONE_STAGIONE } from '../ui/cruscotto';
import { graficoBattistrada } from '../ui/grafico-battistrada';
import { icona } from '../ui/icone';
import { indicatoreBattistrada } from '../ui/indicatore';
import { caricamento, paginaApp } from '../ui/layout';
import { badgeStato } from '../ui/stato';
import {
  ETICHETTE_STAGIONE,
  ETICHETTE_USURA,
  POSIZIONI,
  conData,
  formattaData,
  formattaDecimale,
  formattaKm,
  gestisciErroreCaricamento,
  idValido,
  oggi,
  parametro,
} from './comune';
import { nonTrovato } from './veicolo';

const MESE = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' });
const meseAnno = (iso: string) => MESE.format(new Date(`${iso}T12:00:00Z`));

/**
 * Stato di salute di uno pneumatico: `/pneumatico?id=…`. Si apre toccando una ruota del cruscotto
 * (garage e scheda dell'officina) o dalla carta della ruota nel report di un controllo.
 */
export async function mostraPneumatico(app: HTMLElement): Promise<void> {
  const n = visualizzazioneCorrente();
  app.innerHTML = paginaApp(caricamento());

  const id = parametro('id');
  let p: SchedaPneumatico | null = null;
  let membro = false;
  try {
    if (idValido(id)) {
      const [scheda, utente] = await Promise.all([caricaPneumatico(id), caricaDatiUtente()]);
      p = scheda;
      membro = !!scheda && utente.officine.some((o) => o.officina.id === scheda.officina_id);
    }
  } catch (errore) {
    await gestisciErroreCaricamento(app, n, errore);
    return;
  }
  if (!ancoraAttuale(n)) return;
  if (!p) {
    app.innerHTML = paginaApp(nonTrovato('Pneumatico non trovato', 'Lo pneumatico'));
    return;
  }

  const { veicolo, misure } = p;
  const ultima = misure.at(-1);
  const indietro = membro
    ? `/veicolo?id=${veicolo.id}`
    : `/garage/veicolo?targa=${encodeURIComponent(veicolo.targa)}`;
  const nome = `${p.marca} ${p.modello}`.trim();
  document.title = `${POSIZIONI[p.posizione].nome} ${formattaTarga(veicolo.targa)} · TyreCare`;

  app.innerHTML = paginaApp(`
    <section class="tc-hero" aria-labelledby="tc-pneumatico">
      <p class="tc-etichetta">${POSIZIONI[p.posizione].nome}</p>
      <h1 id="tc-pneumatico" class="tc-hero__modello tc-hero__modello--saluto" tabindex="-1">
        ${esc(nome || 'Pneumatico')}
      </h1>
      <p class="tc-hero__dettagli">
        <span class="tc-targa">${esc(formattaTarga(veicolo.targa))}</span>
        <span>${icona(ICONE_STAGIONE[p.stagione])} ${ETICHETTE_STAGIONE[p.stagione]}</span>
        ${p.misura ? `<span>${esc(p.misura)}</span>` : ''}
      </p>
      ${
        ultima
          ? `<div class="tc-salute">
              ${indicatoreBattistrada({
                posizione: POSIZIONI[p.posizione].nome,
                sigla: 'Ultima',
                mm: ultima.battistrada_mm,
                stato: statoBattistrada(ultima.battistrada_mm, p.stagione),
              })}
              <p class="tc-salute__testo">
                Ultima misura ${formattaData(ultima.controllo.eseguito_il)}
                ${ultima.controllo.km !== null ? `<br />a ${formattaKm(ultima.controllo.km)}` : ''}
              </p>
            </div>`
          : ''
      }
    </section>

    <div class="tc-contenuto">
      ${
        p.smontato_il
          ? `<div class="tc-avviso tc-avviso--info" role="status">
              ${icona(Info)}
              <p class="mb-0">Smontato: non è più sul veicolo ${conData('dal', p.smontato_il)}. Qui
                restano le sue misure.</p>
            </div>`
          : ''
      }
      ${sezioneAndamento(p)}
      ${sezioneDati(p)}
      ${sezioneMisure(misure, p)}
      <a class="btn btn-outline-light btn-lg" href="${esc(indietro)}">
        ${icona(ArrowLeft)} Torna al veicolo</a>
    </div>`);
}

const punti = (misure: MisuraStorica[]): PuntoMisura[] =>
  misure.map((m) => ({
    data: m.controllo.eseguito_il,
    km: m.controllo.km,
    mm: m.battistrada_mm,
  }));

function sezioneAndamento(p: SchedaPneumatico): string {
  const serie = punti(p.misure);
  const t = tendenza(serie);
  const consigliato = SOGLIE_BATTISTRADA_MM.consigliato[p.stagione];
  const limite = SOGLIE_BATTISTRADA_MM.limiteLegale;

  let testo: string;
  if (serie.length === 0) {
    testo = 'Questo pneumatico non è ancora stato misurato.';
  } else if (serie.length === 1) {
    testo = 'Dal prossimo controllo qui vedrai come si consuma il battistrada.';
  } else if (!t) {
    testo = 'Tra le misure il battistrada non è calato: non si può stimare il consumo.';
  } else {
    const ritmo = [
      `circa ${formattaDecimale(t.mmAlMese)} mm al mese`,
      t.mmOgni10000km !== null ? `${formattaDecimale(t.mmOgni10000km)} mm ogni 10.000 km` : '',
    ].filter(Boolean);
    const stime = [
      [consigliato, `${consigliato} mm consigliati`],
      [limite, `${formattaDecimale(limite)} mm del limite di legge`],
    ]
      .map(([soglia, nome]) => {
        const quando = dataSoglia(serie, soglia as number);
        return quando ? `ai ${nome} verso ${meseAnno(quando)}` : '';
      })
      .filter(Boolean);
    testo = `Il battistrada cala di ${ritmo.join(' (')}${ritmo.length > 1 ? ')' : ''}.${
      stime.length > 0
        ? ` Se continua così arriverà ${stime.join(' e ')}. È una stima: dipende da come e quanto guidi.`
        : ''
    }`;
  }

  return `
    <section aria-labelledby="tc-andamento">
      <h2 id="tc-andamento" class="tc-etichetta">Andamento del battistrada</h2>
      ${graficoBattistrada(serie, p.stagione)}
      <p class="tc-salute__andamento">${testo}</p>
    </section>`;
}

function sezioneDati(p: SchedaPneumatico): string {
  const mesi = mesiDalDot(p.dot, oggi());
  const dati: [string, string][] = [
    ['Montato il', formattaData(p.montato_il)],
    ['DOT', p.dot ? esc(p.dot) : ''],
    ['Età', mesi !== null ? formattaEta(mesi) : ''],
    ['Smontato il', p.smontato_il ? formattaData(p.smontato_il) : ''],
  ];
  return `
    <section aria-labelledby="tc-dati">
      <h2 id="tc-dati" class="tc-etichetta">Dati dello pneumatico</h2>
      <div class="tc-ruota">
        <dl class="tc-ruota__dati">
          ${dati
            .filter(([, v]) => v)
            .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`)
            .join('')}
        </dl>
        ${
          mesi !== null && mesi >= MESI_GOMMA_VECCHIA
            ? `<p class="tc-ruota__pneumatico">Oltre i 5 anni la gomma indurisce anche con molto
                battistrada: chiedi alla tua officina di controllarla.</p>`
            : ''
        }
      </div>
    </section>`;
}

function sezioneMisure(misure: MisuraStorica[], p: SchedaPneumatico): string {
  if (misure.length === 0) return '';
  const righe = [...misure]
    .reverse()
    .map((m) => {
      const dettagli = [
        m.controllo.km !== null ? formattaKm(m.controllo.km) : '',
        m.pressione_bar !== null ? `${formattaDecimale(m.pressione_bar)} bar` : '',
        m.usura && m.usura !== 'REGOLARE' ? `usura ${ETICHETTE_USURA[m.usura].toLowerCase()}` : '',
        m.danni,
      ].filter(Boolean);
      return `
        <a class="tc-misure__riga tc-misure__riga--link" href="/controllo?id=${m.controllo.id}">
          <span class="tc-lista__testo">
            ${formattaData(m.controllo.eseguito_il)} · ${formattaDecimale(m.battistrada_mm)} mm
            ${dettagli.length ? `<small>${esc(dettagli.join(' · '))}</small>` : ''}
          </span>
          ${badgeStato(statoBattistrada(m.battistrada_mm, p.stagione))}
          ${icona(ChevronRight)}
        </a>`;
    })
    .join('');
  return `
    <section aria-labelledby="tc-elenco-misure">
      <h2 id="tc-elenco-misure" class="tc-etichetta">Misure (${misure.length})</h2>
      <div class="tc-ruota"><div class="tc-misure">${righe}</div></div>
    </section>`;
}

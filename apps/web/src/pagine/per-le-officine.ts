import {
  CONTATTO_EMAIL,
  FUNZIONI_INCLUSE,
  GIORNI_PROVA,
  PIANI,
  PREZZO_INSTALLAZIONE,
  PianoSchema,
  SITO_URL,
  formattaEuro,
  linkContatto,
  prezzoPiano,
  type Piano,
} from '@tyrecare/shared';
import {
  BellRing,
  CalendarCheck,
  ExternalLink,
  FileSpreadsheet,
  LifeBuoy,
  Smartphone,
  type IconNode,
} from 'lucide';
import { esc } from '../lib/html';
import { icona } from '../ui/icone';
import { paginaAuth } from '../ui/layout';
import { piedeLegale } from '../ui/piede-legale';

const DOPO = '?dopo=/officina/registra';

const VANTAGGI: { icona: IconNode; titolo: string; testo: string }[] = [
  {
    icona: FileSpreadsheet,
    titolo: 'Importa dal tuo gestionale',
    testo: 'Porti clienti e veicoli da un file, senza riscriverli.',
  },
  {
    icona: BellRing,
    titolo: 'Gomme dei clienti sotto controllo',
    testo: 'Vedi lo stato di ogni treno di gomme e i promemoria partono da soli.',
  },
  {
    icona: CalendarCheck,
    titolo: 'Appuntamenti e calendario',
    testo: 'I clienti chiedono un appuntamento dall’app e tu li gestisci dal calendario.',
  },
  {
    icona: Smartphone,
    titolo: 'Controlli e report nell’app',
    testo: 'I clienti trovano i controlli e i report del loro veicolo sul telefono.',
  },
  {
    icona: LifeBuoy,
    titolo: 'Aiuto su strada',
    testo: 'Ricevi le richieste di aiuto degli automobilisti fermi vicino a te.',
  },
];

const PASSI = [
  'Crea il tuo account.',
  'Registra la tua officina.',
  'Firmiamo il DPA e attiviamo l’officina.',
];

/**
 * Domande frequenti (`<details>`). Ogni risposta riflette il codice o le decisioni di oggi:
 * import (`pagine/importa.ts`, `lib/importa.ts`), P22 (mappatura colonne), P25 (nessun pagamento
 * nell'app), termini di servizio in bozza (disdetta), manifest PWA. Niente importi scritti a mano.
 */
const DOMANDE: { domanda: string; risposta: () => string }[] = [
  {
    domanda: 'Devo reinserire i miei clienti?',
    risposta: () =>
      `No. Importi clienti e veicoli da un file del tuo gestionale (.csv, .xls, .xlsx, .ods).
       Se le intestazioni non sono tutte riconosciute, associ tu le colonne ai campi di TyreCare;
       prima di importare vedi un’anteprima con le righe da correggere. L’ultimo import si può
       annullare entro 7 giorni, solo dal titolare dell’officina.`,
  },
  {
    domanda: 'I miei clienti devono scaricare un’app?',
    risposta: () =>
      `No, TyreCare è un’app web: si apre dal browser e si può aggiungere alla schermata Home del
       telefono. Per ogni cliente puoi preparare l’email d’invito con il link per vedere i suoi
       veicoli.`,
  },
  {
    domanda: 'Quanto costa e quando pago?',
    risposta: () =>
      `I prezzi sono nella sezione Prezzi qui sopra. Nell’app non si paga: i primi ${GIORNI_PROVA}
       giorni sono di prova gratuita e non ti chiediamo nessuna carta. Dopo la prova installazione e
       abbonamento si pagano con bonifico su fattura.`,
  },
  {
    domanda: 'Posso smettere quando voglio?',
    risposta: () =>
      `Sì, puoi disdire in qualsiasi momento scrivendo a
       <a href="${esc(linkContatto('Disdetta abbonamento'))}">${esc(CONTATTO_EMAIL)}</a>. La disdetta
       vale dalla fine del periodo già pagato e quel periodo non viene rimborsato. Le condizioni
       complete sono nei Termini di servizio.`,
  },
  {
    domanda: 'I dati sono miei?',
    risposta: () =>
      `Sì. Dalla pagina dell’import scarichi in qualsiasi momento tutti i clienti e i veicoli
       («Scarica clienti e veicoli») e le misure di tutti i controlli («Scarica i controlli»): i file
       si aprono con Excel.`,
  },
  {
    domanda: 'Funziona al computer e al telefono?',
    risposta: () =>
      `Sì, TyreCare funziona dal browser del computer e del telefono, senza installare niente. Sul
       telefono puoi anche aggiungerla alla schermata Home.`,
  },
];

/** Carta di un piano: nome, prezzo e nota, letti da `PIANI` (mai scritti a mano). */
function cartaPrezzo(piano: Piano): string {
  const p = PIANI[piano];
  return `
    <section class="tc-officine__piano" aria-labelledby="tc-prezzo-${piano}">
      <h3 id="tc-prezzo-${piano}" class="tc-officine__piano-nome">${esc(p.nome)}</h3>
      <p class="tc-officine__piano-prezzo">${esc(prezzoPiano(piano))}</p>
      ${p.nota ? `<p class="mb-0">${esc(p.nota)}</p>` : ''}
    </section>`;
}

/** Pagina pubblica di presentazione per i gommisti (`/per-le-officine`): vantaggi e passi per iniziare. */
export function mostraPerLeOfficine(app: HTMLElement): void {
  const vantaggi = VANTAGGI.map(
    (v) => `
      <li class="tc-officine__vantaggio">
        <span class="tc-officine__icona">${icona(v.icona)}</span>
        <div>
          <p class="tc-officine__vantaggio-titolo">${v.titolo}</p>
          <p class="tc-officine__vantaggio-testo">${v.testo}</p>
        </div>
      </li>`,
  ).join('');
  const domande = DOMANDE.map(
    (d) => `
      <details class="tc-officine__domanda">
        <summary>${esc(d.domanda)}</summary>
        <p class="tc-officine__risposta">${d.risposta()}</p>
      </details>`,
  ).join('');
  const passi = PASSI.map((p) => `<li>${p}</li>`).join('');

  app.innerHTML = paginaAuth({
    titolo: 'TyreCare per le officine',
    sottotitolo: 'Meno telefonate, più clienti che tornano al momento giusto.',
    corpo: `
      <div class="tc-officine">
        <ul class="tc-officine__vantaggi">${vantaggi}</ul>
        <h2 class="tc-officine__sezione">Prezzi</h2>
        <div class="tc-officine__piani">${PianoSchema.options.map(cartaPrezzo).join('')}</div>
        <p class="tc-officine__prova">${GIORNI_PROVA} giorni di prova gratuita, senza impegno.</p>
        <p class="mb-0">
          Installazione e avvio: ${formattaEuro(PREZZO_INSTALLAZIONE)} una tantum. Prezzi IVA esclusa,
          pagamento con bonifico su fattura.
        </p>
        <h2 class="tc-officine__sezione">Tutto incluso</h2>
        <ul class="tc-officine__piano-funzioni">
          ${FUNZIONI_INCLUSE.map((f) => `<li>${esc(f)}</li>`).join('')}
        </ul>
        <p class="tc-officine__sito">
          <a href="${SITO_URL}" target="_blank" rel="noopener noreferrer">
            Scopri le funzioni sul sito ${icona(ExternalLink)}
          </a>
        </p>
        <h2 class="tc-officine__sezione">Come si inizia</h2>
        <ol class="tc-officine__passi">${passi}</ol>
        <h2 class="tc-officine__sezione">Domande frequenti</h2>
        <div class="tc-officine__domande">${domande}</div>
        <a class="btn btn-primary btn-lg w-100" href="/registrati${DOPO}">Registra la tua officina</a>
        <p class="tc-officine__accedi">Hai già un account? <a href="/accedi${DOPO}">Accedi</a></p>
      </div>`,
    piede: piedeLegale(),
  });
}

import { PIANI, type Piano } from '@tyrecare/shared';
import {
  BellRing,
  CalendarCheck,
  FileSpreadsheet,
  LifeBuoy,
  Smartphone,
  type IconNode,
} from 'lucide';
import { esc } from '../lib/html';
import { icona } from '../ui/icone';
import { paginaAuth } from '../ui/layout';

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

/** Carta di un piano a pagamento: nome, prezzo al mese e funzioni, letti da `PIANI` (mai scritti a mano). */
function cartaPrezzo(piano: Exclude<Piano, 'PILOTA'>): string {
  const p = PIANI[piano];
  const prezzo = p.prezzoMensile === null ? '' : `${p.prezzoMensile} €/mese`;
  return `
    <section class="tc-officine__piano" aria-labelledby="tc-prezzo-${piano}">
      <h3 id="tc-prezzo-${piano}" class="tc-officine__piano-nome">${esc(p.nome)}</h3>
      <p class="tc-officine__piano-prezzo">${prezzo}</p>
      <ul class="tc-officine__piano-funzioni">
        ${p.funzioni.map((f) => `<li>${esc(f)}</li>`).join('')}
      </ul>
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
  const passi = PASSI.map((p) => `<li>${p}</li>`).join('');

  app.innerHTML = paginaAuth({
    titolo: 'TyreCare per le officine',
    sottotitolo: 'Meno telefonate, più clienti che tornano al momento giusto.',
    corpo: `
      <div class="tc-officine">
        <ul class="tc-officine__vantaggi">${vantaggi}</ul>
        <h2 class="tc-officine__sezione">Prezzi</h2>
        <div class="tc-officine__piani">${cartaPrezzo('STARTER')}${cartaPrezzo('PRO')}</div>
        <p class="tc-officine__prova">30 giorni di prova gratuita: non serve la carta per iniziare.</p>
        <h2 class="tc-officine__sezione">Come si inizia</h2>
        <ol class="tc-officine__passi">${passi}</ol>
        <a class="btn btn-primary btn-lg w-100" href="/registrati${DOPO}">Registra la tua officina</a>
        <p class="tc-officine__accedi">Hai già un account? <a href="/accedi${DOPO}">Accedi</a></p>
      </div>`,
    piede: `<a href="/privacy">Privacy</a> · <a href="/termini">Termini di servizio</a>`,
  });
}

import { BellRing, CalendarCheck, FileSpreadsheet, Smartphone, type IconNode } from 'lucide';
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
];

const PASSI = [
  'Crea il tuo account.',
  'Registra la tua officina.',
  'Firmiamo il DPA e attiviamo l’officina.',
];

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
        <h2 class="tc-officine__sezione">Come si inizia</h2>
        <ol class="tc-officine__passi">${passi}</ol>
        <a class="btn btn-primary btn-lg w-100" href="/registrati${DOPO}">Registra la tua officina</a>
        <p class="tc-officine__accedi">Hai già un account? <a href="/accedi${DOPO}">Accedi</a></p>
      </div>`,
    piede: `<a href="/privacy">Privacy</a> · <a href="/termini">Termini di servizio</a>`,
  });
}

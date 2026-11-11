import { Trash2, type IconNode } from 'lucide';
import { messaggioErrore } from '../lib/auth';
import { ErroreModulo } from '../lib/errori';
import { esc } from '../lib/html';
import { icona } from './icone';

interface Conferma {
  titolo: string;
  /** Cosa succede confermando, in parole semplici (es. "Si perdono anche i 3 controlli"). */
  testo: string;
  /** Verbo + oggetto, come il pulsante che apre il dialogo (es. "Elimina veicolo"). */
  pulsante: string;
  /** Azione da eseguire: se fallisce, l'errore compare nel dialogo, che resta aperto. */
  azione: (testo?: string) => Promise<void>;
  /** Campo di testo facoltativo sopra i pulsanti: il suo valore arriva ad `azione`. */
  campo?: { etichetta: string; max: number };
  /** Icona del pulsante di conferma (predefinita: il cestino). */
  iconaPulsante?: IconNode;
  /** Testo del pulsante mentre l'azione è in corso (predefinito: "Eliminazione…"). */
  inCorso?: string;
  /**
   * Pulsante che ha aperto il dialogo: riprende il focus se si annulla. Va passato esplicitamente,
   * perché Safari non mette a fuoco i pulsanti toccati.
   */
  origine?: HTMLElement;
}

/**
 * Dialogo di conferma per le azioni che non si possono annullare (eliminazioni). È un `<dialog>`
 * modale nativo: il focus resta dentro, Esc chiude, il resto della pagina è inerte. All'apertura il
 * focus va su "Annulla", così un Invio di troppo non elimina nulla.
 */
export function chiediConferma({
  titolo,
  testo,
  pulsante,
  azione,
  campo,
  origine,
  iconaPulsante = Trash2,
  inCorso = 'Eliminazione…',
}: Conferma): void {
  const dialogo = document.createElement('dialog');
  dialogo.className = 'tc-dialogo';
  dialogo.setAttribute('aria-labelledby', 'tc-dialogo-titolo');
  dialogo.setAttribute('aria-describedby', 'tc-dialogo-testo');
  dialogo.innerHTML = `
    <h2 id="tc-dialogo-titolo" class="tc-dialogo__titolo">${esc(titolo)}</h2>
    <p id="tc-dialogo-testo" class="tc-dialogo__testo">${esc(testo)}</p>${
      campo
        ? `
    <div class="mb-3">
      <label for="tc-dialogo-campo" class="form-label">${esc(campo.etichetta)}</label>
      <textarea id="tc-dialogo-campo" class="form-control" rows="3" maxlength="${esc(String(campo.max))}"></textarea>
      <p class="form-text text-end mb-0" data-contatore aria-live="polite">0 / ${esc(String(campo.max))}</p>
    </div>`
        : ''
    }
    <div class="tc-avviso tc-avviso--rosso" role="alert" hidden></div>
    <div class="tc-dialogo__azioni">
      <button type="button" class="btn btn-primary btn-lg" data-conferma>
        ${icona(iconaPulsante)} ${esc(pulsante)}
      </button>
      <button type="button" class="btn btn-outline-light btn-lg" data-annulla>Annulla</button>
    </div>`;

  const annulla = dialogo.querySelector<HTMLButtonElement>('[data-annulla]')!;
  const conferma = dialogo.querySelector<HTMLButtonElement>('[data-conferma]')!;
  const errore = dialogo.querySelector<HTMLElement>('[role="alert"]')!;
  const testoConferma = conferma.innerHTML;
  const area = dialogo.querySelector<HTMLTextAreaElement>('#tc-dialogo-campo');
  const contatore = dialogo.querySelector<HTMLElement>('[data-contatore]');
  area?.addEventListener('input', () => {
    if (contatore && campo) contatore.textContent = `${area.value.length} / ${campo.max}`;
  });
  // Chi aveva il focus prima (il pulsante "Elimina…"): lo riprende se si annulla
  const prima = origine ?? (document.activeElement as HTMLElement | null);

  annulla.addEventListener('click', () => dialogo.close());
  // Un tocco sullo sfondo scuro chiude come "Annulla"
  dialogo.addEventListener('click', (e) => {
    if (e.target === dialogo) dialogo.close();
  });
  dialogo.addEventListener('close', () => {
    dialogo.remove();
    if (prima?.isConnected) prima.focus();
  });
  // Durante l'eliminazione Esc non chiude: l'esito deve arrivare
  dialogo.addEventListener('cancel', (e) => {
    if (conferma.disabled) e.preventDefault();
  });

  conferma.addEventListener('click', async () => {
    errore.hidden = true;
    conferma.disabled = annulla.disabled = true;
    if (area) area.disabled = true;
    conferma.setAttribute('aria-busy', 'true');
    conferma.innerHTML = `<span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
      ${esc(inCorso)}`;
    try {
      await azione(area?.value);
      // L'azione di solito cambia pagina: il dialogo si chiude senza restituire il focus
      if (dialogo.open) dialogo.close();
    } catch (e) {
      conferma.disabled = annulla.disabled = false;
      if (area) area.disabled = false;
      conferma.removeAttribute('aria-busy');
      conferma.innerHTML = testoConferma;
      errore.innerHTML = `<p class="mb-0">${esc(
        e instanceof ErroreModulo ? e.message : messaggioErrore(e),
      )}</p>`;
      errore.hidden = false;
      annulla.focus();
    }
  });

  document.body.append(dialogo);
  dialogo.showModal();
  annulla.focus();
}

/** Pulsante che apre il dialogo di eliminazione, in fondo alle pagine di modifica. */
export function pulsanteElimina(testo: string): string {
  return `
    <button type="button" class="btn btn-lg w-100 tc-pulsante-elimina" data-elimina>
      ${icona(Trash2)} ${esc(testo)}
    </button>`;
}

/** Collega il pulsante di `pulsanteElimina` (se presente in `radice`) al dialogo di conferma. */
export function collegaElimina(radice: HTMLElement, conferma: Omit<Conferma, 'origine'>): void {
  const pulsante = radice.querySelector<HTMLButtonElement>('[data-elimina]');
  pulsante?.addEventListener('click', () => chiediConferma({ ...conferma, origine: pulsante }));
}

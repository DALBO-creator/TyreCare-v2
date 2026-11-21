import { Eye, EyeOff } from 'lucide';
import type { z } from 'zod';
import { messaggioErrore } from '../lib/auth';
import { ErroreModulo } from '../lib/errori';
import { esc } from '../lib/html';
import { icona } from './icone';

interface Campo {
  nome: string;
  etichetta: string;
  tipo: 'text' | 'email' | 'password' | 'tel' | 'date' | 'time';
  /** Valore di `autocomplete`: permette a browser e password manager di compilare il campo. */
  autocomplete: string;
  aiuto?: string;
  /** Valore iniziale (es. i dati attuali del profilo). */
  valore?: string | undefined;
  /**
   * Attributi HTML aggiuntivi, scritti dal codice e mai con dati dell'utente
   * (es. `inputmode="decimal"` per avere la tastiera numerica col separatore decimale).
   */
  attributi?: string;
  /** Unità mostrata a destra del campo (es. "mm", "bar"). */
  unita?: string;
}

const id = (nome: string) => `campo-${nome}`;

const descrizioni = (nome: string, aiuto?: string) =>
  [aiuto ? `${id(nome)}-aiuto` : '', `${id(nome)}-errore`].join(' ').trim();

const etichettaCampo = (nome: string, etichetta: string) =>
  `<label class="form-label" for="${id(nome)}">${esc(etichetta)}</label>`;

const aiutoEErrore = (nome: string, aiuto?: string) => `
  ${aiuto ? `<div id="${id(nome)}-aiuto" class="form-text">${esc(aiuto)}</div>` : ''}
  <div id="${id(nome)}-errore" class="tc-campo__errore" hidden></div>`;

/**
 * Campo con etichetta sempre visibile, testo di aiuto e spazio per l'errore, collegati all'input
 * con `aria-describedby`. Le password hanno il pulsante per mostrarle (incollare è sempre permesso).
 */
export function campo({
  nome,
  etichetta,
  tipo,
  autocomplete,
  aiuto,
  valore,
  attributi = '',
  unita,
}: Campo): string {
  const input = `
    <input class="form-control form-control-lg" id="${id(nome)}" name="${nome}" type="${tipo}"
      autocomplete="${autocomplete}" aria-describedby="${descrizioni(nome, aiuto)}"
      ${valore ? `value="${esc(valore)}"` : ''}
      ${tipo === 'email' ? 'inputmode="email" autocapitalize="off" spellcheck="false"' : ''}
      ${tipo === 'text' && !attributi.includes('autocapitalize') ? 'autocapitalize="words"' : ''}
      ${attributi} />`;

  let controllo = input;
  if (tipo === 'password') {
    controllo = `
      <div class="input-group">
        ${input}
        <button type="button" class="btn tc-campo__mostra" data-mostra-password
          aria-controls="${id(nome)}" aria-pressed="false" aria-label="Mostra password">
          ${icona(Eye)}
        </button>
      </div>`;
  } else if (unita) {
    // L'unità va scritta anche nell'etichetta, per i lettori di schermo: qui è solo visiva
    controllo = `
      <div class="tc-campo__con-unita">
        ${input}<span class="tc-campo__unita" aria-hidden="true">${esc(unita)}</span>
      </div>`;
  }

  return `
    <div class="tc-campo">
      ${etichettaCampo(nome, etichetta)}
      ${controllo}
      ${aiutoEErrore(nome, aiuto)}
    </div>`;
}

/** Coppie valore → testo per menu e caselle. Un valore vuoto è la scelta "nessuna". */
export type Opzioni = readonly (readonly [string, string])[];

interface Scelta {
  nome: string;
  etichetta: string;
  opzioni: Opzioni;
  valore?: string | undefined;
  aiuto?: string;
}

/** Menu a tendina con etichetta, aiuto ed errore come `campo`. */
export function scelta({ nome, etichetta, opzioni, valore = '', aiuto }: Scelta): string {
  return `
    <div class="tc-campo">
      ${etichettaCampo(nome, etichetta)}
      <select class="form-select form-select-lg" id="${id(nome)}" name="${nome}"
        aria-describedby="${descrizioni(nome, aiuto)}">
        ${opzioni
          .map(
            ([v, testo]) =>
              `<option value="${esc(v)}"${v === valore ? ' selected' : ''}>${esc(testo)}</option>`,
          )
          .join('')}
      </select>
      ${aiutoEErrore(nome, aiuto)}
    </div>`;
}

interface AreaTesto {
  nome: string;
  etichetta: string;
  aiuto?: string;
  righe?: number;
  valore?: string | undefined;
}

/** Testo su più righe (es. note). */
export function areaTesto({ nome, etichetta, aiuto, righe = 3, valore = '' }: AreaTesto): string {
  return `
    <div class="tc-campo">
      ${etichettaCampo(nome, etichetta)}
      <textarea class="form-control form-control-lg" id="${id(nome)}" name="${nome}" rows="${righe}"
        aria-describedby="${descrizioni(nome, aiuto)}">${esc(valore)}</textarea>
      ${aiutoEErrore(nome, aiuto)}
    </div>`;
}

interface Caselle {
  nome: string;
  etichetta: string;
  opzioni: Opzioni;
  /** Valori spuntati all'apertura. */
  selezionate?: readonly string[];
  aiuto?: string;
}

/**
 * Gruppo di caselle a scelta multipla (`fieldset` + `legend`), mostrate come pulsanti grandi.
 * Il valore letto dal modulo è sempre un elenco, anche vuoto.
 */
export function caselle({ nome, etichetta, opzioni, selezionate = [], aiuto }: Caselle): string {
  return `
    <fieldset class="tc-campo tc-caselle" data-gruppo="${nome}"
      aria-describedby="${descrizioni(nome, aiuto)}">
      <legend class="form-label">${esc(etichetta)}</legend>
      <div class="tc-caselle__elenco">
        ${opzioni
          .map(
            ([v, testo]) => `
          <label class="tc-caselle__voce">
            <input class="form-check-input" type="checkbox" name="${nome}" value="${esc(v)}"
              ${selezionate.includes(v) ? 'checked' : ''} />
            <span>${esc(testo)}</span>
          </label>`,
          )
          .join('')}
      </div>
      ${aiutoEErrore(nome, aiuto)}
    </fieldset>`;
}

interface SceltaUnica {
  nome: string;
  etichetta: string;
  opzioni: Opzioni;
  valore?: string | undefined;
  aiuto?: string;
}

/**
 * Scelta tra poche opzioni (`fieldset` + pulsanti radio), mostrate come pulsanti grandi come le
 * caselle. Il valore letto dal modulo è una stringa (vuota se non è scelto nulla).
 */
export function sceltaUnica({ nome, etichetta, opzioni, valore = '', aiuto }: SceltaUnica): string {
  return `
    <fieldset class="tc-campo tc-caselle" aria-describedby="${descrizioni(nome, aiuto)}">
      <legend class="form-label">${esc(etichetta)}</legend>
      <div class="tc-caselle__elenco">
        ${opzioni
          .map(
            ([v, testo]) => `
          <label class="tc-caselle__voce">
            <input class="form-check-input" type="radio" name="${nome}" value="${esc(v)}"
              ${v === valore ? 'checked' : ''} />
            <span>${esc(testo)}</span>
          </label>`,
          )
          .join('')}
      </div>
      ${aiutoEErrore(nome, aiuto)}
    </fieldset>`;
}

/** Pulsante di invio con lo stato "in corso" (spinner + testo). */
export function pulsanteInvio(testo: string, testoInCorso: string): string {
  return `
    <button type="submit" class="btn btn-primary btn-lg w-100" data-testo="${esc(testo)}"
      data-testo-in-corso="${esc(testoInCorso)}">${esc(testo)}</button>`;
}

/** Riquadro per l'errore generale (es. credenziali errate): annunciato e raggiungibile dal focus. */
export const RIQUADRO_ERRORE = `
  <div class="tc-avviso tc-avviso--rosso" data-errore-modulo role="alert" tabindex="-1" hidden></div>`;

type Dati = Record<string, string | string[]>;
type Controllo = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

const eControllo = (el: unknown): el is Controllo =>
  el instanceof HTMLInputElement ||
  el instanceof HTMLSelectElement ||
  el instanceof HTMLTextAreaElement;

/**
 * Collega un modulo a uno schema Zod:
 * - all'uscita da un campo modificato ne mostra l'eventuale errore; mentre si corregge, l'errore
 *   sparisce appena il valore diventa valido;
 * - all'invio valida tutto: se ci sono errori li mostra e porta il focus sul primo campo errato,
 *   altrimenti chiama `invia` con i dati già puliti dallo schema (es. spazi tolti dall'email);
 * - se `invia` fallisce mostra il messaggio sotto il campo (`ErroreModulo` con `campo`) o nel
 *   riquadro d'errore generale.
 */
export function collegaModulo<S extends z.ZodType>(
  form: HTMLFormElement,
  schema: S,
  invia: (dati: z.output<S>) => Promise<void>,
): void {
  const modificati = new Set<string>();
  // Nomi dei campi nell'ordine della pagina (un gruppo di caselle conta una volta)
  const nomi = (): string[] => [
    ...new Set(
      [...form.elements]
        .filter(eControllo)
        .map((el) => el.name)
        .filter(Boolean),
    ),
  ];
  const gruppi = new Set(
    [...form.querySelectorAll<HTMLElement>('[data-gruppo]')].map((g) => g.dataset.gruppo!),
  );
  // Le caselle di un gruppo diventano l'elenco dei valori spuntati (vuoto se nessuno)
  const leggi = (): Dati => {
    const fd = new FormData(form);
    return Object.fromEntries(
      nomi().map((n) => [n, gruppi.has(n) ? fd.getAll(n).map(String) : String(fd.get(n) ?? '')]),
    );
  };

  const erroriPerCampo = (): Map<string, string> => {
    const errori = new Map<string, string>();
    for (const issue of schema.safeParse(leggi()).error?.issues ?? []) {
      const nome = String(issue.path[0]);
      if (!errori.has(nome)) errori.set(nome, issue.message);
    }
    return errori;
  };

  const mostraErrore = (nome: string, messaggio: string | undefined) => {
    const box = form.querySelector<HTMLElement>(`#${id(nome)}-errore`);
    if (!box) return;
    for (const el of form.querySelectorAll<Controllo>(`[name="${nome}"]`)) {
      el.classList.toggle('is-invalid', Boolean(messaggio));
      el.setAttribute('aria-invalid', String(Boolean(messaggio)));
    }
    box.textContent = messaggio ?? '';
    box.hidden = !messaggio;
  };

  const aggiornaSeErrato = (el: Controllo) => {
    modificati.add(el.name);
    if (el.classList.contains('is-invalid')) mostraErrore(el.name, erroriPerCampo().get(el.name));
  };
  form.addEventListener('input', (e) => {
    if (eControllo(e.target)) aggiornaSeErrato(e.target);
  });
  // Menu e caselle segnalano la scelta con `change`
  form.addEventListener('change', (e) => {
    if (eControllo(e.target)) aggiornaSeErrato(e.target);
  });

  form.addEventListener('focusout', (e) => {
    const el = e.target;
    // Per le caselle l'errore si aggiorna solo con `change`: passare da una casella all'altra
    // del gruppo non deve far comparire "Scegli almeno…"
    if (eControllo(el) && modificati.has(el.name) && !gruppi.has(el.name)) {
      mostraErrore(el.name, erroriPerCampo().get(el.name));
    }
  });

  // Mostra/nascondi password
  form.addEventListener('click', (e) => {
    const pulsante = (e.target as Element).closest<HTMLButtonElement>('[data-mostra-password]');
    const input =
      pulsante &&
      form.querySelector<HTMLInputElement>(`#${pulsante.getAttribute('aria-controls')}`);
    if (!pulsante || !input) return;
    const visibile = input.type === 'password';
    input.type = visibile ? 'text' : 'password';
    pulsante.setAttribute('aria-pressed', String(visibile));
    pulsante.setAttribute('aria-label', visibile ? 'Nascondi password' : 'Mostra password');
    pulsante.innerHTML = icona(visibile ? EyeOff : Eye);
  });

  const riquadro = form.querySelector<HTMLElement>('[data-errore-modulo]');

  // `reset` arriva prima che i valori tornino iniziali: qui non si leggono valori. Il modulo
  // torna come appena aperto: nessun campo "modificato", nessun errore visibile.
  form.addEventListener('reset', () => {
    modificati.clear();
    for (const nome of nomi()) mostraErrore(nome, undefined);
    if (riquadro) riquadro.hidden = true;
  });
  const pulsante = form.querySelector<HTMLButtonElement>('[type="submit"]');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (pulsante?.disabled) return;
    if (riquadro) riquadro.hidden = true;

    const risultato = schema.safeParse(leggi());
    if (!risultato.success) {
      const errori = erroriPerCampo();
      for (const nome of nomi()) mostraErrore(nome, errori.get(nome));
      form.querySelector<HTMLElement>('.is-invalid')?.focus();
      return;
    }

    staInviando(pulsante, true);
    try {
      await invia(risultato.data);
    } catch (errore) {
      if (errore instanceof ErroreModulo && errore.campo) {
        // Errore legato a un campo (es. targa già registrata): sotto il campo, come gli altri
        mostraErrore(errore.campo, errore.message);
        form.querySelector<HTMLElement>(`[name="${errore.campo}"]`)?.focus();
      } else if (riquadro) {
        const messaggio = errore instanceof ErroreModulo ? errore.message : messaggioErrore(errore);
        riquadro.innerHTML = `<p class="mb-0">${esc(messaggio)}</p>`;
        riquadro.hidden = false;
        riquadro.focus();
      }
    } finally {
      // Se `invia` ha cambiato pagina il pulsante non è più nel documento: niente da ripristinare
      if (pulsante?.isConnected) staInviando(pulsante, false);
    }
  });
}

function staInviando(pulsante: HTMLButtonElement | null, inCorso: boolean): void {
  if (!pulsante) return;
  pulsante.disabled = inCorso;
  pulsante.setAttribute('aria-busy', String(inCorso));
  pulsante.innerHTML = inCorso
    ? `<span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
       ${esc(pulsante.dataset.testoInCorso)}`
    : esc(pulsante.dataset.testo);
}

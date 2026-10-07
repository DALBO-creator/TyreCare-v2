import { Eye, EyeOff } from 'lucide';
import type { z } from 'zod';
import { messaggioErrore } from '../lib/auth';
import { esc } from '../lib/html';
import { icona } from './icone';

interface Campo {
  nome: string;
  etichetta: string;
  tipo: 'text' | 'email' | 'password' | 'tel';
  /** Valore di `autocomplete`: permette a browser e password manager di compilare il campo. */
  autocomplete: string;
  aiuto?: string;
  /** Valore iniziale (es. i dati attuali del profilo). */
  valore?: string;
}

const id = (nome: string) => `campo-${nome}`;

/**
 * Campo con etichetta sempre visibile, testo di aiuto e spazio per l'errore, collegati all'input
 * con `aria-describedby`. Le password hanno il pulsante per mostrarle (incollare è sempre permesso).
 */
export function campo({ nome, etichetta, tipo, autocomplete, aiuto, valore }: Campo): string {
  const descrizioni = [aiuto ? `${id(nome)}-aiuto` : '', `${id(nome)}-errore`].join(' ').trim();
  const input = `
    <input class="form-control form-control-lg" id="${id(nome)}" name="${nome}" type="${tipo}"
      autocomplete="${autocomplete}" aria-describedby="${descrizioni}"
      ${valore ? `value="${esc(valore)}"` : ''}
      ${tipo === 'email' ? 'inputmode="email" autocapitalize="off" spellcheck="false"' : ''}
      ${tipo === 'text' ? 'autocapitalize="words"' : ''} />`;

  return `
    <div class="tc-campo">
      <label class="form-label" for="${id(nome)}">${esc(etichetta)}</label>
      ${
        tipo === 'password'
          ? `<div class="input-group">
              ${input}
              <button type="button" class="btn tc-campo__mostra" data-mostra-password
                aria-controls="${id(nome)}" aria-pressed="false" aria-label="Mostra password">
                ${icona(Eye)}
              </button>
            </div>`
          : input
      }
      ${aiuto ? `<div id="${id(nome)}-aiuto" class="form-text">${esc(aiuto)}</div>` : ''}
      <div id="${id(nome)}-errore" class="tc-campo__errore" hidden></div>
    </div>`;
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

type Dati = Record<string, string>;

/**
 * Collega un modulo a uno schema Zod:
 * - all'uscita da un campo modificato ne mostra l'eventuale errore; mentre si corregge, l'errore
 *   sparisce appena il valore diventa valido;
 * - all'invio valida tutto: se ci sono errori li mostra e porta il focus sul primo campo errato,
 *   altrimenti chiama `invia` con i dati già puliti dallo schema (es. spazi tolti dall'email);
 * - se `invia` fallisce mostra il messaggio nel riquadro d'errore generale.
 */
export function collegaModulo<S extends z.ZodType>(
  form: HTMLFormElement,
  schema: S,
  invia: (dati: z.output<S>) => Promise<void>,
): void {
  const modificati = new Set<string>();
  const leggi = (): Dati =>
    Object.fromEntries([...new FormData(form)].map(([k, v]) => [k, String(v)]));

  const erroriPerCampo = (): Map<string, string> => {
    const errori = new Map<string, string>();
    for (const issue of schema.safeParse(leggi()).error?.issues ?? []) {
      const nome = String(issue.path[0]);
      if (!errori.has(nome)) errori.set(nome, issue.message);
    }
    return errori;
  };

  const mostraErrore = (nome: string, messaggio: string | undefined) => {
    const input = form.elements.namedItem(nome);
    const box = form.querySelector<HTMLElement>(`#${id(nome)}-errore`);
    if (!(input instanceof HTMLInputElement) || !box) return;
    input.classList.toggle('is-invalid', Boolean(messaggio));
    input.setAttribute('aria-invalid', String(Boolean(messaggio)));
    box.textContent = messaggio ?? '';
    box.hidden = !messaggio;
  };

  form.addEventListener('input', (e) => {
    const input = e.target as HTMLInputElement;
    modificati.add(input.name);
    if (input.classList.contains('is-invalid')) {
      mostraErrore(input.name, erroriPerCampo().get(input.name));
    }
  });

  form.addEventListener('focusout', (e) => {
    const input = e.target;
    if (input instanceof HTMLInputElement && modificati.has(input.name)) {
      mostraErrore(input.name, erroriPerCampo().get(input.name));
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
  const pulsante = form.querySelector<HTMLButtonElement>('[type="submit"]');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (pulsante?.disabled) return;
    if (riquadro) riquadro.hidden = true;

    const risultato = schema.safeParse(leggi());
    if (!risultato.success) {
      const errori = erroriPerCampo();
      for (const input of form.querySelectorAll<HTMLInputElement>('input[name]')) {
        mostraErrore(input.name, errori.get(input.name));
      }
      form.querySelector<HTMLInputElement>('.is-invalid')?.focus();
      return;
    }

    staInviando(pulsante, true);
    try {
      await invia(risultato.data);
    } catch (errore) {
      if (riquadro) {
        riquadro.innerHTML = `<p class="mb-0">${esc(messaggioErrore(errore))}</p>`;
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

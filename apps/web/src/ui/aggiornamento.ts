/**
 * Avviso non bloccante "nuova versione disponibile": un riquadro fisso in basso, sopra la
 * navigazione, con "Aggiorna" e "Più tardi". Sostituisce `confirm()`, che blocca la pagina.
 * Modulo piccolo e senza dipendenze: è importato da `main.ts`, quindi sta nel file iniziale.
 */

/** HTML del riquadro (testo statico: nessun dato dell'utente, niente da proteggere con `esc`). */
export function htmlAvvisoAggiornamento(): string {
  return `<div class="tc-avviso tc-avviso--info tc-aggiornamento" role="status" data-aggiornamento>
    <p class="tc-aggiornamento__testo">È disponibile una nuova versione di TyreCare.</p>
    <div class="tc-aggiornamento__azioni">
      <button type="button" class="btn btn-primary btn-sm" data-aggiorna>Aggiorna</button>
      <button type="button" class="btn btn-link btn-sm" data-piu-tardi>Più tardi</button>
    </div>
  </div>`;
}

/** Callback corrente dell'avviso aperto: una seconda chiamata aggiorna questo, non crea un'altra copia. */
let aggiornaCorrente: (() => void) | null = null;

/** Mostra l'avviso (una sola copia). "Aggiorna" chiama `aggiorna` una volta; "Più tardi" lo chiude. */
export function mostraAvvisoAggiornamento(aggiorna: () => void): void {
  aggiornaCorrente = aggiorna;
  if (document.querySelector('[data-aggiornamento]')) return;

  const contenitore = document.createElement('div');
  contenitore.innerHTML = htmlAvvisoAggiornamento();
  const riquadro = contenitore.firstElementChild as HTMLElement;
  const pulsanteAggiorna = riquadro.querySelector<HTMLButtonElement>('[data-aggiorna]')!;
  const pulsantePiuTardi = riquadro.querySelector<HTMLButtonElement>('[data-piu-tardi]')!;

  pulsanteAggiorna.addEventListener('click', () => {
    // Evita il doppio clic mentre la pagina si ricarica
    pulsanteAggiorna.disabled = true;
    aggiornaCorrente?.();
  });
  pulsantePiuTardi.addEventListener('click', () => {
    riquadro.remove();
    aggiornaCorrente = null;
  });

  // Annuncio: il riquadro entra con il paragrafo vuoto e il testo si scrive al giro successivo,
  // così il lettore di schermo vede una modifica della regione `role="status"` e la legge.
  const paragrafo = riquadro.querySelector<HTMLElement>('.tc-aggiornamento__testo')!;
  const testo = paragrafo.textContent ?? '';
  paragrafo.textContent = '';
  document.body.append(riquadro);
  setTimeout(() => {
    paragrafo.textContent = testo; // se il riquadro è già stato chiuso, scrive in un nodo staccato: innocuo
  }, 0);
}

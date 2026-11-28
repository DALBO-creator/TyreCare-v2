/**
 * Chiavi delle bozze del «Nuovo controllo» e loro pulizia all'uscita dall'account. Nessun import:
 * il file è letto da `auth.ts` (JS iniziale) e deve restare minuscolo. La logica delle bozze
 * (salvataggio, scadenza) sta in `bozza-controllo.ts`.
 */

export const PREFISSO_BOZZA = 'tc-bozza-controllo:';

/** La chiave contiene l'id utente: un altro account sullo stesso telefono non vede le note. */
export function chiaveBozza(utenteId: string, veicoloId: string): string {
  return `${PREFISSO_BOZZA}${utenteId}:${veicoloId}`;
}

/**
 * Toglie dal dispositivo tutte le bozze dell'utente (chiavi `tc-bozza-controllo:<utenteId>:`), da
 * chiamare all'uscita: sul tablet dell'officina le misure non salvate non restano al prossimo.
 * Il `:` finale evita che `u1` tocchi le bozze di `u10`. Con id vuoto non fa nulla. Prima raccoglie
 * le chiavi, poi cancella (gli indici di `key(i)` si spostano). Non lancia mai.
 */
export function pulisciBozzeUtente(utenteId: string): void {
  if (!utenteId) return;
  const prefisso = `${PREFISSO_BOZZA}${utenteId}:`;
  let chiavi: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k !== null && k.startsWith(prefisso)) chiavi.push(k);
    }
  } catch {
    chiavi = [];
  }
  for (const chiave of chiavi) {
    try {
      localStorage.removeItem(chiave);
    } catch {
      // una chiave che non si cancella resta dov'è
    }
  }
}

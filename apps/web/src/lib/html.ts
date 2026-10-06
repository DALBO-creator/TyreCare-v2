const ENTITA: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Rende sicuro un testo da inserire in un template HTML. Va usato per **ogni** dato che arriva
 * dall'utente o dal database (nomi, email, indirizzi…): senza, un nome come `<img onerror=…>`
 * eseguirebbe codice nella pagina (XSS).
 */
export function esc(testo: string | null | undefined): string {
  return (testo ?? '').replace(/[&<>"']/g, (c) => ENTITA[c] ?? c);
}

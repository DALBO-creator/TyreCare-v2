/**
 * Applica il tema chiaro/scuro di Bootstrap (`data-bs-theme` su <html>) seguendo
 * l'impostazione del sistema operativo, e lo aggiorna se l'utente la cambia.
 */
export function seguiTemaDiSistema(): void {
  const scuro = window.matchMedia('(prefers-color-scheme: dark)');
  const applica = (): void => {
    document.documentElement.dataset.bsTheme = scuro.matches ? 'dark' : 'light';
  };
  applica();
  scuro.addEventListener('change', applica);
}

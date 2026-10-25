/**
 * Caricamento pigro delle pagine: il codice di una pagina si scarica solo quando la si apre.
 * Se un import dinamico fallisce perché è uscita una versione nuova e il file vecchio non c'è più,
 * la pagina si ricarica una volta sola per prendere la versione nuova.
 */

const CHIAVE_RICARICA = 'tc-ricarica-pagina';

const MESSAGGI_IMPORT = [
  'Failed to fetch dynamically imported module', // Chrome, Edge
  'Importing a module script failed', // Safari
  'error loading dynamically imported module', // Firefox
];

/** Vero se l'errore è un import dinamico fallito e la pagina non è già stata ricaricata. */
export function deveRicaricare(errore: unknown, giaRicaricata: boolean): boolean {
  if (giaRicaricata) return false;
  const messaggio = errore instanceof Error ? errore.message : '';
  return MESSAGGI_IMPORT.some((m) => messaggio.includes(m));
}

function leggiFlag(): boolean {
  try {
    return sessionStorage.getItem(CHIAVE_RICARICA) !== null;
  } catch {
    return false;
  }
}

function scriviFlag(): void {
  try {
    sessionStorage.setItem(CHIAVE_RICARICA, '1');
  } catch {
    /* sessionStorage non disponibile */
  }
}

function togliFlag(): void {
  try {
    sessionStorage.removeItem(CHIAVE_RICARICA);
  } catch {
    /* sessionStorage non disponibile */
  }
}

type Pagina = (app: HTMLElement) => void | Promise<void>;

/**
 * Restituisce la funzione `mostra` di una rotta che importa il modulo solo alla prima visita.
 * Più rotte dello stesso modulo condividono lo stesso chunk.
 */
export function pigra<M, K extends keyof M>(
  carica: () => Promise<M>,
  nome: M[K] extends Pagina ? K : never,
): (app: HTMLElement) => Promise<void> {
  return async (app) => {
    let modulo: M;
    try {
      modulo = await carica();
    } catch (errore) {
      if (deveRicaricare(errore, leggiFlag())) {
        scriviFlag();
        location.reload();
        // La pagina sta per essere ricaricata: non mostrare niente nel frattempo
        return new Promise<void>(() => undefined);
      }
      throw errore;
    }
    // Import riuscito: un deploy successivo potrà ricaricare di nuovo
    togliFlag();
    await (modulo[nome] as Pagina)(app);
  };
}

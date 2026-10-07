import type { Enums } from '@tyrecare/shared';
import { esci } from '../lib/auth';
import { sessioneNonValida } from '../lib/profilo';
import { ancoraAttuale } from '../lib/router';
import { paginaApp } from '../ui/layout';

export const ETICHETTE_RUOLO: Record<Enums<'ruolo'>, string> = {
  ADMIN: 'Amministratore',
  OFFICINA: 'Officina',
  CLIENTE: 'Cliente',
};

/** Etichetta sopra il saluto in home, in base al ruolo. */
export const ETICHETTE_AREA: Record<Enums<'ruolo'>, string> = {
  ADMIN: 'Amministrazione',
  OFFICINA: 'Area officina',
  CLIENTE: 'Il tuo garage',
};

export const ETICHETTE_RUOLO_OFFICINA: Record<Enums<'ruolo_officina'>, string> = {
  TITOLARE: 'Titolare',
  OPERATORE: 'Operatore',
};

export const ETICHETTE_STATO_OFFICINA: Record<Enums<'stato_affiliazione'>, string> = {
  IN_ATTESA: 'In attesa',
  ATTIVA: 'Attiva',
  SOSPESA: 'Sospesa',
};

/** Messaggio quando i dati non si caricano, con un pulsante per riprovare. */
export function erroreCaricamento(): string {
  return `
    <div class="tc-contenuto pt-4">
      <div class="tc-avviso tc-avviso--giallo" role="alert">
        <p class="mb-0">Non riusciamo a caricare i tuoi dati. Controlla la connessione e riprova.</p>
      </div>
      <a class="btn btn-outline-light" href="${location.pathname}">Riprova</a>
    </div>`;
}

/**
 * Gestisce un errore di `caricaDatiUtente`. Con una sessione non più valida esce: main.ts riceve
 * SIGNED_OUT e porta ad `/accedi`. Altrimenti mostra l'avviso con "Riprova".
 */
export async function gestisciErroreCaricamento(
  app: HTMLElement,
  n: number,
  errore: unknown,
): Promise<void> {
  if (sessioneNonValida(errore)) {
    try {
      await esci();
      return;
    } catch {
      // Uscita non riuscita (es. offline): si ricade sull'avviso generico
    }
  }
  if (ancoraAttuale(n)) app.innerHTML = paginaApp(erroreCaricamento());
}

/** Intestazione delle sottopagine del profilo: etichetta "Profilo" e titolo. */
export function intestazioneSottopagina(titolo: string): string {
  return `
    <section class="tc-hero">
      <p class="tc-etichetta">Profilo</p>
      <h1 class="tc-hero__modello tc-hero__modello--saluto" tabindex="-1">${titolo}</h1>
    </section>`;
}

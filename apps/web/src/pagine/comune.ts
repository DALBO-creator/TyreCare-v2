import type { Enums } from '@tyrecare/shared';

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

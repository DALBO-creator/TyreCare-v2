import { CircleCheck } from 'lucide';
import type { Enums, Posizione, Stagione, Usura } from '@tyrecare/shared';
import { esci } from '../lib/auth';
import { ErroreModulo } from '../lib/errori';
import { segnalaErrore } from '../lib/errori-app';
import { esc } from '../lib/html';
import { sessioneNonValida } from '../lib/profilo';
import { ancoraAttuale, vaiA } from '../lib/router';
import { icona } from '../ui/icone';
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

/** Nome per esteso e sigla (per gli indicatori) di ogni posizione, nell'ordine di visualizzazione. */
export const POSIZIONI: Record<Posizione, { nome: string; sigla: string }> = {
  ANT_SX: { nome: 'Anteriore sinistro', sigla: 'Ant. SX' },
  ANT_DX: { nome: 'Anteriore destro', sigla: 'Ant. DX' },
  POST_SX: { nome: 'Posteriore sinistro', sigla: 'Post. SX' },
  POST_DX: { nome: 'Posteriore destro', sigla: 'Post. DX' },
  SCORTA: { nome: 'Ruota di scorta', sigla: 'Scorta' },
};
export const ORDINE_POSIZIONI = Object.keys(POSIZIONI) as Posizione[];

export const ETICHETTE_STAGIONE: Record<Stagione, string> = {
  ESTIVO: 'Estivi',
  INVERNALE: 'Invernali',
  QUATTRO_STAGIONI: '4 stagioni',
};

export const ETICHETTE_USURA: Record<Usura, string> = {
  REGOLARE: 'Regolare',
  INTERNA: 'Sul lato interno',
  ESTERNA: 'Sul lato esterno',
  CENTRALE: 'Al centro',
  BORDI: 'Su entrambi i bordi',
};

const FORMATO_DATA = new Intl.DateTimeFormat('it-IT', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** `2026-09-14` → "14 settembre 2026". Mezzogiorno UTC: la data non cambia con il fuso orario. */
export const formattaData = (iso: string): string =>
  FORMATO_DATA.format(new Date(`${iso}T12:00:00Z`));

/** Data di oggi (`AAAA-MM-GG`) nel fuso orario del dispositivo. */
export function oggi(): string {
  const d = new Date();
  const due = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}`;
}

/** Preposizione + data: "dal 14 settembre 2026", ma "dall'8 ottobre 2026" (e "dell'11…"). */
export function conData(preposizione: 'dal' | 'del', iso: string): string {
  const data = formattaData(iso);
  return /^(8|11) /.test(data)
    ? `${preposizione.slice(0, 2)}ll'${data}`
    : `${preposizione} ${data}`;
}

/** 41250 → "41.250 km". */
export const formattaKm = (km: number): string => `${km.toLocaleString('it-IT')} km`;

/** 6.2 → "6,2". */
export const formattaDecimale = (n: number): string =>
  n.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Messaggio quando i dati non si caricano, con un pulsante per riprovare. */
export function erroreCaricamento(
  messaggio = 'Non riusciamo a caricare i tuoi dati. Controlla la connessione e riprova.',
): string {
  return `
    <div class="tc-contenuto pt-4">
      <div class="tc-avviso tc-avviso--giallo" role="alert">
        <p class="mb-0">${esc(messaggio)}</p>
      </div>
      <a class="btn btn-outline-light" href="${esc(location.pathname + location.search)}">Riprova</a>
    </div>`;
}

/**
 * Gestisce un errore di caricamento. Con una sessione non più valida esce: main.ts riceve
 * SIGNED_OUT e porta ad `/accedi`. Un `ErroreModulo` mostra il suo messaggio; altrimenti l'avviso
 * generico con "Riprova".
 */
export async function gestisciErroreCaricamento(
  app: HTMLElement,
  n: number,
  errore: unknown,
): Promise<void> {
  if (sessioneNonValida(errore)) {
    await esci();
    return;
  }
  if (!(errore instanceof ErroreModulo)) segnalaErrore(errore, 'caricamento');
  if (!ancoraAttuale(n)) return;
  app.innerHTML = paginaApp(
    erroreCaricamento(errore instanceof ErroreModulo ? errore.message : undefined),
  );
}

/** Intestazione delle sottopagine: etichetta piccola (es. "Profilo", la targa) e titolo. */
export function intestazioneSottopagina(titolo: string, etichetta = 'Profilo'): string {
  return `
    <section class="tc-hero">
      <p class="tc-etichetta">${esc(etichetta)}</p>
      <h1 class="tc-hero__modello tc-hero__modello--saluto" tabindex="-1">${esc(titolo)}</h1>
    </section>`;
}

// Conferma da mostrare sulla prossima pagina dopo un salvataggio (una sola volta)
let conferma: string | undefined;

/**
 * Va alla pagina indicata mostrando lì un avviso di conferma (es. "Veicolo salvato"). Con
 * `sostituisci` non aggiunge un passo alla cronologia (es. la stessa pagina ridisegnata dopo un'azione).
 */
export function vaiConConferma(
  percorso: string,
  messaggio: string,
  opzioni = { sostituisci: false },
): void {
  conferma = messaggio;
  vaiA(percorso, opzioni);
}

/**
 * Imposta la conferma da mostrare sulla prossima pagina senza cambiare pagina (es. prima di
 * `esci()`: il cambio lo fa main.ts su SIGNED_OUT).
 */
export function impostaConferma(messaggio: string): void {
  conferma = messaggio;
}

/** Avviso verde con la conferma in attesa, se c'è (poi viene dimenticata). */
export function avvisoConferma(): string {
  const messaggio = conferma;
  conferma = undefined;
  return messaggio
    ? `<div class="tc-avviso tc-avviso--verde" role="status">
        ${icona(CircleCheck)}<p class="mb-0">${esc(messaggio)}</p>
      </div>`
    : '';
}

/** HTML del contenuto di un riquadro d'errore (testo con escape). */
export function htmlErrore(messaggio: string): string {
  return `<p class="mb-0">${esc(messaggio)}</p>`;
}

/** Mostra il messaggio nel riquadro d'errore e gli dà il focus (senza riquadro: niente). */
export function mostraErroreInBox(box: HTMLElement | null, messaggio: string): void {
  if (!box) return;
  box.innerHTML = htmlErrore(messaggio);
  box.hidden = false;
  box.focus();
}

/** Nasconde il riquadro d'errore (senza riquadro: niente). */
export function nascondiBox(box: HTMLElement | null): void {
  if (box) box.hidden = true;
}

/** Parametro `?nome=` dell'URL attuale. */
export const parametro = (nome: string): string | null =>
  new URLSearchParams(location.search).get(nome);

/**
 * Vero se il testo ha la forma di un id (uuid). Con un id non valido il database risponderebbe con
 * un errore: per le pagine è semplicemente "non trovato".
 */
export const idValido = (id: string | null): id is string =>
  id !== null && /^[0-9a-f-]{36}$/i.test(id);

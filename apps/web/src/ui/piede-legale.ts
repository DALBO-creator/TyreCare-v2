import { SITO_URL } from '@tyrecare/shared';

/**
 * Link alle pagine legali e al sito di presentazione, da mettere in fondo alle pagine pubbliche
 * (accesso, registrazione, «Per le officine», testi legali). La cookie policy deve essere
 * raggiungibile da ogni pagina (Linee guida del Garante sui cookie, 10 giugno 2021).
 */
export function piedeLegale(): string {
  return `
    <span class="tc-piede-legale">
      <a href="/privacy">Privacy</a> ·
      <a href="/termini">Termini di servizio</a> ·
      <a href="/cookie">Cookie</a> ·
      <a href="${SITO_URL}" target="_blank" rel="noopener noreferrer">Il sito di TyreCare</a>
    </span>`;
}

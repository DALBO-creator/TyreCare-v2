// Contatti di TyreCare mostrati nell'app (rinnovo dell'abbonamento, risposte ai commenti).

/**
 * Indirizzo email a cui le officine scrivono per attivare, rinnovare o cambiare l'abbonamento.
 * SEGNAPOSTO DA CONFERMARE: va sostituito con la casella vera del dominio di TyreCare prima del lancio.
 * È l'unico posto in cui compare: tutta l'app lo legge da qui.
 */
export const CONTATTO_EMAIL = 'info@tyrecare.it';

/** Link `mailto:` con destinatario, oggetto e (facoltativo) testo già scritti. */
export function linkEmail(destinatario: string, oggetto: string, corpo = ''): string {
  const parametri = [`subject=${encodeURIComponent(oggetto)}`];
  if (corpo) parametri.push(`body=${encodeURIComponent(corpo)}`);
  return `mailto:${destinatario}?${parametri.join('&')}`;
}

/** Link `mailto:` verso TyreCare ({@link CONTATTO_EMAIL}). */
export const linkContatto = (oggetto: string, corpo = ''): string =>
  linkEmail(CONTATTO_EMAIL, oggetto, corpo);

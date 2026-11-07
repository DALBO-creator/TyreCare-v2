// Email di riserva di una notifica (T066): la usa `index.ts` quando nessuna push è partita.
// Senza import, così la provano anche i test di vitest (project `funzioni`).

export interface NotificaEmail {
  titolo: string;
  testo: string;
  link: string | null;
}

export interface EmailComposta {
  oggetto: string;
  testo: string;
  html: string;
}

/** Sostituisce `& < > " '` con le entità HTML (`&` per primo, per non toccare le altre). */
export const escapeHtml = (valore: string): string =>
  valore
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Link assoluto `sitoUrl + link` con una sola `/` in mezzo; link nullo o vuoto → la home. */
export const linkAssoluto = (sitoUrl: string, link: string | null | undefined): string => {
  const base = sitoUrl.trim().replace(/\/+$/, '');
  const percorso = (link ?? '').trim().replace(/^\/+/, '');
  return `${base}/${percorso}`;
};

const PIEDE =
  "Ricevi questa email perché l'avviso sul telefono non è arrivato. Puoi spegnere le email in TyreCare, pagina Notifiche.";

export const componiEmailNotifica = (
  { titolo, testo, link }: NotificaEmail,
  sitoUrl: string,
): EmailComposta => {
  const url = linkAssoluto(sitoUrl, link);
  const oggetto = `TyreCare · ${titolo}`;
  const testoSemplice = `${titolo}\n\n${testo}\n\nApri TyreCare: ${url}\n\n--\n${PIEDE}\n`;
  const html = `<!doctype html>
<html lang="it">
<head><meta charset="utf-8"><title>${escapeHtml(oggetto)}</title></head>
<body style="margin:0;padding:24px;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;color:#212529">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;padding:24px">
<h1 style="font-size:20px;margin:0 0 12px">${escapeHtml(titolo)}</h1>
<p style="font-size:16px;line-height:1.5;margin:0 0 24px">${escapeHtml(testo)}</p>
<p style="margin:0 0 24px"><a href="${escapeHtml(url)}" style="display:inline-block;background:#0d6efd;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:bold">Apri TyreCare</a></p>
<p style="font-size:12px;color:#6c757d;margin:0">${escapeHtml(PIEDE)}</p>
</div>
</body>
</html>
`;
  return { oggetto, testo: testoSemplice, html };
};

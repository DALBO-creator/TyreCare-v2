import { describe, expect, it } from 'vitest';
import { componiEmailNotifica, escapeHtml, linkAssoluto } from './email.ts';

describe('escapeHtml', () => {
  it('sostituisce tutti e cinque i caratteri, & per primo', () => {
    expect(escapeHtml(`a & b < c > d " e ' f &amp;`)).toBe(
      'a &amp; b &lt; c &gt; d &quot; e &#39; f &amp;amp;',
    );
  });
});

describe('linkAssoluto', () => {
  it.each([
    ['https://tyrecare.it', '/notifiche'],
    ['https://tyrecare.it/', '/notifiche'],
    ['https://tyrecare.it', 'notifiche'],
    ['https://tyrecare.it//', '//notifiche'],
  ])('%s + %s → una sola barra', (sito, link) => {
    expect(linkAssoluto(sito, link)).toBe('https://tyrecare.it/notifiche');
  });

  it('link nullo o vuoto → la home', () => {
    expect(linkAssoluto('https://tyrecare.it/', null)).toBe('https://tyrecare.it/');
    expect(linkAssoluto('https://tyrecare.it', '')).toBe('https://tyrecare.it/');
  });
});

describe('componiEmailNotifica', () => {
  const email = componiEmailNotifica(
    {
      titolo: 'Prenotazione <confermata>',
      testo: `Ci vediamo "domani" & l'auto`,
      link: '/appuntamenti',
    },
    'https://tyrecare.it/',
  );

  it("oggetto con il titolo così com'è", () => {
    expect(email.oggetto).toBe('TyreCare · Prenotazione <confermata>');
  });

  it('testo semplice con il link assoluto', () => {
    expect(email.testo).toContain('https://tyrecare.it/appuntamenti');
    expect(email.testo).not.toContain('//appuntamenti');
  });

  it('testo semplice con il piede: perché arriva e come spegnerla', () => {
    expect(email.testo).toContain(
      "--\nRicevi questa email perché l'avviso sul telefono non è arrivato. Puoi spegnere le email in TyreCare, pagina Notifiche.\n",
    );
  });

  it('HTML con titolo e testo protetti, pulsante e piede', () => {
    expect(email.html).toContain('Prenotazione &lt;confermata&gt;');
    expect(email.html).toContain('Ci vediamo &quot;domani&quot; &amp; l&#39;auto');
    expect(email.html).not.toContain('<confermata>');
    expect(email.html).toContain('href="https://tyrecare.it/appuntamenti"');
    expect(email.html).toContain('Apri TyreCare');
    expect(email.html).toContain(
      'Ricevi questa email perché l&#39;avviso sul telefono non è arrivato. Puoi spegnere le email in TyreCare, pagina Notifiche.',
    );
  });

  it("protegge anche l'href", () => {
    const { html } = componiEmailNotifica(
      { titolo: 't', testo: 'x', link: '/a?b=1&c="2"' },
      'https://tyrecare.it',
    );
    expect(html).toContain('href="https://tyrecare.it/a?b=1&amp;c=&quot;2&quot;"');
  });
});

import { describe, expect, it } from 'vitest';
import { linkInvito, mailtoInvito, testoInvito } from './inviti';

const dati = {
  officina: 'Gomme Rossi S.n.c.',
  nome: 'Franco',
  email: 'franco.gialli@esempio.it',
  link: 'https://tyre-care-v2.vercel.app/invito?codice=abc123',
  scadenza: '24 ottobre 2026',
};

describe('linkInvito', () => {
  it('mette il codice nella pagina /invito', () => {
    expect(linkInvito('abc123', 'https://tyre-care-v2.vercel.app')).toBe(dati.link);
  });
});

describe('testoInvito', () => {
  it("nomina l'officina, il link, l'email da usare e la scadenza", () => {
    const { oggetto, corpo } = testoInvito(dati);
    expect(oggetto).toBe('Gomme Rossi S.n.c. ti invita su TyreCare');
    expect(corpo).toMatch(/^Ciao Franco,/);
    expect(corpo).toContain(`\n${dati.link}\n`);
    expect(corpo).toContain('(franco.gialli@esempio.it)');
    expect(corpo).toContain('fino al 24 ottobre 2026');
  });

  it('senza nome usa un saluto generico', () => {
    expect(testoInvito({ ...dati, nome: '' }).corpo).toMatch(/^Buongiorno,/);
  });
});

describe('mailtoInvito', () => {
  it('codifica oggetto e testo con %20 e non con +', () => {
    const url = mailtoInvito(dati);
    expect(url).toMatch(/^mailto:franco\.gialli@esempio\.it\?subject=Gomme%20Rossi/);
    expect(url).not.toContain('+');
    expect(new URL(url).searchParams.get('body')).toContain(dati.link);
  });
});

// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { lavoraInOfficina } = vi.hoisted(() => ({ lavoraInOfficina: vi.fn() }));
vi.mock('../lib/profilo', () => ({ lavoraInOfficina }));
vi.mock('../lib/notifiche', () => ({
  avviaNotifiche: vi.fn(),
  notificheNonLette: () => 0,
  numeroBadge: (n: number) => String(n),
  testoNonLette: () => '',
}));

import { paginaApp } from './layout';

/** Disegna la pagina come se l'utente fosse su `percorso`. */
function disegna(percorso: string, inOfficina: boolean): void {
  lavoraInOfficina.mockReturnValue(inOfficina);
  history.replaceState(null, '', percorso);
  document.body.innerHTML = paginaApp('<p>Contenuto</p>');
}

const voci = () => [...document.querySelectorAll<HTMLAnchorElement>('.tc-bottomnav__voce')];
// l'etichetta è il testo della voce, senza il numero del badge delle notifiche
const etichetta = (a: Element) =>
  a.querySelector(':scope > span:last-child')?.firstChild?.textContent;
const testi = () => voci().map(etichetta);
const href = () => voci().map((a) => a.getAttribute('href'));
const attive = () => voci().filter((a) => a.getAttribute('aria-current') === 'page');
const attivaDi = (percorso: string, inOfficina = false): string | null | undefined => {
  disegna(percorso, inOfficina);
  expect(attive()).toHaveLength(1);
  return etichetta(attive()[0]!);
};

beforeEach(() => {
  lavoraInOfficina.mockReset();
});

describe('barra di navigazione', () => {
  it('per un cliente mostra le voci con «Officine» e i percorsi esatti', () => {
    disegna('/', false);
    expect(testi()).toEqual(['Home', 'Officine', 'Appuntamenti', 'Notifiche', 'Profilo']);
    expect(href()).toEqual(['/', '/officine', '/appuntamenti', '/notifiche', '/profilo']);
  });

  it('per chi lavora in officina mostra «Clienti» e niente «Officine»', () => {
    disegna('/', true);
    expect(testi()).toEqual(['Home', 'Clienti', 'Appuntamenti', 'Notifiche', 'Profilo']);
    expect(href()).toEqual(['/', '/clienti', '/appuntamenti', '/notifiche', '/profilo']);
    expect(testi()).not.toContain('Officine');
  });

  it('un cliente non vede «Clienti»', () => {
    disegna('/', false);
    expect(testi()).not.toContain('Clienti');
  });

  it('evidenzia la voce del percorso corrente (una sola)', () => {
    expect(attivaDi('/')).toBe('Home');
    expect(attivaDi('/officine')).toBe('Officine');
    expect(attivaDi('/appuntamenti')).toBe('Appuntamenti');
    expect(attivaDi('/notifiche')).toBe('Notifiche');
    expect(attivaDi('/profilo')).toBe('Profilo');
    expect(attivaDi('/clienti', true)).toBe('Clienti');
  });

  it('evidenzia la voce anche per i percorsi «anche»', () => {
    expect(attivaDi('/prenota')).toBe('Officine');
    expect(attivaDi('/officina')).toBe('Officine');
    expect(attivaDi('/garage')).toBe('Home');
    expect(attivaDi('/servizi')).toBe('Appuntamenti');
    expect(attivaDi('/cliente', true)).toBe('Clienti');
    expect(attivaDi('/officina/orari', true)).toBe('Profilo');
  });

  it('evidenzia la voce anche nelle sottopagine', () => {
    expect(attivaDi('/profilo/password')).toBe('Profilo');
    expect(attivaDi('/officine/qualcosa')).toBe('Officine');
  });

  it('non confonde percorsi che iniziano con lo stesso testo', () => {
    disegna('/profiloaltro', false);
    expect(attive()).toHaveLength(0);
  });

  it('ha il link «Salta al contenuto» verso il contenuto principale', () => {
    disegna('/', false);
    const salta = document.querySelector<HTMLAnchorElement>('.tc-salta')!;
    expect(salta.textContent).toBe('Salta al contenuto');
    expect(salta.getAttribute('href')).toBe('#tc-principale');
    const principale = document.getElementById('tc-principale')!;
    expect(principale.tagName).toBe('MAIN');
    expect(principale.textContent).toContain('Contenuto');
  });
});

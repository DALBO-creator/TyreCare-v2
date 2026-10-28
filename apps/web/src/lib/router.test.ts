import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { avviaRouter, riquadroPaginaNonDisponibile, vaiA, type Rotta } from './router';

describe('riquadroPaginaNonDisponibile', () => {
  it('contiene il testo e il link Riprova', () => {
    const html = riquadroPaginaNonDisponibile('/clienti');
    expect(html).toContain('Pagina non disponibile');
    expect(html).toContain('controlla la connessione e riprova');
    expect(html).toContain('href="/clienti">Riprova</a>');
  });

  it("esegue l'escape dell'URL", () => {
    const html = riquadroPaginaNonDisponibile('/x?a="<b>&c');
    expect(html).toContain('href="/x?a=&quot;&lt;b&gt;&amp;c"');
    expect(html).not.toContain('<b>');
  });
});

describe('mostraPagina con rotta che fallisce', () => {
  const app = { innerHTML: 'vecchia', querySelector: () => null } as unknown as HTMLElement;
  let percorso = '/rotta';

  beforeEach(() => {
    percorso = '/rotta';
    app.innerHTML = 'vecchia';
    vi.stubGlobal('location', {
      get pathname() {
        return percorso.split('?')[0];
      },
      get search() {
        return percorso.includes('?') ? '?' + percorso.split('?')[1] : '';
      },
      origin: 'http://x',
    });
    vi.stubGlobal('history', {
      pushState: (_a: unknown, _b: string, u: string) => (percorso = u),
      replaceState: (_a: unknown, _b: string, u: string) => (percorso = u),
    });
    vi.stubGlobal('document', { title: '', addEventListener: vi.fn() });
    vi.stubGlobal('window', { scrollTo: vi.fn(), addEventListener: vi.fn() });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const rotta = (p: string, mostra: Rotta['mostra']): Rotta => ({
    percorso: p,
    accesso: 'pubblica',
    titolo: p,
    mostra,
  });

  it('mostra il riquadro se la rotta lancia', async () => {
    const altra = rotta('/altra', (a) => void (a.innerHTML = 'altra'));
    const rotte = [rotta('/rotta', () => Promise.reject(new Error('rete'))), altra];
    await avviaRouter(app, { rotte, nonTrovata: altra, autenticato: () => false });
    expect(app.innerHTML).toContain('Pagina non disponibile');
    expect(app.innerHTML).toContain('href="/rotta"');
    expect(console.error).toHaveBeenCalled();
  });

  it("non mostra il riquadro se un'altra navigazione è già partita", async () => {
    let rifiuta: (e: Error) => void = () => undefined;
    const altra = rotta('/altra', (a) => void (a.innerHTML = 'altra'));
    const rotte = [rotta('/rotta', () => new Promise<void>((_, rj) => (rifiuta = rj))), altra];
    const avvio = avviaRouter(app, { rotte, nonTrovata: altra, autenticato: () => false });
    vaiA('/altra');
    rifiuta(new Error('tardi'));
    await avvio;
    await Promise.resolve();
    expect(app.innerHTML).toBe('altra');
  });
});

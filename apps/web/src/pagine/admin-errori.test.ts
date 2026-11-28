// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formattaDataOra } from '../lib/admin';
import type * as M_admin_errori from '../lib/admin-errori';
import type { RigaErrore } from '../lib/admin-errori';
import type * as M_profilo from '../lib/profilo';
import type * as M_router from '../lib/router';
import type * as M_comune from './comune';

const { caricaDatiUtente, caricaErroriApp, gestisciErroreCaricamento } = vi.hoisted(() => ({
  caricaDatiUtente: vi.fn(),
  caricaErroriApp: vi.fn(),
  gestisciErroreCaricamento: vi.fn(),
}));

vi.mock('../lib/admin-errori', async (importOriginal) => ({
  ...(await importOriginal<typeof M_admin_errori>()),
  caricaErroriApp,
}));
vi.mock('../lib/profilo', async (importOriginal) => ({
  ...(await importOriginal<typeof M_profilo>()),
  caricaDatiUtente,
}));
vi.mock('../lib/router', async (importOriginal) => ({
  ...(await importOriginal<typeof M_router>()),
  visualizzazioneCorrente: () => 1,
  ancoraAttuale: () => true,
  mostraPagina: vi.fn(),
}));
vi.mock('./comune', async (importOriginal) => ({
  ...(await importOriginal<typeof M_comune>()),
  gestisciErroreCaricamento,
}));
vi.mock('../lib/supabase', () => ({ getSupabase: () => ({}), chiaveSessione: () => 'chiave' }));

import { mostraAdminErrori } from './admin-errori';

const UTENTE_A = 'aaaaaaaa-1111-4111-8111-111111111111';
const UTENTE_B = 'bbbbbbbb-2222-4222-8222-222222222222';

function riga(extra: Partial<RigaErrore> = {}): RigaErrore {
  return {
    id: 'e1',
    autore_id: UTENTE_A,
    percorso: '/clienti',
    messaggio: 'Boom',
    dettaglio: '',
    versione: '1.2.3',
    agente: 'Firefox',
    created_at: '2026-11-20T10:30:00Z',
    ...extra,
  };
}

let app: HTMLElement;

beforeEach(() => {
  vi.clearAllMocks();
  caricaDatiUtente.mockResolvedValue({ profilo: { ruolo: 'ADMIN' } });
  app = document.createElement('div');
  document.body.replaceChildren(app);
});

const sommario = (): string =>
  app.querySelector('summary')!.textContent!.replace(/\s+/g, ' ').trim();

describe('pagina admin: Errori dell’app', () => {
  it('senza errori mostra il testo vuoto', async () => {
    caricaErroriApp.mockResolvedValue([]);
    await mostraAdminErrori(app);
    expect(app.querySelector('.tc-vuoto__titolo')?.textContent).toBe(
      'Nessun errore negli ultimi 30 giorni',
    );
    expect(app.querySelector('details')).toBeNull();
  });

  it('un gruppo: messaggio, «1 volta · ultima …» e «1 utente»', async () => {
    const r = riga();
    caricaErroriApp.mockResolvedValue([r]);
    await mostraAdminErrori(app);
    expect(app.querySelectorAll('details')).toHaveLength(1);
    expect(app.querySelector('summary strong')?.textContent).toBe('Boom');
    expect(sommario()).toContain(`1 volta · ultima ${formattaDataOra(r.created_at)} · 1 utente`);
  });

  it('più occorrenze: «3 volte», «2 utenti», ultima = la più recente', async () => {
    caricaErroriApp.mockResolvedValue([
      riga({ id: 'a', created_at: '2026-11-10T08:00:00Z' }),
      riga({ id: 'b', created_at: '2026-11-25T08:00:00Z', autore_id: UTENTE_B }),
      riga({ id: 'c', created_at: '2026-11-12T08:00:00Z' }),
    ]);
    await mostraAdminErrori(app);
    expect(sommario()).toContain(
      `3 volte · ultima ${formattaDataOra('2026-11-25T08:00:00Z')} · 2 utenti`,
    );
  });

  it('elenca percorsi e versioni del gruppo', async () => {
    caricaErroriApp.mockResolvedValue([
      riga({ id: 'a', percorso: '/clienti', versione: '1.0' }),
      riga({ id: 'b', percorso: '/agenda', versione: '1.1' }),
    ]);
    await mostraAdminErrori(app);
    expect(sommario()).toContain('Percorsi: /clienti, /agenda');
    expect(sommario()).toContain('Versioni: 1.0, 1.1');
  });

  it('gruppi diversi per messaggio, dal più recente', async () => {
    caricaErroriApp.mockResolvedValue([
      riga({ id: 'a', messaggio: 'Vecchio', created_at: '2026-11-01T08:00:00Z' }),
      riga({ id: 'b', messaggio: 'Nuovo', created_at: '2026-11-27T08:00:00Z' }),
    ]);
    await mostraAdminErrori(app);
    const messaggi = [...app.querySelectorAll('summary strong')].map((e) => e.textContent);
    expect(messaggi).toEqual(['Nuovo', 'Vecchio']);
  });

  it('percorso vuoto: «Percorso non indicato»; versione vuota: «versione n.d.»', async () => {
    caricaErroriApp.mockResolvedValue([riga({ percorso: '', versione: '' })]);
    await mostraAdminErrori(app);
    const occ = app.querySelector('details .tc-lista__riga')!.textContent!.replace(/\s+/g, ' ');
    expect(occ).toContain('Percorso non indicato');
    expect(occ).toContain('versione n.d.');
  });

  it('l’utente è abbreviato a 8 caratteri e l’id intero non compare', async () => {
    caricaErroriApp.mockResolvedValue([riga()]);
    await mostraAdminErrori(app);
    const occ = app.querySelector('details .tc-lista__riga')!.textContent!.replace(/\s+/g, ' ');
    expect(occ).toContain('utente aaaaaaaa ');
    expect(app.textContent).not.toContain(UTENTE_A);
  });

  it('il dettaglio compare in un <pre> solo se presente', async () => {
    caricaErroriApp.mockResolvedValue([riga({ dettaglio: 'stack: a -> b' })]);
    await mostraAdminErrori(app);
    expect(app.querySelector('pre')?.textContent).toBe('stack: a -> b');

    caricaErroriApp.mockResolvedValue([riga({ dettaglio: '' })]);
    await mostraAdminErrori(app);
    expect(app.querySelector('pre')).toBeNull();
  });

  it('ruolo diverso da ADMIN: pagina riservata e nessun caricamento', async () => {
    caricaDatiUtente.mockResolvedValue({ profilo: { ruolo: 'CLIENTE' } });
    await mostraAdminErrori(app);
    expect(app.querySelector('.tc-contenuto p')?.textContent).toBe(
      "Pagina riservata all'amministratore.",
    );
    expect(caricaErroriApp).not.toHaveBeenCalled();
  });

  it('errore di caricamento: lo passa a gestisciErroreCaricamento', async () => {
    const errore = new Error('rete');
    caricaErroriApp.mockRejectedValue(errore);
    await mostraAdminErrori(app);
    expect(gestisciErroreCaricamento).toHaveBeenCalledWith(app, 1, errore);
    expect(app.querySelector('details')).toBeNull();
  });
});

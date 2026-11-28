// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as M_admin from '../lib/admin';
import type { CommentoAdmin } from '../lib/admin';
import { formattaDataOra } from '../lib/admin';
import type * as M_router from '../lib/router';
import type * as M_comune from './comune';

const { caricaCommentiAdmin, gestisciErroreCaricamento } = vi.hoisted(() => ({
  caricaCommentiAdmin: vi.fn(),
  gestisciErroreCaricamento: vi.fn(),
}));

vi.mock('../lib/admin', async (importOriginal) => ({
  ...(await importOriginal<typeof M_admin>()),
  caricaCommentiAdmin,
}));
vi.mock('../lib/router', async (importOriginal) => ({
  ...(await importOriginal<typeof M_router>()),
  visualizzazioneCorrente: () => 1,
  ancoraAttuale: () => true,
  mostraPagina: vi.fn(),
}));
vi.mock('../lib/supabase', () => ({ getSupabase: () => ({}), chiaveSessione: () => 'chiave' }));
vi.mock('./admin-comune', () => ({ accessoAdmin: vi.fn().mockResolvedValue(true) }));
vi.mock('./comune', async (importOriginal) => ({
  ...(await importOriginal<typeof M_comune>()),
  gestisciErroreCaricamento,
}));

import { mostraAdminCommenti } from './admin-commenti';
import { accessoAdmin } from './admin-comune';

const commento = (over: Partial<CommentoAdmin> = {}): CommentoAdmin => ({
  id: '11111111-1111-4111-8111-111111111111',
  testo: 'Bella app',
  percorso: '/garage',
  created_at: '2026-11-20T10:00:00Z',
  autore: 'Mario Rossi',
  ...over,
});

const app = () => document.getElementById('app')!;
const righe = () => [...app().querySelectorAll<HTMLElement>('.tc-lista__riga')];
const testo = (el: Element) => el.textContent!.replace(/\s+/g, ' ').trim();
const apri = async () => {
  await mostraAdminCommenti(app());
};

beforeEach(() => {
  document.body.innerHTML = '<div id="app"></div>';
  caricaCommentiAdmin.mockReset().mockResolvedValue([]);
  gestisciErroreCaricamento.mockReset().mockResolvedValue(undefined);
  vi.mocked(accessoAdmin).mockReset().mockResolvedValue(true);
});

describe('Commenti (admin)', () => {
  it('nessun commento: mostra il testo vuoto', async () => {
    await apri();
    expect(app().querySelector('.tc-vuoto__titolo')!.textContent).toBe('Nessun commento per ora.');
    expect(righe()).toHaveLength(0);
  });

  it('righe nell’ordine ricevuto (il più recente per primo) con data e autore', async () => {
    const nuovo = commento({ id: 'a', testo: 'Più recente', created_at: '2026-11-25T09:00:00Z' });
    const vecchio = commento({
      id: 'b',
      testo: 'Più vecchio',
      created_at: '2026-11-01T08:00:00Z',
      autore: 'Anna Bianchi',
    });
    caricaCommentiAdmin.mockResolvedValue([nuovo, vecchio]);
    await apri();
    const r = righe();
    expect(r).toHaveLength(2);
    expect(testo(r[0]!)).toContain('Più recente');
    expect(testo(r[0]!)).toContain(`${formattaDataOra(nuovo.created_at)} · Mario Rossi`);
    expect(testo(r[1]!)).toContain('Più vecchio');
    expect(testo(r[1]!)).toContain(`${formattaDataOra(vecchio.created_at)} · Anna Bianchi`);
  });

  it('autore vuoto: «Autore non disponibile»', async () => {
    caricaCommentiAdmin.mockResolvedValue([commento({ autore: '' })]);
    await apri();
    expect(testo(righe()[0]!)).toContain('· Autore non disponibile');
  });

  it('percorso presente: «Da: <percorso>»; assente: nessun «Da:»', async () => {
    caricaCommentiAdmin.mockResolvedValue([
      commento({ percorso: '/garage' }),
      commento({ percorso: '' }),
    ]);
    await apri();
    const r = righe();
    expect(testo(r[0]!)).toContain('Da: /garage');
    expect(testo(r[1]!)).not.toContain('Da:');
  });

  it('il testo con HTML è mostrato come testo', async () => {
    caricaCommentiAdmin.mockResolvedValue([commento({ testo: 'ciao <b>grassetto</b>' })]);
    await apri();
    expect(righe()[0]!.querySelector('b')).toBeNull();
    expect(testo(righe()[0]!)).toContain('ciao <b>grassetto</b>');
  });

  it('non admin: i commenti non vengono caricati', async () => {
    vi.mocked(accessoAdmin).mockResolvedValue(false);
    await apri();
    expect(caricaCommentiAdmin).not.toHaveBeenCalled();
    expect(righe()).toHaveLength(0);
  });

  it('errore di caricamento: lo gestisce gestisciErroreCaricamento', async () => {
    const errore = new Error('rete');
    caricaCommentiAdmin.mockRejectedValue(errore);
    await apri();
    expect(gestisciErroreCaricamento).toHaveBeenCalledWith(app(), 1, errore);
  });
});

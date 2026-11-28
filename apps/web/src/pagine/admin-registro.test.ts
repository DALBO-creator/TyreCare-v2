// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formattaDataOra } from '../lib/admin';
import type * as M_admin_pannello from '../lib/admin-pannello';
import type { VoceRegistro } from '../lib/admin-pannello';
import { descriviVoce, dettagliVoce } from '../lib/admin-pannello';
import type * as M_router from '../lib/router';
import type * as M_comune from './comune';

const { accessoAdmin, caricaRegistro, gestisciErroreCaricamento } = vi.hoisted(() => ({
  accessoAdmin: vi.fn(),
  caricaRegistro: vi.fn(),
  gestisciErroreCaricamento: vi.fn(),
}));

vi.mock('../lib/admin-pannello', async (importOriginal) => ({
  ...(await importOriginal<typeof M_admin_pannello>()),
  caricaRegistro,
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
vi.mock('./admin-comune', () => ({ accessoAdmin }));

import { mostraAdminRegistro } from './admin-registro';

function voce(extra: Partial<VoceRegistro> = {}): VoceRegistro {
  return {
    id: 1,
    created_at: '2026-11-20T10:30:00Z',
    azione: 'insert',
    tabella: 'officine',
    oggetto_id: '',
    dettagli: null,
    admin: 'Mario Rossi',
    ...extra,
  };
}

let app: HTMLElement;

beforeEach(() => {
  vi.clearAllMocks();
  accessoAdmin.mockResolvedValue(true);
  app = document.createElement('div');
  document.body.replaceChildren(app);
});

describe('pagina admin: Registro delle azioni', () => {
  it('senza voci mostra il testo vuoto', async () => {
    caricaRegistro.mockResolvedValue([]);
    await mostraAdminRegistro(app);
    expect(app.querySelector('.tc-vuoto__titolo')?.textContent).toBe('Nessuna azione registrata');
    expect(app.querySelector('.tc-lista__riga')).toBeNull();
  });

  it('con una voce mostra azione, data e amministratore', async () => {
    const v = voce();
    caricaRegistro.mockResolvedValue([v]);
    await mostraAdminRegistro(app);
    const riga = app.querySelector('.tc-lista__riga')!;
    expect(riga.querySelector('strong')?.textContent).toBe(descriviVoce(v));
    expect(riga.querySelector('small')?.textContent).toBe(formattaDataOra(v.created_at));
    expect(riga.textContent).toContain('Mario Rossi');
    expect(app.textContent).not.toContain('Nessuna azione registrata');
  });

  it('una riga per voce, nell’ordine ricevuto', async () => {
    const a = voce({ id: 2, azione: 'delete' });
    const b = voce({ id: 1, azione: 'update' });
    caricaRegistro.mockResolvedValue([a, b]);
    await mostraAdminRegistro(app);
    const titoli = [...app.querySelectorAll('.tc-lista__riga strong')].map((e) => e.textContent);
    expect(titoli).toEqual([descriviVoce(a), descriviVoce(b)]);
  });

  it('admin vuoto: «Amministratore»', async () => {
    caricaRegistro.mockResolvedValue([voce({ admin: '' })]);
    await mostraAdminRegistro(app);
    expect(app.querySelectorAll('small')[1]?.textContent?.trim()).toBe('Amministratore');
  });

  it('oggetto_id presente: « · ID <id>»; assente: nessun «ID»', async () => {
    caricaRegistro.mockResolvedValue([voce({ oggetto_id: 'abc-123' })]);
    await mostraAdminRegistro(app);
    expect(app.querySelectorAll('small')[1]?.textContent?.trim()).toBe('Mario Rossi · ID abc-123');

    caricaRegistro.mockResolvedValue([voce({ oggetto_id: '' })]);
    await mostraAdminRegistro(app);
    expect(app.querySelectorAll('small')[1]?.textContent?.trim()).toBe('Mario Rossi');
    expect(app.textContent).not.toContain('ID');
  });

  it('una voce con dettagli li mostra come <li> in un elenco', async () => {
    const v = voce({ azione: 'update', dettagli: { stato: ['ATTESA', 'ATTIVA'], note: 'x' } });
    caricaRegistro.mockResolvedValue([v]);
    await mostraAdminRegistro(app);
    const voci = [...app.querySelectorAll('ul > li')].map((e) => e.textContent);
    expect(voci).toEqual(dettagliVoce(v));
    expect(voci).toEqual(['stato: ATTESA → ATTIVA', 'note: x']);
  });

  it('senza dettagli non disegna l’elenco', async () => {
    caricaRegistro.mockResolvedValue([voce({ dettagli: null })]);
    await mostraAdminRegistro(app);
    expect(app.querySelector('ul')).toBeNull();
  });

  it('accesso negato: il registro non viene caricato', async () => {
    accessoAdmin.mockResolvedValue(false);
    await mostraAdminRegistro(app);
    expect(caricaRegistro).not.toHaveBeenCalled();
    expect(gestisciErroreCaricamento).not.toHaveBeenCalled();
  });

  it('errore di caricamento: lo passa a gestisciErroreCaricamento', async () => {
    const errore = new Error('rete');
    caricaRegistro.mockRejectedValue(errore);
    await mostraAdminRegistro(app);
    expect(gestisciErroreCaricamento).toHaveBeenCalledWith(app, 1, errore);
    expect(app.querySelector('.tc-lista')).toBeNull();
  });
});

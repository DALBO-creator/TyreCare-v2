// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as M_admin_pannello from '../lib/admin-pannello';
import type * as M_router from '../lib/router';
import { VOCI_RIEPILOGO } from '../lib/admin-pannello';

const { caricaRiepilogo, accessoAdmin } = vi.hoisted(() => ({
  caricaRiepilogo: vi.fn(),
  accessoAdmin: vi.fn(),
}));

// Si finge solo la lettura del riepilogo: il resto del modulo resta vero
vi.mock('../lib/admin-pannello', async (importOriginal) => ({
  ...(await importOriginal<typeof M_admin_pannello>()),
  caricaRiepilogo,
}));
vi.mock('./admin-comune', () => ({ accessoAdmin }));
vi.mock('../lib/router', async (importOriginal) => ({
  ...(await importOriginal<typeof M_router>()),
  visualizzazioneCorrente: () => 1,
  ancoraAttuale: () => true,
}));
vi.mock('../lib/supabase', () => ({ getSupabase: () => ({}), chiaveSessione: () => 'chiave' }));

import { avvisiAdmin, mostraAdmin } from './admin';

const zeri = () =>
  Object.fromEntries(VOCI_RIEPILOGO.map((k) => [k, 0])) as Record<
    (typeof VOCI_RIEPILOGO)[number],
    number
  >;

const sezione = (app: HTMLElement, id: string) =>
  app.querySelector<HTMLElement>(`section[aria-labelledby="${id}"]`)!;

const voce = (sez: HTMLElement, etichetta: string): string | undefined =>
  [...sez.querySelectorAll('.tc-riepilogo__voce')]
    .find((v) => v.querySelector('.tc-riepilogo__etichetta')?.textContent === etichetta)
    ?.querySelector('.tc-riepilogo__numero')?.textContent ?? undefined;

async function disegna(extra: object = {}): Promise<HTMLElement> {
  caricaRiepilogo.mockResolvedValue({ ...zeri(), ...extra });
  const app = document.createElement('div');
  document.body.append(app);
  await mostraAdmin(app);
  return app;
}

beforeEach(() => {
  accessoAdmin.mockResolvedValue(true);
});
afterEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = '';
});

describe('avvisiAdmin', () => {
  it('senza avvisi: niente da sistemare', async () => {
    const app = await disegna();
    expect(app.querySelector('[role="status"]')?.textContent).toContain(
      'Niente da sistemare per ora.',
    );
    expect(app.querySelector('section[aria-labelledby="tc-admin-avvisi"]')).toBeNull();
    expect(avvisiAdmin(zeri())).toEqual([]);
  });

  it('una officina in attesa: singolare', async () => {
    const app = await disegna({ officine_in_attesa: 1 });
    const avviso = app.querySelector('section[aria-labelledby="tc-admin-avvisi"] a')!;
    expect(avviso.textContent).toContain('1 officina aspetta l’attivazione');
    expect(avviso.getAttribute('href')).toBe('/admin/officine');
  });

  it('due officine in attesa: plurale', async () => {
    const app = await disegna({ officine_in_attesa: 2 });
    expect(
      app.querySelector('section[aria-labelledby="tc-admin-avvisi"] a')?.textContent,
    ).toContain('2 officine aspettano l’attivazione');
  });
});

describe('mostraAdmin', () => {
  it('sezione Abbonamenti con numeri, ricavo in euro e nota', async () => {
    const app = await disegna({
      abbonamenti_attivi: 3,
      prove_in_corso: 2,
      abbonamenti_scaduti: 1,
      ricavo_mensile: 175.5,
    });
    const sez = sezione(app, 'tc-admin-abbonamenti');
    expect(sez.querySelector('h2')?.textContent).toBe('Abbonamenti');
    expect(voce(sez, 'Attivi')).toBe('3');
    expect(voce(sez, 'In prova')).toBe('2');
    expect(voce(sez, 'Abbonamenti scaduti')).toBe('1');
    expect(voce(sez, 'Ricavo al mese')).toBe('175,50 €');
    expect(sez.textContent).toContain('IVA esclusa, solo abbonamenti attivi');
  });

  it('ricavo intero senza decimali', async () => {
    const app = await disegna({ ricavo_mensile: 200 });
    expect(voce(sezione(app, 'tc-admin-abbonamenti'), 'Ricavo al mese')).toBe('200 €');
  });

  it('Officine ha i suoi numeri e non gli abbonamenti scaduti', async () => {
    const app = await disegna({
      officine_attive: 5,
      officine_in_attesa: 4,
      officine_sospese: 6,
      abbonamenti_scaduti: 7,
    });
    const sez = sezione(app, 'tc-admin-officine');
    expect(voce(sez, 'Attive')).toBe('5');
    expect(voce(sez, 'In attesa')).toBe('4');
    expect(voce(sez, 'Sospese')).toBe('6');
    expect(voce(sez, 'Abbonamenti scaduti')).toBeUndefined();
    expect(sez.textContent).not.toContain('Abbonamenti scaduti');
  });

  it('Account e Uso mostrano i loro numeri', async () => {
    const app = await disegna({ utenti: 12345, utenti_bloccati: 2, clienti: 9, controlli: 8 });
    expect(voce(sezione(app, 'tc-admin-account'), 'Account')).toBe('12.345');
    expect(voce(sezione(app, 'tc-admin-account'), 'Bloccati')).toBe('2');
    expect(voce(sezione(app, 'tc-admin-uso'), 'Clienti delle officine')).toBe('9');
    expect(voce(sezione(app, 'tc-admin-uso'), 'Controlli')).toBe('8');
  });

  it('senza accesso admin non carica il riepilogo', async () => {
    accessoAdmin.mockResolvedValue(false);
    const app = document.createElement('div');
    await mostraAdmin(app);
    expect(caricaRiepilogo).not.toHaveBeenCalled();
  });
});

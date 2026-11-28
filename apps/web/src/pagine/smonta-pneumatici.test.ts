// @vitest-environment happy-dom
import { oggiISO } from '@tyrecare/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as M_comune from './comune';

// Le icone creano SVG con `document`: qui bastano segnaposto
vi.mock('../ui/icone', () => ({ icona: () => '<svg></svg>' }));

const { caricaSchedaDaUrl, smontaPneumatici, vaiConConferma } = vi.hoisted(() => ({
  caricaSchedaDaUrl: vi.fn(),
  smontaPneumatici: vi.fn(),
  vaiConConferma: vi.fn(),
}));
vi.mock('./veicolo', () => ({ caricaSchedaDaUrl }));
vi.mock('../lib/officina', () => ({ smontaPneumatici }));
vi.mock('../lib/router', () => ({ visualizzazioneCorrente: () => 1, vaiA: vi.fn() }));
vi.mock('./comune', async (importOriginal) => ({
  ...(await importOriginal<typeof M_comune>()),
  vaiConConferma,
}));

import type { Pneumatico } from '../lib/officina';
import { mostraSmontaPneumatici } from './smonta-pneumatici';

const ruota = (posizione: Pneumatico['posizione']): Pneumatico => ({
  id: `p-${posizione}`,
  veicolo_id: 'v1',
  officina_id: 'o1',
  posizione,
  stagione: 'ESTIVO',
  marca: 'Michelin',
  modello: 'Primacy',
  misura: '205/55 R16',
  dot: null,
  montato_il: '2026-01-01',
  smontato_il: null,
  origine: 'APP',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
});

const scheda = (pneumatici: Pneumatico[]) => ({
  veicolo: { id: 'v1', targa: 'AB123CD' },
  pneumatici,
});

const caselle = () => [...document.querySelectorAll<HTMLInputElement>('[name="posizioni"]')];
const spunta = (valore: string) => {
  const el = caselle().find((c) => c.value === valore)!;
  el.checked = true;
  el.dispatchEvent(new Event('change', { bubbles: true }));
};
const invia = async () => {
  document
    .querySelector('form')!
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await new Promise((r) => setTimeout(r, 0));
};

const monta = async () => {
  const app = document.createElement('div');
  document.body.append(app);
  await mostraSmontaPneumatici(app);
  return app;
};

beforeEach(() => {
  smontaPneumatici.mockResolvedValue(undefined);
});
afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('Smonta pneumatici', () => {
  it('una casella per pneumatico montato, in ordine di posizione e non spuntate', async () => {
    caricaSchedaDaUrl.mockResolvedValue(
      scheda([ruota('SCORTA'), ruota('POST_SX'), ruota('ANT_SX')]),
    );
    await monta();
    expect(caselle().map((c) => c.value)).toEqual(['ANT_SX', 'POST_SX', 'SCORTA']);
    expect(caselle().map((c) => c.checked)).toEqual([false, false, false]);
    expect(
      [...document.querySelectorAll('.tc-caselle__voce span')].map((s) => s.textContent),
    ).toEqual(['Anteriore sinistro', 'Posteriore sinistro', 'Ruota di scorta']);
    expect(document.querySelector<HTMLInputElement>('[name="smontato_il"]')!.value).toBe(oggiISO());
  });

  it('con un solo pneumatico montato la casella è già spuntata', async () => {
    caricaSchedaDaUrl.mockResolvedValue(scheda([ruota('SCORTA')]));
    await monta();
    expect(caselle().map((c) => [c.value, c.checked])).toEqual([['SCORTA', true]]);
  });

  it('nessuno pneumatico montato: avviso e nessun modulo', async () => {
    caricaSchedaDaUrl.mockResolvedValue(scheda([]));
    await monta();
    expect(document.querySelector('form')).toBeNull();
    expect(document.querySelector('p.text-body-secondary')?.textContent).toBe(
      'Nessuno pneumatico montato su questo veicolo.',
    );
  });

  it('invio senza scelte: errore dello schema e nessuna chiamata', async () => {
    caricaSchedaDaUrl.mockResolvedValue(scheda([ruota('ANT_SX'), ruota('POST_SX')]));
    await monta();
    await invia();
    expect(document.querySelector('#campo-posizioni-errore')?.textContent).toBe(
      'Scegli almeno una posizione',
    );
    expect(caselle().map((c) => c.getAttribute('aria-invalid'))).toEqual(['true', 'true']);
    expect(smontaPneumatici).not.toHaveBeenCalled();
    expect(vaiConConferma).not.toHaveBeenCalled();
  });

  it('due ruote: smontaPneumatici con i loro id e conferma al plurale', async () => {
    caricaSchedaDaUrl.mockResolvedValue(
      scheda([ruota('ANT_SX'), ruota('POST_SX'), ruota('SCORTA')]),
    );
    await monta();
    spunta('POST_SX');
    spunta('ANT_SX');
    await invia();
    expect(smontaPneumatici).toHaveBeenCalledExactlyOnceWith(['p-ANT_SX', 'p-POST_SX'], oggiISO());
    expect(vaiConConferma).toHaveBeenCalledExactlyOnceWith(
      '/veicolo?id=v1',
      'Pneumatici smontati.',
    );
  });

  it('una ruota: conferma al singolare', async () => {
    caricaSchedaDaUrl.mockResolvedValue(scheda([ruota('ANT_SX'), ruota('POST_SX')]));
    await monta();
    spunta('POST_SX');
    await invia();
    expect(smontaPneumatici).toHaveBeenCalledExactlyOnceWith(['p-POST_SX'], oggiISO());
    expect(vaiConConferma).toHaveBeenCalledExactlyOnceWith(
      '/veicolo?id=v1',
      'Pneumatico smontato.',
    );
  });

  it('scheda non trovata: niente disegnato dalla pagina', async () => {
    caricaSchedaDaUrl.mockResolvedValue(null);
    const app = await monta();
    expect(app.innerHTML).toBe('');
  });
});

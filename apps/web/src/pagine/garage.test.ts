// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VeicoloGarage } from '../lib/garage';

const { caricaGarage } = vi.hoisted(() => ({ caricaGarage: vi.fn() }));
vi.mock('../lib/garage', () => ({ caricaGarage }));
vi.mock('../lib/profilo', () => ({
  caricaDatiUtente: vi.fn(),
  accettaTerminiAttuali: vi.fn(),
  lavoraInOfficina: () => false,
}));
vi.mock('../lib/auth', () => ({
  esci: vi.fn(),
  sessioneCorrente: vi.fn(),
  messaggioErrore: (e: unknown) => (e instanceof Error ? e.message : 'Errore'),
}));
vi.mock('../lib/supabase', () => ({ getSupabase: () => ({}), chiaveSessione: () => 'chiave' }));
vi.mock('./home-officina', () => ({ mostraHomeOfficina: vi.fn() }));

import { mostraGarage } from './garage';

const veicolo = (targa: string) =>
  ({
    targa,
    marca: 'Fiat',
    modello: 'Panda',
    anno: 2020,
    officine: [],
    pneumatici: [],
    controlli: [],
    stato: null,
  }) as unknown as VeicoloGarage;

const monta = async () => {
  document.body.innerHTML = '<div id="app"></div>';
  await mostraGarage(document.getElementById('app')!);
};

describe('mostraGarage', () => {
  beforeEach(() => {
    history.replaceState(null, '', '/garage');
    caricaGarage.mockReset();
  });

  it('mostra il titolo e una carta per ogni veicolo', async () => {
    caricaGarage.mockResolvedValue([veicolo('AB123CD'), veicolo('EF456GH')]);
    await monta();
    expect(document.querySelector('h1')?.textContent).toContain('Il tuo garage');
    expect(document.querySelectorAll('a.tc-garage__carta')).toHaveLength(2);
  });

  it('senza veicoli mostra lo stato vuoto', async () => {
    caricaGarage.mockResolvedValue([]);
    await monta();
    expect(document.querySelector('.tc-vuoto')).not.toBeNull();
    expect(document.querySelector('a.tc-garage__carta')).toBeNull();
  });
});

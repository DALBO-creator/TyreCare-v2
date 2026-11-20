// @vitest-environment happy-dom
import { statoBattistrada } from '@tyrecare/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OfficinaGarage, VeicoloGarage } from '../lib/garage';

const { caricaGarage, caricaOfficinePrenotabili } = vi.hoisted(() => ({
  caricaGarage: vi.fn(),
  caricaOfficinePrenotabili: vi.fn(),
}));
vi.mock('../lib/garage', () => ({ caricaGarage }));
vi.mock('../lib/prenotazioni', () => ({ caricaOfficinePrenotabili }));
vi.mock('../lib/auth', () => ({
  esci: vi.fn(),
  sessioneCorrente: vi.fn(),
  messaggioErrore: (e: unknown) => (e instanceof Error ? e.message : 'Errore'),
}));
vi.mock('../lib/supabase', () => ({ getSupabase: () => ({}), chiaveSessione: () => 'chiave' }));

import { mostraGarageVeicolo } from './garage-veicolo';

// La data di sistema è fissata: il verdetto del battistrada dipende solo da mm e stagione
const OGGI = new Date('2026-11-16T10:00:00');
const TARGA = 'AB123CD';
const ORARI_VALIDI = { lun: [['08:30', '12:30']] };

const officina = (id: string, nome: string): OfficinaGarage => ({
  id,
  ragione_sociale: nome,
  indirizzo: 'Via Roma 1',
  citta: 'Milano',
  telefono: '02 1234567',
});

const prenotabile = (id: string) => ({ id, orari: ORARI_VALIDI, servizi: [{ id: 's1' }] });

const POSIZIONI = ['ANT_SX', 'ANT_DX', 'POST_SX', 'POST_DX'] as const;

/** Veicolo con un controllo: le quattro gomme misurate `mm` (ESTIVO). */
function veicolo(mm: number, extra: Partial<VeicoloGarage> = {}): VeicoloGarage {
  const misure = POSIZIONI.map((posizione) => ({
    battistrada_mm: mm,
    pressione_bar: null,
    usura: null,
    danni: null,
    pneumatico: { id: `p-${posizione}`, posizione, stagione: 'ESTIVO' },
  }));
  return {
    targa: TARGA,
    marca: 'Fiat',
    modello: 'Panda',
    anno: 2020,
    officine: [officina('o1', 'Gomme Rossi')],
    pneumatici: [],
    officinaPneumatici: 'Gomme Rossi',
    controlli: [
      {
        id: 'c1',
        eseguito_il: '2026-11-10',
        km: 40000,
        note: null,
        created_at: '2026-11-10T10:00:00Z',
        officina: 'Gomme Rossi',
        misure,
      },
    ],
    stato: null,
    ...extra,
  } as unknown as VeicoloGarage;
}

const monta = async (targa = TARGA) => {
  history.replaceState(null, '', `/garage/veicolo?targa=${targa}`);
  document.body.innerHTML = '<div id="app"></div>';
  await mostraGarageVeicolo(document.getElementById('app')!);
};
const testo = (selettore: string) =>
  document.querySelector(selettore)?.textContent?.replace(/\s+/g, ' ').trim();

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: OGGI });
  caricaGarage.mockReset();
  caricaOfficinePrenotabili.mockReset().mockResolvedValue([]);
});
afterEach(() => vi.useRealTimers());

describe('scheda del veicolo nel garage', () => {
  it('targa sconosciuta: pagina «Veicolo non trovato» con ritorno al garage', async () => {
    caricaGarage.mockResolvedValue([veicolo(5)]);
    await monta('ZZ999ZZ');
    expect(testo('h1')).toBe('Veicolo non trovato');
    expect(testo('.tc-vuoto__testo')).toBe(
      'Questo veicolo non è nel tuo garage. Se è tuo, chiedi alla tua officina di collegarlo al tuo account.',
    );
    expect(document.querySelector('.tc-vuoto a[href="/"]')!.textContent).toContain(
      'Torna al garage',
    );
    expect(document.querySelector('.tc-cruscotto')).toBeNull();
  });

  it('la targa dell’indirizzo è normalizzata prima della ricerca', async () => {
    caricaGarage.mockResolvedValue([veicolo(5)]);
    await monta('ab 123-cd');
    expect(testo('h1')).toBe('Panda');
  });

  it('gomme rosse: avviso e «Prenota la sostituzione» verso l’officina prenotabile', async () => {
    expect(statoBattistrada(1, 'ESTIVO')).toBe('ROSSO');
    caricaGarage.mockResolvedValue([veicolo(1)]);
    caricaOfficinePrenotabili.mockResolvedValue([prenotabile('o1')]);
    await monta();

    expect(document.querySelector('.tc-cruscotto')).not.toBeNull();
    expect(testo('.tc-avviso')).toContain('sono da sostituire');
    const link = [...document.querySelectorAll<HTMLAnchorElement>('.tc-azione a.btn')].find((a) =>
      a.textContent!.includes('Prenota la sostituzione'),
    );
    expect(link?.getAttribute('href')).toBe(`/prenota?officina=o1&targa=${TARGA}`);
    expect(caricaOfficinePrenotabili).toHaveBeenCalledWith(['o1']);
  });

  it('gomme rosse ma nessuna officina prenotabile: avviso senza pulsanti «Prenota»', async () => {
    caricaGarage.mockResolvedValue([veicolo(1)]);
    await monta();
    expect(testo('.tc-avviso')).toContain('sono da sostituire');
    expect(document.body.textContent).not.toContain('Prenota');
    expect(document.querySelector('.tc-officina__prenota')).toBeNull();
  });

  it('officina senza orari o senza servizi: non è prenotabile', async () => {
    caricaGarage.mockResolvedValue([veicolo(1)]);
    caricaOfficinePrenotabili.mockResolvedValue([{ id: 'o1', orari: {}, servizi: [{ id: 's1' }] }]);
    await monta();
    expect(document.body.textContent).not.toContain('Prenota');
    caricaOfficinePrenotabili.mockResolvedValue([{ id: 'o1', orari: ORARI_VALIDI, servizi: [] }]);
    await monta();
    expect(document.body.textContent).not.toContain('Prenota');
  });

  it('gomme gialle: «Prenota un controllo»; gomme verdi: nessun avviso', async () => {
    expect(statoBattistrada(2.5, 'ESTIVO')).toBe('GIALLO');
    expect(statoBattistrada(6, 'ESTIVO')).toBe('VERDE');
    caricaOfficinePrenotabili.mockResolvedValue([prenotabile('o1')]);
    caricaGarage.mockResolvedValue([veicolo(2.5)]);
    await monta();
    expect(testo('.tc-azione a.btn')).toContain('Prenota un controllo');
    caricaGarage.mockResolvedValue([veicolo(6)]);
    await monta();
    expect(document.querySelector('.tc-azione')).toBeNull();
  });

  it('senza controlli: storico vuoto e niente cruscotto', async () => {
    caricaGarage.mockResolvedValue([veicolo(5, { controlli: [] })]);
    await monta();
    expect(testo('#tc-storico')).toBe('Storico dei controlli');
    expect(testo('#tc-storico + p')).toBe('Nessun controllo registrato.');
    expect(document.querySelector('.tc-storico__voce')).toBeNull();
    expect(document.querySelector('.tc-cruscotto')).toBeNull();
  });

  it('con un controllo: una voce nello storico', async () => {
    caricaGarage.mockResolvedValue([veicolo(5)]);
    await monta();
    expect(document.querySelectorAll('.tc-storico__voce')).toHaveLength(1);
    expect(document.querySelector('.tc-cruscotto')).not.toBeNull();
  });

  it('due officine: due carte con titolo «Le tue officine»; «Prenota» solo su quella prenotabile', async () => {
    caricaGarage.mockResolvedValue([
      veicolo(5, { officine: [officina('o1', 'Gomme Rossi'), officina('o2', 'Pneus Blu')] }),
    ]);
    caricaOfficinePrenotabili.mockResolvedValue([prenotabile('o2')]);
    await monta();

    const carte = [...document.querySelectorAll('article.tc-officina')];
    expect(carte).toHaveLength(2);
    expect(testo('#tc-officine')).toBe('Le tue officine');
    expect(carte.map((c) => c.querySelector('.tc-officina__nome')!.textContent)).toEqual([
      'Gomme Rossi',
      'Pneus Blu',
    ]);
    expect(carte[0]!.querySelector('.tc-officina__prenota')).toBeNull();
    expect(carte[1]!.querySelector('.tc-officina__prenota')!.getAttribute('href')).toBe(
      `/prenota?officina=o2&targa=${TARGA}`,
    );
  });

  it('una sola officina: titolo «La tua officina», con Chiama e Indicazioni', async () => {
    caricaGarage.mockResolvedValue([veicolo(5)]);
    await monta();
    expect(testo('#tc-officine')).toBe('La tua officina');
    expect(document.querySelectorAll('article.tc-officina')).toHaveLength(1);
    expect(document.querySelector('a[href="tel:021234567"]')).not.toBeNull();
  });
});

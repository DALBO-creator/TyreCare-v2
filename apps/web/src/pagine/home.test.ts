// @vitest-environment happy-dom
import { VERSIONE_TERMINI } from '@tyrecare/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VeicoloGarage } from '../lib/garage';
import type { DatiUtente } from '../lib/profilo';

const { caricaGarage, caricaDatiUtente, mostraHomeOfficina } = vi.hoisted(() => ({
  caricaGarage: vi.fn(),
  caricaDatiUtente: vi.fn(),
  mostraHomeOfficina: vi.fn(),
}));
vi.mock('../lib/garage', () => ({ caricaGarage }));
vi.mock('../lib/profilo', () => ({
  caricaDatiUtente,
  accettaTerminiAttuali: vi.fn(),
  lavoraInOfficina: () => false,
}));
vi.mock('../lib/auth', () => ({
  esci: vi.fn(),
  sessioneCorrente: vi.fn(),
  messaggioErrore: (e: unknown) => (e instanceof Error ? e.message : 'Errore'),
}));
vi.mock('../lib/supabase', () => ({ getSupabase: () => ({}), chiaveSessione: () => 'chiave' }));
vi.mock('./home-officina', () => ({ mostraHomeOfficina }));

import { statoBattistrada } from '@tyrecare/shared';
import { STATI } from '../ui/stato';
import { mostraHome } from './home';

// `oggi()` legge la data di sistema: la si fissa per rendere stabile l'età dei DOT
const OGGI = new Date('2026-11-16T10:00:00');
const DOT_VECCHIO = '0120'; // settimana 1 del 2020: oltre 5 anni
const DOT_RECENTE = '4625'; // settimana 46 del 2025: meno di 2 anni

const utente = (): DatiUtente => ({
  email: 'cliente@esempio.it',
  profilo: {
    id: 'u1',
    nome: 'Giulia',
    cognome: 'Verdi',
    ruolo: 'CLIENTE',
    telefono: null,
    email_notifiche: true,
    termini_versione: VERSIONE_TERMINI,
    termini_accettati_il: '2026-10-01T10:00:00Z',
    created_at: '2026-10-01T10:00:00Z',
    updated_at: '2026-10-01T10:00:00Z',
  },
  officine: [],
});

/** Veicolo con una sola gomma misurata: lo stato è calcolato con le soglie reali. */
function veicolo(targa: string, mm: number, dot: string, extra: Partial<VeicoloGarage> = {}) {
  const stagione = 'ESTIVO' as const;
  return {
    targa,
    marca: 'Fiat',
    modello: 'Panda',
    anno: 2020,
    officine: [],
    pneumatici: [{ id: 'p1', dot, stagione, posizione: 'ANT_SX' }],
    officinaPneumatici: 'Gomme Rossi',
    controlli: [],
    stato: statoBattistrada(mm, stagione),
    ...extra,
  } as unknown as VeicoloGarage;
}

const montaHome = async () => {
  document.body.innerHTML = '<div id="app"></div>';
  await mostraHome(document.getElementById('app')!);
};
const carte = () => [...document.querySelectorAll<HTMLAnchorElement>('a.tc-garage__carta')];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: OGGI });
  history.replaceState(null, '', '/');
  caricaGarage.mockReset();
  caricaDatiUtente.mockReset().mockResolvedValue(utente());
  mostraHomeOfficina.mockReset();
});
afterEach(() => vi.useRealTimers());

describe('home del cliente', () => {
  it('senza veicoli mostra lo stato vuoto con l’invito', async () => {
    caricaGarage.mockResolvedValue([]);
    await montaHome();
    expect(document.querySelector('.tc-vuoto__titolo')!.textContent).toBe('Ancora nessun veicolo');
    expect(document.querySelector('.tc-vuoto__testo')!.textContent!.replace(/\s+/g, ' ')).toBe(
      ' Chiedi alla tua officina di invitarti: dal link che ti manda per email colleghi i tuoi veicoli e qui vedrai lo stato dei tuoi pneumatici. ',
    );
    expect(carte()).toHaveLength(0);
    expect(document.querySelector('h1')!.textContent).toContain('Ciao, Giulia');
    expect(mostraHomeOfficina).not.toHaveBeenCalled();
  });

  it('con due veicoli mostra due carte con collegamento, targa e stato', async () => {
    expect(statoBattistrada(1, 'ESTIVO')).toBe('ROSSO');
    expect(statoBattistrada(7, 'ESTIVO')).toBe('VERDE');
    caricaGarage.mockResolvedValue([
      veicolo('AB123CD', 1, DOT_RECENTE),
      veicolo('ZZ9', 7, DOT_RECENTE, { marca: 'Audi', modello: '' }),
    ]);
    await montaHome();

    const [prima, seconda] = carte();
    expect(carte()).toHaveLength(2);
    expect(document.querySelector('.tc-vuoto')).toBeNull();

    expect(prima!.getAttribute('href')).toBe(
      `/garage/veicolo?targa=${encodeURIComponent('AB123CD')}`,
    );
    expect(prima!.querySelector('.tc-targa')!.textContent).toBe('AB 123 CD');
    expect(prima!.classList.contains(`tc-garage__carta--${STATI.ROSSO.classe}`)).toBe(true);
    expect(prima!.querySelector('.tc-stato')!.textContent).toContain(STATI.ROSSO.etichetta);

    expect(seconda!.getAttribute('href')).toBe('/garage/veicolo?targa=ZZ9');
    expect(seconda!.querySelector('.tc-targa')!.textContent).toBe('ZZ9');
    expect(seconda!.classList.contains(`tc-garage__carta--${STATI.VERDE.classe}`)).toBe(true);
    expect(seconda!.querySelector('.tc-stato')!.textContent).toContain(STATI.VERDE.etichetta);
    // senza modello la carta mostra la targa
    expect(seconda!.querySelector('.tc-garage__modello')!.textContent).toBe('ZZ9');
  });

  it('un veicolo senza controlli mostra «Nessun controllo» e nessuna classe di stato', async () => {
    caricaGarage.mockResolvedValue([veicolo('AB123CD', 7, DOT_RECENTE, { stato: null })]);
    await montaHome();
    const carta = carte()[0]!;
    expect(carta.querySelector('.tc-stato--nessuno')!.textContent).toBe('Nessun controllo');
    expect(carta.className).toBe('tc-garage__carta');
  });

  it('avvisa delle gomme con DOT di oltre 5 anni', async () => {
    caricaGarage.mockResolvedValue([
      veicolo('AB123CD', 7, DOT_VECCHIO),
      veicolo('ZZ9', 7, DOT_RECENTE),
    ]);
    await montaHome();
    const [vecchia, recente] = carte();
    const avviso = (c: Element) =>
      [...c.querySelectorAll('small')].map((s) => s.textContent).filter((t) => /anni/.test(t!));
    expect(avviso(vecchia!)).toEqual(['1 gomma ha più di 5 anni']);
    expect(avviso(recente!)).toEqual([]);
  });

  it('mostra i collegamenti per l’aiuto su strada e per registrare un’officina', async () => {
    caricaGarage.mockResolvedValue([]);
    await montaHome();
    const link = (testo: string) =>
      [...document.querySelectorAll('a')].find((a) => a.textContent === testo);
    expect(link('Gomma a terra? Chiedi aiuto su strada')!.getAttribute('href')).toBe('/strada');
    expect(link("Hai un'officina? Registrala su TyreCare")!.getAttribute('href')).toBe(
      '/officina/registra',
    );
  });

  it('non mostra il banner dei termini se la versione è quella attuale', async () => {
    caricaGarage.mockResolvedValue([]);
    await montaHome();
    expect(document.body.textContent).not.toContain('Abbiamo aggiornato informativa e termini');
  });

  it('con un’officina lascia la pagina alla home dell’officina', async () => {
    const dati = utente();
    dati.officine = [{ id: 'o1' } as unknown as DatiUtente['officine'][number]];
    caricaDatiUtente.mockResolvedValue(dati);
    caricaGarage.mockResolvedValue([]);
    await montaHome();
    expect(mostraHomeOfficina).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.tc-garage')).toBeNull();
  });
});

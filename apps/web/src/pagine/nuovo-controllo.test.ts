// @vitest-environment happy-dom
import { oggiISO } from '@tyrecare/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Le icone creano SVG con `document`: qui bastano segnaposto
vi.mock('../ui/icone', () => ({ icona: () => '<svg></svg>' }));

const { caricaSchedaDaUrl, registraControllo, vaiConConferma } = vi.hoisted(() => ({
  caricaSchedaDaUrl: vi.fn(),
  registraControllo: vi.fn(),
  vaiConConferma: vi.fn(),
}));
vi.mock('./veicolo', () => ({ caricaSchedaDaUrl }));
vi.mock('../lib/officina', () => ({ registraControllo }));
vi.mock('../lib/auth', async (importOriginal) => ({
  ...(await importOriginal()),
  sessioneCorrente: () => ({ user: { id: 'u1' } }),
}));
vi.mock('../lib/notifiche', async (importOriginal) => ({
  ...(await importOriginal()),
  avviaNotifiche: () => {},
}));
vi.mock('../lib/router', () => ({ visualizzazioneCorrente: () => 1, vaiA: vi.fn() }));
vi.mock('./comune', async (importOriginal) => ({
  ...(await importOriginal()),
  vaiConConferma,
}));

import { chiaveBozza, leggiBozza, salvaBozza } from '../lib/bozza-controllo';
import type { Pneumatico } from '../lib/officina';
import { campiControllo, collegaStatoInDiretta, mostraNuovoControllo } from './nuovo-controllo';

const ruota = (
  posizione: Pneumatico['posizione'],
  stagione: Pneumatico['stagione'],
): Pneumatico => ({
  id: `p-${posizione}`,
  veicolo_id: 'v1',
  officina_id: 'o1',
  posizione,
  stagione,
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

const ESTIVA = ruota('ANT_SX', 'ESTIVO');
const INVERNALE = ruota('POST_SX', 'INVERNALE');
const POSIZIONI_MONTATE = ['ANT_SX', 'POST_SX'];

const campoDi = (nome: string) => document.querySelector<HTMLInputElement>(`[name="${nome}"]`)!;
const badge = (posizione: string) =>
  document.querySelector<HTMLElement>(`[data-stato="${posizione}"]`)!;
const scrivi = (nome: string, valore: string) => {
  const el = campoDi(nome);
  el.value = valore;
  el.dispatchEvent(new Event('input', { bubbles: true }));
};

describe('stato in diretta del battistrada', () => {
  beforeEach(() => {
    const montati = [ESTIVA, INVERNALE];
    document.body.innerHTML = `<form>${campiControllo(montati, {
      eseguito_il: '2026-11-10',
      km: null,
      note: '',
    })}</form>`;
    collegaStatoInDiretta(document.querySelector('form')!, montati);
  });

  it('estivo: 5 mm verde, 2,5 giallo, 1,2 rosso', () => {
    scrivi('mm_ANT_SX', '5');
    expect(badge('ANT_SX').textContent).toBe('In buono stato');
    expect(badge('ANT_SX').querySelector('.tc-stato--verde')).not.toBeNull();
    scrivi('mm_ANT_SX', '2.5');
    expect(badge('ANT_SX').textContent).toBe('Da controllare');
    expect(badge('ANT_SX').querySelector('.tc-stato--giallo')).not.toBeNull();
    scrivi('mm_ANT_SX', '1.2');
    expect(badge('ANT_SX').textContent).toBe('Da sostituire');
    expect(badge('ANT_SX').querySelector('.tc-stato--rosso')).not.toBeNull();
  });

  it('la soglia dipende dalla stagione: 3,5 mm è verde sull’estivo e gialla sull’invernale', () => {
    scrivi('mm_ANT_SX', '3.5');
    scrivi('mm_POST_SX', '3.5');
    expect(badge('ANT_SX').textContent).toBe('In buono stato');
    expect(badge('POST_SX').textContent).toBe('Da controllare');
    expect(badge('POST_SX').querySelector('.tc-stato--giallo')).not.toBeNull();
  });

  it('accetta la virgola decimale', () => {
    scrivi('mm_ANT_SX', '2,5');
    expect(badge('ANT_SX').textContent).toBe('Da controllare');
  });

  it.each(['abc', '-1', '21'])('con «%s» non mostra nessun badge', (valore) => {
    scrivi('mm_ANT_SX', valore);
    expect(badge('ANT_SX').innerHTML).toBe('');
  });

  it('un badge già presente sparisce quando il valore diventa non valido', () => {
    scrivi('mm_ANT_SX', '5');
    expect(badge('ANT_SX').textContent).toBe('In buono stato');
    scrivi('mm_ANT_SX', 'abc');
    expect(badge('ANT_SX').innerHTML).toBe('');
  });
});

describe('pagina Nuovo controllo con bozza', () => {
  const chiave = chiaveBozza('u1', 'v1');
  const bozzaValida = {
    eseguito_il: oggiISO(),
    mm_ANT_SX: '5',
    mm_POST_SX: '3,5',
    note: 'Convergenza da rivedere',
  };
  const pulsante = (testo: string) =>
    [...document.querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.textContent?.trim() === testo,
    );
  const avviso = () => document.querySelector('[data-bozza-avviso]')!;

  async function apri(): Promise<void> {
    document.body.innerHTML = '<div id="app"></div>';
    await mostraNuovoControllo(document.getElementById('app')!);
    await vi.waitFor(() => expect(pulsante('Salva controllo')).toBeDefined());
  }

  beforeEach(() => {
    localStorage.clear();
    registraControllo.mockReset();
    vaiConConferma.mockReset();
    caricaSchedaDaUrl.mockReset();
    caricaSchedaDaUrl.mockResolvedValue({
      veicolo: { id: 'v1', targa: 'AB123CD', marca: 'Fiat', modello: 'Panda' },
      pneumatici: [ESTIVA, INVERNALE],
      controlli: [],
    });
  });

  it('senza bozza: campi vuoti e nessun avviso', async () => {
    await apri();
    expect(campoDi('mm_ANT_SX').value).toBe('');
    expect(avviso().textContent?.trim()).toBe('');
    expect(pulsante('Scarta la bozza')).toBeUndefined();
  });

  it('con una bozza valida riempie i campi, ricalcola i badge e mostra l’avviso', async () => {
    salvaBozza(chiave, POSIZIONI_MONTATE, bozzaValida);
    await apri();
    expect(campoDi('mm_ANT_SX').value).toBe('5');
    expect(campoDi('mm_POST_SX').value).toBe('3,5');
    expect(campoDi('note').value).toBe('Convergenza da rivedere');
    expect(badge('ANT_SX').textContent).toBe('In buono stato');
    expect(badge('POST_SX').textContent).toBe('Da controllare');
    expect(avviso().querySelector('p')!.textContent).toBe(
      'Abbiamo ripreso le misure che non avevi salvato.',
    );
    expect(pulsante('Scarta la bozza')).toBeDefined();
  });

  it('«Scarta la bozza» rimette i valori iniziali, cancella la bozza e toglie l’avviso', async () => {
    salvaBozza(chiave, POSIZIONI_MONTATE, { ...bozzaValida, eseguito_il: '2026-01-02' });
    await apri();
    expect(leggiBozza(chiave, POSIZIONI_MONTATE)).not.toBeNull();
    pulsante('Scarta la bozza')!.click();
    expect(campoDi('mm_ANT_SX').value).toBe('');
    expect(campoDi('mm_POST_SX').value).toBe('');
    expect(campoDi('note').value).toBe('');
    expect(campoDi('eseguito_il').value).toBe(oggiISO());
    expect(badge('ANT_SX').innerHTML).toBe('');
    expect(badge('POST_SX').innerHTML).toBe('');
    expect(leggiBozza(chiave, POSIZIONI_MONTATE)).toBeNull();
    expect(pulsante('Scarta la bozza')).toBeUndefined();
    expect(avviso().textContent?.trim()).toBe('');
  });

  it('salvataggio riuscito: registra il controllo e cancella la bozza', async () => {
    registraControllo.mockResolvedValue(undefined);
    salvaBozza(chiave, POSIZIONI_MONTATE, bozzaValida);
    await apri();
    expect(leggiBozza(chiave, POSIZIONI_MONTATE)).not.toBeNull();
    document.querySelector('form')!.requestSubmit();
    await vi.waitFor(() => expect(vaiConConferma).toHaveBeenCalled());
    expect(registraControllo).toHaveBeenCalledTimes(1);
    expect(registraControllo.mock.calls[0]![0]).toBe('v1');
    expect(leggiBozza(chiave, POSIZIONI_MONTATE)).toBeNull();
  });

  it('salvataggio fallito: la bozza resta', async () => {
    registraControllo.mockRejectedValue(new Error('rete assente'));
    salvaBozza(chiave, POSIZIONI_MONTATE, bozzaValida);
    await apri();
    expect(leggiBozza(chiave, POSIZIONI_MONTATE)).not.toBeNull();
    document.querySelector('form')!.requestSubmit();
    await vi.waitFor(() => expect(registraControllo).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(pulsante('Salva controllo')!.disabled).toBe(false));
    expect(vaiConConferma).not.toHaveBeenCalled();
    expect(leggiBozza(chiave, POSIZIONI_MONTATE)).not.toBeNull();
  });
});

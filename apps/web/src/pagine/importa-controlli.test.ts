// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tabella } from '@tyrecare/shared';
import type * as M_importa from '../lib/importa';
import type * as M_importa_controlli from '../lib/importa-controlli';
import type * as M_officina from '../lib/officina';
import type * as M_router from '../lib/router';

const { leggiTabella, importaControlli, caricaContestoOfficina } = vi.hoisted(() => ({
  leggiTabella: vi.fn(),
  importaControlli: vi.fn(),
  caricaContestoOfficina: vi.fn(),
}));
const { mostraPagina } = vi.hoisted(() => ({ mostraPagina: vi.fn() }));

// Si fingono lettura del file, funzione d'import e contesto: le funzioni pure restano vere
vi.mock('../lib/importa', async (importOriginal) => ({
  ...(await importOriginal<typeof M_importa>()),
  leggiTabella,
}));
vi.mock('../lib/importa-controlli', async (importOriginal) => ({
  ...(await importOriginal<typeof M_importa_controlli>()),
  importaControlli,
}));
vi.mock('../lib/officina', async (importOriginal) => ({
  ...(await importOriginal<typeof M_officina>()),
  caricaContestoOfficina,
}));
vi.mock('../lib/router', async (importOriginal) => ({
  ...(await importOriginal<typeof M_router>()),
  visualizzazioneCorrente: () => 1,
  ancoraAttuale: () => true,
  mostraPagina,
}));
vi.mock('../lib/supabase', () => ({ getSupabase: () => ({}), chiaveSessione: () => 'chiave' }));

import { mostraImportaControlli } from './importa-controlli';

const ID_OFFICINA = '22222222-2222-4222-8222-222222222222';

const contesto = (ruolo: 'TITOLARE' | 'OPERATORE') => {
  const officina = { id: ID_OFFICINA, ragione_sociale: 'LA SANTI GOMME' };
  return { officine: [{ ruolo, officina }], attiva: { ruolo, officina } };
};

const INTESTAZIONI = ['codice_documento', 'targa', 'data', 'posizione', 'battistrada_mm'];
const buona = (numero: number, documento = `D${numero}`) => ({
  numero,
  celle: [documento, 'AB123CD', '25/10/2026', 'ANT_SX', '4,5'],
});
// Posizione inventata: la riga viene scartata dal controllo del file
const cattiva = (numero: number) => ({
  numero,
  celle: [`D${numero}`, 'AB123CD', '25/10/2026', 'XX', '4,5'],
});
const tabella = (righe: Tabella['righe']): Tabella => ({ intestazioni: INTESTAZIONI, righe });

const conteggi = (extra: Partial<M_importa_controlli.ConteggiControlli> = {}) => ({
  controlli_nuovi: 2,
  controlli_gia_presenti: 1,
  pneumatici_nuovi: 4,
  misure_nuove: 8,
  misure_saltate: 0,
  pneumatici_completati: 0,
  targhe_non_trovate: [],
  ...extra,
});

/** Disegna la pagina da titolare e consegna un file finto all'input. */
async function apriEScegliFile(app: HTMLElement, nome = 'storico.csv') {
  await mostraImportaControlli(app);
  const input = app.querySelector<HTMLInputElement>('#tc-file')!;
  Object.defineProperty(input, 'files', {
    value: [new File(['x'], nome)],
    configurable: true,
  });
  input.dispatchEvent(new Event('change'));
}

let app: HTMLElement;
const anteprima = () => app.querySelector<HTMLElement>('[data-anteprima]')!;
// Il testo della pagina ha a capo e rientri del template: si confronta con gli spazi ridotti
const testo = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ').trim();

beforeEach(() => {
  app = document.createElement('div');
  document.body.append(app);
  caricaContestoOfficina.mockResolvedValue(contesto('TITOLARE'));
});

afterEach(() => {
  app.remove();
  vi.clearAllMocks();
});

describe('Importa i controlli: permessi', () => {
  it('chi non è titolare vede il messaggio di sola lettura e nessun campo file', async () => {
    caricaContestoOfficina.mockResolvedValue(contesto('OPERATORE'));
    await mostraImportaControlli(app);
    expect(app.querySelector('[role="status"]')!.textContent).toContain(
      "Solo il titolare dell'officina può importare i dati dal gestionale.",
    );
    expect(app.querySelector('input[type="file"]')).toBeNull();
    expect(app.querySelector('[data-modello]')).toBeNull();
  });

  it('il titolare vede il campo file', async () => {
    await mostraImportaControlli(app);
    expect(app.querySelector('input#tc-file[type="file"]')).not.toBeNull();
  });
});

describe('Importa i controlli: file non importabile', () => {
  it('file vuoto', async () => {
    leggiTabella.mockResolvedValue(null);
    await apriEScegliFile(app);
    await vi.waitFor(() => expect(anteprima().textContent).toContain('Il file è vuoto.'));
    expect(importaControlli).not.toHaveBeenCalled();
  });

  it('file senza le colonne del modello', async () => {
    leggiTabella.mockResolvedValue({
      intestazioni: ['a', 'b'],
      righe: [{ numero: 2, celle: ['1', '2'] }],
    });
    await apriEScegliFile(app);
    await vi.waitFor(() =>
      expect(anteprima().textContent).toContain('Rinomina le colonne del file come nel modello.'),
    );
    expect(anteprima().querySelector('[role="alert"]')!.textContent).toContain(
      'Manca la colonna «Codice documento».',
    );
    expect(importaControlli).not.toHaveBeenCalled();
  });

  it('nessuna riga valida: errori elencati, nessuna simulazione, nessun pulsante', async () => {
    leggiTabella.mockResolvedValue(tabella([cattiva(2), cattiva(3)]));
    await apriEScegliFile(app);
    await vi.waitFor(() =>
      expect(anteprima().textContent).toContain(
        'Nessuna riga da importare: correggi il file e caricalo di nuovo.',
      ),
    );
    expect(testo(anteprima())).toContain('2 righe lette: 0 pronte da importare, 2 con errori.');
    expect(app.querySelectorAll('[aria-label="Righe con errori"] li')).toHaveLength(2);
    expect(importaControlli).not.toHaveBeenCalled();
    expect(app.querySelector('[data-importa]')).toBeNull();
  });

  it("un errore del lettore di file è mostrato com'è", async () => {
    leggiTabella.mockRejectedValue(new Error('Formato non riconosciuto.'));
    await apriEScegliFile(app);
    await vi.waitFor(() =>
      expect(anteprima().querySelector('[role="alert"]')!.textContent).toContain(
        'Formato non riconosciuto.',
      ),
    );
  });
});

describe('Importa i controlli: anteprima', () => {
  it('righe valide e scartate: conteggi del database e numeri del file', async () => {
    leggiTabella.mockResolvedValue(tabella([buona(2), buona(3), cattiva(4)]));
    importaControlli.mockResolvedValue(conteggi());
    await apriEScegliFile(app, 'storico.csv');
    await vi.waitFor(() => expect(app.querySelector('[data-conteggi]')).not.toBeNull());

    expect(app.querySelector('#tc-anteprima')!.textContent).toBe('Anteprima di «storico.csv»');
    expect(testo(anteprima())).toContain('3 righe lette: 2 pronte da importare, 1 con errori.');
    expect(app.querySelector('[data-conteggi]')!.textContent).toBe(
      '2 controlli nuovi · 1 già presente · 4 pneumatici nuovi · 8 misure',
    );
    expect(app.querySelector('[data-periodo]')!.textContent).toBe('Controlli del 25 ottobre 2026');
    const elenco = app.querySelectorAll('[aria-label="Righe con errori"] li');
    expect(elenco).toHaveLength(1);
    expect(elenco[0]!.textContent).toContain('Riga 4');

    // La simulazione parte da sola, con le sole righe valide
    expect(importaControlli).toHaveBeenCalledTimes(1);
    const arg = importaControlli.mock.calls[0]![0];
    expect(arg).toMatchObject({
      officinaId: ID_OFFICINA,
      nomeFile: 'storico.csv',
      scartate: 1,
      simula: true,
    });
    expect(arg.righe.map((r: { numero: number }) => r.numero)).toEqual([2, 3]);
  });

  it('più di 100 errori: ne mostra 100 e dice quanti restano', async () => {
    const righe = [buona(2)];
    for (let n = 3; n < 3 + 105; n++) righe.push(cattiva(n));
    leggiTabella.mockResolvedValue(tabella(righe));
    importaControlli.mockResolvedValue(conteggi({ controlli_nuovi: 1 }));
    await apriEScegliFile(app);
    await vi.waitFor(() => expect(app.querySelector('[data-conteggi]')).not.toBeNull());

    expect(app.querySelectorAll('[aria-label="Righe con errori"] li')).toHaveLength(100);
    expect(testo(anteprima())).toContain('E altri 5 errori.');
    expect(testo(anteprima())).toContain('106 righe lette: 1 pronta da importare, 105 con errori.');
  });

  it('con 100 errori esatti non compare «E altri»', async () => {
    const righe = [buona(2)];
    for (let n = 3; n < 103; n++) righe.push(cattiva(n));
    leggiTabella.mockResolvedValue(tabella(righe));
    importaControlli.mockResolvedValue(conteggi());
    await apriEScegliFile(app);
    await vi.waitFor(() => expect(app.querySelector('[data-conteggi]')).not.toBeNull());
    expect(app.querySelectorAll('[aria-label="Righe con errori"] li')).toHaveLength(100);
    expect(anteprima().textContent).not.toContain('E altri');
  });

  it("nessun controllo nuovo: niente pulsante d'import", async () => {
    leggiTabella.mockResolvedValue(tabella([buona(2)]));
    importaControlli.mockResolvedValue(conteggi({ controlli_nuovi: 0, controlli_gia_presenti: 1 }));
    await apriEScegliFile(app);
    await vi.waitFor(() =>
      expect(anteprima().textContent).toContain(
        'Niente da importare: nessun controllo nuovo in questo file.',
      ),
    );
    expect(app.querySelector('[data-importa]')).toBeNull();
  });

  it("errore di rete nell'anteprima", async () => {
    leggiTabella.mockResolvedValue(tabella([buona(2)]));
    importaControlli.mockRejectedValue(new TypeError('Failed to fetch'));
    await apriEScegliFile(app);
    await vi.waitFor(() =>
      expect(anteprima().querySelector('[role="alert"]')!.textContent).toContain(
        'Non riusciamo a contattare il server. Controlla la connessione e riprova.',
      ),
    );
    expect(app.querySelector('[data-importa]')).toBeNull();
  });
});

describe('Importa i controlli: import', () => {
  async function finoAlPulsante() {
    leggiTabella.mockResolvedValue(tabella([buona(2), buona(3), cattiva(4)]));
    importaControlli.mockResolvedValueOnce(conteggi());
    await apriEScegliFile(app);
    await vi.waitFor(() => expect(app.querySelector('[data-importa]')).not.toBeNull());
    return app.querySelector<HTMLButtonElement>('[data-importa]')!;
  }

  it('conferma: una sola chiamata con simula false e le righe valide, poi il riepilogo', async () => {
    const pulsante = await finoAlPulsante();
    importaControlli.mockResolvedValueOnce(conteggi({ pneumatici_completati: 2 }));
    pulsante.click();
    // Un secondo clic subito dopo: il pulsante è già disabilitato
    pulsante.click();
    await vi.waitFor(() =>
      expect(app.querySelector('#tc-esito')!.textContent).toBe('Import completato'),
    );

    // anteprima (simula true) + import (simula false) = 2 chiamate, non 3
    expect(importaControlli).toHaveBeenCalledTimes(2);
    const arg = importaControlli.mock.calls[1]![0];
    expect(arg).toMatchObject({ officinaId: ID_OFFICINA, scartate: 1, simula: false });
    expect(arg.righe.map((r: { numero: number }) => r.numero)).toEqual([2, 3]);

    expect(testo(anteprima())).toContain(
      'Import completato: 2 controlli nuovi · 1 già presente · 4 pneumatici nuovi · 8 misure.',
    );
    expect(testo(app.querySelector('[data-completate]')!)).toContain(
      '2 gomme già registrate sono state completate',
    );
    const link = app.querySelector<HTMLAnchorElement>('a.btn-primary')!;
    expect(link.textContent).toBe('Torna ai veicoli');
    expect(link.getAttribute('href')).toBe('/');
    expect(app.querySelector('[data-importa]')).toBeNull();
  });

  it("errore di rete nell'import: messaggio, pulsante di nuovo attivo e nuovo tentativo possibile", async () => {
    const pulsante = await finoAlPulsante();
    importaControlli.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    pulsante.click();
    await vi.waitFor(() =>
      expect(app.querySelector('[data-errore-import]')!.textContent).toContain(
        'Non riusciamo a contattare il server. Controlla la connessione e riprova.',
      ),
    );
    expect(pulsante.disabled).toBe(false);
    expect(pulsante.textContent).toContain('Importa i controlli');
    expect(app.querySelector('#tc-esito')).toBeNull();

    importaControlli.mockResolvedValueOnce(conteggi());
    pulsante.click();
    await vi.waitFor(() => expect(app.querySelector('#tc-esito')).not.toBeNull());
    expect(importaControlli).toHaveBeenCalledTimes(3);
    // Il messaggio d'errore sparisce con il riepilogo (la sezione è sostituita)
    expect(app.querySelector('[data-errore-import]')).toBeNull();
  });

  it('errore 42501 del database: messaggio di sola lettura', async () => {
    const pulsante = await finoAlPulsante();
    importaControlli.mockRejectedValueOnce(Object.assign(new Error('rls'), { code: '42501' }));
    pulsante.click();
    await vi.waitFor(() =>
      expect(app.querySelector('[data-errore-import]')!.textContent).toContain(
        "Solo il titolare dell'officina può importare i dati dal gestionale.",
      ),
    );
  });

  it('rifiuto del database con codice: il messaggio del database è riportato', async () => {
    const pulsante = await finoAlPulsante();
    importaControlli.mockRejectedValueOnce(
      Object.assign(new Error('vincolo violato'), { code: '23514' }),
    );
    pulsante.click();
    await vi.waitFor(() =>
      expect(app.querySelector('[data-errore-import]')!.textContent).toContain(
        'Il database ha rifiutato i dati (vincolo violato). Controlla il file e riprova.',
      ),
    );
  });
});

// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formattaTarga } from '@tyrecare/shared';
import type * as M_report from '../lib/report';
import type { MisuraReport, Report } from '../lib/report';
import type * as M_router from '../lib/router';
import type * as M_pagina_report from './report';

const { caricaReportPubblico, htmlReport, ancora } = vi.hoisted(() => ({
  caricaReportPubblico: vi.fn(),
  htmlReport: vi.fn(),
  ancora: vi.fn(),
}));

vi.mock('../lib/report', async (importOriginal) => ({
  ...(await importOriginal<typeof M_report>()),
  caricaReportPubblico,
}));
vi.mock('../lib/router', async (importOriginal) => ({
  ...(await importOriginal<typeof M_router>()),
  visualizzazioneCorrente: () => 1,
  ancoraAttuale: ancora,
}));
// htmlReport avvolge il vero: si verifica la chiamata e insieme l'HTML disegnato
vi.mock('./report', async (importOriginal) => {
  const originale = await importOriginal<typeof M_pagina_report>();
  htmlReport.mockImplementation(originale.htmlReport);
  return { ...originale, htmlReport };
});
vi.mock('../lib/supabase', () => ({ getSupabase: () => ({}), chiaveSessione: () => 'chiave' }));

import { mostraReportPubblico } from './report-pubblico';

const ID_OFFICINA = '22222222-2222-4222-8222-222222222222';
const TARGA = 'AB123CD';

type Posizione = MisuraReport['pneumatico']['posizione'];

const misura = (posizione: Posizione, battistrada: number): MisuraReport => ({
  battistrada_mm: battistrada,
  pressione_bar: null,
  usura: null,
  danni: '',
  pneumatico: {
    id: `p-${posizione}`,
    posizione,
    stagione: 'ESTIVO',
    misura: '205/55 R16',
    marca: 'Pirelli',
    modello: `Cinturato ${posizione}`,
    dot: null,
    montato_il: '2025-03-10',
    smontato_il: '2025-03-10',
  },
});

const report = (): Report => ({
  id: '33333333-3333-4333-8333-333333333333',
  officina_id: ID_OFFICINA,
  eseguito_il: '2026-11-20',
  km: 45200,
  note: '',
  veicolo: {
    id: '44444444-4444-4444-8444-444444444444',
    targa: TARGA,
    marca: 'Fiat',
    modello: 'Panda',
    anno: 2019,
    officina: {
      id: ID_OFFICINA,
      ragione_sociale: 'Gomme Rossi',
      indirizzo: 'Via Roma 1',
      citta: 'Milano',
      telefono: '02 1234567',
    },
  },
  misure: [
    misura('POST_DX', 3.5),
    misura('ANT_SX', 5),
    misura('POST_SX', 1.4),
    misura('ANT_DX', 2.5),
  ],
});

const monta = async () => {
  document.body.innerHTML = '<div id="app"></div>';
  await mostraReportPubblico(document.getElementById('app')!);
};
const attendi = () => new Promise((r) => setTimeout(r, 0));
const h1 = () => document.querySelector('h1')?.textContent?.trim();
const stato = () => document.querySelector('[role="status"]')?.textContent?.trim();

beforeEach(() => {
  for (const f of [caricaReportPubblico, ancora]) f.mockReset();
  htmlReport.mockClear();
  ancora.mockReturnValue(true);
  caricaReportPubblico.mockResolvedValue(report());
  window.history.replaceState({}, '', '/r?c=ABC');
  document.title = '';
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

describe('report pubblico (/r?c=…)', () => {
  it('senza codice nel link: non chiede nulla e mostra «Report non disponibile»', async () => {
    window.history.replaceState({}, '', '/r');
    await monta();
    expect(caricaReportPubblico).not.toHaveBeenCalled();
    expect(h1()).toBe('Report non disponibile');
    expect(stato()).toBe("Link non valido o scaduto. Chiedi all'officina un link nuovo.");
    const vai = [...document.querySelectorAll('a')].find((a) => a.textContent === 'Vai a TyreCare');
    expect(vai?.getAttribute('href')).toBe('/');
  });

  it('link scaduto o revocato (nessun report): stesso messaggio', async () => {
    caricaReportPubblico.mockResolvedValue(null);
    await monta();
    expect(caricaReportPubblico).toHaveBeenCalledWith('ABC');
    expect(h1()).toBe('Report non disponibile');
    expect(stato()).toBe("Link non valido o scaduto. Chiedi all'officina un link nuovo.");
    expect(htmlReport).not.toHaveBeenCalled();
  });

  it('lettura fallita: messaggio di errore e «Riprova» rilancia la lettura', async () => {
    caricaReportPubblico.mockRejectedValueOnce(new Error('rete'));
    await monta();
    expect(h1()).toBe('Non riusciamo a caricare il report');
    expect(stato()).toBe('Controlla la connessione e riprova.');
    document.querySelector<HTMLButtonElement>('[data-riprova]')!.click();
    await attendi();
    expect(caricaReportPubblico).toHaveBeenCalledTimes(2);
    expect(h1()).toBe('20 novembre 2026');
  });

  it('se la visualizzazione non è più attuale, la pagina resta sul caricamento', async () => {
    ancora.mockReturnValue(false);
    await monta();
    expect(h1()).toBeUndefined();
    expect(stato()).toBe('Caricamento…');
  });

  it('link valido: titolo del documento con targa e data, report disegnato con pubblico = true', async () => {
    await monta();
    expect(htmlReport).toHaveBeenCalledTimes(1);
    expect(htmlReport).toHaveBeenCalledWith(report(), { membro: false, pubblico: true });
    expect(document.title).toBe(`Controllo ${formattaTarga(TARGA)} 2026-11-20 · TyreCare`);
    expect(document.querySelector('.tc-targa')?.textContent).toBe(formattaTarga(TARGA));
  });

  it('link valido: niente menu né notifiche, solo il marchio che porta alla home', async () => {
    await monta();
    const testata = document.querySelector('header.tc-appbar')!;
    expect(document.querySelector('nav')).toBeNull();
    expect(testata.querySelectorAll('a')).toHaveLength(1);
    expect(testata.querySelector('a')?.getAttribute('aria-label')).toBe('TyreCare, home');
    expect(testata.querySelector('button')).toBeNull();
  });

  it('link valido: nessun elemento che la versione pubblica nasconde', async () => {
    await monta();
    expect(document.querySelector('a[href^="/pneumatico"]')).toBeNull();
    expect(document.querySelector('a[href^="/controllo/modifica"]')).toBeNull();
    expect(document.querySelector('[data-condividi-report]')).toBeNull();
    const testi = [...document.querySelectorAll('a, button')].map((e) => e.textContent?.trim());
    expect(testi).not.toContain('Torna al veicolo');
    // Il report è comunque disegnato: ogni ruota con la sua descrizione, senza collegamento
    expect(document.querySelectorAll('.tc-ruota')).toHaveLength(4);
  });

  it('«Stampa o salva in PDF» chiama window.print', async () => {
    const stampa = vi.fn();
    vi.stubGlobal('print', stampa);
    await monta();
    document.querySelector<HTMLButtonElement>('[data-stampa]')!.click();
    expect(stampa).toHaveBeenCalledTimes(1);
  });
});

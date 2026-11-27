// @vitest-environment happy-dom
import { CONTATTO_EMAIL } from '@tyrecare/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as M_abbonamento from '../lib/abbonamento';
import type * as M_officina from '../lib/officina';
import type * as M_router from '../lib/router';

const { caricaAbbonamento, caricaContestoOfficina, segnalaErrore } = vi.hoisted(() => ({
  caricaAbbonamento: vi.fn(),
  caricaContestoOfficina: vi.fn(),
  segnalaErrore: vi.fn(),
}));

// Si fingono solo le letture: riassunto, etichette e testo della richiesta restano veri
vi.mock('../lib/abbonamento', async (importOriginal) => ({
  ...(await importOriginal<typeof M_abbonamento>()),
  caricaAbbonamento,
}));
vi.mock('../lib/officina', async (importOriginal) => ({
  ...(await importOriginal<typeof M_officina>()),
  caricaContestoOfficina,
}));
vi.mock('../lib/errori-app', () => ({ segnalaErrore }));
vi.mock('../lib/router', async (importOriginal) => ({
  ...(await importOriginal<typeof M_router>()),
  visualizzazioneCorrente: () => 1,
  ancoraAttuale: () => true,
  mostraPagina: vi.fn(),
}));
vi.mock('../lib/supabase', () => ({ getSupabase: () => ({}), chiaveSessione: () => 'chiave' }));

import { mostraAbbonamento } from './abbonamento';

const ID_OFFICINA = '22222222-2222-4222-8222-222222222222';
const RAGIONE_SOCIALE = 'Gomme Rossi';

// Il ruolo viene dai dati finti del contesto: `eTitolare` è quella vera
const contesto = (ruolo: 'TITOLARE' | 'OPERATORE') => {
  const voce = {
    ruolo,
    officina: {
      id: ID_OFFICINA,
      ragione_sociale: RAGIONE_SOCIALE,
      citta: 'Roma',
      stato_affiliazione: 'ATTIVA',
    },
  };
  return { email: 'x@example.it', profilo: {}, officine: [voce], attiva: voce };
};

// Oggi (fissato) = 1 dicembre 2026
const abbonamento = (extra: object = {}) => ({
  piano: 'MENSILE',
  stato: 'ATTIVO',
  prova_fino_al: '2026-11-01',
  iniziato_il: '2026-11-05',
  scade_il: '2027-03-31',
  installazione_pagata: false,
  installazione_pagata_il: null,
  importo_concordato: null,
  ...extra,
});

const monta = async () => {
  document.body.innerHTML = '<div id="app"></div>';
  await mostraAbbonamento(document.getElementById('app')!);
};

const avviso = () => document.querySelector<HTMLElement>('[data-stato-abbonamento]')!;
const carte = () => [
  ...document.querySelectorAll<HTMLElement>('section[aria-labelledby^="tc-piano-"]'),
];
const carta = (nome: string) =>
  carte().find((c) => c.querySelector('h3')?.textContent?.startsWith(nome))!;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-12-01T10:00:00Z'));
  caricaAbbonamento.mockReset();
  caricaContestoOfficina.mockReset();
  segnalaErrore.mockReset();
  caricaContestoOfficina.mockResolvedValue(contesto('TITOLARE'));
  caricaAbbonamento.mockResolvedValue(abbonamento());
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('abbonamento (titolare): permessi e caricamento', () => {
  it('l’operatore vede solo il messaggio e l’abbonamento non viene letto', async () => {
    caricaContestoOfficina.mockResolvedValue(contesto('OPERATORE'));
    await monta();
    expect(document.querySelector('.tc-contenuto p')?.textContent).toBe(
      "Solo il titolare vede l'abbonamento.",
    );
    expect(caricaAbbonamento).not.toHaveBeenCalled();
    expect(avviso()).toBeNull();
    expect(carte()).toHaveLength(0);
  });

  it('un errore di caricamento mostra il messaggio generico e lo segnala', async () => {
    caricaContestoOfficina.mockRejectedValue(new Error('rete'));
    await monta();
    expect(document.querySelector('[role="alert"]')?.textContent?.trim()).toBe(
      'Non riusciamo a caricare i tuoi dati. Controlla la connessione e riprova.',
    );
    expect(segnalaErrore).toHaveBeenCalledTimes(1);
    expect(avviso()).toBeNull();
  });

  it('senza abbonamento avvisa e mostra comunque i prezzi senza «Il tuo piano»', async () => {
    caricaAbbonamento.mockResolvedValue(null);
    await monta();
    expect(document.querySelector('#tc-attuale')!.parentElement!.textContent).toContain(
      "Non troviamo l'abbonamento della tua officina: scrivici e lo sistemiamo.",
    );
    expect(avviso()).toBeNull();
    expect(carte()).toHaveLength(2);
    expect(document.body.textContent).not.toContain('Il tuo piano');
  });
});

describe('abbonamento (titolare): avviso per stato', () => {
  it('PROVA con 3 giorni rimasti: giallo e titolo con i giorni', async () => {
    caricaAbbonamento.mockResolvedValue(
      abbonamento({
        stato: 'PROVA',
        prova_fino_al: '2026-12-03',
        scade_il: null,
        iniziato_il: null,
      }),
    );
    await monta();
    expect(avviso().querySelector('p')?.textContent).toBe('Prova gratuita: mancano 3 giorni');
    expect(avviso().className).toContain('tc-avviso--giallo');
    expect(avviso().classList.contains('tc-avviso--verde')).toBe(false);
    expect(avviso().classList.contains('tc-avviso--rosso')).toBe(false);
    expect(avviso().textContent).toContain('fino al 3 dicembre 2026');
  });

  it('ATTIVO lontano dalla scadenza: verde e data di scadenza', async () => {
    await monta();
    expect(avviso().querySelector('p')?.textContent).toBe(
      'Abbonamento attivo fino al 31 marzo 2027',
    );
    expect(avviso().classList.contains('tc-avviso--verde')).toBe(true);
  });

  it('SCADUTO: rosso e data di scadenza', async () => {
    caricaAbbonamento.mockResolvedValue(abbonamento({ stato: 'SCADUTO', scade_il: '2026-11-30' }));
    await monta();
    expect(avviso().querySelector('p')?.textContent).toBe(
      'Abbonamento scaduto il 30 novembre 2026',
    );
    expect(avviso().classList.contains('tc-avviso--rosso')).toBe(true);
  });

  it('SOSPESO: rosso', async () => {
    caricaAbbonamento.mockResolvedValue(abbonamento({ stato: 'SOSPESO' }));
    await monta();
    expect(avviso().querySelector('p')?.textContent).toBe('Abbonamento sospeso');
    expect(avviso().classList.contains('tc-avviso--rosso')).toBe(true);
  });
});

describe('abbonamento (titolare): prezzi e contatto', () => {
  it('le due carte mostrano il prezzo di listino', async () => {
    await monta();
    expect(carte()).toHaveLength(2);
    expect(carta('Mensile').querySelector('.tc-officine__piano-prezzo')?.textContent).toBe(
      '100 €/mese',
    );
    expect(carta('Annuale').querySelector('.tc-officine__piano-prezzo')?.textContent).toBe(
      '1000 €/anno',
    );
    expect(carta('Annuale').textContent).toContain('2 mesi gratis');
  });

  it('«Il tuo piano» compare una volta sola, sulla carta del piano attuale', async () => {
    caricaAbbonamento.mockResolvedValue(abbonamento({ piano: 'ANNUALE' }));
    await monta();
    expect(document.body.textContent!.match(/Il tuo piano/g)).toHaveLength(1);
    expect(carta('Annuale').textContent).toContain('Il tuo piano');
    expect(carta('Mensile').textContent).not.toContain('Il tuo piano');
  });

  it('l’indirizzo di contatto è quello di TyreCare, nel testo e nel link', async () => {
    await monta();
    expect(CONTATTO_EMAIL).toBe('info@tyrecare.it');
    expect(document.body.textContent).toContain(CONTATTO_EMAIL);
    const link = document.querySelector<HTMLAnchorElement>('a[data-contatta]')!;
    expect(link.getAttribute('href')!.startsWith(`mailto:${CONTATTO_EMAIL}?subject=`)).toBe(true);
    expect(decodeURIComponent(link.getAttribute('href')!)).toContain(
      `scrivo per l'abbonamento di ${RAGIONE_SOCIALE}.`,
    );
  });
});

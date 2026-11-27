// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formattaTarga, SOGLIE_BATTISTRADA_MM } from '@tyrecare/shared';
import { messaggioErrore } from '../lib/auth';
import type * as M_notifiche from '../lib/notifiche';
import type * as M_profilo from '../lib/profilo';
import { linkReport, type MisuraReport, type Report } from '../lib/report';
import type * as M_report from '../lib/report';
import type * as M_router from '../lib/router';
import {
  ETICHETTE_USURA,
  POSIZIONI,
  conData,
  formattaData,
  formattaDecimale,
  formattaKm,
} from './comune';

const { caricaReport, creaLinkReport, revocaLinkReport } = vi.hoisted(() => ({
  caricaReport: vi.fn(),
  creaLinkReport: vi.fn(),
  revocaLinkReport: vi.fn(),
}));
const { caricaDatiUtente } = vi.hoisted(() => ({ caricaDatiUtente: vi.fn() }));
const { notificheNonLette, segnaLette } = vi.hoisted(() => ({
  notificheNonLette: vi.fn(),
  segnaLette: vi.fn(),
}));
const { mostraPagina } = vi.hoisted(() => ({ mostraPagina: vi.fn() }));

// Si fingono letture e scritture: linkReport, linkWhatsApp e GIORNI_LINK_REPORT restano veri
vi.mock('../lib/report', async (importOriginal) => ({
  ...(await importOriginal<typeof M_report>()),
  caricaReport,
  creaLinkReport,
  revocaLinkReport,
}));
vi.mock('../lib/profilo', async (importOriginal) => ({
  ...(await importOriginal<typeof M_profilo>()),
  caricaDatiUtente,
}));
vi.mock('../lib/notifiche', async (importOriginal) => ({
  ...(await importOriginal<typeof M_notifiche>()),
  notificheNonLette,
  segnaLette,
}));
vi.mock('../lib/router', async (importOriginal) => ({
  ...(await importOriginal<typeof M_router>()),
  visualizzazioneCorrente: () => 1,
  ancoraAttuale: () => true,
  mostraPagina,
}));
vi.mock('../lib/supabase', () => ({ getSupabase: () => ({}), chiaveSessione: () => 'chiave' }));

import { htmlReport, mostraReport } from './report';

const ID_CONTROLLO = '33333333-3333-4333-8333-333333333333';
const ID_OFFICINA = '22222222-2222-4222-8222-222222222222';
const ID_VEICOLO = '44444444-4444-4444-8444-444444444444';
const TARGA = 'AB123CD';
const CODICE = 'codice-segreto-1';

const CLIENTE = { membro: false, pubblico: false };
const OFFICINA = { membro: true, pubblico: false };
const PUBBLICO = { membro: false, pubblico: true };

type Posizione = MisuraReport['pneumatico']['posizione'];

/** Una misura; l'id dello pneumatico deriva dalla posizione, così i link si riconoscono. */
const misura = (
  posizione: Posizione,
  battistrada: number,
  extra: Partial<MisuraReport> = {},
  stagione: 'ESTIVO' | 'INVERNALE' = 'ESTIVO',
): MisuraReport => ({
  battistrada_mm: battistrada,
  pressione_bar: null,
  usura: null,
  danni: '',
  ...extra,
  pneumatico: {
    id: `p-${posizione}`,
    posizione,
    stagione,
    misura: '205/55 R16',
    marca: 'Pirelli',
    modello: `Cinturato ${posizione}`,
    dot: null,
    montato_il: '2025-03-10',
    smontato_il: '2025-03-10',
  },
});

// Fuori ordine di proposito. Con le soglie vere (limite 1,6; consigliato estivo 3, invernale 4):
// 5 mm estivo verde, 2,5 mm estivo giallo, 1,4 mm rosso, 3,5 mm invernale giallo, 4 mm invernale verde
const quattroRuote = (): MisuraReport[] => [
  misura('POST_DX', 3.5, {}, 'INVERNALE'),
  misura('ANT_SX', 5, { pressione_bar: 2.2, usura: 'INTERNA', danni: 'Taglio sul fianco' }),
  misura('POST_SX', 1.4),
  misura('ANT_DX', 2.5),
];

const report = (misure: MisuraReport[] = quattroRuote(), note = ''): Report => ({
  id: ID_CONTROLLO,
  officina_id: ID_OFFICINA,
  eseguito_il: '2026-11-20',
  km: 45200,
  note,
  veicolo: {
    id: ID_VEICOLO,
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
  misure,
});

const disegna = (r: Report, opzioni: { membro: boolean; pubblico: boolean }) => {
  document.body.innerHTML = `<div id="app">${htmlReport(r, opzioni)}</div>`;
  return document.getElementById('app')!;
};

const carte = () => [...document.querySelectorAll<HTMLElement>('.tc-ruota')];
const carta = (posizione: Posizione) => {
  const trovata = carte().find(
    (c) => c.querySelector('h3')?.textContent === POSIZIONI[posizione].nome,
  );
  if (!trovata) throw new Error(`Carta non trovata: ${posizione}`);
  return trovata;
};
const dati = (c: HTMLElement) =>
  Object.fromEntries(
    [...c.querySelectorAll('dl > div')].map((d) => [
      d.querySelector('dt')!.textContent,
      d.querySelector('dd')!.textContent,
    ]),
  );
const badge = (c: HTMLElement) => c.querySelector('.tc-stato')!.textContent;
const link = (nome: string) =>
  [...document.querySelectorAll<HTMLAnchorElement>('a')].find((a) => a.textContent?.includes(nome));
const pulsante = (nome: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
    b.textContent?.includes(nome),
  );
const linkSalute = () => document.querySelectorAll('a[href^="/pneumatico?id="]');

describe('htmlReport: carte delle ruote', () => {
  it('una carta per ruota, nell’ordine delle posizioni anche con misure fuori ordine', () => {
    disegna(report([...quattroRuote(), misura('SCORTA', 4, {}, 'INVERNALE')]), CLIENTE);
    expect(carte().map((c) => c.querySelector('h3')!.textContent)).toEqual([
      'Anteriore sinistro',
      'Anteriore destro',
      'Posteriore sinistro',
      'Posteriore destro',
      'Ruota di scorta',
    ]);
  });

  it('battistrada con «mm» e badge di stato secondo le soglie e la stagione', () => {
    expect(SOGLIE_BATTISTRADA_MM.limiteLegale).toBe(1.6);
    expect(SOGLIE_BATTISTRADA_MM.consigliato.ESTIVO).toBe(3);
    expect(SOGLIE_BATTISTRADA_MM.consigliato.INVERNALE).toBe(4);
    disegna(report([...quattroRuote(), misura('SCORTA', 4, {}, 'INVERNALE')]), CLIENTE);
    const atteso: [Posizione, number, string][] = [
      ['ANT_SX', 5, 'In buono stato'],
      ['ANT_DX', 2.5, 'Da controllare'],
      ['POST_SX', 1.4, 'Da sostituire'],
      ['POST_DX', 3.5, 'Da controllare'],
      ['SCORTA', 4, 'In buono stato'],
    ];
    for (const [posizione, mm, stato] of atteso) {
      expect(dati(carta(posizione)).Battistrada).toBe(`${formattaDecimale(mm)} mm`);
      expect(badge(carta(posizione))).toBe(stato);
    }
  });

  it('pressione, usura e danni compaiono solo se presenti', () => {
    disegna(report(), CLIENTE);
    expect(dati(carta('ANT_SX'))).toEqual({
      Battistrada: `${formattaDecimale(5)} mm`,
      Pressione: `${formattaDecimale(2.2)} bar`,
      Usura: ETICHETTE_USURA.INTERNA,
      Danni: 'Taglio sul fianco',
    });
    expect(dati(carta('ANT_DX'))).toEqual({ Battistrada: `${formattaDecimale(2.5)} mm` });
  });

  it('nessuna misura: il testo che lo dice e nessuna carta', () => {
    disegna(report([]), CLIENTE);
    expect(document.querySelector('#tc-misure + p')?.textContent).toBe(
      'In questo controllo non sono state registrate misure.',
    );
    expect(carte()).toHaveLength(0);
  });

  it('intestazione con data, targa, auto e km', () => {
    disegna(report(), CLIENTE);
    expect(document.querySelector('h1')?.textContent?.trim()).toBe(formattaData('2026-11-20'));
    const dettagli = document.querySelector('.tc-hero__dettagli')!;
    expect(dettagli.querySelector('.tc-targa')?.textContent).toBe(formattaTarga(TARGA));
    expect(dettagli.textContent).toContain('Fiat Panda · 2019');
    expect(dettagli.textContent).toContain(formattaKm(45200));
  });

  it('le note con HTML si mostrano come testo', () => {
    disegna(report(quattroRuote(), 'Controllare <b>valvole</b>'), CLIENTE);
    const nota = document.getElementById('tc-note')!.nextElementSibling!;
    expect(nota.textContent).toBe('Controllare <b>valvole</b>');
    expect(nota.querySelector('b')).toBeNull();
  });

  it('senza note la sezione non c’è', () => {
    disegna(report(), CLIENTE);
    expect(document.getElementById('tc-note')).toBeNull();
  });
});

describe('htmlReport: cliente, officina, pubblico', () => {
  it('cliente: link «Stato di salute» per ogni ruota, torna al garage, niente condivisione', () => {
    disegna(report(), CLIENTE);
    for (const c of carte()) {
      const a = c.querySelector('a')!;
      expect(a.textContent).toContain('Stato di salute');
    }
    expect(carta('ANT_SX').querySelector('a')!.getAttribute('href')).toBe(
      '/pneumatico?id=p-ANT_SX',
    );
    expect(link('Torna al veicolo')!.getAttribute('href')).toBe(
      `/garage/veicolo?targa=${encodeURIComponent(TARGA)}`,
    );
    expect(pulsante('Condividi il report')).toBeUndefined();
    expect(link('Correggi o elimina')).toBeUndefined();
    expect(pulsante('Stampa o salva in PDF')).toBeDefined();
  });

  it('officina: torna alla scheda del veicolo, condivide e corregge', () => {
    disegna(report(), OFFICINA);
    expect(link('Torna al veicolo')!.getAttribute('href')).toBe(`/veicolo?id=${ID_VEICOLO}`);
    expect(pulsante('Condividi il report')).toBeDefined();
    expect(link('Correggi o elimina')!.getAttribute('href')).toBe(
      `/controllo/modifica?id=${ID_CONTROLLO}`,
    );
    expect(carta('ANT_SX').querySelector('a')!.getAttribute('href')).toBe(
      '/pneumatico?id=p-ANT_SX',
    );
  });

  it('pubblico: nessun link alle pagine con accesso, solo la descrizione dello pneumatico', () => {
    disegna(report(), PUBBLICO);
    expect(linkSalute()).toHaveLength(0);
    expect(document.body.textContent).not.toContain('Stato di salute dello pneumatico');
    expect(carta('ANT_SX').querySelector('a')).toBeNull();
    expect(carta('ANT_SX').querySelector('.tc-ruota__pneumatico')!.textContent).toBe(
      `Pirelli Cinturato ANT_SX · 205/55 R16 · Estivi · ${conData('dal', '2025-03-10')}`,
    );
    expect(link('Torna al veicolo')).toBeUndefined();
    expect(pulsante('Condividi il report')).toBeUndefined();
    expect(link('Correggi o elimina')).toBeUndefined();
    expect(pulsante('Stampa o salva in PDF')).toBeDefined();
  });

  it('pubblico: anche chi è membro non vede condivisione e correzione', () => {
    disegna(report(), { membro: true, pubblico: true });
    expect(pulsante('Condividi il report')).toBeUndefined();
    expect(link('Correggi o elimina')).toBeUndefined();
    expect(link('Torna al veicolo')).toBeUndefined();
  });

  it('non pubblico: i contagiri del cruscotto sono link, pubblico: immagini', () => {
    disegna(report(), CLIENTE);
    expect(document.querySelectorAll('.tc-cruscotto a[href^="/pneumatico?id="]')).toHaveLength(4);
    disegna(report(), PUBBLICO);
    expect(document.querySelectorAll('.tc-cruscotto a')).toHaveLength(0);
    expect(document.querySelectorAll('.tc-cruscotto [role="img"]')).toHaveLength(4);
  });
});

describe('mostraReport', () => {
  let stampa: ReturnType<typeof vi.spyOn>;
  const printOriginale = typeof window.print === 'function';
  const descrittoreAppunti = Object.getOwnPropertyDescriptor(navigator, 'clipboard');

  const monta = async (r: Report | null, { membro = false, id = ID_CONTROLLO } = {}) => {
    caricaReport.mockResolvedValue(r);
    caricaDatiUtente.mockResolvedValue({
      officine: membro ? [{ officina: { id: ID_OFFICINA } }] : [],
    });
    history.replaceState(null, '', `/controllo?id=${id}`);
    document.body.innerHTML = '<div id="app"></div>';
    await mostraReport(document.getElementById('app')!);
  };

  beforeEach(() => {
    for (const f of [
      caricaReport,
      creaLinkReport,
      revocaLinkReport,
      caricaDatiUtente,
      notificheNonLette,
      segnaLette,
      mostraPagina,
    ]) {
      f.mockReset();
    }
    notificheNonLette.mockReturnValue(0);
    segnaLette.mockResolvedValue(undefined);
    // happy-dom non ha window.print: se manca se ne mette uno vuoto da spiare, poi si toglie
    if (typeof window.print !== 'function') window.print = () => {};
    stampa = vi.spyOn(window, 'print').mockImplementation(() => {});
  });

  afterEach(() => {
    stampa.mockRestore();
    if (!printOriginale) Reflect.deleteProperty(window, 'print');
    if (descrittoreAppunti) Object.defineProperty(navigator, 'clipboard', descrittoreAppunti);
    else Reflect.deleteProperty(navigator, 'clipboard');
    document.body.innerHTML = '';
  });

  describe('caricamento', () => {
    it('id non valido: «Controllo non trovato» senza leggere il report', async () => {
      await monta(report(), { id: 'non-valido' });
      expect(document.querySelector('h1')?.textContent).toBe('Controllo non trovato');
      expect(caricaReport).not.toHaveBeenCalled();
    });

    it('report assente: «Controllo non trovato»', async () => {
      await monta(null);
      expect(caricaReport).toHaveBeenCalledExactlyOnceWith(ID_CONTROLLO);
      expect(document.querySelector('h1')?.textContent).toBe('Controllo non trovato');
      expect(segnaLette).not.toHaveBeenCalled();
    });

    it('report trovato: pagina disegnata e titolo del documento', async () => {
      await monta(report());
      expect(document.querySelector('h1')?.textContent?.trim()).toBe(formattaData('2026-11-20'));
      expect(document.title).toBe(`Controllo ${formattaTarga(TARGA)} 2026-11-20 · TyreCare`);
      expect(carte()).toHaveLength(4);
    });

    it('chi non è dell’officina del controllo è cliente, anche se è membro di un’altra', async () => {
      caricaDatiUtente.mockResolvedValue({
        officine: [{ officina: { id: '55555555-5555-4555-8555-555555555555' } }],
      });
      caricaReport.mockResolvedValue(report());
      history.replaceState(null, '', `/controllo?id=${ID_CONTROLLO}`);
      document.body.innerHTML = '<div id="app"></div>';
      await mostraReport(document.getElementById('app')!);
      expect(pulsante('Condividi il report')).toBeUndefined();
      expect(link('Torna al veicolo')!.getAttribute('href')).toBe(`/garage/veicolo?targa=${TARGA}`);
    });
  });

  describe('notifiche', () => {
    it('con notifiche non lette le segna lette per questo controllo, una volta', async () => {
      notificheNonLette.mockReturnValue(2);
      await monta(report());
      expect(segnaLette).toHaveBeenCalledExactlyOnceWith({ controllo: ID_CONTROLLO });
    });

    it('senza notifiche non lette non chiama segnaLette', async () => {
      notificheNonLette.mockReturnValue(0);
      await monta(report());
      expect(segnaLette).not.toHaveBeenCalled();
    });

    it('se segnaLette fallisce la pagina si disegna lo stesso', async () => {
      notificheNonLette.mockReturnValue(2);
      segnaLette.mockRejectedValue(new Error('rete'));
      await monta(report());
      await vi.waitFor(() => expect(segnaLette).toHaveBeenCalledTimes(1));
      expect(carte()).toHaveLength(4);
      expect(document.querySelector('[role="alert"]')).toBeNull();
    });
  });

  describe('stampa', () => {
    it('«Stampa o salva in PDF» chiama window.print', async () => {
      await monta(report());
      expect(stampa).not.toHaveBeenCalled();
      pulsante('Stampa o salva in PDF')!.click();
      expect(stampa).toHaveBeenCalledTimes(1);
    });
  });

  describe('condivisione', () => {
    const apri = () => pulsante('Condividi il report') as HTMLButtonElement;
    const campo = () => document.querySelector<HTMLInputElement>('#tc-link-report');
    const allerta = () => document.querySelector('[role="alert"]');

    const appunti = (scrivi: ReturnType<typeof vi.fn>) =>
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: scrivi },
        configurable: true,
      });

    it('il cliente non ha il pulsante «Condividi il report»', async () => {
      await monta(report(), { membro: false });
      expect(pulsante('Condividi il report')).toBeUndefined();
      expect(creaLinkReport).not.toHaveBeenCalled();
    });

    it('il membro crea il link, vede il campo e il pulsante si nasconde', async () => {
      creaLinkReport.mockResolvedValue(CODICE);
      await monta(report(), { membro: true });
      apri().click();
      await vi.waitFor(() => expect(campo()).not.toBeNull());
      expect(creaLinkReport).toHaveBeenCalledExactlyOnceWith(ID_CONTROLLO);
      expect(campo()!.value).toBe(linkReport(location.origin, CODICE));
      expect(document.querySelector('label[for="tc-link-report"]')?.textContent).toBe(
        'Link del report',
      );
      expect(apri().hidden).toBe(true);
    });

    it('«Copia il link» copia il link e lo dice', async () => {
      creaLinkReport.mockResolvedValue(CODICE);
      const scrivi = vi.fn().mockResolvedValue(undefined);
      appunti(scrivi);
      await monta(report(), { membro: true });
      apri().click();
      await vi.waitFor(() => expect(pulsante('Copia il link')).toBeDefined());
      pulsante('Copia il link')!.click();
      await vi.waitFor(() =>
        expect(document.querySelector('[data-esito] [role="status"]')?.textContent?.trim()).toBe(
          'Link copiato.',
        ),
      );
      expect(scrivi).toHaveBeenCalledExactlyOnceWith(linkReport(location.origin, CODICE));
    });

    it('se gli appunti non ci sono il link resta nel campo, senza messaggi', async () => {
      creaLinkReport.mockResolvedValue(CODICE);
      const scrivi = vi.fn().mockRejectedValue(new Error('negato'));
      appunti(scrivi);
      await monta(report(), { membro: true });
      apri().click();
      await vi.waitFor(() => expect(pulsante('Copia il link')).toBeDefined());
      pulsante('Copia il link')!.click();
      await vi.waitFor(() => expect(scrivi).toHaveBeenCalledTimes(1));
      expect(document.querySelector('[data-esito]')!.textContent).toBe('');
      expect(campo()!.value).toBe(linkReport(location.origin, CODICE));
    });

    it.each([
      ['errore qualunque', new Error('boom')],
      ['errore di rete', new TypeError('Failed to fetch')],
    ])(
      '%s nella creazione: messaggio tradotto, avviso e pulsante riabilitato',
      async (_n, errore) => {
        creaLinkReport.mockRejectedValue(errore);
        await monta(report(), { membro: true });
        apri().click();
        await vi.waitFor(() => expect(allerta()).not.toBeNull());
        expect(allerta()!.textContent?.trim()).toBe(messaggioErrore(errore));
        expect(apri().disabled).toBe(false);
        expect(apri().hidden).toBe(false);
        expect(campo()).toBeNull();
      },
    );

    it('«Disattiva i link» revoca, lo dice e il pulsante torna visibile', async () => {
      creaLinkReport.mockResolvedValue(CODICE);
      revocaLinkReport.mockResolvedValue(undefined);
      await monta(report(), { membro: true });
      apri().click();
      await vi.waitFor(() => expect(pulsante('Disattiva i link')).toBeDefined());
      pulsante('Disattiva i link')!.click();
      await vi.waitFor(() => expect(campo()).toBeNull());
      expect(revocaLinkReport).toHaveBeenCalledExactlyOnceWith(ID_CONTROLLO);
      expect(
        document.querySelector('[data-riquadro-condivisione] [role="status"]')?.textContent?.trim(),
      ).toBe('Link disattivati.');
      expect(apri().hidden).toBe(false);
      expect(apri().disabled).toBe(false);
    });

    it('errore nella revoca: avviso, link ancora visibile e «Disattiva i link» riabilitato', async () => {
      creaLinkReport.mockResolvedValue(CODICE);
      const errore = new Error('boom');
      revocaLinkReport.mockRejectedValue(errore);
      await monta(report(), { membro: true });
      apri().click();
      await vi.waitFor(() => expect(pulsante('Disattiva i link')).toBeDefined());
      pulsante('Disattiva i link')!.click();
      await vi.waitFor(() => expect(allerta()).not.toBeNull());
      expect(allerta()!.textContent?.trim()).toBe(messaggioErrore(errore));
      expect((pulsante('Disattiva i link') as HTMLButtonElement).disabled).toBe(false);
      expect(campo()!.value).toBe(linkReport(location.origin, CODICE));
      expect(apri().hidden).toBe(true);
    });
  });
});

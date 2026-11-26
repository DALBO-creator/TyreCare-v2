// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as M_calendario from '../lib/calendario';
import type * as M_officina from '../lib/officina';
import type * as M_orari from '../lib/orari';
import type * as M_router from '../lib/router';
import type * as M_comune from './comune';

const { caricaOrariECapienza, caricaSettimana, caricaChiusure, caricaContestoOfficina } =
  vi.hoisted(() => ({
    caricaOrariECapienza: vi.fn(),
    caricaSettimana: vi.fn(),
    caricaChiusure: vi.fn(),
    caricaContestoOfficina: vi.fn(),
  }));
const { gestisciErroreCaricamento, mostraPagina } = vi.hoisted(() => ({
  gestisciErroreCaricamento: vi.fn(),
  mostraPagina: vi.fn(),
}));

// Si fingono solo le letture: le funzioni pure (giorniSettimana, lunediDi, agendaDelGiorno…) restano vere
vi.mock('../lib/calendario', async (importOriginal) => ({
  ...(await importOriginal<typeof M_calendario>()),
  caricaOrariECapienza,
  caricaSettimana,
}));
vi.mock('../lib/officina', async (importOriginal) => ({
  ...(await importOriginal<typeof M_officina>()),
  caricaContestoOfficina,
}));
vi.mock('../lib/orari', async (importOriginal) => ({
  ...(await importOriginal<typeof M_orari>()),
  caricaChiusure,
}));
vi.mock('../lib/router', async (importOriginal) => ({
  ...(await importOriginal<typeof M_router>()),
  visualizzazioneCorrente: () => 1,
  ancoraAttuale: () => true,
  mostraPagina,
}));
vi.mock('../lib/supabase', () => ({ getSupabase: () => ({}), chiaveSessione: () => 'chiave' }));
// `parametro` resta vero: legge `location.search`
vi.mock('./comune', async (importOriginal) => ({
  ...(await importOriginal<typeof M_comune>()),
  gestisciErroreCaricamento,
}));

import { mostraCalendario, selettoreVista } from './calendario';

const ID_OFFICINA = '22222222-2222-4222-8222-222222222222';
// Giovedì 26 novembre 2026, le 11:00 in Italia (10:00 UTC): lontano dalla mezzanotte
const ORA_FISSATA = new Date('2026-11-26T10:00:00Z');

// Lun–ven mattina e pomeriggio, sabato solo mattina, domenica chiuso (nessuna chiave)
const ORARI = {
  lun: [
    ['08:30', '12:30'],
    ['14:30', '19:00'],
  ],
  mar: [
    ['08:30', '12:30'],
    ['14:30', '19:00'],
  ],
  mer: [
    ['08:30', '12:30'],
    ['14:30', '19:00'],
  ],
  gio: [
    ['08:30', '12:30'],
    ['14:30', '19:00'],
  ],
  ven: [
    ['08:30', '12:30'],
    ['14:30', '19:00'],
  ],
  sab: [['08:30', '12:30']],
};

const prenotazione = (dati: Record<string, unknown> = {}) => ({
  id: 'p-1',
  stato: 'CONFERMATA',
  giorno: '2026-11-24',
  fascia: 'MATTINA',
  // 08:30 UTC = 09:30 in Italia (ora solare)
  appuntamento: '2026-11-24T08:30:00Z',
  servizio: 'Cambio gomme',
  nome_cliente: 'Mario Rossi',
  targa: 'AB123CD',
  ...dati,
});

const chiusura = (dal: string, al: string, motivo: string) => ({
  id: 'c-1',
  officina_id: ID_OFFICINA,
  dal,
  al,
  motivo,
  created_at: '2026-11-01T00:00:00Z',
});

const monta = async (query = '') => {
  history.replaceState(null, '', `/appuntamenti/calendario${query}`);
  document.body.innerHTML = '<div id="app"></div>';
  await mostraCalendario(document.getElementById('app')!);
};

const testo = (el: Element | null | undefined) => el?.textContent?.replace(/\s+/g, ' ').trim();
const titolo = () => testo(document.querySelector('.tc-settimana__titolo'));
const giornoBtn = (d: string) => document.querySelector<HTMLButtonElement>(`[data-giorno="${d}"]`)!;
const agenda = () => document.querySelector('.tc-agenda')!;
const titoloAgenda = () => testo(document.querySelector('.tc-agenda__giorno'));
const frecciaPrima = () =>
  document.querySelector<HTMLElement>('[aria-label="Settimana precedente"]')!;
const frecciaDopo = () =>
  document.querySelector<HTMLElement>('[aria-label="Settimana successiva"]')!;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(ORA_FISSATA);
  for (const f of [
    caricaOrariECapienza,
    caricaSettimana,
    caricaChiusure,
    caricaContestoOfficina,
    gestisciErroreCaricamento,
    mostraPagina,
  ]) {
    f.mockReset();
  }
  caricaContestoOfficina.mockResolvedValue({
    attiva: { officina: { id: ID_OFFICINA, ragione_sociale: 'Gomme Rossi' } },
  });
  caricaOrariECapienza.mockResolvedValue({ orari: ORARI, capienza: null });
  caricaSettimana.mockResolvedValue([]);
  caricaChiusure.mockResolvedValue([]);
  gestisciErroreCaricamento.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('calendario: settimana mostrata', () => {
  it('senza ?giorno= è la settimana di oggi, con oggi selezionato', async () => {
    await monta();
    expect(titolo()).toBe('23 – 29 novembre');
    expect(testo(document.querySelector('.tc-etichetta'))).toBe('Appuntamenti · Gomme Rossi');
    expect(giornoBtn('2026-11-26').getAttribute('aria-pressed')).toBe('true');
    expect(giornoBtn('2026-11-26').classList.contains('tc-settimana__giorno--oggi')).toBe(true);
    expect(caricaSettimana).toHaveBeenCalledExactlyOnceWith(ID_OFFICINA, '2026-11-23');
    expect(caricaChiusure).toHaveBeenCalledExactlyOnceWith(ID_OFFICINA, '2026-11-23');
  });

  it('con ?giorno= valido è la settimana di quel giorno', async () => {
    await monta('?giorno=2026-10-14');
    expect(titolo()).toBe('12 – 18 ottobre');
    expect(giornoBtn('2026-10-14').getAttribute('aria-pressed')).toBe('true');
    expect(giornoBtn('2026-11-26')).toBeNull();
    expect(titoloAgenda()).toBe('Mercoledì 14 ottobre');
    expect(caricaSettimana).toHaveBeenCalledExactlyOnceWith(ID_OFFICINA, '2026-10-12');
  });

  it('una settimana a cavallo di mese mostra entrambi i mesi', async () => {
    await monta('?giorno=2026-10-28');
    expect(titolo()).toBe('26 ottobre – 1 novembre');
  });

  it('con ?giorno= non valido si usa oggi', async () => {
    await monta('?giorno=ieri');
    expect(titolo()).toBe('23 – 29 novembre');
    expect(titoloAgenda()).toBe('Giovedì 26 novembre · oggi');
    expect(caricaSettimana).toHaveBeenCalledExactlyOnceWith(ID_OFFICINA, '2026-11-23');
  });

  it('«Torna a oggi» compare solo se non si guarda oggi', async () => {
    await monta();
    expect(document.querySelector('[data-oggi]')).toBeNull();
    await monta('?giorno=2026-11-24');
    expect(testo(document.querySelector('[data-oggi]'))).toBe('Torna a oggi');
  });
});

describe('calendario: agenda del giorno', () => {
  it('un appuntamento confermato compare nel suo giorno con ora e servizio', async () => {
    caricaSettimana.mockResolvedValue([prenotazione()]);
    await monta('?giorno=2026-11-24');
    const riga = agenda().querySelector<HTMLAnchorElement>('a.tc-agenda__riga')!;
    expect(riga.getAttribute('href')).toBe('/appuntamento?id=p-1');
    expect(testo(riga.querySelector('.tc-agenda__ora'))).toBe('9:30');
    expect(testo(riga.querySelector('.tc-lista__testo'))).toBe(
      'Cambio gomme Mario Rossi · AB 123 CD',
    );
    expect(testo(riga.querySelector('.tc-stato'))).toBe('Confermato');
    expect(agenda().querySelectorAll('a.tc-agenda__riga')).toHaveLength(1);
    // Il giorno con l'appuntamento ha il contatore; gli altri no
    expect(giornoBtn('2026-11-24').getAttribute('aria-label')).toBe(
      'Martedì 24 novembre: 1 appuntamento',
    );
    expect(testo(giornoBtn('2026-11-24').querySelector('.tc-settimana__conta'))).toBe('1');
    expect(giornoBtn('2026-11-25').getAttribute('aria-label')).toBe(
      'Mercoledì 25 novembre: 0 appuntamenti',
    );
  });

  it('lo stesso appuntamento non compare negli altri giorni della settimana', async () => {
    caricaSettimana.mockResolvedValue([prenotazione()]);
    await monta('?giorno=2026-11-25');
    expect(agenda().querySelectorAll('a.tc-agenda__riga')).toHaveLength(0);
  });

  it('giorno aperto senza appuntamenti: blocco «Nessun appuntamento» con il suo testo', async () => {
    await monta('?giorno=2026-11-24');
    const vuoto = agenda().querySelector('.tc-vuoto')!;
    expect(testo(vuoto.querySelector('.tc-vuoto__titolo'))).toBe('Nessun appuntamento');
    expect(testo(vuoto.querySelector('.tc-vuoto__testo'))).toBe(
      'Le richieste dei clienti per questo giorno compaiono qui.',
    );
    expect(agenda().querySelector('.tc-agenda__libero')).toBeNull();
    expect(testo(agenda().querySelector('.tc-agenda__orari'))).toBe(
      'Aperto 8:30–12:30, 14:30–19:00',
    );
  });

  it('con appuntamenti solo al mattino, il pomeriggio aperto dice «Nessun appuntamento»', async () => {
    caricaSettimana.mockResolvedValue([prenotazione()]);
    await monta('?giorno=2026-11-24');
    expect(agenda().querySelector('.tc-vuoto')).toBeNull();
    const sezioni = [...agenda().querySelectorAll('section')];
    expect(sezioni.map((s) => testo(s.querySelector('h3')))).toEqual(['Mattina', 'Pomeriggio']);
    expect(sezioni[0]!.querySelector('.tc-agenda__libero')).toBeNull();
    expect(testo(sezioni[1]!.querySelector('.tc-agenda__libero'))).toBe('Nessun appuntamento');
  });

  it('con la capienza, ogni fascia mostra le richieste occupate', async () => {
    caricaOrariECapienza.mockResolvedValue({ orari: ORARI, capienza: 1 });
    caricaSettimana.mockResolvedValue([prenotazione()]);
    await monta('?giorno=2026-11-24');
    const intestazioni = [...agenda().querySelectorAll('h3')].map((h) => testo(h));
    expect(intestazioni).toEqual([
      'Mattina · 1 su 1 richieste · piena',
      'Pomeriggio · 0 su 1 richieste',
    ]);
  });

  it('una chiusura straordinaria segna il giorno e ne scrive il motivo nell’agenda', async () => {
    caricaChiusure.mockResolvedValue([chiusura('2026-11-25', '2026-11-25', 'Ferie')]);
    await monta('?giorno=2026-11-25');
    const btn = giornoBtn('2026-11-25');
    expect(btn.classList.contains('tc-settimana__giorno--chiuso')).toBe(true);
    expect(btn.getAttribute('aria-label')).toBe('Mercoledì 25 novembre: 0 appuntamenti, chiuso');
    expect(testo(agenda().querySelector('.tc-agenda__orari'))).toBe('Chiuso: ferie');
    // Chiuso e senza appuntamenti: né blocco vuoto né fasce
    expect(agenda().querySelector('.tc-vuoto')).toBeNull();
    expect(agenda().querySelectorAll('section')).toHaveLength(0);
    // I giorni vicini restano aperti
    expect(giornoBtn('2026-11-24').classList.contains('tc-settimana__giorno--chiuso')).toBe(false);
    expect(giornoBtn('2026-11-24').getAttribute('aria-label')).toBe(
      'Martedì 24 novembre: 0 appuntamenti',
    );
  });

  it('una chiusura senza motivo dice solo «Chiuso»', async () => {
    caricaChiusure.mockResolvedValue([chiusura('2026-11-25', '2026-11-25', '')]);
    await monta('?giorno=2026-11-25');
    expect(testo(agenda().querySelector('.tc-agenda__orari'))).toBe('Chiuso');
  });

  it('un giorno senza orari (domenica) è segnato chiuso anche senza chiusura straordinaria', async () => {
    await monta('?giorno=2026-11-29');
    expect(giornoBtn('2026-11-29').classList.contains('tc-settimana__giorno--chiuso')).toBe(true);
    expect(giornoBtn('2026-11-29').getAttribute('aria-label')).toBe(
      'Domenica 29 novembre: 0 appuntamenti, chiuso',
    );
    expect(testo(agenda().querySelector('.tc-agenda__orari'))).toBe('Chiuso');
  });
});

describe('calendario: cambio di giorno e di settimana', () => {
  it('un giorno della stessa settimana ridisegna senza ricaricare', async () => {
    caricaSettimana.mockResolvedValue([prenotazione()]);
    await monta();
    giornoBtn('2026-11-24').click();
    await vi.waitFor(() => expect(titoloAgenda()).toBe('Martedì 24 novembre'));
    expect(caricaSettimana).toHaveBeenCalledTimes(1);
    expect(caricaChiusure).toHaveBeenCalledTimes(1);
    expect(location.search).toBe('?giorno=2026-11-24');
    expect(giornoBtn('2026-11-24').getAttribute('aria-pressed')).toBe('true');
    expect(giornoBtn('2026-11-26').getAttribute('aria-pressed')).toBe('false');
    expect(testo(agenda().querySelector('.tc-agenda__ora'))).toBe('9:30');
  });

  it('«Settimana successiva» carica la settimana dopo (lunedì giusto) e aggiorna l’indirizzo', async () => {
    await monta();
    frecciaDopo().click();
    await vi.waitFor(() => expect(titolo()).toBe('30 novembre – 6 dicembre'));
    expect(caricaSettimana).toHaveBeenLastCalledWith(ID_OFFICINA, '2026-11-30');
    expect(caricaChiusure).toHaveBeenLastCalledWith(ID_OFFICINA, '2026-11-30');
    expect(caricaSettimana).toHaveBeenCalledTimes(2);
    expect(location.search).toBe('?giorno=2026-12-03');
    expect(giornoBtn('2026-12-03').getAttribute('aria-pressed')).toBe('true');
    expect(testo(document.querySelector('[data-oggi]'))).toBe('Torna a oggi');
  });

  it('«Settimana precedente» carica la settimana prima', async () => {
    await monta();
    frecciaPrima().click();
    await vi.waitFor(() => expect(titolo()).toBe('16 – 22 novembre'));
    expect(caricaSettimana).toHaveBeenLastCalledWith(ID_OFFICINA, '2026-11-16');
    expect(caricaChiusure).toHaveBeenLastCalledWith(ID_OFFICINA, '2026-11-16');
    expect(location.search).toBe('?giorno=2026-11-19');
  });

  it('«Torna a oggi» da un’altra settimana ricarica quella di oggi', async () => {
    await monta('?giorno=2026-10-14');
    document.querySelector<HTMLElement>('[data-oggi]')!.click();
    await vi.waitFor(() => expect(titolo()).toBe('23 – 29 novembre'));
    expect(caricaSettimana).toHaveBeenLastCalledWith(ID_OFFICINA, '2026-11-23');
    expect(location.search).toBe('?giorno=2026-11-26');
  });
});

describe('calendario: errori di caricamento', () => {
  it('se il contesto dell’officina non si carica, chiama gestisciErroreCaricamento', async () => {
    const errore = new Error('rete');
    caricaContestoOfficina.mockRejectedValue(errore);
    await monta();
    expect(gestisciErroreCaricamento).toHaveBeenCalledExactlyOnceWith(
      document.getElementById('app'),
      1,
      errore,
    );
    expect(document.querySelector('.tc-settimana')).toBeNull();
  });

  it('se la settimana non si carica, chiama gestisciErroreCaricamento', async () => {
    const errore = new Error('rete');
    caricaSettimana.mockRejectedValue(errore);
    await monta();
    expect(gestisciErroreCaricamento).toHaveBeenCalledExactlyOnceWith(
      document.getElementById('app'),
      1,
      errore,
    );
  });

  it('se la settimana nuova non si carica al cambio, chiama gestisciErroreCaricamento', async () => {
    await monta();
    const errore = new Error('rete');
    caricaSettimana.mockRejectedValue(errore);
    frecciaDopo().click();
    await vi.waitFor(() => expect(gestisciErroreCaricamento).toHaveBeenCalledTimes(1));
    expect(gestisciErroreCaricamento).toHaveBeenCalledWith(
      document.getElementById('app'),
      1,
      errore,
    );
  });
});

describe('selettoreVista', () => {
  const voci = (attiva: 'calendario' | 'elenco') => {
    document.body.innerHTML = selettoreVista(attiva);
    return [...document.querySelectorAll('a.tc-vista__voce')].map((a) => ({
      testo: testo(a),
      href: a.getAttribute('href'),
      corrente: a.getAttribute('aria-current'),
    }));
  };

  it('con «calendario» attiva, solo il calendario ha aria-current', () => {
    expect(voci('calendario')).toEqual([
      { testo: 'Calendario', href: '/appuntamenti/calendario', corrente: 'page' },
      { testo: 'Elenco', href: '/appuntamenti', corrente: null },
    ]);
  });

  it('con «elenco» attiva, solo l’elenco ha aria-current', () => {
    expect(voci('elenco')).toEqual([
      { testo: 'Calendario', href: '/appuntamenti/calendario', corrente: null },
      { testo: 'Elenco', href: '/appuntamenti', corrente: 'page' },
    ]);
  });

  it('la pagina segna attiva la vista del calendario', async () => {
    await monta();
    const attive = document.querySelectorAll('.tc-vista [aria-current="page"]');
    expect(attive).toHaveLength(1);
    expect(testo(attive[0])).toBe('Calendario');
  });
});

// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as M_dati_officina from '../lib/dati-officina';
import type * as M_officina from '../lib/officina';
import type * as M_comune from './comune';

// Le icone creano SVG con `document`: qui bastano segnaposto
vi.mock('../ui/icone', () => ({ icona: () => '<svg></svg>' }));

const { caricaContestoOfficina, caricaDatiOfficina, salvaDatiOfficina, vaiConConferma } =
  vi.hoisted(() => ({
    caricaContestoOfficina: vi.fn(),
    caricaDatiOfficina: vi.fn(),
    salvaDatiOfficina: vi.fn(),
    vaiConConferma: vi.fn(),
  }));

// Si fingono le letture e la scrittura: eTitolare, testoPosizione e statoCasella restano vere
vi.mock('../lib/officina', async (importOriginal) => ({
  ...(await importOriginal<typeof M_officina>()),
  caricaContestoOfficina,
}));
vi.mock('../lib/dati-officina', async (importOriginal) => ({
  ...(await importOriginal<typeof M_dati_officina>()),
  caricaDatiOfficina,
  salvaDatiOfficina,
}));
vi.mock('../lib/router', () => ({
  visualizzazioneCorrente: () => 1,
  ancoraAttuale: () => true,
}));
vi.mock('./comune', async (importOriginal) => ({
  ...(await importOriginal<typeof M_comune>()),
  vaiConConferma,
}));
vi.mock('../lib/supabase', () => ({ getSupabase: () => ({}), chiaveSessione: () => 'chiave' }));

import { RAGGIO_MAX_KM, RAGGIO_MIN_KM } from '../lib/strada-officina';
import { mostraDatiOfficina } from './dati-officina';

const ID_OFFICINA = '22222222-2222-4222-8222-222222222222';

const datiFinti = (extra: Record<string, unknown> = {}) => ({
  ragione_sociale: 'Gomme Rossi Srl',
  partita_iva: '12345678901',
  indirizzo: 'Via Roma 1',
  cap: '10100',
  citta: 'Torino',
  provincia: 'TO',
  telefono: '+39 011 1234567',
  email: 'info@gommerossi.it',
  latitudine: 45.070312,
  longitudine: 7.686856,
  intervento_strada: true,
  raggio_strada_km: 25,
  ...extra,
});

const contesto = (ruolo: 'TITOLARE' | 'OPERATORE') => ({
  attiva: { officina: { id: ID_OFFICINA, ragione_sociale: 'Gomme Rossi' } },
  officine: [{ ruolo, officina: { id: ID_OFFICINA, ragione_sociale: 'Gomme Rossi' } }],
});

const monta = async (ruolo: 'TITOLARE' | 'OPERATORE', dati = datiFinti()) => {
  caricaContestoOfficina.mockResolvedValue(contesto(ruolo));
  caricaDatiOfficina.mockResolvedValue(dati);
  document.body.innerHTML = '<div id="app"></div>';
  await mostraDatiOfficina(document.getElementById('app')!);
  // Pagina già disegnata (dritta T145): l'intestazione c'è prima di controllare le assenze
  expect(document.querySelector('h1')?.textContent).toBe("Dati dell'officina");
};

const campoDi = (nome: string) => document.querySelector<HTMLInputElement>(`[name="${nome}"]`)!;
const scrivi = (nome: string, valore: string) => {
  const el = campoDi(nome);
  el.value = valore;
  el.dispatchEvent(new Event('input', { bubbles: true }));
};
const errore = (nome: string) => document.getElementById(`campo-${nome}-errore`)!;
const pulsantePosizione = () =>
  document.querySelector<HTMLButtonElement>('[data-posizione-attuale]')!;
const invia = () => document.querySelector('form')!.requestSubmit();
const geolocalizzazione = (getCurrentPosition: unknown) =>
  vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });

beforeEach(() => {
  for (const f of [caricaContestoOfficina, caricaDatiOfficina, salvaDatiOfficina, vaiConConferma]) {
    f.mockReset();
  }
  salvaDatiOfficina.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('dati dell’officina: chi la vede', () => {
  it('l’operatore vede solo l’avviso: niente modulo, niente «Salva dati», niente lettura dei dati', async () => {
    caricaContestoOfficina.mockResolvedValue(contesto('OPERATORE'));
    document.body.innerHTML = '<div id="app"></div>';
    await mostraDatiOfficina(document.getElementById('app')!);
    expect(document.querySelector('h1')?.textContent).toBe("Dati dell'officina");
    expect(document.querySelector('[role="status"]')?.textContent?.trim()).toBe(
      "Solo il titolare dell'officina può modificare i dati dell'officina.",
    );
    expect(document.querySelector('form')).toBeNull();
    expect(document.body.textContent).not.toContain('Salva dati');
    expect(caricaDatiOfficina).not.toHaveBeenCalled();
  });

  it('il titolare vede i campi riempiti e la nota sull’amministratore', async () => {
    await monta('TITOLARE');
    expect(campoDi('indirizzo').value).toBe('Via Roma 1');
    expect(campoDi('cap').value).toBe('10100');
    expect(campoDi('provincia').value).toBe('TO');
    expect(campoDi('citta').value).toBe('Torino');
    expect(campoDi('telefono').value).toBe('+39 011 1234567');
    expect(campoDi('email').value).toBe('info@gommerossi.it');
    expect(campoDi('posizione').value).toBe('45.070312, 7.686856');
    expect(campoDi('intervento_strada').checked).toBe(true);
    expect(campoDi('raggio_strada_km').value).toBe('25');
    expect(document.body.textContent).toContain('Gomme Rossi Srl');
    expect(document.body.textContent).toContain('Partita IVA 12345678901');
    expect(document.body.textContent).toContain(
      "Ragione sociale e partita IVA le cambia l'amministratore.",
    );
    expect(caricaDatiOfficina).toHaveBeenCalledExactlyOnceWith(ID_OFFICINA);
  });
});

describe('dati dell’officina: raggio e aiuto su strada', () => {
  it.each(['4', '101'])('il raggio %s km è fuori da 5–100: errore sul campo', async (valore) => {
    expect([RAGGIO_MIN_KM, RAGGIO_MAX_KM]).toEqual([5, 100]);
    await monta('TITOLARE');
    scrivi('raggio_strada_km', valore);
    invia();
    await vi.waitFor(() =>
      expect(errore('raggio_strada_km').textContent).toBe('Scrivi un numero intero da 5 a 100'),
    );
    expect(errore('raggio_strada_km').hidden).toBe(false);
    expect(campoDi('raggio_strada_km').getAttribute('aria-invalid')).toBe('true');
    expect(salvaDatiOfficina).not.toHaveBeenCalled();
  });

  it('senza posizione la casella è spenta e disattivata, con il suo testo; la posizione torna e la riattiva', async () => {
    await monta('TITOLARE');
    const aiuto = () => document.querySelector('[data-aiuto-strada]')!.textContent!.trim();
    expect(aiuto()).toContain('I clienti fermi con una gomma a terra');
    scrivi('posizione', '');
    expect(campoDi('intervento_strada').disabled).toBe(true);
    expect(campoDi('intervento_strada').checked).toBe(false);
    expect(aiuto()).toBe('Imposta prima la posizione');
    // La scelta dell'utente (spuntata) torna con la posizione leggibile
    scrivi('posizione', '45.1, 7.6');
    expect(campoDi('intervento_strada').disabled).toBe(false);
    expect(campoDi('intervento_strada').checked).toBe(true);
  });

  it('officina senza posizione salvata: casella disattivata e si salva senza aiuto su strada', async () => {
    await monta('TITOLARE', datiFinti({ latitudine: null, longitudine: null }));
    expect(campoDi('posizione').value).toBe('');
    expect(campoDi('intervento_strada').disabled).toBe(true);
    expect(campoDi('intervento_strada').checked).toBe(false);
    invia();
    await vi.waitFor(() => expect(salvaDatiOfficina).toHaveBeenCalledTimes(1));
    expect(salvaDatiOfficina.mock.calls[0]).toEqual([
      ID_OFFICINA,
      expect.objectContaining({
        latitudine: null,
        longitudine: null,
        intervento_strada: false,
      }),
    ]);
  });

  it('una posizione illeggibile dà l’errore sul campo e non salva', async () => {
    await monta('TITOLARE');
    scrivi('posizione', 'qui vicino');
    invia();
    await vi.waitFor(() =>
      expect(errore('posizione').textContent).toBe(
        'Non riesco a leggere la posizione: incolla due numeri (es. 45.070312, 7.686856) o un link di Google Maps',
      ),
    );
    expect(campoDi('posizione').getAttribute('aria-invalid')).toBe('true');
    expect(salvaDatiOfficina).not.toHaveBeenCalled();
  });
});

describe('dati dell’officina: «Usa la posizione attuale»', () => {
  it('senza geolocalizzazione dice di incollare la posizione dalle mappe', async () => {
    vi.stubGlobal('navigator', {});
    await monta('TITOLARE');
    expect('geolocation' in navigator).toBe(false);
    pulsantePosizione().click();
    expect(errore('posizione').textContent).toBe(
      'Questo dispositivo non permette di leggere la posizione: incollala dalle mappe.',
    );
    expect(errore('posizione').hidden).toBe(false);
    expect(campoDi('posizione').value).toBe('45.070312, 7.686856');
  });

  it('con una posizione finta riempie il campo a 6 decimali e riattiva la casella', async () => {
    const getCurrentPosition = vi.fn((ok: (p: unknown) => void) =>
      ok({ coords: { latitude: 45.4642107, longitude: 9.1913832 } }),
    );
    geolocalizzazione(getCurrentPosition);
    await monta('TITOLARE', datiFinti({ latitudine: null, longitudine: null }));
    expect(campoDi('intervento_strada').disabled).toBe(true);
    pulsantePosizione().click();
    expect(campoDi('posizione').value).toBe('45.464211, 9.191383');
    expect(campoDi('posizione').getAttribute('aria-invalid')).toBe('false');
    expect(campoDi('intervento_strada').disabled).toBe(false);
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it('se il browser rifiuta mostra il messaggio e lascia la posizione com’era', async () => {
    geolocalizzazione((_ok: unknown, ko: () => void) => ko());
    await monta('TITOLARE');
    pulsantePosizione().click();
    expect(errore('posizione').textContent).toBe(
      'Non riesco a leggere la posizione. Consenti l’accesso alla posizione al browser, oppure incollala dalle mappe.',
    );
    expect(campoDi('posizione').value).toBe('45.070312, 7.686856');
  });
});

describe('dati dell’officina: salvataggio', () => {
  it('salva una volta con i dati attesi e torna al profilo con la conferma', async () => {
    await monta('TITOLARE');
    scrivi('raggio_strada_km', '30');
    invia();
    await vi.waitFor(() =>
      expect(vaiConConferma).toHaveBeenCalledExactlyOnceWith(
        '/profilo',
        "Dati dell'officina salvati.",
      ),
    );
    expect(salvaDatiOfficina).toHaveBeenCalledExactlyOnceWith(ID_OFFICINA, {
      indirizzo: 'Via Roma 1',
      cap: '10100',
      citta: 'Torino',
      provincia: 'TO',
      telefono: '+39 011 1234567',
      email: 'info@gommerossi.it',
      latitudine: 45.070312,
      longitudine: 7.686856,
      intervento_strada: true,
      raggio_strada_km: 30,
    });
  });
});

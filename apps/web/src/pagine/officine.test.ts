// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  distanzaKm,
  formattaDistanza,
  giorniPrenotabili,
  type Chiusura,
  type Orari,
} from '@tyrecare/shared';
import type * as M_prenotazioni from '../lib/prenotazioni';
import type { OfficinaConServizi } from '../lib/prenotazioni';
import type * as M_router from '../lib/router';

const {
  caricaOfficineAttive,
  caricaOfficinaPubblica,
  caricaFascePiene,
  caricaMieiVeicoli,
  richiediPrenotazione,
  caricaDatiUtente,
  rpc,
  vaiA,
} = vi.hoisted(() => ({
  caricaOfficineAttive: vi.fn(),
  caricaOfficinaPubblica: vi.fn(),
  caricaFascePiene: vi.fn(),
  caricaMieiVeicoli: vi.fn(),
  richiediPrenotazione: vi.fn(),
  caricaDatiUtente: vi.fn(),
  rpc: vi.fn(),
  vaiA: vi.fn(),
}));

// Si fingono le letture e la scrittura: le funzioni pure e gli errori tradotti restano veri
vi.mock('../lib/prenotazioni', async (importOriginal) => ({
  ...(await importOriginal<typeof M_prenotazioni>()),
  caricaOfficineAttive,
  caricaOfficinaPubblica,
  caricaFascePiene,
  caricaMieiVeicoli,
  richiediPrenotazione,
}));
vi.mock('../lib/profilo', () => ({ caricaDatiUtente, lavoraInOfficina: () => false }));
vi.mock('../lib/notifiche', () => ({
  // usate dal layout della pagina
  avviaNotifiche: () => undefined,
  notificheNonLette: () => 0,
  numeroBadge: String,
  testoNonLette: () => '',
}));
vi.mock('../ui/avvisi-push', () => ({ collegaAvvisiPush: vi.fn() }));
vi.mock('../lib/router', async (importOriginal) => ({
  ...(await importOriginal<typeof M_router>()),
  visualizzazioneCorrente: () => 1,
  ancoraAttuale: () => true,
  vaiA,
}));
// rpc serve alla `richiediPrenotazione` vera, usata per provare l'errore tradotto dal database
vi.mock('../lib/supabase', () => ({
  getSupabase: () => ({ rpc }),
  chiaveSessione: () => 'chiave',
}));

import { mostraOfficina, mostraOfficine, mostraPrenota } from './officine';

const ID_OFFICINA = '22222222-2222-4222-8222-222222222222';
const ID_NORD = '44444444-4444-4444-8444-444444444441';
const ID_SUD = '44444444-4444-4444-8444-444444444442';
const ID_SERVIZIO = '55555555-5555-4555-8555-555555555555';
const ID_PRENOTAZIONE = '66666666-6666-4666-8666-666666666666';
const OGGI = '2026-12-10';

const APERTO: [string, string][] = [
  ['08:30', '12:30'],
  ['14:30', '19:00'],
];
const ORARI: Orari = { lun: APERTO, mar: APERTO, mer: APERTO, gio: APERTO, ven: APERTO };

const officinaBase = (extra: Partial<OfficinaConServizi> = {}): OfficinaConServizi => ({
  id: ID_OFFICINA,
  ragione_sociale: 'Gomme Rossi',
  indirizzo: 'Via Roma 1',
  cap: '20100',
  citta: 'Milano',
  provincia: 'MI',
  latitudine: null,
  longitudine: null,
  telefono: '02 1234567',
  orari: ORARI,
  servizi: [
    {
      id: ID_SERVIZIO,
      officina_id: ID_OFFICINA,
      nome: 'Cambio gomme',
      descrizione: 'Con equilibratura',
      durata_minuti: 60,
      prezzo_da: 40,
      prenotabile: true,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
  ],
  chiusure: [],
  ...extra,
});

const nord = {
  ...officinaBase(),
  id: ID_NORD,
  ragione_sociale: 'Gomme Nord',
  latitudine: 45.46,
  longitudine: 9.19,
};
const sud = {
  ...officinaBase(),
  id: ID_SUD,
  ragione_sociale: 'Gomme Sud',
  citta: 'Napoli',
  provincia: 'NA',
  indirizzo: 'Via Toledo 5',
  latitudine: 40.85,
  longitudine: 14.27,
};

const app = () => document.getElementById('app')!;
const norm = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
const righe = () =>
  [...app().querySelectorAll<HTMLAnchorElement>('a[href^="/officina?id="]')].map((a) =>
    norm(a.textContent),
  );
const nomi = () => righe().map((r) => r.replace(/Via .*$/, ''));
const cerca = () => app().querySelector<HTMLInputElement>('#tc-cerca')!;
const vicino = () => app().querySelector<HTMLButtonElement>('[data-vicino]')!;
const avvisoPosizione = () => norm(app().querySelector('[data-avviso-posizione]')!.textContent);
const conteggio = () => norm(app().querySelector('[data-conteggio]')!.textContent);

function apri(pagina: (a: HTMLElement) => Promise<void>, url: string): Promise<void> {
  history.replaceState(null, '', url);
  document.body.innerHTML = '<div id="app"></div>';
  return pagina(app());
}

const descrittoreGeo = Object.getOwnPropertyDescriptor(navigator, 'geolocation');

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${OGGI}T10:00:00Z`));
  for (const f of [
    caricaOfficineAttive,
    caricaOfficinaPubblica,
    caricaFascePiene,
    caricaMieiVeicoli,
    richiediPrenotazione,
    caricaDatiUtente,
    rpc,
    vaiA,
  ]) {
    f.mockReset();
  }
  caricaFascePiene.mockResolvedValue([]);
  caricaMieiVeicoli.mockResolvedValue([]);
  caricaDatiUtente.mockResolvedValue({ email: 'u@example.com', profilo: {}, officine: [] });
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
  if (descrittoreGeo) Object.defineProperty(navigator, 'geolocation', descrittoreGeo);
  else Reflect.deleteProperty(navigator, 'geolocation');
});

describe('officine: elenco', () => {
  it('nessuna officina: «Ancora nessuna officina» e niente ricerca', async () => {
    caricaOfficineAttive.mockResolvedValue([]);
    await apri(mostraOfficine, '/officine');
    expect(norm(app().querySelector('.tc-vuoto__titolo')!.textContent)).toBe(
      'Ancora nessuna officina',
    );
    expect(app().querySelector('#tc-cerca')).toBeNull();
    expect(app().querySelector('[data-vicino]')).toBeNull();
  });

  it('mostra tutte le officine con indirizzo e conta i risultati', async () => {
    caricaOfficineAttive.mockResolvedValue([nord, sud]);
    await apri(mostraOfficine, '/officine');
    expect(righe()).toEqual([
      'Gomme NordVia Roma 1, Milano (MI)',
      'Gomme SudVia Toledo 5, Napoli (NA)',
    ]);
    expect(conteggio()).toBe('2 officine trovate');
  });

  it('la ricerca per città filtra l’elenco', async () => {
    caricaOfficineAttive.mockResolvedValue([nord, sud]);
    await apri(mostraOfficine, '/officine');
    cerca().value = 'napoli';
    cerca().dispatchEvent(new Event('input', { bubbles: true }));
    expect(righe()).toEqual(['Gomme SudVia Toledo 5, Napoli (NA)']);
    expect(conteggio()).toBe('1 officina trovata');
  });

  it('la ricerca per nome filtra l’elenco', async () => {
    caricaOfficineAttive.mockResolvedValue([nord, sud]);
    await apri(mostraOfficine, '/officine');
    cerca().value = 'Nord';
    cerca().dispatchEvent(new Event('input', { bubbles: true }));
    expect(righe()).toEqual(['Gomme NordVia Roma 1, Milano (MI)']);
  });

  it('ricerca che non trova: stato vuoto col testo digitato (trim) e suggerimento', async () => {
    caricaOfficineAttive.mockResolvedValue([nord, sud]);
    await apri(mostraOfficine, '/officine');
    cerca().value = '  torino ';
    cerca().dispatchEvent(new Event('input', { bubbles: true }));
    expect(righe()).toEqual([]);
    expect(norm(app().querySelector('.tc-vuoto__titolo')!.textContent)).toBe(
      'Nessuna officina per «torino»',
    );
    expect(norm(app().querySelector('.tc-vuoto__testo')!.textContent)).toBe(
      'Prova con il nome della città.',
    );
    expect(conteggio()).toBe('0 officine trovate');
  });

  it('ricerca di soli spazi: elenco intero, non stato vuoto', async () => {
    caricaOfficineAttive.mockResolvedValue([nord, sud]);
    await apri(mostraOfficine, '/officine');
    cerca().value = '   ';
    cerca().dispatchEvent(new Event('input', { bubbles: true }));
    expect(righe()).toHaveLength(2);
    expect(app().querySelector('.tc-vuoto')).toBeNull();
  });
});

describe('officine: «Vicino a me»', () => {
  it('con la posizione ordina per distanza e la scrive sotto il nome', async () => {
    caricaOfficineAttive.mockResolvedValue([nord, sud]);
    // Poco a nord di Napoli: la più vicina è "Sud", che nell'elenco di partenza è seconda
    const posizione = { latitudine: 40.86, longitudine: 14.27 };
    const getCurrentPosition = vi.fn((ok: (p: unknown) => void) =>
      ok({ coords: { latitude: posizione.latitudine, longitude: posizione.longitudine } }),
    );
    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition },
      configurable: true,
    });
    await apri(mostraOfficine, '/officine');
    expect(nomi()).toEqual(['Gomme Nord', 'Gomme Sud']);

    vicino().click();

    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    const km = (o: { latitudine: number; longitudine: number }) =>
      formattaDistanza(distanzaKm(posizione, o));
    expect(righe()).toEqual([
      `Gomme SudVia Toledo 5, Napoli (NA) A ${km(sud as never)} da te`,
      `Gomme NordVia Roma 1, Milano (MI) A ${km(nord as never)} da te`,
    ]);
    expect(vicino().disabled).toBe(false);
    expect(norm(vicino().textContent)).toBe('Vicino a me');
    expect(avvisoPosizione()).toBe('');
  });

  it('posizione negata: messaggio del codice, pulsante di nuovo attivo, elenco invariato', async () => {
    caricaOfficineAttive.mockResolvedValue([nord, sud]);
    Object.defineProperty(navigator, 'geolocation', {
      value: {
        getCurrentPosition: vi.fn((_ok: unknown, ko: () => void) => ko()),
      },
      configurable: true,
    });
    await apri(mostraOfficine, '/officine');

    vicino().click();

    expect(avvisoPosizione()).toBe(
      'Non riusciamo a sapere dove sei: controlla i permessi di posizione del browser.',
    );
    expect(app().querySelector('[data-avviso-posizione] [role="alert"]')).not.toBeNull();
    expect(vicino().disabled).toBe(false);
    expect(norm(vicino().textContent)).toBe('Vicino a me');
    expect(nomi()).toEqual(['Gomme Nord', 'Gomme Sud']);
  });
});

describe('officina: scheda', () => {
  it.each([
    ['officina assente', null, ID_OFFICINA],
    ['id non valido', null, 'abc'],
  ])('%s: «Officina non disponibile» e «Vedi le officine»', async (_c, officina, id) => {
    caricaOfficinaPubblica.mockResolvedValue(officina);
    await apri(mostraOfficina, `/officina?id=${id}`);
    expect(norm(app().querySelector('h1')!.textContent)).toBe('Officina non disponibile');
    const link = [...app().querySelectorAll('a')].find(
      (a) => norm(a.textContent) === 'Vedi le officine',
    );
    expect(link?.getAttribute('href')).toBe('/officine');
  });

  it('id non valido: non si interroga il database', async () => {
    await apri(mostraOfficina, '/officina?id=abc');
    expect(caricaOfficinaPubblica).not.toHaveBeenCalled();
  });

  it('officina con servizi e orari: servizi, «Chiedi un appuntamento» e nessuna chiusura', async () => {
    caricaOfficinaPubblica.mockResolvedValue(officinaBase());
    await apri(mostraOfficina, `/officina?id=${ID_OFFICINA}`);
    expect(caricaOfficinaPubblica).toHaveBeenCalledWith(ID_OFFICINA);
    expect(norm(app().querySelector('h1')!.textContent)).toContain('Gomme Rossi');
    const servizio = app().querySelector(`a[aria-label="Prenota Cambio gomme"]`)!;
    expect(servizio.getAttribute('href')).toBe(
      `/prenota?officina=${ID_OFFICINA}&servizio=${ID_SERVIZIO}`,
    );
    expect(norm(servizio.textContent)).toBe(
      'Cambio gomme 1 h · da 40 € · Con equilibratura Prenota',
    );
    const chiedi = [...app().querySelectorAll('a')].find((a) =>
      norm(a.textContent).endsWith('Chiedi un appuntamento'),
    );
    expect(chiedi?.getAttribute('href')).toBe(`/prenota?officina=${ID_OFFICINA}`);
    expect(norm(app().textContent)).not.toContain('Chiusure in programma');
  });

  it('senza servizi: avviso, nessun «Chiedi un appuntamento» e il perché', async () => {
    caricaOfficinaPubblica.mockResolvedValue(officinaBase({ servizi: [] }));
    await apri(mostraOfficina, `/officina?id=${ID_OFFICINA}`);
    expect(norm(app().textContent)).toContain("L'officina non ha ancora indicato i suoi servizi.");
    expect(norm(app().textContent)).not.toContain('Chiedi un appuntamento');
    expect(norm(app().textContent)).toContain(
      "Per ora questa officina non accetta prenotazioni dall'app: chiamala per un appuntamento.",
    );
  });

  it('senza orari: i servizi non hanno «Prenota» né il pulsante', async () => {
    caricaOfficinaPubblica.mockResolvedValue(officinaBase({ orari: {} }));
    await apri(mostraOfficina, `/officina?id=${ID_OFFICINA}`);
    const servizio = app().querySelector(`a[aria-label="Prenota Cambio gomme"]`)!;
    expect(norm(servizio.textContent)).toBe('Cambio gomme 1 h · da 40 € · Con equilibratura');
    expect(norm(app().textContent)).not.toContain('Chiedi un appuntamento');
  });

  it('con chiusure in programma: la sezione elenca periodo e motivo', async () => {
    const chiusure: Chiusura[] = [
      { dal: '2026-12-24', al: '2026-12-26', motivo: 'Natale' },
      { dal: '2026-12-31', al: '2026-12-31', motivo: '' },
    ];
    caricaOfficinaPubblica.mockResolvedValue(officinaBase({ chiusure }));
    await apri(mostraOfficina, `/officina?id=${ID_OFFICINA}`);
    const titolo = [...app().querySelectorAll('h3')].find(
      (h) => norm(h.textContent) === 'Chiusure in programma',
    );
    expect(titolo).toBeDefined();
    const voci = [...titolo!.nextElementSibling!.querySelectorAll('li')].map((l) =>
      norm(l.textContent),
    );
    expect(voci).toEqual([
      'Da giovedì 24 dicembre a sabato 26 dicembre · Natale',
      'Giovedì 31 dicembre',
    ]);
  });
});

describe('prenota: «Chiedi un appuntamento»', () => {
  const giorno = () => giorniPrenotabili(ORARI, OGGI, [])[0]!.data;
  const campo = <T extends HTMLElement>(nome: string) =>
    app().querySelector<T>(`[name="${nome}"]`)!;
  const apriPrenota = (query = '') =>
    apri(mostraPrenota, `/prenota?officina=${ID_OFFICINA}${query}`);

  /** Compila il modulo come un cliente: servizio, targa, giorno (con `change`), fascia, telefono. */
  function compila() {
    campo<HTMLSelectElement>('servizio_id').value = ID_SERVIZIO;
    campo<HTMLInputElement>('targa').value = 'ab 123 cd';
    campo<HTMLInputElement>('giorno').value = giorno();
    campo<HTMLInputElement>('giorno').dispatchEvent(new Event('change', { bubbles: true }));
    app().querySelector<HTMLInputElement>('[name="fascia"][value="POMERIGGIO"]')!.click();
    campo<HTMLInputElement>('telefono').value = '333 1234567';
  }
  const invia = () =>
    app()
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

  beforeEach(() => {
    caricaOfficinaPubblica.mockResolvedValue(officinaBase());
  });

  it('il primo giorno prenotabile è domani (venerdì 11 dicembre)', () => {
    expect(giorno()).toBe('2026-12-11');
  });

  it.each([
    ['officina assente', null],
    ['senza servizi', officinaBase({ servizi: [] })],
    ['senza orari', officinaBase({ orari: {} })],
  ])('%s: «Officina non disponibile», nessun modulo', async (_c, officina) => {
    caricaOfficinaPubblica.mockResolvedValue(officina);
    await apriPrenota();
    expect(norm(app().querySelector('h1')!.textContent)).toBe('Officina non disponibile');
    expect(app().querySelector('form')).toBeNull();
  });

  it('modulo: servizio dal parametro, targa dal garage e telefono dal profilo', async () => {
    caricaDatiUtente.mockResolvedValue({
      email: 'u@example.com',
      profilo: { telefono: '+39 333 1234567' },
      officine: [],
    });
    await apriPrenota(`&servizio=${ID_SERVIZIO}&targa=ab123cd`);
    expect(campo<HTMLSelectElement>('servizio_id').value).toBe(ID_SERVIZIO);
    expect(campo<HTMLInputElement>('targa').value).toBe('AB 123 CD');
    expect(campo<HTMLInputElement>('telefono').value).toBe('+39 333 1234567');
    expect(caricaFascePiene).toHaveBeenCalledWith(ID_OFFICINA);
  });

  it('scelto un giorno si legge quando l’officina è aperta', async () => {
    await apriPrenota();
    campo<HTMLInputElement>('giorno').value = giorno();
    campo<HTMLInputElement>('giorno').dispatchEvent(new Event('change', { bubbles: true }));
    expect(norm(app().querySelector('[data-giorno-scelto]')!.textContent)).toBe(
      'venerdì 11 dicembre: aperto mattina e pomeriggio',
    );
  });

  it('invio valido: una sola richiesta coi valori del modulo, poi conferma e navigazione', async () => {
    richiediPrenotazione.mockResolvedValue(ID_PRENOTAZIONE);
    await apriPrenota();
    compila();
    invia();
    await vi.waitFor(() => expect(vaiA).toHaveBeenCalledTimes(1));

    expect(richiediPrenotazione).toHaveBeenCalledTimes(1);
    expect(richiediPrenotazione).toHaveBeenCalledWith(
      ID_OFFICINA,
      expect.objectContaining({
        servizio_id: ID_SERVIZIO,
        targa: 'AB123CD',
        giorno: giorno(),
        fascia: 'POMERIGGIO',
        telefono: '333 1234567',
      }),
    );
    expect(vaiA).toHaveBeenCalledWith(`/appuntamento?id=${ID_PRENOTAZIONE}`, {
      sostituisci: false,
    });
  });

  it('modulo incompleto: errori sotto i campi e nessuna richiesta', async () => {
    await apriPrenota();
    invia();
    await vi.waitFor(() =>
      expect(norm(app().querySelector('#campo-servizio_id-errore')!.textContent)).toBe(
        'Scegli il servizio',
      ),
    );
    expect(norm(app().querySelector('#campo-targa-errore')!.textContent)).toBe(
      'Inserisci la targa del veicolo',
    );
    expect(norm(app().querySelector('#campo-giorno-errore')!.textContent)).toBe('Scegli il giorno');
    expect(richiediPrenotazione).not.toHaveBeenCalled();
    expect(vaiA).not.toHaveBeenCalled();
  });

  describe('errori tradotti dal database (si parte dalla funzione vera)', () => {
    const reale = async () =>
      (await vi.importActual<typeof M_prenotazioni>('../lib/prenotazioni')).richiediPrenotazione;

    it('FASCIA_PIENA: messaggio sotto «fascia», fasce piene ricaricate, nessuna navigazione', async () => {
      richiediPrenotazione.mockImplementation(await reale());
      rpc.mockResolvedValue({ data: null, error: { message: 'FASCIA_PIENA' } });
      await apriPrenota();
      expect(caricaFascePiene).toHaveBeenCalledTimes(1);
      caricaFascePiene.mockResolvedValue([{ giorno: giorno(), fascia: 'POMERIGGIO' }]);
      compila();
      invia();

      await vi.waitFor(() =>
        expect(norm(app().querySelector('#campo-fascia-errore')!.textContent)).toBe(
          'Questa fascia si è appena riempita: scegli un altro giorno o fascia.',
        ),
      );
      expect(rpc).toHaveBeenCalledTimes(1);
      expect(rpc).toHaveBeenCalledWith(
        'richiedi_prenotazione',
        expect.objectContaining({
          p_officina_id: ID_OFFICINA,
          p_giorno: giorno(),
          p_fascia: 'POMERIGGIO',
        }),
      );
      expect(caricaFascePiene).toHaveBeenCalledTimes(2);
      expect(caricaFascePiene).toHaveBeenLastCalledWith(ID_OFFICINA);
      expect(app().querySelector('#campo-fascia-errore')!.hasAttribute('hidden')).toBe(false);
      expect(app().querySelector('[name="fascia"]')!.getAttribute('aria-invalid')).toBe('true');
      // La fascia ora risulta piena: accanto al nome e spenta
      expect(
        norm(
          app().querySelector('[name="fascia"][value="POMERIGGIO"]')!.nextElementSibling!
            .textContent,
        ),
      ).toBe('Pomeriggio (piena)');
      expect(
        app().querySelector<HTMLInputElement>('[name="fascia"][value="POMERIGGIO"]')!.disabled,
      ).toBe(true);
      expect(vaiA).not.toHaveBeenCalled();
    });

    it('TROPPE_RICHIESTE: messaggio nel riquadro generale, senza ricaricare le fasce', async () => {
      richiediPrenotazione.mockImplementation(await reale());
      rpc.mockResolvedValue({ data: null, error: { message: 'TROPPE_RICHIESTE' } });
      await apriPrenota();
      compila();
      invia();

      const riquadro = () => app().querySelector<HTMLElement>('[data-errore-modulo]')!;
      await vi.waitFor(() => expect(riquadro().hidden).toBe(false));
      expect(norm(riquadro().textContent)).toBe(
        'Hai già 3 richieste in attesa con questa officina: aspetta la risposta o annullane una.',
      );
      expect(caricaFascePiene).toHaveBeenCalledTimes(1);
      expect(vaiA).not.toHaveBeenCalled();
    });
  });
});

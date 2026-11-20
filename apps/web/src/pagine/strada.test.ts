// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErroreModulo } from '../lib/errori';
import type * as routerReale from '../lib/router';
import type * as stradaReale from '../lib/strada';
import type { RichiestaInCorso } from '../lib/strada';

const { richiestaInCorso, creaRichiestaStrada, annullaRichiestaStrada, posizioneAttuale } =
  vi.hoisted(() => ({
    richiestaInCorso: vi.fn(),
    creaRichiestaStrada: vi.fn(),
    annullaRichiestaStrada: vi.fn(),
    posizioneAttuale: vi.fn(),
  }));
const { caricaDatiUtente, caricaGarage } = vi.hoisted(() => ({
  caricaDatiUtente: vi.fn(),
  caricaGarage: vi.fn(),
}));
vi.mock('../lib/strada', async (importOriginal) => ({
  ...(await importOriginal<typeof stradaReale>()),
  richiestaInCorso,
  creaRichiestaStrada,
  annullaRichiestaStrada,
  posizioneAttuale,
}));
vi.mock('../lib/garage', () => ({ caricaGarage }));
vi.mock('../lib/notifiche', () => ({
  // usate dal layout della pagina
  avviaNotifiche: () => undefined,
  notificheNonLette: () => 0,
  numeroBadge: String,
  testoNonLette: () => '',
}));
vi.mock('../lib/profilo', () => ({ caricaDatiUtente, lavoraInOfficina: () => false }));
vi.mock('../ui/avvisi-push', () => ({ collegaAvvisiPush: vi.fn() }));
vi.mock('../lib/router', async (importOriginal) => ({
  ...(await importOriginal<typeof routerReale>()),
  visualizzazioneCorrente: () => 1,
  ancoraAttuale: () => true,
}));

import { MESSAGGI } from '../lib/strada';
import { mostraStrada } from './strada';

const richiesta = (extra: Partial<RichiestaInCorso> = {}): RichiestaInCorso => ({
  id: 'r1',
  stato: 'APERTA',
  descrizione: 'Gomma a terra sulla statale',
  scade_il: '2099-01-01T12:00:00Z',
  accettata_il: null,
  targa: null,
  officina: null,
  ...extra,
});

const app = () => document.getElementById('app')!;
const apri = () => mostraStrada(app());
const testo = (sel: string) => app().querySelector(sel)!.textContent!.replace(/\s+/g, ' ').trim();
const dialogo = () => document.querySelector<HTMLDialogElement>('dialog.tc-dialogo');

beforeEach(() => {
  vi.resetAllMocks();
  richiestaInCorso.mockResolvedValue(null);
  caricaGarage.mockResolvedValue([]);
  caricaDatiUtente.mockResolvedValue({ profilo: { telefono: '+39 333 1234567' } });
  document.body.innerHTML = '<div id="app"></div>';
});

afterEach(() => {
  // niente intervalli di 15 s vivi tra i test
  vi.clearAllTimers();
  document.body.innerHTML = '';
});

describe('pagina «Aiuto su strada» del cliente', () => {
  it('senza richieste mostra il modulo con il telefono del profilo', async () => {
    await apri();
    expect(testo('h1')).toBe('Aiuto su strada');
    expect(testo('form [type="submit"]')).toContain('Usa la mia posizione e invia');
    expect(app().querySelector<HTMLInputElement>('input[name="telefono"]')!.value).toBe(
      '+39 333 1234567',
    );
    expect(app().querySelector('[data-annulla]')).toBeNull();
  });

  it('richiesta APERTA: stato di ricerca e «Annulla la richiesta», nessun link tel:', async () => {
    richiestaInCorso.mockResolvedValue(richiesta());
    await apri();
    expect(testo('#tc-stato')).toBe("Stiamo cercando un'officina vicina");
    expect(testo('[data-annulla]')).toBe('Annulla la richiesta');
    expect(testo('#tc-tua + p')).toBe('Gomma a terra sulla statale');
    expect(app().querySelector('a[href^="tel:"]')).toBeNull();
    expect(app().querySelector('form')).toBeNull();
  });

  it("richiesta ACCETTATA: nome dell'officina e link tel: col numero senza spazi", async () => {
    richiestaInCorso.mockResolvedValue(
      richiesta({
        stato: 'ACCETTATA',
        officina: { ragione_sociale: 'Gomme Rossi', telefono: '+39 02 1234 5678' },
      }),
    );
    await apri();
    expect(testo('#tc-stato')).toBe("Un'officina ti aiuta");
    expect(testo('section strong')).toBe('Gomme Rossi');
    const chiama = app().querySelector<HTMLAnchorElement>('a[href="tel:+390212345678"]')!;
    expect(chiama.textContent!.replace(/\s+/g, ' ').trim()).toBe('Chiama +39 02 1234 5678');
    expect(testo('[data-annulla]')).toBe('Annulla la richiesta');
  });

  it("ACCETTATA senza telefono dell'officina: la richiamerà, nessun link tel:", async () => {
    richiestaInCorso.mockResolvedValue(
      richiesta({
        stato: 'ACCETTATA',
        officina: { ragione_sociale: 'Gomme Rossi', telefono: null },
      }),
    );
    await apri();
    expect(testo('section strong')).toBe('Gomme Rossi');
    expect(app().textContent).toContain("L'officina ti richiamerà al numero che hai indicato.");
    expect(app().querySelector('a[href^="tel:"]')).toBeNull();
  });

  it("limite orario: nel riquadro d'errore compare il messaggio di lib/strada", async () => {
    posizioneAttuale.mockResolvedValue({ latitudine: 45.46, longitudine: 9.19 });
    creaRichiestaStrada.mockRejectedValue(
      new ErroreModulo(MESSAGGI.TROPPE_RICHIESTE!, undefined, 'TROPPE_RICHIESTE'),
    );
    await apri();
    const descrizione = app().querySelector<HTMLTextAreaElement>('textarea[name="descrizione"]')!;
    descrizione.value = 'Gomma a terra';
    descrizione.dispatchEvent(new Event('input', { bubbles: true }));
    app().querySelector('form')!.requestSubmit();
    await vi.waitFor(() => expect(testo('[data-errore-modulo]')).toBe(MESSAGGI.TROPPE_RICHIESTE));
    expect(testo('[data-errore-modulo]')).toContain(
      "Hai già fatto diverse richieste nell'ultima ora",
    );
    expect(creaRichiestaStrada).toHaveBeenCalledWith(
      expect.objectContaining({ descrizione: 'Gomma a terra', telefono: '+39 333 1234567' }),
      { latitudine: 45.46, longitudine: 9.19 },
    );
    // la pagina è ancora il modulo, nessuna richiesta disegnata
    expect(app().querySelector('[data-annulla]')).toBeNull();
  });

  it("annullo riuscito: chiama annullaRichiestaStrada con l'id e il focus va sull'h1", async () => {
    richiestaInCorso.mockResolvedValueOnce(richiesta({ id: 'r-77' })).mockResolvedValue(null);
    annullaRichiestaStrada.mockResolvedValue(undefined);
    await apri();
    app().querySelector<HTMLButtonElement>('[data-annulla]')!.click();
    expect(dialogo()!.open).toBe(true);
    expect(dialogo()!.querySelector('h2')!.textContent).toBe('Annullare la richiesta?');
    const conferma = dialogo()!.querySelector<HTMLButtonElement>('[data-conferma]')!;
    expect(conferma.textContent!.trim()).toBe('Annulla la richiesta');
    conferma.click();
    await vi.waitFor(() => expect(document.activeElement).toBe(app().querySelector('h1')));
    expect(annullaRichiestaStrada).toHaveBeenCalledExactlyOnceWith('r-77');
    expect(app().querySelector('form')).not.toBeNull();
    expect(dialogo()).toBeNull();
  });
});

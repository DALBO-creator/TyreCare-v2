// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as M_comune from './comune';
import type * as M_profilo from '../lib/profilo';
import type * as M_router from '../lib/router';

const {
  richiediAffiliazione,
  caricaDatiUtente,
  vaiConConferma,
  gestisciErroreCaricamento,
  ancora,
} = vi.hoisted(() => ({
  richiediAffiliazione: vi.fn(),
  caricaDatiUtente: vi.fn(),
  vaiConConferma: vi.fn(),
  gestisciErroreCaricamento: vi.fn(),
  ancora: vi.fn(),
}));

vi.mock('../lib/affiliazione', () => ({ richiediAffiliazione }));
vi.mock('../lib/profilo', async (importOriginal) => ({
  ...(await importOriginal<typeof M_profilo>()),
  caricaDatiUtente,
}));
vi.mock('../lib/router', async (importOriginal) => ({
  ...(await importOriginal<typeof M_router>()),
  visualizzazioneCorrente: () => 1,
  ancoraAttuale: ancora,
}));
vi.mock('./comune', async (importOriginal) => ({
  ...(await importOriginal<typeof M_comune>()),
  vaiConConferma,
  gestisciErroreCaricamento,
}));
vi.mock('../lib/supabase', () => ({ getSupabase: () => ({}), chiaveSessione: () => 'chiave' }));

import { mostraRegistraOfficina } from './registra-officina';

/** Aggiunge la cifra di controllo a 10 cifre (stessa regola di Luhn di packages/shared). */
function conControllo(dieci: string): string {
  let somma = 0;
  for (let i = 0; i < 10; i++) {
    let c = Number(dieci[i]);
    if (i % 2 === 1) c = c * 2 > 9 ? c * 2 - 9 : c * 2;
    somma += c;
  }
  return dieci + String((10 - (somma % 10)) % 10);
}
const VALIDA = conControllo('1234567890');

const monta = async () => {
  document.body.innerHTML = '<div id="app"></div>';
  await mostraRegistraOfficina(document.getElementById('app')!);
};
const campo = (nome: string) => document.querySelector<HTMLInputElement>(`input[name="${nome}"]`)!;
const invia = async () => {
  document.querySelector<HTMLFormElement>('form')!.requestSubmit();
  await new Promise((r) => setTimeout(r, 0));
};
const compila = (partitaIva: string, telefono = '') => {
  campo('ragione_sociale').value = '  Gomme Verdi  ';
  campo('partita_iva').value = partitaIva;
  campo('citta').value = ' Torino ';
  campo('telefono').value = telefono;
};

beforeEach(() => {
  for (const f of [
    richiediAffiliazione,
    caricaDatiUtente,
    vaiConConferma,
    gestisciErroreCaricamento,
    ancora,
  ])
    f.mockReset();
  ancora.mockReturnValue(true);
  caricaDatiUtente.mockResolvedValue({ email: 'm@example.com', profilo: {}, officine: [] });
  richiediAffiliazione.mockResolvedValue('id-officina');
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('registra la tua officina', () => {
  it("chi non ha un'officina vede il modulo con i quattro campi", async () => {
    await monta();
    expect(document.querySelector('h1')?.textContent).toBe('Registra la tua officina');
    for (const nome of ['ragione_sociale', 'partita_iva', 'citta', 'telefono']) {
      expect(campo(nome)).not.toBeNull();
    }
    expect(caricaDatiUtente).toHaveBeenCalledTimes(1);
  });

  it('chi lavora già in un’officina vede l’avviso e il link alla home, senza modulo', async () => {
    caricaDatiUtente.mockResolvedValue({
      email: 'm@example.com',
      profilo: {},
      officine: [{ id: 'o1' }],
    });
    await monta();
    expect(document.querySelector('[role="status"]')?.textContent?.trim()).toBe(
      "Il tuo account lavora già in un'officina.",
    );
    const torna = [...document.querySelectorAll('a')].find(
      (a) => a.textContent === 'Torna alla home',
    );
    expect(torna?.getAttribute('href')).toBe('/');
    expect(document.querySelector('form')).toBeNull();
  });

  it('caricamento fallito: passa l’errore a gestisciErroreCaricamento e non disegna il modulo', async () => {
    const errore = new Error('rete');
    caricaDatiUtente.mockRejectedValue(errore);
    await monta();
    expect(gestisciErroreCaricamento).toHaveBeenCalledWith(
      document.getElementById('app'),
      1,
      errore,
    );
    expect(document.querySelector('form')).toBeNull();
  });

  it('se la visualizzazione non è più attuale, la pagina resta sul caricamento', async () => {
    ancora.mockReturnValue(false);
    await monta();
    expect(document.querySelector('form')).toBeNull();
    expect(document.querySelector('h1')).toBeNull();
    expect(document.querySelector('[role="status"]')?.textContent?.trim()).toBe('Caricamento…');
  });

  it('partita IVA non valida: errore sul campo e nessuna richiesta', async () => {
    await monta();
    const sbagliata = VALIDA.slice(0, 10) + String((Number(VALIDA[10]) + 1) % 10);
    compila(sbagliata);
    await invia();
    expect(campo('partita_iva').getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById('campo-partita_iva-errore')!.textContent).toBe(
      'Partita IVA non valida',
    );
    expect(richiediAffiliazione).not.toHaveBeenCalled();
    expect(vaiConConferma).not.toHaveBeenCalled();
  });

  it('invio valido: una richiesta con i dati normalizzati, poi ricarica l’utente e va alla home', async () => {
    await monta();
    compila(`IT ${VALIDA}`);
    await invia();
    expect(richiediAffiliazione).toHaveBeenCalledTimes(1);
    expect(richiediAffiliazione).toHaveBeenCalledWith({
      ragione_sociale: 'Gomme Verdi',
      partita_iva: VALIDA,
      citta: 'Torino',
      telefono: null,
    });
    expect(caricaDatiUtente).toHaveBeenCalledTimes(2);
    expect(vaiConConferma).toHaveBeenCalledWith(
      '/',
      'Richiesta inviata: intanto puoi preparare la tua officina.',
    );
  });

  it('richiesta rifiutata: errore nel riquadro del modulo e nessun ritorno alla home', async () => {
    richiediAffiliazione.mockRejectedValue(new Error('rete'));
    await monta();
    compila(VALIDA, '011 1234567');
    await invia();
    const riquadro = document.querySelector<HTMLElement>('[data-errore-modulo]')!;
    expect(riquadro.hidden).toBe(false);
    expect(riquadro.textContent).toBe('Qualcosa è andato storto. Riprova tra poco.');
    expect(caricaDatiUtente).toHaveBeenCalledTimes(1);
    expect(vaiConConferma).not.toHaveBeenCalled();
  });
});

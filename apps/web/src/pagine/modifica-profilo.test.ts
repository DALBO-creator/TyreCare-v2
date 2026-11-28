// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as M_profilo from '../lib/profilo';
import type * as M_router from '../lib/router';

const { caricaDatiUtente, salvaProfilo, tornaAlProfilo, ancora } = vi.hoisted(() => ({
  caricaDatiUtente: vi.fn(),
  salvaProfilo: vi.fn(),
  tornaAlProfilo: vi.fn(),
  ancora: vi.fn(),
}));

vi.mock('../lib/profilo', async (importOriginal) => ({
  ...(await importOriginal<typeof M_profilo>()),
  caricaDatiUtente,
  salvaProfilo,
}));
vi.mock('../lib/router', async (importOriginal) => ({
  ...(await importOriginal<typeof M_router>()),
  visualizzazioneCorrente: () => 1,
  ancoraAttuale: ancora,
}));
// Il modulo pagina `profilo` è pesante: si finge intero, qui serve solo `tornaAlProfilo`
vi.mock('./profilo', () => ({ tornaAlProfilo }));
vi.mock('../lib/supabase', () => ({ getSupabase: () => ({}), chiaveSessione: () => 'chiave' }));

import { mostraModificaProfilo } from './modifica-profilo';

const dati = (telefono: string | null) => ({
  email: 'm@example.com',
  profilo: { nome: 'Mario', cognome: 'Rossi', telefono },
  officine: [],
});

const monta = async () => {
  document.body.innerHTML = '<div id="app"></div>';
  await mostraModificaProfilo(document.getElementById('app')!);
};
const campo = (nome: string) => document.querySelector<HTMLInputElement>(`input[name="${nome}"]`)!;
const invia = async () => {
  document.querySelector<HTMLFormElement>('form')!.requestSubmit();
  await new Promise((r) => setTimeout(r, 0));
};
const riquadro = () => document.querySelector<HTMLElement>('[data-errore-modulo]')!;

beforeEach(() => {
  for (const f of [caricaDatiUtente, salvaProfilo, tornaAlProfilo, ancora]) f.mockReset();
  ancora.mockReturnValue(true);
  caricaDatiUtente.mockResolvedValue(dati('333 1234567'));
  salvaProfilo.mockResolvedValue(undefined);
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('modifica profilo («I tuoi dati»)', () => {
  it('riempie nome, cognome e telefono dal profilo', async () => {
    await monta();
    expect(document.querySelector('h1')?.textContent).toBe('I tuoi dati');
    expect(campo('nome').value).toBe('Mario');
    expect(campo('cognome').value).toBe('Rossi');
    expect(campo('telefono').value).toBe('333 1234567');
  });

  it('telefono assente: il campo è vuoto', async () => {
    caricaDatiUtente.mockResolvedValue(dati(null));
    await monta();
    expect(campo('telefono').value).toBe('');
  });

  it('errore di caricamento: mostra il riquadro di errore con Riprova', async () => {
    caricaDatiUtente.mockRejectedValue(new Error('rete'));
    await monta();
    expect(document.querySelector('[role="alert"]')?.textContent?.trim()).toBe(
      'Non riusciamo a caricare i tuoi dati. Controlla la connessione e riprova.',
    );
    expect(document.querySelector('form')).toBeNull();
  });

  it('se la visualizzazione non è più attuale, la pagina resta sul caricamento', async () => {
    ancora.mockReturnValue(false);
    await monta();
    expect(document.querySelector('form')).toBeNull();
    expect(document.querySelector('h1')).toBeNull();
    expect(document.querySelector('[role="alert"]')).toBeNull();
  });

  it('nome vuoto: errore sul campo con aria-invalid e nessun salvataggio', async () => {
    await monta();
    campo('nome').value = '';
    await invia();
    expect(campo('nome').getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById('campo-nome-errore')!.textContent).toBe('Inserisci il tuo nome');
    expect(salvaProfilo).not.toHaveBeenCalled();
    expect(tornaAlProfilo).not.toHaveBeenCalled();
  });

  it('invio valido: salva una volta i valori normalizzati e torna al profilo', async () => {
    await monta();
    campo('nome').value = '  Luigi  ';
    campo('telefono').value = '';
    await invia();
    expect(salvaProfilo).toHaveBeenCalledTimes(1);
    expect(salvaProfilo).toHaveBeenCalledWith({ nome: 'Luigi', cognome: 'Rossi', telefono: null });
    expect(tornaAlProfilo).toHaveBeenCalledWith('Dati salvati.');
  });

  it('errore di salvataggio: messaggio nel riquadro del modulo e nessun ritorno al profilo', async () => {
    salvaProfilo.mockRejectedValue(new Error('rete'));
    await monta();
    await invia();
    expect(riquadro().hidden).toBe(false);
    expect(riquadro().textContent).toBe('Qualcosa è andato storto. Riprova tra poco.');
    expect(tornaAlProfilo).not.toHaveBeenCalled();
  });
});

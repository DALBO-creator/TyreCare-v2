// @vitest-environment happy-dom
import { AuthApiError } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as M_auth from '../lib/auth';
import type * as M_miei_dati from '../lib/miei-dati';
import type * as M_profilo from '../lib/profilo';
import type * as M_router from '../lib/router';

const {
  caricaDatiUtente,
  contaOfficineInAttesa,
  sessioneAal2,
  raccogliMieiDati,
  scaricaJson,
  esci,
} = vi.hoisted(() => ({
  caricaDatiUtente: vi.fn(),
  contaOfficineInAttesa: vi.fn(),
  sessioneAal2: vi.fn(),
  raccogliMieiDati: vi.fn(),
  scaricaJson: vi.fn(),
  esci: vi.fn(),
}));
const { mostraPagina } = vi.hoisted(() => ({ mostraPagina: vi.fn() }));

vi.mock('../lib/profilo', async (importOriginal) => ({
  ...(await importOriginal<typeof M_profilo>()),
  caricaDatiUtente,
}));
vi.mock('../lib/admin', () => ({ contaOfficineInAttesa }));
vi.mock('../lib/admin-pannello', () => ({ sessioneAal2 }));
// Si finge solo la lettura: il nome del file resta quello vero
vi.mock('../lib/miei-dati', async (importOriginal) => ({
  ...(await importOriginal<typeof M_miei_dati>()),
  raccogliMieiDati,
}));
vi.mock('../lib/scarica', () => ({ scaricaJson }));
// `messaggioErrore` resta vero: il messaggio si prova dal codice d'origine
vi.mock('../lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof M_auth>()),
  esci,
}));
vi.mock('../lib/router', async (importOriginal) => ({
  ...(await importOriginal<typeof M_router>()),
  visualizzazioneCorrente: () => 1,
  ancoraAttuale: () => true,
  mostraPagina,
}));
vi.mock('../lib/supabase', () => ({ getSupabase: () => ({}), chiaveSessione: () => 'chiave' }));

import { nomeFileMieiDati } from '../lib/miei-dati';
import { mostraProfilo } from './profilo';

const ID_OFFICINA = '22222222-2222-4222-8222-222222222222';

type RuoloProfilo = 'CLIENTE' | 'OFFICINA' | 'ADMIN';
type RuoloOfficina = 'TITOLARE' | 'OPERATORE';

const utente = (
  ruolo: RuoloProfilo,
  officine: RuoloOfficina[] = [],
  nome = 'Mario',
  cognome = 'Rossi',
) => ({
  email: 'mario@example.com',
  profilo: { id: 'p1', ruolo, nome, cognome, telefono: null },
  officine: officine.map((r) => ({
    ruolo: r,
    officina: {
      id: ID_OFFICINA,
      ragione_sociale: 'Gomme Rossi',
      citta: 'Milano',
      stato_affiliazione: 'ATTIVA',
    },
  })),
});

const monta = async (dati: ReturnType<typeof utente>) => {
  caricaDatiUtente.mockResolvedValue(dati);
  document.body.innerHTML = '<div id="app"></div>';
  await mostraProfilo(document.getElementById('app')!);
};

const titoli = () => [...document.querySelectorAll('h2')].map((h) => h.textContent?.trim());
const links = () =>
  [...document.querySelectorAll('a')].map((a) => ({
    nome: a.textContent?.replace(/\s+/g, ' ').trim(),
    href: a.getAttribute('href'),
  }));
const link = (nome: string) => links().find((l) => l.nome === nome);
const pulsanteScarica = () => document.querySelector<HTMLButtonElement>('[data-scarica-dati]')!;
const boxErrore = () => document.querySelector<HTMLElement>('[data-errore-dati]')!;

beforeEach(() => {
  for (const f of [
    caricaDatiUtente,
    contaOfficineInAttesa,
    sessioneAal2,
    raccogliMieiDati,
    scaricaJson,
    esci,
    mostraPagina,
  ]) {
    f.mockReset();
  }
  sessioneAal2.mockResolvedValue(false);
  esci.mockResolvedValue(undefined);
  history.replaceState(null, '', '/profilo');
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('profilo: cliente', () => {
  it('mostra il nome nel titolo e le voci dell’account, senza officina né amministrazione', async () => {
    await monta(utente('CLIENTE'));
    expect(document.querySelector('h1')?.textContent?.trim()).toBe('Mario Rossi');
    expect(link('Modifica i tuoi dati')?.href).toBe('/profilo/dati');
    expect(link('Cambia password')?.href).toBe('/profilo/password');
    expect(link('Verifica in due passaggi')?.href).toBe('/profilo/sicurezza');
    expect(link('Elimina il tuo account')?.href).toBe('/profilo/elimina');
    expect(titoli()).not.toContain('Officina');
    expect(titoli()).not.toContain('Amministrazione');
    expect(link('Servizi e prezzi')).toBeUndefined();
    expect(link('Pannello amministratore')).toBeUndefined();
    expect(contaOfficineInAttesa).not.toHaveBeenCalled();
  });

  it('senza nome né cognome il titolo è «Il tuo account»', async () => {
    await monta(utente('CLIENTE', [], '', ''));
    expect(document.querySelector('h1')?.textContent?.trim()).toBe('Il tuo account');
  });
});

describe('profilo: officina', () => {
  it('il titolare vede servizi, orari e dati dell’officina', async () => {
    await monta(utente('OFFICINA', ['TITOLARE']));
    expect(titoli()).toContain('Officina');
    expect(link('Servizi e prezzi')?.href).toBe('/servizi');
    expect(link('Orari e chiusure')?.href).toBe('/officina/orari');
    expect(link("Dati dell'officina")?.href).toBe('/officina/dati');
    expect(titoli()).not.toContain('Amministrazione');
  });

  it('l’operatore vede solo i servizi', async () => {
    await monta(utente('OFFICINA', ['OPERATORE']));
    expect(link('Servizi e prezzi')?.href).toBe('/servizi');
    expect(link('Orari e chiusure')).toBeUndefined();
    expect(link("Dati dell'officina")).toBeUndefined();
  });
});

describe('profilo: amministratore', () => {
  it('con la 2FA fatta (aal2) mostra il pannello e il numero di officine in attesa', async () => {
    sessioneAal2.mockResolvedValue(true);
    contaOfficineInAttesa.mockResolvedValue(2);
    await monta(utente('ADMIN'));
    expect(titoli()).toContain('Amministrazione');
    expect(link('Pannello amministratore')?.href).toBe('/admin');
    expect(link('Officine da attivare (2)')?.href).toBe('/admin/officine');
  });

  it('se il conteggio fallisce il link è senza numero', async () => {
    sessioneAal2.mockResolvedValue(true);
    contaOfficineInAttesa.mockRejectedValue(new Error('rete'));
    await monta(utente('ADMIN'));
    expect(link('Officine da attivare')?.href).toBe('/admin/officine');
  });

  it('senza aal2 non conta le officine e il link è senza numero', async () => {
    sessioneAal2.mockResolvedValue(false);
    await monta(utente('ADMIN'));
    expect(contaOfficineInAttesa).not.toHaveBeenCalled();
    expect(link('Officine da attivare')?.href).toBe('/admin/officine');
    expect(link('Verifica in due passaggi')?.href).toBe('/profilo/sicurezza');
  });
});

describe('profilo: errore di caricamento', () => {
  it('se i dati non si caricano non disegna il profilo', async () => {
    caricaDatiUtente.mockRejectedValue(new Error('boom'));
    document.body.innerHTML = '<div id="app"></div>';
    await mostraProfilo(document.getElementById('app')!);
    expect(document.querySelector('h1')).toBeNull();
    expect(document.querySelector('[data-scarica-dati]')).toBeNull();
  });
});

describe('profilo: «Scarica i tuoi dati»', () => {
  it('raccoglie i dati e li scarica con il nome del file, poi il pulsante torna attivo', async () => {
    let finisci!: (v: unknown) => void;
    const dati = { profilo: { id: 'p1' } };
    raccogliMieiDati.mockReturnValue(new Promise((r) => (finisci = r)));
    await monta(utente('CLIENTE'));

    pulsanteScarica().click();
    expect(raccogliMieiDati).toHaveBeenCalledTimes(1);
    expect(pulsanteScarica().disabled).toBe(true);
    expect(pulsanteScarica().textContent?.trim()).toBe('Preparazione…');
    expect(scaricaJson).not.toHaveBeenCalled();

    finisci(dati);
    await vi.waitFor(() => expect(pulsanteScarica().disabled).toBe(false));
    expect(scaricaJson).toHaveBeenCalledTimes(1);
    expect(scaricaJson).toHaveBeenCalledWith(nomeFileMieiDati(), dati);
    expect(pulsanteScarica().textContent?.trim()).toBe('Scarica i tuoi dati');
    expect(boxErrore().hidden).toBe(true);
  });

  it('se la lettura fallisce mostra il messaggio tradotto nel box e non scarica', async () => {
    raccogliMieiDati.mockRejectedValue(
      new AuthApiError('rate limit', 429, 'over_request_rate_limit'),
    );
    await monta(utente('CLIENTE'));
    expect(boxErrore().hidden).toBe(true);

    pulsanteScarica().click();
    await vi.waitFor(() => expect(boxErrore().hidden).toBe(false));
    expect(boxErrore().textContent?.trim()).toBe(
      'Troppi tentativi ravvicinati. Riprova tra qualche minuto.',
    );
    expect(scaricaJson).not.toHaveBeenCalled();
    expect(pulsanteScarica().disabled).toBe(false);
    expect(pulsanteScarica().textContent?.trim()).toBe('Scarica i tuoi dati');
  });
});

describe('profilo: «Esci»', () => {
  it('chiama esci una volta', async () => {
    await monta(utente('CLIENTE'));
    document.querySelector<HTMLButtonElement>('[data-esci]')!.click();
    expect(esci).toHaveBeenCalledTimes(1);
  });
});

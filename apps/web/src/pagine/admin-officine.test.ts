// @vitest-environment happy-dom
import { PIANI } from '@tyrecare/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as M_admin from '../lib/admin';
import type * as M_router from '../lib/router';
import type { OfficinaAdmin } from '../lib/admin';
import { ETICHETTE_STATO_ABBONAMENTO } from '../lib/abbonamento';
import { ERRORI_RIFIUTO } from '../lib/admin';
import { messaggioErrore } from '../lib/auth';
import { ErroreModulo } from '../lib/errori';
import { ETICHETTE_STATO_OFFICINA } from './comune';

const {
  attivaOfficina,
  caricaOfficineAdmin,
  leggiVersioneDatabase,
  rifiutaAffiliazione,
  sospendiOfficina,
} = vi.hoisted(() => ({
  attivaOfficina: vi.fn(),
  caricaOfficineAdmin: vi.fn(),
  leggiVersioneDatabase: vi.fn(),
  rifiutaAffiliazione: vi.fn(),
  sospendiOfficina: vi.fn(),
}));

// Si fingono solo letture e scritture: `statoDatabase` resta vera, decide il testo del riquadro
vi.mock('../lib/admin', async (importOriginal) => ({
  ...(await importOriginal<typeof M_admin>()),
  attivaOfficina,
  caricaOfficineAdmin,
  leggiVersioneDatabase,
  rifiutaAffiliazione,
  sospendiOfficina,
}));
vi.mock('../lib/router', async (importOriginal) => ({
  ...(await importOriginal<typeof M_router>()),
  visualizzazioneCorrente: () => 1,
  ancoraAttuale: () => true,
  mostraPagina: vi.fn(),
}));
vi.mock('../lib/supabase', () => ({ getSupabase: () => ({}), chiaveSessione: () => 'chiave' }));
vi.mock('./admin-comune', () => ({ accessoAdmin: vi.fn().mockResolvedValue(true) }));

import { mostraAdminOfficine } from './admin-officine';

const MSG_RIFIUTO = ERRORI_RIFIUTO['OFFICINA_NON_IN_ATTESA']!;
const ATTESA = '20261114200000';
const ID_A = '11111111-1111-4111-8111-111111111111';
const ID_B = '22222222-2222-4222-8222-222222222222';
const ID_C = '33333333-3333-4333-8333-333333333333';

const officina = (over: Partial<OfficinaAdmin> = {}): OfficinaAdmin => ({
  id: ID_A,
  ragione_sociale: 'Gomme Rossi',
  partita_iva: '12345678901',
  citta: 'Verona',
  email: 'info@gommerossi.it',
  created_at: '2026-11-01T10:00:00Z',
  stato_affiliazione: 'IN_ATTESA',
  titolare: 'Mario Rossi',
  piano: null,
  statoAbbonamento: null,
  ...over,
});

const app = () => document.getElementById('app')!;
const righe = () => [...app().querySelectorAll<HTMLElement>('.tc-lista__riga')];
const testoPulsanti = (riga: HTMLElement) =>
  [...riga.querySelectorAll('button')].map((b) => b.textContent!.replace(/\s+/g, ' ').trim());
const dialogo = () => document.querySelector<HTMLDialogElement>('dialog.tc-dialogo');
const clic = (el: Element | null | undefined) => (el as HTMLElement).click();
const attendi = () => new Promise((r) => setTimeout(r, 0));
const riquadro = () => app().querySelector('[data-riquadro-database]')!;
const testo = (el: Element) => el.textContent!.replace(/\s+/g, ' ').trim();

async function monta(officine: OfficinaAdmin[]) {
  caricaOfficineAdmin.mockResolvedValue(officine);
  await mostraAdminOfficine(app());
}

beforeEach(() => {
  document.body.innerHTML = '<div id="app"></div>';
  for (const f of [
    attivaOfficina,
    caricaOfficineAdmin,
    leggiVersioneDatabase,
    rifiutaAffiliazione,
    sospendiOfficina,
  ]) {
    f.mockReset();
  }
  attivaOfficina.mockResolvedValue(undefined);
  sospendiOfficina.mockResolvedValue(undefined);
  rifiutaAffiliazione.mockResolvedValue(undefined);
  leggiVersioneDatabase.mockResolvedValue(ATTESA);
  vi.stubGlobal('__ULTIMA_MIGRAZIONE__', ATTESA);
  vi.stubGlobal('__VERSIONE_APP__', 'abc1234');
  // happy-dom: showModal/close minimi se mancano
  const proto = HTMLDialogElement.prototype;
  if (typeof proto.showModal !== 'function') {
    proto.showModal = function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
    proto.close = function (this: HTMLDialogElement) {
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    };
  }
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('admin officine: elenco', () => {
  it('senza officine mostra «Nessuna officina»', async () => {
    await monta([]);
    expect(app().querySelector('.tc-vuoto__titolo')?.textContent).toBe('Nessuna officina');
    expect(righe()).toHaveLength(0);
  });

  it('una riga per officina con stato e pulsanti del suo stato', async () => {
    await monta([
      officina({ id: ID_A, ragione_sociale: 'Gomme Rossi', stato_affiliazione: 'IN_ATTESA' }),
      officina({ id: ID_B, ragione_sociale: 'Pneus Express', stato_affiliazione: 'ATTIVA' }),
      officina({ id: ID_C, ragione_sociale: 'Gomme Blu', stato_affiliazione: 'SOSPESA' }),
    ]);
    const [attesa, attiva, sospesa] = righe();
    expect(righe()).toHaveLength(3);

    const stato = (r: HTMLElement) => r.querySelector('.tc-stato')!;
    expect(stato(attesa!).className).toContain('tc-stato--giallo');
    expect(testo(stato(attesa!))).toBe(ETICHETTE_STATO_OFFICINA.IN_ATTESA);
    expect(stato(attiva!).className).toContain('tc-stato--verde');
    expect(testo(stato(attiva!))).toBe(ETICHETTE_STATO_OFFICINA.ATTIVA);
    expect(stato(sospesa!).className).toContain('tc-stato--nessuno');
    expect(testo(stato(sospesa!))).toBe(ETICHETTE_STATO_OFFICINA.SOSPESA);

    expect(testoPulsanti(attesa!)).toEqual(['Attiva', 'Rifiuta la richiesta']);
    expect(testoPulsanti(attiva!)).toEqual(['Sospendi']);
    expect(testoPulsanti(sospesa!)).toEqual(['Attiva']);
    expect(sospesa!.querySelector('[data-rifiuta]')).toBeNull();
  });

  it('piano e stato dell’abbonamento; senza piano «non disponibile»', async () => {
    await monta([
      officina({ id: ID_A, piano: 'ANNUALE', statoAbbonamento: 'ATTIVO' }),
      officina({ id: ID_B, piano: null, statoAbbonamento: null }),
    ]);
    const [con, senza] = righe();
    const piano = (r: HTMLElement) => testo(r.querySelector('[data-piano-attuale]')!);
    expect(piano(con!)).toBe(
      `Piano: ${PIANI.ANNUALE.nome} · ${ETICHETTE_STATO_ABBONAMENTO.ATTIVO} · Gestisci l’abbonamento`,
    );
    expect(piano(senza!)).toBe('Piano: non disponibile · Gestisci l’abbonamento');
  });
});

describe('admin officine: azioni', () => {
  it('«Attiva» apre la conferma e solo la conferma chiama attivaOfficina', async () => {
    await monta([officina({ id: ID_A, ragione_sociale: 'Gomme Rossi' })]);
    clic(app().querySelector('[data-attiva]'));
    expect(dialogo()!.querySelector('h2')?.textContent).toBe('Attivare l’officina?');
    expect(attivaOfficina).not.toHaveBeenCalled();

    caricaOfficineAdmin.mockResolvedValue([officina({ id: ID_A, stato_affiliazione: 'ATTIVA' })]);
    caricaOfficineAdmin.mockClear();
    clic(dialogo()!.querySelector('[data-conferma]'));
    await attendi();

    expect(attivaOfficina).toHaveBeenCalledTimes(1);
    expect(attivaOfficina).toHaveBeenCalledWith(ID_A);
    expect(caricaOfficineAdmin).toHaveBeenCalledTimes(1);
    expect(dialogo()).toBeNull();
    expect(testoPulsanti(righe()[0]!)).toEqual(['Sospendi']);
  });

  it('«Annulla» non chiama né attiva né sospendi', async () => {
    await monta([
      officina({ id: ID_A, stato_affiliazione: 'IN_ATTESA' }),
      officina({ id: ID_B, stato_affiliazione: 'ATTIVA' }),
    ]);
    caricaOfficineAdmin.mockClear();
    clic(app().querySelector('[data-attiva]'));
    clic(dialogo()!.querySelector('[data-annulla]'));
    clic(app().querySelector('[data-sospendi]'));
    clic(dialogo()!.querySelector('[data-annulla]'));
    await attendi();
    expect(attivaOfficina).not.toHaveBeenCalled();
    expect(sospendiOfficina).not.toHaveBeenCalled();
    expect(caricaOfficineAdmin).not.toHaveBeenCalled();
    expect(dialogo()).toBeNull();
  });

  it('«Sospendi» apre la conferma e solo la conferma chiama sospendiOfficina', async () => {
    await monta([officina({ id: ID_B, stato_affiliazione: 'ATTIVA' })]);
    clic(app().querySelector('[data-sospendi]'));
    expect(dialogo()!.querySelector('h2')?.textContent).toBe('Sospendere l’officina?');
    expect(sospendiOfficina).not.toHaveBeenCalled();

    caricaOfficineAdmin.mockClear();
    caricaOfficineAdmin.mockResolvedValue([officina({ id: ID_B, stato_affiliazione: 'SOSPESA' })]);
    clic(dialogo()!.querySelector('[data-conferma]'));
    await attendi();

    expect(sospendiOfficina).toHaveBeenCalledTimes(1);
    expect(sospendiOfficina).toHaveBeenCalledWith(ID_B);
    expect(caricaOfficineAdmin).toHaveBeenCalledTimes(1);
    expect(testoPulsanti(righe()[0]!)).toEqual(['Attiva']);
  });

  it('errore di attivaOfficina: resta nel dialogo aperto, niente ricarica', async () => {
    await monta([officina({ id: ID_A })]);
    const errore = new Error('rete caduta');
    attivaOfficina.mockRejectedValue(errore);
    caricaOfficineAdmin.mockClear();
    clic(app().querySelector('[data-attiva]'));
    clic(dialogo()!.querySelector('[data-conferma]'));
    await attendi();

    const atteso = messaggioErrore(errore);
    expect(atteso).not.toBe('rete caduta');
    expect(testo(dialogo()!.querySelector('[role="alert"]')!)).toBe(atteso);
    expect(dialogo()!.hasAttribute('open')).toBe(true);
    expect(caricaOfficineAdmin).not.toHaveBeenCalled();
  });

  it('errore di sospendiOfficina: resta nel dialogo aperto, niente ricarica', async () => {
    await monta([officina({ id: ID_B, stato_affiliazione: 'ATTIVA' })]);
    const errore = new Error('rete caduta');
    sospendiOfficina.mockRejectedValue(errore);
    caricaOfficineAdmin.mockClear();
    clic(app().querySelector('[data-sospendi]'));
    clic(dialogo()!.querySelector('[data-conferma]'));
    await attendi();

    const atteso = messaggioErrore(errore);
    expect(atteso).not.toBe('rete caduta');
    expect(testo(dialogo()!.querySelector('[role="alert"]')!)).toBe(atteso);
    expect(dialogo()!.hasAttribute('open')).toBe(true);
    expect(caricaOfficineAdmin).not.toHaveBeenCalled();
  });

  it('«Rifiuta la richiesta» con un motivo lo passa a rifiutaAffiliazione', async () => {
    await monta([officina({ id: ID_A })]);
    clic(app().querySelector('[data-rifiuta]'));
    expect(dialogo()!.querySelector('h2')?.textContent).toBe('Rifiutare la richiesta?');
    expect(dialogo()!.querySelector('label')?.textContent).toBe('Motivo (facoltativo)');
    expect(rifiutaAffiliazione).not.toHaveBeenCalled();

    const campo = dialogo()!.querySelector<HTMLTextAreaElement>('textarea#tc-dialogo-campo')!;
    campo.value = 'Partita IVA non valida';
    caricaOfficineAdmin.mockClear();
    caricaOfficineAdmin.mockResolvedValue([]);
    clic(dialogo()!.querySelector('[data-conferma]'));
    await attendi();

    expect(rifiutaAffiliazione).toHaveBeenCalledTimes(1);
    expect(rifiutaAffiliazione).toHaveBeenCalledWith(ID_A, 'Partita IVA non valida');
    expect(caricaOfficineAdmin).toHaveBeenCalledTimes(1);
    expect(app().querySelector('.tc-vuoto__titolo')?.textContent).toBe('Nessuna officina');
  });

  it('«Rifiuta la richiesta» con il campo vuoto passa la stringa vuota', async () => {
    await monta([officina({ id: ID_A })]);
    clic(app().querySelector('[data-rifiuta]'));
    clic(dialogo()!.querySelector('[data-conferma]'));
    await attendi();
    expect(rifiutaAffiliazione).toHaveBeenCalledTimes(1);
    expect(rifiutaAffiliazione).toHaveBeenCalledWith(ID_A, '');
  });

  it('«Annulla» nel dialogo di rifiuto non chiama nulla', async () => {
    await monta([officina({ id: ID_A })]);
    clic(app().querySelector('[data-rifiuta]'));
    clic(dialogo()!.querySelector('[data-annulla]'));
    await attendi();
    expect(rifiutaAffiliazione).not.toHaveBeenCalled();
    expect(dialogo()).toBeNull();
  });

  it('errore di rifiutaAffiliazione: resta nel dialogo aperto, niente ricarica', async () => {
    await monta([officina({ id: ID_A })]);
    rifiutaAffiliazione.mockRejectedValue(new ErroreModulo(MSG_RIFIUTO));
    caricaOfficineAdmin.mockClear();
    clic(app().querySelector('[data-rifiuta]'));
    clic(dialogo()!.querySelector('[data-conferma]'));
    await attendi();

    expect(testo(dialogo()!.querySelector('[role="alert"]')!)).toBe(MSG_RIFIUTO);
    expect(dialogo()!.hasAttribute('open')).toBe(true);
    expect(caricaOfficineAdmin).not.toHaveBeenCalled();
  });
});

describe('admin officine: riquadro «Database»', () => {
  const monta1 = () => monta([officina()]);

  it('versione allineata: «Database aggiornato (migrazione X)»', async () => {
    leggiVersioneDatabase.mockResolvedValue(`${ATTESA}_nome`);
    await monta1();
    expect(testo(riquadro().firstElementChild!)).toBe(`Database aggiornato (migrazione ${ATTESA})`);
    expect(riquadro().querySelector('[role="status"]')).not.toBeNull();
    expect(testo(riquadro().lastElementChild!)).toBe("Versione dell'app: abc1234");
  });

  it('database indietro con versione nota: mostra le prime 14 cifre', async () => {
    leggiVersioneDatabase.mockResolvedValue('20261001000000_vecchia');
    await monta1();
    expect(testo(riquadro().firstElementChild!)).toBe(
      `Il database è indietro: l'app si aspetta la migrazione ${ATTESA}, il database è alla 20261001000000. Pubblica le migrazioni: guida DOCS/pilota/pubblicazione.md.`,
    );
  });

  it('database indietro senza funzione di controllo (presente null)', async () => {
    leggiVersioneDatabase.mockResolvedValue(null);
    await monta1();
    expect(testo(riquadro().firstElementChild!)).toBe(
      `Il database è indietro: l'app si aspetta la migrazione ${ATTESA}, non ha ancora la funzione di controllo. Pubblica le migrazioni: guida DOCS/pilota/pubblicazione.md.`,
    );
  });

  it('database più nuovo dell’app: «aspetta il prossimo rilascio»', async () => {
    leggiVersioneDatabase.mockResolvedValue('20261201000000');
    await monta1();
    expect(testo(riquadro().firstElementChild!)).toBe(
      "Il database ha migrazioni più nuove dell'app pubblicata: aspetta il prossimo rilascio di Vercel.",
    );
  });

  it('migrazione attesa vuota: versione non disponibile in questa build', async () => {
    vi.stubGlobal('__ULTIMA_MIGRAZIONE__', '');
    await monta1();
    expect(testo(riquadro().firstElementChild!)).toBe(
      "Versione delle migrazioni dell'app non disponibile in questa build.",
    );
  });

  it('errore di leggiVersioneDatabase: avviso nel riquadro e l’elenco resta visibile', async () => {
    leggiVersioneDatabase.mockRejectedValue(new Error('rete assente'));
    await monta1();
    expect(testo(riquadro().querySelector('[role="alert"]')!)).toBe(
      'Non siamo riusciti a leggere la versione del database: rete assente',
    );
    expect(righe()).toHaveLength(1);
  });
});

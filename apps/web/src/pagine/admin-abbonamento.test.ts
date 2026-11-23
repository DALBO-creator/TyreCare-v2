// @vitest-environment happy-dom
import { PREZZO_INSTALLAZIONE, formattaEuro } from '@tyrecare/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as M_admin_abbonamento from '../lib/admin-abbonamento';
import type * as M_profilo from '../lib/profilo';
import type * as M_router from '../lib/router';
import type * as M_comune from './comune';
import { ETICHETTE_STATO_ABBONAMENTO } from '../lib/abbonamento';
import { traduciErroreAbbonamento } from '../lib/admin-abbonamento';

const {
  caricaAbbonamentoAdmin,
  impostaAbbonamento,
  registraInstallazione,
  rinnovaAbbonamento,
  caricaDatiUtente,
  stato2fa,
  vaiConConferma,
  mostraPagina,
} = vi.hoisted(() => ({
  caricaAbbonamentoAdmin: vi.fn(),
  impostaAbbonamento: vi.fn(),
  registraInstallazione: vi.fn(),
  rinnovaAbbonamento: vi.fn(),
  caricaDatiUtente: vi.fn(),
  stato2fa: vi.fn(),
  vaiConConferma: vi.fn(),
  mostraPagina: vi.fn(),
}));

// Si fingono solo letture e scritture: lo schema del modulo e gli errori tradotti restano veri
vi.mock('../lib/admin-abbonamento', async (importOriginal) => ({
  ...(await importOriginal<typeof M_admin_abbonamento>()),
  caricaAbbonamentoAdmin,
  impostaAbbonamento,
  registraInstallazione,
  rinnovaAbbonamento,
}));
vi.mock('../lib/admin-pannello', () => ({ stato2fa }));
vi.mock('../lib/profilo', async (importOriginal) => ({
  ...(await importOriginal<typeof M_profilo>()),
  caricaDatiUtente,
}));
vi.mock('../lib/router', async (importOriginal) => ({
  ...(await importOriginal<typeof M_router>()),
  visualizzazioneCorrente: () => 1,
  ancoraAttuale: () => true,
  mostraPagina,
}));
vi.mock('../lib/supabase', () => ({ getSupabase: () => ({}), chiaveSessione: () => 'chiave' }));
vi.mock('./comune', async (importOriginal) => ({
  ...(await importOriginal<typeof M_comune>()),
  vaiConConferma,
}));

import { mostraAdminAbbonamento } from './admin-abbonamento';
import { formattaData } from './comune';

const ID = '33333333-3333-4333-8333-333333333333';
const QUI = `/admin/abbonamento?id=${ID}`;

const abbonamento = (extra: object = {}) => ({
  officina_id: ID,
  ragione_sociale: 'Gomme Rossi',
  stato_affiliazione: 'ATTIVA',
  piano: 'MENSILE',
  stato: 'ATTIVO',
  prova_fino_al: '2026-11-01',
  iniziato_il: '2026-11-05',
  scade_il: '2026-12-31',
  installazione_pagata: false,
  installazione_pagata_il: null,
  importo_concordato: null,
  note_admin: '',
  ...extra,
});

const monta = async (id: string | null = ID) => {
  history.replaceState(
    null,
    '',
    id === null ? '/admin/abbonamento' : `/admin/abbonamento?id=${id}`,
  );
  document.body.innerHTML = '<div id="app"></div>';
  await mostraAdminAbbonamento(document.getElementById('app')!);
};

const dialogo = () => document.querySelector<HTMLDialogElement>('dialog');
const bottone = (nome: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (b) => b.textContent?.replace(/\s+/g, ' ').trim() === nome,
  )!;
const boxAzioni = () => document.querySelector<HTMLElement>('[data-errore-azioni]')!;

beforeEach(() => {
  for (const f of [
    caricaAbbonamentoAdmin,
    impostaAbbonamento,
    registraInstallazione,
    rinnovaAbbonamento,
    caricaDatiUtente,
    stato2fa,
    vaiConConferma,
    mostraPagina,
  ]) {
    f.mockReset();
  }
  caricaDatiUtente.mockResolvedValue({ profilo: { ruolo: 'ADMIN' } });
  stato2fa.mockResolvedValue({ tipo: 'verificato' });
  caricaAbbonamentoAdmin.mockResolvedValue(abbonamento());
  rinnovaAbbonamento.mockResolvedValue('2027-01-31');
  registraInstallazione.mockResolvedValue(undefined);
  impostaAbbonamento.mockResolvedValue(undefined);
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
  document.body.innerHTML = '';
});

describe('abbonamento (admin): caricamento e dati', () => {
  it('un id non valido mostra «Officina non trovata.» senza leggere nulla', async () => {
    await monta('non-un-id');
    expect(document.querySelector('.tc-contenuto p')?.textContent).toBe('Officina non trovata.');
    expect(caricaAbbonamentoAdmin).not.toHaveBeenCalled();
  });

  it('un’officina che non esiste mostra «Officina non trovata.»', async () => {
    caricaAbbonamentoAdmin.mockResolvedValue(null);
    await monta();
    expect(document.querySelector('.tc-contenuto p')?.textContent).toBe('Officina non trovata.');
    expect(caricaAbbonamentoAdmin).toHaveBeenCalledWith(ID);
  });

  it('mostra stato, scadenza e installazione da pagare col prezzo', async () => {
    await monta();
    expect(document.querySelector('[data-stato]')?.textContent).toBe(
      ETICHETTE_STATO_ABBONAMENTO.ATTIVO,
    );
    expect(document.querySelector('[data-scadenza]')?.textContent).toBe(formattaData('2026-12-31'));
    expect(document.body.textContent).toContain(
      `Da pagare (${formattaEuro(PREZZO_INSTALLAZIONE)})`,
    );
    expect(boxAzioni().hidden).toBe(true);
  });
});

describe('abbonamento (admin): «Rinnova»', () => {
  it.each([
    ['Rinnova di un mese', 'Rinnovare l’abbonamento di un mese?', 'MESE'],
    ['Rinnova di un anno', 'Rinnovare l’abbonamento di un anno?', 'ANNO'],
  ])('«%s» chiede conferma e solo il «Sì, rinnova» rinnova', async (nome, titolo, periodo) => {
    await monta();
    bottone(nome).click();
    expect(dialogo()!.querySelector('h2')!.textContent).toBe(titolo);
    expect(dialogo()!.querySelector('p')!.textContent).toBe(
      'Registra il pagamento di Gomme Rossi e avvisa i titolari.',
    );
    expect(rinnovaAbbonamento).not.toHaveBeenCalled();
    bottone('Sì, rinnova').click();
    await vi.waitFor(() => expect(vaiConConferma).toHaveBeenCalledTimes(1));
    expect(rinnovaAbbonamento).toHaveBeenCalledTimes(1);
    expect(rinnovaAbbonamento).toHaveBeenCalledWith(ID, periodo);
    expect(vaiConConferma).toHaveBeenCalledWith(
      QUI,
      `Abbonamento rinnovato fino al ${formattaData('2027-01-31')}.`,
      { sostituisci: true },
    );
  });

  it('«Annulla» nel dialogo non rinnova e non cambia pagina', async () => {
    await monta();
    bottone('Rinnova di un anno').click();
    bottone('Annulla').click();
    expect(dialogo()).toBeNull();
    expect(rinnovaAbbonamento).not.toHaveBeenCalled();
    expect(vaiConConferma).not.toHaveBeenCalled();
  });

  it('un errore del rinnovo si legge nel dialogo, non nel riquadro della pagina', async () => {
    rinnovaAbbonamento.mockRejectedValue(
      traduciErroreAbbonamento({ message: 'PERIODO_NON_VALIDO' }),
    );
    await monta();
    bottone('Rinnova di un mese').click();
    bottone('Sì, rinnova').click();
    await vi.waitFor(() =>
      expect(dialogo()!.querySelector<HTMLElement>('[role="alert"]')!.hidden).toBe(false),
    );
    expect(dialogo()!.querySelector('[role="alert"]')!.textContent).toBe('Periodo non valido.');
    expect(dialogo()!.open).toBe(true);
    expect(boxAzioni().hidden).toBe(true);
    expect(vaiConConferma).not.toHaveBeenCalled();
  });
});

describe('abbonamento (admin): installazione e modulo', () => {
  it('«Installazione pagata» registra subito, senza dialogo', async () => {
    await monta();
    bottone('Installazione pagata').click();
    await vi.waitFor(() => expect(vaiConConferma).toHaveBeenCalledTimes(1));
    expect(dialogo()).toBeNull();
    expect(registraInstallazione).toHaveBeenCalledTimes(1);
    expect(registraInstallazione).toHaveBeenCalledWith(ID, true);
    expect(vaiConConferma).toHaveBeenCalledWith(QUI, 'Installazione segnata come pagata.', {
      sostituisci: true,
    });
  });

  it('«Installazione non pagata» (già pagata) annulla subito, senza dialogo', async () => {
    caricaAbbonamentoAdmin.mockResolvedValue(
      abbonamento({ installazione_pagata: true, installazione_pagata_il: '2026-11-10' }),
    );
    await monta();
    bottone('Installazione non pagata').click();
    await vi.waitFor(() => expect(vaiConConferma).toHaveBeenCalledTimes(1));
    expect(dialogo()).toBeNull();
    expect(registraInstallazione).toHaveBeenCalledWith(ID, false);
    expect(vaiConConferma).toHaveBeenCalledWith(QUI, 'Installazione segnata come da pagare.', {
      sostituisci: true,
    });
  });

  it('il modulo salvato chiama impostaAbbonamento una volta con i dati', async () => {
    await monta();
    document.querySelector('form')!.requestSubmit();
    await vi.waitFor(() => expect(vaiConConferma).toHaveBeenCalledTimes(1));
    expect(impostaAbbonamento).toHaveBeenCalledTimes(1);
    expect(impostaAbbonamento).toHaveBeenCalledWith(ID, {
      piano: 'MENSILE',
      stato: 'ATTIVO',
      prova_fino_al: '2026-11-01',
      iniziato_il: '2026-11-05',
      scade_il: '2026-12-31',
      importo: null,
      note: '',
    });
    expect(vaiConConferma).toHaveBeenCalledWith(QUI, 'Abbonamento salvato.', { sostituisci: true });
  });
});

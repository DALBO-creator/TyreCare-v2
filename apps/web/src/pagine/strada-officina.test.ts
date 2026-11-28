// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as M_officina from '../lib/officina';
import type * as M_router from '../lib/router';
import type * as M_stradaOfficina from '../lib/strada-officina';

// Le icone creano SVG con `document`: qui bastano segnaposto
vi.mock('../ui/icone', () => ({ icona: () => '<svg></svg>' }));

const {
  accettaRichiestaStrada,
  caricaContestoOfficina,
  caricaRichiesteAccettate,
  caricaRichiesteVicine,
  chiudiRichiestaStrada,
  officinaOffreStrada,
  stato,
} = vi.hoisted(() => ({
  accettaRichiestaStrada: vi.fn(),
  caricaContestoOfficina: vi.fn(),
  caricaRichiesteAccettate: vi.fn(),
  caricaRichiesteVicine: vi.fn(),
  chiudiRichiestaStrada: vi.fn(),
  officinaOffreStrada: vi.fn(),
  // `ancoraAttuale` si controlla da qui: false = l'utente ha lasciato la pagina
  stato: { ancora: true },
}));
const { mostraPagina } = vi.hoisted(() => ({ mostraPagina: vi.fn() }));

// Si fingono solo le letture e le scritture: le funzioni pure (eTitolare, linkMappa, …) restano vere
vi.mock('../lib/officina', async (importOriginal) => ({
  ...(await importOriginal<typeof M_officina>()),
  caricaContestoOfficina,
}));
vi.mock('../lib/strada-officina', async (importOriginal) => ({
  ...(await importOriginal<typeof M_stradaOfficina>()),
  accettaRichiestaStrada,
  caricaRichiesteAccettate,
  caricaRichiesteVicine,
  chiudiRichiestaStrada,
}));
vi.mock('../lib/dati-officina', () => ({ officinaOffreStrada }));
vi.mock('../lib/notifiche', () => ({
  // usate dal layout della pagina
  avviaNotifiche: () => undefined,
  notificheNonLette: () => 0,
  numeroBadge: String,
  testoNonLette: () => '',
}));
vi.mock('../lib/profilo', () => ({ lavoraInOfficina: () => true }));
vi.mock('../lib/router', async (importOriginal) => ({
  ...(await importOriginal<typeof M_router>()),
  visualizzazioneCorrente: () => 1,
  ancoraAttuale: () => stato.ancora,
  mostraPagina,
}));
vi.mock('../lib/supabase', () => ({ getSupabase: () => ({}), chiaveSessione: () => 'chiave' }));

import { INTERVALLO_AGGIORNAMENTO_MS, MESSAGGI, traduci } from '../lib/strada-officina';
import type { RichiestaAccettata, RichiestaVicina } from '../lib/strada-officina';
import { mostraStradaOfficina } from './strada-officina';

const ID_OFFICINA = '22222222-2222-4222-8222-222222222222';

const contesto = (ruolo: 'TITOLARE' | 'OPERATORE') => {
  const officina = { id: ID_OFFICINA, ragione_sociale: 'Gomme Rossi' };
  return { officine: [{ ruolo, officina }], attiva: { ruolo, officina } };
};

const vicina = (extra: Partial<RichiestaVicina> = {}): RichiestaVicina => ({
  id: 'r1',
  descrizione: 'Gomma a terra sulla statale',
  targa: null,
  distanza_km: 4,
  created_at: '2099-01-01T11:00:00Z',
  scade_il: '2099-01-01T12:00:00Z',
  ...extra,
});

const app = () => document.getElementById('app')!;
const apri = () => mostraStradaOfficina(app());
const testo = (sel: string) => app().querySelector(sel)!.textContent!.replace(/\s+/g, ' ').trim();
const dialogo = () => document.querySelector<HTMLDialogElement>('dialog.tc-dialogo');
const erroreDialogo = () => dialogo()!.querySelector<HTMLElement>('[role="alert"]')!;
const conferma = () => dialogo()!.querySelector<HTMLButtonElement>('[data-conferma]')!;
const annulla = () => dialogo()!.querySelector<HTMLButtonElement>('[data-annulla]')!;
const accetta = (id: string) =>
  app().querySelector<HTMLButtonElement>(`[data-azione="accetta"][data-id="${id}"]`)!;

beforeEach(() => {
  vi.resetAllMocks();
  stato.ancora = true;
  caricaContestoOfficina.mockResolvedValue(contesto('TITOLARE'));
  officinaOffreStrada.mockResolvedValue(true);
  caricaRichiesteVicine.mockResolvedValue([]);
  caricaRichiesteAccettate.mockResolvedValue([]);
  document.body.innerHTML = '<div id="app"></div>';
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('pagina «Richieste su strada» dell’officina', () => {
  it('officina che non offre l’aiuto, titolare: avviso con il link ai dati e nessuna lettura delle vicine', async () => {
    officinaOffreStrada.mockResolvedValue(false);
    await apri();
    expect(testo('h1')).toBe('Richieste su strada');
    expect(testo('.tc-avviso--giallo[role="status"]')).toBe(
      "L'officina non offre l'aiuto su strada, quindi non riceve richieste. Puoi attivarlo in Dati dell'officina.",
    );
    const link = app().querySelector<HTMLAnchorElement>('.tc-avviso--giallo a')!;
    expect(link.getAttribute('href')).toBe('/officina/dati');
    expect(link.textContent).toBe("Dati dell'officina");
    expect(testo('[data-vicine] p')).toBe('Nessuna richiesta: l’aiuto su strada non è attivo.');
    expect(caricaRichiesteVicine).not.toHaveBeenCalled();
    expect(caricaRichiesteAccettate).toHaveBeenCalledTimes(1);
    expect(caricaRichiesteAccettate).toHaveBeenCalledWith(ID_OFFICINA);
  });

  it('officina che non offre l’aiuto, operatore: il titolare può attivarlo, senza link', async () => {
    caricaContestoOfficina.mockResolvedValue(contesto('OPERATORE'));
    officinaOffreStrada.mockResolvedValue(false);
    await apri();
    expect(testo('.tc-avviso--giallo[role="status"]')).toBe(
      "L'officina non offre l'aiuto su strada, quindi non riceve richieste. Il titolare può attivarlo in «Dati dell'officina».",
    );
    expect(app().querySelector('.tc-avviso--giallo a')).toBeNull();
    expect(testo('[data-vicine] p')).toBe('Nessuna richiesta: l’aiuto su strada non è attivo.');
    expect(caricaRichiesteVicine).not.toHaveBeenCalled();
  });

  it('offre l’aiuto ma nessuna richiesta: due elenchi vuoti e nessun avviso', async () => {
    await apri();
    expect(app().querySelector('.tc-avviso--giallo')).toBeNull();
    expect(testo('[data-vicine] p')).toBe(
      'Nessuna richiesta nel tuo raggio. Questa pagina si aggiorna da sola.',
    );
    expect(testo('[data-accettate] p')).toBe('Nessuna richiesta accettata in corso.');
    expect(caricaRichiesteVicine).toHaveBeenCalledTimes(1);
    expect(caricaRichiesteVicine).toHaveBeenCalledWith(ID_OFFICINA);
    expect(app().querySelector('[data-azione]')).toBeNull();
  });

  it('una richiesta vicina: descrizione, targa e pulsante «Accetta» con il suo id', async () => {
    caricaRichiesteVicine.mockResolvedValue([vicina({ targa: 'AB123CD' })]);
    await apri();
    const riga = accetta('r1').parentElement!;
    expect(riga.textContent).toContain('Gomma a terra sulla statale');
    expect(riga.textContent).toContain('Targa AB123CD');
    expect(accetta('r1').textContent!.trim()).toBe('Accetta');
    expect(app().querySelector('[data-vicine] p.text-body-secondary.mb-0')).toBeNull();
  });

  it('«Accetta» apre il dialogo; annullando non si accetta nulla', async () => {
    caricaRichiesteVicine.mockResolvedValue([vicina()]);
    await apri();
    accetta('r1').click();
    expect(dialogo()?.querySelector('h2')?.textContent).toBe('Accetti la richiesta?');
    expect(dialogo()?.open).toBe(true);
    expect(accettaRichiestaStrada).not.toHaveBeenCalled();
    annulla().click();
    expect(dialogo()).toBeNull();
    expect(accettaRichiestaStrada).not.toHaveBeenCalled();
  });

  it('confermando accetta una volta con (id, officina), rilegge e chiude il dialogo', async () => {
    caricaRichiesteVicine.mockResolvedValueOnce([vicina()]).mockResolvedValueOnce([]);
    caricaRichiesteAccettate.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        id: 'r1',
        stato: 'ACCETTATA',
        officina_id: ID_OFFICINA,
        descrizione: 'Gomma a terra sulla statale',
        targa: null,
        telefono: '+39 333 1234567',
        latitudine: 45.5,
        longitudine: 9.2,
        accettata_il: '2099-01-01T11:30:00Z',
        scade_il: '2099-01-01T12:00:00Z',
      } satisfies RichiestaAccettata,
    ]);
    await apri();
    accetta('r1').click();
    conferma().click();
    await vi.waitFor(() => expect(dialogo()).toBeNull());
    expect(accettaRichiestaStrada).toHaveBeenCalledTimes(1);
    expect(accettaRichiestaStrada).toHaveBeenCalledWith('r1', ID_OFFICINA);
    expect(caricaRichiesteVicine).toHaveBeenCalledTimes(2);
    expect(testo('[data-vicine] p')).toBe(
      'Nessuna richiesta nel tuo raggio. Questa pagina si aggiorna da sola.',
    );
    expect(
      app().querySelector('[data-accettate] [data-azione="chiudi"][data-id="r1"]'),
    ).not.toBeNull();
    expect(app().querySelector('[data-accettate] a[href="tel:+393331234567"]')).not.toBeNull();
  });

  it('se l’accettazione fallisce, l’errore resta nel dialogo che resta aperto', async () => {
    // L'errore tradotto nasce dal codice d'origine della funzione SQL, non dal testo scritto qui
    let atteso = '';
    accettaRichiestaStrada.mockImplementation(async () => {
      const errore = traduci({ message: 'RICHIESTA_NON_DISPONIBILE' });
      atteso = (errore as Error).message;
      throw errore;
    });
    caricaRichiesteVicine.mockResolvedValue([vicina()]);
    await apri();
    accetta('r1').click();
    conferma().click();
    await vi.waitFor(() => expect(erroreDialogo().hidden).toBe(false));
    expect(atteso).toBe(MESSAGGI.RICHIESTA_NON_DISPONIBILE);
    expect(atteso).toContain('non è più disponibile');
    expect(erroreDialogo().textContent!.trim()).toBe(atteso);
    expect(dialogo()?.open).toBe(true);
    expect(conferma().disabled).toBe(false);
    expect(accettaRichiestaStrada).toHaveBeenCalledTimes(1);
    // l'elenco si rilegge comunque: la richiesta potrebbe essere stata presa da un'altra officina
    await vi.waitFor(() => expect(caricaRichiesteVicine).toHaveBeenCalledTimes(2));
  });

  describe('aggiornamento periodico', () => {
    beforeEach(() => {
      // solo gli intervalli: setTimeout e Date restano veri, i vi.waitFor funzionano
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    });

    it('ogni 15 s rilegge le richieste e si ferma quando si lascia la pagina', async () => {
      caricaRichiesteVicine.mockResolvedValueOnce([]).mockResolvedValueOnce([vicina()]);
      await apri();
      expect(caricaRichiesteVicine).toHaveBeenCalledTimes(1);
      expect(caricaRichiesteAccettate).toHaveBeenCalledTimes(1);
      expect(app().querySelector('[data-azione="accetta"]')).toBeNull();

      await vi.advanceTimersByTimeAsync(INTERVALLO_AGGIORNAMENTO_MS);
      await vi.waitFor(() => expect(accetta('r1')).not.toBeNull());
      expect(caricaRichiesteVicine).toHaveBeenCalledTimes(2);
      expect(caricaRichiesteAccettate).toHaveBeenCalledTimes(2);

      stato.ancora = false;
      await vi.advanceTimersByTimeAsync(INTERVALLO_AGGIORNAMENTO_MS * 2);
      expect(caricaRichiesteVicine).toHaveBeenCalledTimes(2);
      expect(caricaRichiesteAccettate).toHaveBeenCalledTimes(2);
    });
  });
});

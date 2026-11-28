// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as M_officina from '../lib/officina';
import type * as M_profilo from '../lib/profilo';
import type * as M_comune from './comune';

// Le icone creano SVG con `document`: qui bastano segnaposto
vi.mock('../ui/icone', () => ({ icona: () => '<svg></svg>' }));

const { caricaControllo, caricaDatiUtente, eliminaControllo, modificaControllo, vaiConConferma } =
  vi.hoisted(() => ({
    caricaControllo: vi.fn(),
    caricaDatiUtente: vi.fn(),
    eliminaControllo: vi.fn(),
    modificaControllo: vi.fn(),
    vaiConConferma: vi.fn(),
  }));

vi.mock('../lib/officina', async (importOriginal) => ({
  ...(await importOriginal<typeof M_officina>()),
  caricaControllo,
  modificaControllo,
  eliminaControllo,
}));
vi.mock('../lib/profilo', async (importOriginal) => ({
  ...(await importOriginal<typeof M_profilo>()),
  caricaDatiUtente,
}));
vi.mock('../lib/router', () => ({
  visualizzazioneCorrente: () => 1,
  ancoraAttuale: () => true,
  vaiA: vi.fn(),
}));
vi.mock('../lib/supabase', () => ({ getSupabase: () => ({}), chiaveSessione: () => 'chiave' }));
vi.mock('./comune', async (importOriginal) => ({
  ...(await importOriginal<typeof M_comune>()),
  vaiConConferma,
}));

import type { ControlloDaCorreggere, Pneumatico } from '../lib/officina';
import { mostraModificaControllo } from './modifica-controllo';

const ID_CONTROLLO = '11111111-1111-4111-8111-111111111111';

const ruota = (posizione: Pneumatico['posizione']): Pneumatico => ({
  id: `p-${posizione}`,
  veicolo_id: 'v1',
  officina_id: 'o1',
  posizione,
  stagione: 'ESTIVO',
  marca: 'Michelin',
  modello: 'Primacy',
  misura: '205/55 R16',
  dot: null,
  montato_il: '2026-01-01',
  smontato_il: null,
  origine: 'APP',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
});

// Le misure arrivano in ordine sparso: la pagina le mette in ordine di posizione
const controllo = (officinaId = 'o1'): ControlloDaCorreggere => ({
  id: ID_CONTROLLO,
  veicolo_id: 'v1',
  officina_id: officinaId,
  eseguito_il: '2026-11-10',
  km: 41250,
  note: 'Tutto a posto',
  veicolo: { targa: 'AB123CD' },
  misure: [
    {
      battistrada_mm: 3.5,
      pressione_bar: null,
      usura: null,
      danni: '',
      pneumatico: ruota('POST_SX'),
    },
    {
      battistrada_mm: 5.5,
      pressione_bar: 2.3,
      usura: 'REGOLARE',
      danni: 'Piccolo taglio',
      pneumatico: ruota('ANT_SX'),
    },
  ],
});

const campoDi = (nome: string) => document.querySelector<HTMLInputElement>(`[name="${nome}"]`)!;
const scrivi = (nome: string, valore: string) => {
  const el = campoDi(nome);
  el.value = valore;
  el.dispatchEvent(new Event('input', { bubbles: true }));
};
const invia = async () => {
  document
    .querySelector('form')!
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await new Promise((r) => setTimeout(r, 0));
};
const riquadroErrore = () => document.querySelector<HTMLElement>('[data-errore-modulo]')!;

const monta = async (id: string | null = ID_CONTROLLO) => {
  history.replaceState(
    null,
    '',
    id === null ? '/controllo/modifica' : `/controllo/modifica?id=${id}`,
  );
  const app = document.createElement('div');
  document.body.append(app);
  await mostraModificaControllo(app);
  return app;
};

beforeEach(() => {
  caricaControllo.mockResolvedValue(controllo());
  caricaDatiUtente.mockResolvedValue({ officine: [{ officina: { id: 'o1' } }] });
  modificaControllo.mockResolvedValue(undefined);
});
afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('Modifica controllo', () => {
  it('riempie i campi con i valori del controllo, ruote in ordine di posizione', async () => {
    await monta();
    expect(caricaControllo).toHaveBeenCalledExactlyOnceWith(ID_CONTROLLO);
    expect(document.querySelector('h1')?.textContent).toContain('Correggi controllo');
    expect(campoDi('eseguito_il').value).toBe('2026-11-10');
    expect(campoDi('km').value).toBe('41250');
    expect(campoDi('note').value).toBe('Tutto a posto');
    expect(campoDi('mm_ANT_SX').value).toBe('5,5');
    expect(campoDi('bar_ANT_SX').value).toBe('2,3');
    expect(campoDi('danni_ANT_SX').value).toBe('Piccolo taglio');
    expect(campoDi('mm_POST_SX').value).toBe('3,5');
    expect(campoDi('bar_POST_SX').value).toBe('');
    const nomiMm = [...document.querySelectorAll<HTMLInputElement>('[name^="mm_"]')].map(
      (e) => e.name,
    );
    expect(nomiMm).toEqual(['mm_ANT_SX', 'mm_POST_SX']);
  });

  it('invio con un valore cambiato: modificaControllo una volta e conferma', async () => {
    await monta();
    scrivi('mm_POST_SX', '2,5');
    await invia();
    expect(modificaControllo).toHaveBeenCalledExactlyOnceWith(ID_CONTROLLO, {
      eseguito_il: '2026-11-10',
      km: 41250,
      note: 'Tutto a posto',
      misure: [
        {
          posizione: 'ANT_SX',
          battistrada_mm: 5.5,
          pressione_bar: 2.3,
          usura: 'REGOLARE',
          danni: 'Piccolo taglio',
        },
        { posizione: 'POST_SX', battistrada_mm: 2.5, pressione_bar: null, usura: null, danni: '' },
      ],
    });
    expect(vaiConConferma).toHaveBeenCalledExactlyOnceWith(
      '/veicolo?id=v1',
      'Controllo aggiornato.',
    );
  });

  it('controllo assente: pagina "non trovato" e nessun modulo', async () => {
    caricaControllo.mockResolvedValue(null);
    await monta();
    expect(document.querySelector('h1')?.textContent).toBe('Controllo non trovato');
    expect(document.querySelector('form')).toBeNull();
  });

  it('controllo di un\'altra officina: "non trovato" e nessun modulo', async () => {
    caricaControllo.mockResolvedValue(controllo('o2'));
    await monta();
    expect(document.querySelector('h1')?.textContent).toBe('Controllo non trovato');
    expect(document.querySelector('form')).toBeNull();
  });

  it('id non valido: "non trovato" senza interrogare i dati', async () => {
    await monta('non-un-uuid');
    expect(document.querySelector('h1')?.textContent).toBe('Controllo non trovato');
    expect(caricaControllo).not.toHaveBeenCalled();
    expect(document.querySelector('form')).toBeNull();
  });

  it('errore di salvataggio: messaggio nel riquadro e nessuna conferma', async () => {
    modificaControllo.mockRejectedValue(new Error('boom'));
    await monta();
    await invia();
    expect(modificaControllo).toHaveBeenCalledTimes(1);
    expect(riquadroErrore().hidden).toBe(false);
    expect(riquadroErrore().textContent?.trim()).toBe(
      'Qualcosa è andato storto. Riprova tra poco.',
    );
    expect(vaiConConferma).not.toHaveBeenCalled();
  });
});

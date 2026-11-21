// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as routerReale from '../lib/router';
import type * as libReale from '../lib/admin-andamento';
import type { AndamentoOfficina } from '../lib/admin-andamento';

const { caricaAndamento } = vi.hoisted(() => ({ caricaAndamento: vi.fn() }));
vi.mock('../lib/admin-andamento', async (importOriginal) => ({
  ...(await importOriginal<typeof libReale>()),
  caricaAndamento,
}));
vi.mock('./admin-comune', () => ({ accessoAdmin: vi.fn().mockResolvedValue(true) }));
vi.mock('../lib/router', async (importOriginal) => ({
  ...(await importOriginal<typeof routerReale>()),
  visualizzazioneCorrente: () => 1,
  ancoraAttuale: () => true,
}));

import { mostraAdminAndamento } from './admin-andamento';

const officina = (nome: string): AndamentoOfficina => ({
  officina_id: nome,
  ragione_sociale: nome,
  stato_affiliazione: 'ATTIVA',
  clienti: 1,
  clienti_collegati: 1,
  clienti_con_push: 1,
  inviti_creati: 1,
  controlli_app: 1,
  controlli_importati: 1,
  richieste_appuntamento: 1,
  richieste_strada_accettate: 1,
});

function differita<T>() {
  let risolvi!: (v: T) => void;
  let rifiuta!: (e: unknown) => void;
  const promessa = new Promise<T>((ok, ko) => {
    risolvi = ok;
    rifiuta = ko;
  });
  return { promessa, risolvi, rifiuta };
}

const app = () => document.getElementById('app')!;
const selettore = () => app().querySelector<HTMLSelectElement>('#tc-periodo')!;
const elenco = () => app().querySelector<HTMLElement>('[data-elenco]')!.innerHTML;
const avviso = () => app().querySelector<HTMLElement>('[data-errore-carica]')!;
const cambia = (valore: string) => {
  selettore().value = valore;
  selettore().dispatchEvent(new Event('change'));
};
const microtask = () => new Promise((r) => setTimeout(r, 0));
const TESTO = 'Non riesco a leggere i numeri. Riprova tra poco.';

beforeEach(async () => {
  document.body.innerHTML = '<div id="app"></div>';
  caricaAndamento.mockReset();
  caricaAndamento.mockResolvedValueOnce([officina('Prima Srl')]);
  await mostraAdminAndamento(app());
});

describe('admin andamento: cambio di periodo', () => {
  it('parte da questa settimana', () => {
    expect(selettore().value).toBe('questa');
    expect(elenco()).toContain('Prima Srl');
  });

  it('se il caricamento fallisce il selettore torna al periodo mostrato', async () => {
    const prima = elenco();
    caricaAndamento.mockRejectedValueOnce(new Error('rete'));
    cambia('30giorni');
    await microtask();
    expect(selettore().value).toBe('questa');
    expect(avviso().hidden).toBe(false);
    expect(avviso().textContent).toContain(TESTO);
    expect(elenco()).toBe(prima);
  });

  it('se il caricamento riesce il selettore e l’elenco sono quelli nuovi', async () => {
    caricaAndamento.mockResolvedValueOnce([officina('Seconda Srl')]);
    cambia('30giorni');
    await microtask();
    expect(selettore().value).toBe('30giorni');
    expect(elenco()).toContain('Seconda Srl');
    expect(avviso().hidden).toBe(true);
  });

  it('due cambi rapidi, il primo fallisce dopo il secondo: resta il valore del secondo', async () => {
    const primo = differita<AndamentoOfficina[]>();
    const secondo = differita<AndamentoOfficina[]>();
    caricaAndamento.mockReturnValueOnce(primo.promessa).mockReturnValueOnce(secondo.promessa);
    cambia('scorsa');
    cambia('30giorni');
    secondo.risolvi([officina('Seconda Srl')]);
    await microtask();
    primo.rifiuta(new Error('rete'));
    await microtask();
    expect(selettore().value).toBe('30giorni');
    expect(elenco()).toContain('Seconda Srl');
    expect(avviso().hidden).toBe(true);
  });
});

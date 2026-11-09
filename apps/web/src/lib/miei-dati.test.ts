import { describe, expect, it, vi } from 'vitest';
import { componiMieiDati, raccogliMieiDati, type PartiMieiDati } from './miei-dati';

const chiamate: { tabella: string; filtri: [string, unknown][] }[] = [];

vi.mock('./auth', () => ({
  sessioneCorrente: () => ({ user: { id: 'utente-1', email: 'cliente@tyrecare.test' } }),
}));
vi.mock('./garage', () => ({ caricaGarage: async () => [] }));
vi.mock('./supabase', () => ({
  getSupabase: () => ({
    from: (tabella: string) => {
      const chiamata = { tabella, filtri: [] as [string, unknown][] };
      chiamate.push(chiamata);
      const q: Record<string, unknown> = {};
      q.select = () => q;
      q.eq = (col: string, val: unknown) => {
        chiamata.filtri.push([col, val]);
        return q;
      };
      q.order = () => q;
      q.range = () => Promise.resolve({ data: [], error: null });
      q.single = () => Promise.resolve({ data: { id: 'utente-1' }, error: null });
      q.then = (ok: (v: unknown) => unknown) => Promise.resolve({ count: 0, error: null }).then(ok);
      return q;
    },
  }),
}));

const parti: PartiMieiDati = {
  email: 'cliente@tyrecare.test',
  profilo: { id: 'p1', nome: 'Carlo', cognome: 'Bianchi', telefono: '+39 333 1234567' },
  clientiOfficine: [{ id: 'c1', officina: { ragione_sociale: 'Gomme Rossi' } }],
  garage: [],
  prenotazioni: [{ id: 'b1', targa: 'AB123CD' }],
  richiesteStrada: [
    { id: 'r1', targa: 'AB123CD' },
    { id: 'r2', targa: null },
  ],
  notifiche: [{ id: 'n1', titolo: 'Confermata' }],
  commenti: [],
  officineLavoro: [],
  iscrizioniPush: 2,
};

describe('componiMieiDati', () => {
  it('restituisce versione, data e tutte le chiavi previste', () => {
    const r = componiMieiDati(parti, '2026-10-25T10:00:00.000Z');
    expect(r.versione).toBe(1);
    expect(r.generato_il).toBe('2026-10-25T10:00:00.000Z');
    expect(Object.keys(r)).toEqual([
      'versione',
      'generato_il',
      'account',
      'profilo',
      'clienti_officine',
      'garage',
      'prenotazioni',
      'richieste_strada',
      'notifiche',
      'commenti',
      'officine_lavoro',
      'iscrizioni_push',
    ]);
    expect(r.account).toEqual({ email: 'cliente@tyrecare.test' });
    expect(r.clienti_officine).toEqual(parti.clientiOfficine);
    expect(r.prenotazioni).toEqual(parti.prenotazioni);
  });

  it('include le richieste di aiuto su strada', () => {
    const r = componiMieiDati(parti, '2026-10-25T10:00:00.000Z');
    expect(r.richieste_strada).toEqual([
      { id: 'r1', targa: 'AB123CD' },
      { id: 'r2', targa: null },
    ]);
  });

  it('esporta le iscrizioni push solo come numero, senza chiavi del browser', () => {
    const r = componiMieiDati(parti, '2026-10-25T10:00:00.000Z');
    expect(r.iscrizioni_push).toBe(2);
    const json = JSON.stringify(r);
    for (const chiave of ['endpoint', 'p256dh', 'auth']) {
      expect(json).not.toContain(`"${chiave}"`);
    }
  });
});

describe('raccogliMieiDati', () => {
  it("legge le richieste su strada filtrando per cliente_id dell'utente", async () => {
    chiamate.length = 0;
    const r = await raccogliMieiDati();
    expect(r.richieste_strada).toEqual([]);
    const c = chiamate.find((x) => x.tabella === 'richieste_strada');
    expect(c?.filtri).toEqual([['cliente_id', 'utente-1']]);
  });
});

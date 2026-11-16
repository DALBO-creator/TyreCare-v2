import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  caricaAndamento,
  ordinaOfficine,
  periodoScelto,
  rigaCopiabile,
  settimana,
  testoCopiabile,
  type AndamentoOfficina,
} from './admin-andamento';

const rpc = vi.fn();
vi.mock('./supabase', () => ({ getSupabase: () => ({ rpc }) }));

const o = (nome: string, over: Partial<AndamentoOfficina> = {}): AndamentoOfficina => ({
  officina_id: nome,
  ragione_sociale: nome,
  stato_affiliazione: 'ATTIVA',
  clienti: 12,
  clienti_collegati: 5,
  clienti_con_push: 3,
  inviti_creati: 2,
  controlli_app: 4,
  controlli_importati: 10,
  richieste_appuntamento: 1,
  richieste_strada_accettate: 0,
  ...over,
});

describe('settimana', () => {
  it('mercoledì → lunedì e domenica della stessa settimana', () => {
    expect(settimana('2026-11-18')).toEqual({ da: '2026-11-16', a: '2026-11-22' });
  });
  it('lunedì → lui stesso', () => {
    expect(settimana('2026-11-16')).toEqual({ da: '2026-11-16', a: '2026-11-22' });
  });
  it('domenica → lunedì precedente', () => {
    expect(settimana('2026-11-22')).toEqual({ da: '2026-11-16', a: '2026-11-22' });
  });
  it('cambio d’anno: venerdì 2027-01-01', () => {
    expect(settimana('2027-01-01')).toEqual({ da: '2026-12-28', a: '2027-01-03' });
  });
});

describe('periodoScelto', () => {
  it('questa, scorsa e ultimi 30 giorni', () => {
    expect(periodoScelto('questa', '2026-11-18')).toEqual({ da: '2026-11-16', a: '2026-11-22' });
    expect(periodoScelto('scorsa', '2026-11-18')).toEqual({ da: '2026-11-09', a: '2026-11-15' });
    expect(periodoScelto('30giorni', '2026-11-18')).toEqual({ da: '2026-10-20', a: '2026-11-18' });
  });
  it('settimana scorsa a cavallo dell’anno', () => {
    expect(periodoScelto('scorsa', '2027-01-04')).toEqual({ da: '2026-12-28', a: '2027-01-03' });
  });
});

describe('ordinaOfficine', () => {
  it('ATTIVE per nome, le altre in fondo; non modifica l’ingresso', () => {
    const entrata = [
      o('Zeta'),
      o('Alfa', { stato_affiliazione: 'IN_ATTESA' }),
      o('Beta'),
      o('Beta2', { stato_affiliazione: 'SOSPESA' }),
    ];
    expect(ordinaOfficine(entrata).map((r) => r.ragione_sociale)).toEqual([
      'Beta',
      'Zeta',
      'Alfa',
      'Beta2',
    ]);
    expect(entrata[0]!.ragione_sociale).toBe('Zeta');
  });
});

describe('testo da copiare', () => {
  const p = { da: '2026-11-16', a: '2026-11-22' };
  it('una riga per officina con tutti i numeri', () => {
    expect(rigaCopiabile(o('Gomme Rossi'), p)).toBe(
      'Gomme Rossi (dal 2026-11-16 al 2026-11-22): clienti 12, collegati 5, con notifiche 3; ' +
        'inviti creati 2; controlli inseriti 4, importati 10; richieste di appuntamento 1; aiuto su strada 0',
    );
  });
  it('più officine: una riga ciascuna, nell’ordine delle carte', () => {
    const righe = testoCopiabile([o('B'), o('A')], p).split('\n');
    expect(righe).toHaveLength(2);
    expect(righe[0]).toMatch(/^A /);
  });
  it('nessuna officina → testo vuoto', () => {
    expect(testoCopiabile([], p)).toBe('');
  });
});

describe('caricaAndamento', () => {
  beforeEach(() => rpc.mockReset());
  it('chiama la funzione con il periodo', async () => {
    rpc.mockResolvedValue({ data: [o('A')], error: null });
    expect(await caricaAndamento('2026-11-16', '2026-11-22')).toHaveLength(1);
    expect(rpc).toHaveBeenCalledWith('andamento_officine', {
      p_da: '2026-11-16',
      p_a: '2026-11-22',
    });
  });
  it('errore → lo rilancia; dati nulli → elenco vuoto', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'x' } });
    await expect(caricaAndamento('a', 'b')).rejects.toEqual({ message: 'x' });
    rpc.mockResolvedValueOnce({ data: null, error: null });
    expect(await caricaAndamento('a', 'b')).toEqual([]);
  });
});

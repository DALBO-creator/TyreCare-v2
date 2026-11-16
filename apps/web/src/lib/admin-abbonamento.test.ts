import { describe, expect, it, vi } from 'vitest';
import {
  ModuloAbbonamentoSchema,
  caricaAbbonamentoAdmin,
  impostaAbbonamento,
  traduciErroreAbbonamento,
} from './admin-abbonamento';
import { ErroreModulo } from './errori';

const maybeSingle = vi.fn();
const rpc = vi.fn((nome: string) =>
  nome === 'admin_leggi_abbonamento' ? { maybeSingle } : esitoRpc,
);
let esitoRpc: { error: unknown; data?: unknown } = { error: null };
vi.mock('./supabase', () => ({ getSupabase: () => ({ rpc }) }));

const base = {
  piano: 'MENSILE',
  stato: 'ATTIVO',
  prova_fino_al: '',
  iniziato_il: '2026-11-01',
  scade_il: '2026-11-30',
  importo: '',
  note: '  bonifico ricevuto  ',
};

describe('ModuloAbbonamentoSchema', () => {
  it('trasforma i campi vuoti in null e pulisce le note', () => {
    expect(ModuloAbbonamentoSchema.parse(base)).toEqual({
      piano: 'MENSILE',
      stato: 'ATTIVO',
      prova_fino_al: null,
      iniziato_il: '2026-11-01',
      scade_il: '2026-11-30',
      importo: null,
      note: 'bonifico ricevuto',
    });
  });

  it('legge l’importo con la virgola', () => {
    expect(ModuloAbbonamentoSchema.parse({ ...base, importo: '90,50' }).importo).toBe(90.5);
    const r = ModuloAbbonamentoSchema.safeParse({ ...base, importo: '-3' });
    expect(r.error?.issues[0]?.path).toEqual(['importo']);
  });

  it('chiede la scadenza per un abbonamento attivo', () => {
    const r = ModuloAbbonamentoSchema.safeParse({ ...base, scade_il: '' });
    expect(r.error?.issues.map((i) => i.path[0])).toEqual(['scade_il']);
  });

  it('rifiuta un inizio dopo la scadenza e lo stato SOSPESO', () => {
    const r = ModuloAbbonamentoSchema.safeParse({ ...base, iniziato_il: '2026-12-01' });
    expect(r.error?.issues[0]?.path).toEqual(['iniziato_il']);
    expect(ModuloAbbonamentoSchema.safeParse({ ...base, stato: 'SOSPESO' }).success).toBe(false);
  });
});

describe('traduciErroreAbbonamento', () => {
  it('traduce le chiavi della funzione SQL, con il campo', () => {
    const e = traduciErroreAbbonamento({ message: 'SCADENZA_MANCANTE' });
    expect(e).toBeInstanceOf(ErroreModulo);
    expect((e as ErroreModulo).campo).toBe('scade_il');
  });
  it('42501: solo l’amministratore', () => {
    const e = traduciErroreAbbonamento({ code: '42501', message: 'Accesso riservato' });
    expect((e as ErroreModulo).codice).toBe('42501');
  });
  it('lascia passare gli altri errori', () => {
    const originale = new Error('rete');
    expect(traduciErroreAbbonamento(originale)).toBe(originale);
  });
});

describe('caricaAbbonamentoAdmin', () => {
  it('officina non trovata: null', async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'OFFICINA_NON_TROVATA' } });
    expect(await caricaAbbonamentoAdmin('x')).toBeNull();
  });
  it('importo numerico e valori sconosciuti con un ripiego', async () => {
    maybeSingle.mockResolvedValueOnce({
      data: { piano: 'STARTER', stato: 'ATTIVO', importo_concordato: '90.00' },
      error: null,
    });
    const a = await caricaAbbonamentoAdmin('x');
    expect(a?.piano).toBe('MENSILE');
    expect(a?.importo_concordato).toBe(90);
  });
});

describe('impostaAbbonamento', () => {
  it('non manda i campi vuoti (la funzione SQL tiene la fine della prova)', async () => {
    esitoRpc = { error: null };
    await impostaAbbonamento('o1', ModuloAbbonamentoSchema.parse(base));
    expect(rpc).toHaveBeenLastCalledWith('admin_imposta_abbonamento', {
      p_officina_id: 'o1',
      p_piano: 'MENSILE',
      p_stato: 'ATTIVO',
      p_iniziato_il: '2026-11-01',
      p_scade_il: '2026-11-30',
      p_note: 'bonifico ricevuto',
    });
  });
  it('errore tradotto', async () => {
    esitoRpc = { error: { message: 'DATE_NON_VALIDE' } };
    await expect(impostaAbbonamento('o1', ModuloAbbonamentoSchema.parse(base))).rejects.toThrow(
      'L’inizio deve venire prima della scadenza.',
    );
  });
});

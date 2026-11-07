import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErroreModulo } from './errori';

const mock = vi.hoisted(() => ({
  utente: { id: 'u1' } as { id: string } | null,
  risposta: { data: { email_notifiche: false }, error: null } as {
    data: unknown;
    error: { code?: string; message: string } | null;
  },
  update: [] as unknown[],
  eq: [] as unknown[][],
  single: 0,
}));
vi.mock('./supabase', () => ({
  getSupabase: () => {
    const q: Record<string, unknown> = {};
    q.select = () => q;
    q.update = (dati: unknown) => (mock.update.push(dati), q);
    q.eq = (...args: unknown[]) => (mock.eq.push(args), q);
    q.single = async () => (mock.single++, mock.risposta);
    return {
      from: () => q,
      auth: { getUser: async () => ({ data: { user: mock.utente }, error: null }) },
    };
  },
}));

import {
  leggiEmailNotifiche,
  numeroBadge,
  salvaEmailNotifiche,
  tempoTrascorso,
  testoNonLette,
} from './notifiche';

describe('email di riserva', () => {
  beforeEach(() => {
    mock.utente = { id: 'u1' };
    mock.risposta = { data: { email_notifiche: false }, error: null };
    mock.update = [];
    mock.eq = [];
    mock.single = 0;
  });

  it('legge il valore del proprio profilo', async () => {
    await expect(leggiEmailNotifiche()).resolves.toBe(false);
    expect(mock.eq).toEqual([['id', 'u1']]);
  });

  it('salva passando solo email_notifiche, sul proprio profilo', async () => {
    await salvaEmailNotifiche(false);
    expect(mock.update).toEqual([{ email_notifiche: false }]);
    expect(mock.eq).toEqual([['id', 'u1']]);
    expect(mock.single).toBe(1);
  });

  it('riga assente (PGRST116) → ErroreModulo', async () => {
    mock.risposta = { data: null, error: { code: 'PGRST116', message: '0 rows' } };
    await expect(salvaEmailNotifiche(true)).rejects.toBeInstanceOf(ErroreModulo);
  });

  it('altri errori → Error semplice, non ErroreModulo', async () => {
    mock.risposta = { data: null, error: { code: '500', message: 'boom' } };
    const errore = await salvaEmailNotifiche(true).catch((e: unknown) => e);
    expect(errore).toBeInstanceOf(Error);
    expect(errore).not.toBeInstanceOf(ErroreModulo);
  });

  it('senza utente non scrive', async () => {
    mock.utente = null;
    await expect(salvaEmailNotifiche(true)).rejects.toThrow('Nessun utente');
    expect(mock.update).toEqual([]);
  });
});

describe('tempoTrascorso', () => {
  // Mercoledì 14 ottobre 2026, 15:30 in Italia (ora legale, UTC+2)
  const adesso = new Date('2026-10-14T13:30:00Z');

  it('meno di un minuto → "Adesso"', () => {
    expect(tempoTrascorso('2026-10-14T13:29:30Z', adesso)).toBe('Adesso');
  });

  it('minuti e ore dello stesso giorno', () => {
    expect(tempoTrascorso('2026-10-14T13:25:00Z', adesso)).toBe('5 min fa');
    expect(tempoTrascorso('2026-10-14T12:20:00Z', adesso)).toBe("Un'ora fa");
    expect(tempoTrascorso('2026-10-13T22:30:00Z', adesso)).toBe('15 ore fa'); // 00:30 italiane
  });

  it('il giorno prima in Italia → "Ieri", anche se in UTC è lo stesso giorno', () => {
    expect(tempoTrascorso('2026-10-13T21:59:00Z', adesso)).toBe('Ieri'); // 23:59 del 13
  });

  it('più vecchie → giorno e mese', () => {
    expect(tempoTrascorso('2026-10-02T08:00:00Z', adesso)).toBe('2 ott');
  });
});

describe('contatore', () => {
  it('testo per il lettore di schermo, singolare e plurale', () => {
    expect(testoNonLette(1)).toBe('1 notifica da leggere');
    expect(testoNonLette(4)).toBe('4 notifiche da leggere');
  });

  it('oltre 9 il badge mostra "9+"', () => {
    expect(numeroBadge(9)).toBe('9');
    expect(numeroBadge(12)).toBe('9+');
  });
});

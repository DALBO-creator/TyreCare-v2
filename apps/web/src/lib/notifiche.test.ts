import { describe, expect, it } from 'vitest';
import { numeroBadge, tempoTrascorso, testoNonLette } from './notifiche';

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

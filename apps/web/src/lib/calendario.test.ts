import { describe, expect, it } from 'vitest';
import {
  agendaDelGiorno,
  contaPerGiorno,
  giorniSettimana,
  lunediDi,
  posizioneInAgenda,
} from './calendario';

type P = Parameters<typeof agendaDelGiorno>[0][number] & { id: string };

const p = (id: string, dati: Partial<P>): P => ({
  id,
  stato: 'RICHIESTA',
  giorno: '2026-10-13',
  fascia: 'MATTINA',
  appuntamento: null,
  ...dati,
});

describe('settimana', () => {
  it('lunedì della settimana, anche dalla domenica e a cavallo del mese', () => {
    expect(lunediDi('2026-10-13')).toBe('2026-10-12');
    expect(lunediDi('2026-10-18')).toBe('2026-10-12');
    expect(lunediDi('2026-11-01')).toBe('2026-10-26');
  });

  it('i 7 giorni da lunedì a domenica', () => {
    expect(giorniSettimana('2026-10-15')).toEqual([
      '2026-10-12',
      '2026-10-13',
      '2026-10-14',
      '2026-10-15',
      '2026-10-16',
      '2026-10-17',
      '2026-10-18',
    ]);
  });
});

describe('agenda', () => {
  it("con l'ora fissata conta l'ora (in Italia), altrimenti giorno e fascia chiesti", () => {
    // 13:30 UTC = 15:30 in Italia (ora legale)
    expect(
      posizioneInAgenda(
        p('a', { stato: 'PROPOSTA', fascia: 'MATTINA', appuntamento: '2026-10-14T13:30:00Z' }),
      ),
    ).toEqual({ data: '2026-10-14', fascia: 'POMERIGGIO', ora: '15:30' });
    expect(posizioneInAgenda(p('b', { fascia: 'POMERIGGIO' }))).toEqual({
      data: '2026-10-13',
      fascia: 'POMERIGGIO',
      ora: null,
    });
  });

  it('per fascia: prima le ore in ordine, poi le richieste da fissare; esclusi gli annullati', () => {
    const elenco = [
      p('richiesta', {}),
      p('alle-11', { stato: 'CONFERMATA', appuntamento: '2026-10-13T09:00:00Z' }),
      p('alle-9', { stato: 'CONFERMATA', appuntamento: '2026-10-13T07:00:00Z' }),
      p('annullata', { stato: 'ANNULLATA' }),
      p('pomeriggio', { stato: 'CONFERMATA', appuntamento: '2026-10-13T13:00:00Z' }),
      p('altro-giorno', { giorno: '2026-10-14' }),
    ];
    const agenda = agendaDelGiorno(elenco, '2026-10-13');
    expect(agenda.MATTINA.map((x) => x.id)).toEqual(['alle-9', 'alle-11', 'richiesta']);
    expect(agenda.POMERIGGIO.map((x) => x.id)).toEqual(['pomeriggio']);
  });

  it('conteggio per giorno: una proposta conta nel giorno proposto', () => {
    const conta = contaPerGiorno([
      p('a', {}),
      p('b', { stato: 'PROPOSTA', appuntamento: '2026-10-15T08:00:00Z' }),
      p('c', { stato: 'RIFIUTATA' }),
    ]);
    expect(Object.fromEntries(conta)).toEqual({ '2026-10-13': 1, '2026-10-15': 1 });
  });
});

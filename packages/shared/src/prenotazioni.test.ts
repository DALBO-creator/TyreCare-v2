import { describe, expect, it } from 'vitest';
import {
  ConfermaPrenotazioneSchema,
  aggiungiGiorni,
  creaPropostaSchema,
  creaRichiestaSchema,
  fasceAperte,
  giorniPrenotabili,
  giornoSettimana,
  inItalia,
  istanteItaliano,
  oggiInItalia,
  ServizioSchema,
  testoDurata,
  testoPrezzo,
} from './prenotazioni';

// Orari di "Gomme Rossi" nel seed: lun–ven mattina e pomeriggio, sabato mattina, domenica chiuso
const ORARI = {
  lun: [
    ['08:30', '12:30'],
    ['14:30', '19:00'],
  ],
  mar: [
    ['08:30', '12:30'],
    ['14:30', '19:00'],
  ],
  mer: [
    ['08:30', '12:30'],
    ['14:30', '19:00'],
  ],
  gio: [
    ['08:30', '12:30'],
    ['14:30', '19:00'],
  ],
  ven: [
    ['08:30', '12:30'],
    ['14:30', '19:00'],
  ],
  sab: [['08:30', '12:30']],
  dom: [],
};
// Lunedì 12 ottobre 2026
const OGGI = '2026-10-12';

describe('date', () => {
  it('giorno della settimana da lunedì (0) a domenica (6)', () => {
    expect(giornoSettimana('2026-10-12')).toBe(0);
    expect(giornoSettimana('2026-10-18')).toBe(6);
  });

  it('aggiunge giorni anche a cavallo del mese e del cambio d’ora', () => {
    expect(aggiungiGiorni('2026-10-30', 3)).toBe('2026-11-02');
    expect(aggiungiGiorni('2026-03-28', 1)).toBe('2026-03-29');
  });

  it('oggi in Italia anche quando in UTC è ancora ieri', () => {
    expect(oggiInItalia(new Date('2026-10-11T22:30:00Z'))).toBe('2026-10-12');
  });

  it('ora italiana → istante, con ora solare e legale', () => {
    expect(istanteItaliano('2026-12-01', '09:30')).toBe('2026-12-01T08:30:00.000Z');
    expect(istanteItaliano('2026-10-20', '09:30')).toBe('2026-10-20T07:30:00.000Z');
    expect(inItalia('2026-10-20T07:30:00.000Z')).toEqual({ data: '2026-10-20', ora: '09:30' });
  });
});

describe('fasce di apertura (come fasce_aperte in SQL)', () => {
  it('lunedì, sabato e domenica', () => {
    expect(fasceAperte(ORARI, '2026-10-12')).toEqual(['MATTINA', 'POMERIGGIO']);
    expect(fasceAperte(ORARI, '2026-10-17')).toEqual(['MATTINA']);
    expect(fasceAperte(ORARI, '2026-10-18')).toEqual([]);
  });

  it('orario continuato, solo pomeriggio, orari non indicati', () => {
    expect(fasceAperte({ mar: [['9:00', '18:00']] }, '2026-10-13')).toEqual([
      'MATTINA',
      'POMERIGGIO',
    ]);
    expect(fasceAperte({ mer: [['14:00', '18:00']] }, '2026-10-14')).toEqual(['POMERIGGIO']);
    expect(fasceAperte({}, '2026-10-12')).toEqual([]);
    expect(fasceAperte(null, '2026-10-12')).toEqual([]);
  });

  it('giorni prenotabili: da domani, senza le domeniche', () => {
    const giorni = giorniPrenotabili(ORARI, OGGI);
    expect(giorni[0]).toEqual({ data: '2026-10-13', fasce: ['MATTINA', 'POMERIGGIO'] });
    expect(giorni.find((g) => g.data === '2026-10-17')?.fasce).toEqual(['MATTINA']);
    expect(giorni.some((g) => g.data === '2026-10-18')).toBe(false);
    expect(giorni.at(-1)!.data <= aggiungiGiorni(OGGI, 60)).toBe(true);
  });
});

describe('servizio del catalogo', () => {
  const base = { nome: 'Cambio gomme', descrizione: '', durata_minuti: '', prezzo_da: '' };

  it('prezzo e durata facoltativi', () => {
    expect(ServizioSchema.parse({ ...base, prenotabile: ['SI'] })).toEqual({
      nome: 'Cambio gomme',
      descrizione: '',
      durata_minuti: null,
      prezzo_da: null,
      prenotabile: true,
    });
  });

  it('prezzo all’italiana con il simbolo dell’euro', () => {
    const s = ServizioSchema.parse({ ...base, prezzo_da: '39,90 €', prenotabile: [] });
    expect(s.prezzo_da).toBe(39.9);
    expect(s.prenotabile).toBe(false);
  });

  it('errori su nome, durata e prezzo', () => {
    const r = ServizioSchema.safeParse({
      nome: 'X',
      descrizione: '',
      durata_minuti: '2',
      prezzo_da: '40,123',
      prenotabile: [],
    });
    expect(r.error?.issues.map((i) => i.path[0])).toEqual(['nome', 'durata_minuti', 'prezzo_da']);
  });

  it('testi per il cliente', () => {
    expect(testoPrezzo(40)).toBe('da 40 €');
    expect(testoPrezzo(39.9)).toBe('da 39,90 €');
    expect(testoPrezzo(null)).toBe('Su preventivo');
    expect(testoDurata(45)).toBe('45 min');
    expect(testoDurata(60)).toBe('1 h');
    expect(testoDurata(90)).toBe('1 h 30 min');
  });
});

describe('richiesta di prenotazione', () => {
  const schema = creaRichiestaSchema(ORARI, OGGI);
  const valida = {
    servizio_id: 'a1000000-0000-4000-8000-000000000001',
    targa: 'ab 123-cd',
    veicolo: ' Fiat Panda ',
    giorno: '2026-10-13',
    fascia: 'MATTINA',
    telefono: '347-111.2223',
    note: '',
  };
  const errore = (dati: Partial<typeof valida>) =>
    schema.safeParse({ ...valida, ...dati }).error?.issues.map((i) => [i.path[0], i.message]);

  it('dati puliti per richiedi_prenotazione', () => {
    expect(schema.parse(valida)).toEqual({
      ...valida,
      targa: 'AB123CD',
      veicolo: 'Fiat Panda',
      telefono: '347 111 2223',
    });
  });

  it('giorno: non oggi, non oltre 60 giorni, non quando è chiuso', () => {
    expect(errore({ giorno: OGGI })).toEqual([['giorno', 'Scegli un giorno da domani in poi']]);
    expect(errore({ giorno: aggiungiGiorni(OGGI, 61) })?.[0]?.[0]).toBe('giorno');
    expect(errore({ giorno: '2026-10-18' })).toEqual([
      ['giorno', "Quel giorno l'officina è chiusa"],
    ]);
  });

  it('fascia chiusa quel giorno', () => {
    expect(errore({ giorno: '2026-10-17', fascia: 'POMERIGGIO' })).toEqual([
      ['fascia', "Quel giorno l'officina è aperta solo la mattina"],
    ]);
  });

  it('servizio, targa, fascia e telefono obbligatori', () => {
    expect(
      errore({ servizio_id: '', targa: '', fascia: '', telefono: '' })?.map(([campo]) => campo),
    ).toEqual(['servizio_id', 'targa', 'fascia', 'telefono']);
  });
});

describe("risposta dell'officina", () => {
  it('ora con o senza zero davanti', () => {
    expect(ConfermaPrenotazioneSchema.parse({ ora: '9:30', messaggio: '' }).ora).toBe('09:30');
    expect(ConfermaPrenotazioneSchema.safeParse({ ora: '25:00', messaggio: '' }).success).toBe(
      false,
    );
  });

  it('proposta: da oggi a 60 giorni', () => {
    const schema = creaPropostaSchema(OGGI);
    expect(schema.safeParse({ giorno: OGGI, ora: '17:00', messaggio: '' }).success).toBe(true);
    expect(schema.safeParse({ giorno: '2026-10-11', ora: '17:00', messaggio: '' }).success).toBe(
      false,
    );
  });
});

import { describe, expect, it } from 'vitest';
import {
  ConfermaPrenotazioneSchema,
  GIORNI_SETTIMANA,
  TURNI,
  campiTurno,
  chiusuraIl,
  creaChiusuraSchema,
  creaOrariECapienzaSchema,
  creaOrariSchema,
  fasceLibere,
  testoChiusura,
  aggiungiGiorni,
  creaPropostaSchema,
  dividiVeicolo,
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

describe('chiusure straordinarie', () => {
  const ferie = [{ dal: '2026-10-14', al: '2026-10-15', motivo: 'Ferie' }];

  it('giorni prenotabili senza i giorni di chiusura', () => {
    const giorni = giorniPrenotabili(ORARI, OGGI, ferie).map((g) => g.data);
    expect(giorni.slice(0, 3)).toEqual(['2026-10-13', '2026-10-16', '2026-10-17']);
    expect(chiusuraIl(ferie, '2026-10-15')?.motivo).toBe('Ferie');
    expect(chiusuraIl(ferie, '2026-10-16')).toBeUndefined();
    expect(testoChiusura(ferie[0]!)).toBe('Chiuso: ferie');
  });

  it('la richiesta in un giorno di chiusura dice il motivo', () => {
    const r = creaRichiestaSchema(ORARI, OGGI, ferie).safeParse({
      servizio_id: 'a1000000-0000-4000-8000-000000000001',
      targa: 'AB123CD',
      veicolo: '',
      giorno: '2026-10-14',
      fascia: 'MATTINA',
      telefono: '3471112223',
      note: '',
    });
    expect(r.error?.issues.map((i) => [i.path[0], i.message])).toEqual([
      ['giorno', "Quel giorno l'officina è chiusa (ferie)"],
    ]);
  });

  it('periodo: da oggi, la fine dopo l’inizio, al massimo un anno', () => {
    const schema = creaChiusuraSchema(OGGI);
    expect(schema.safeParse({ dal: '2026-10-14', al: '2026-10-14', motivo: '' }).success).toBe(
      true,
    );
    const errori = (dal: string, al: string) =>
      schema.safeParse({ dal, al, motivo: '' }).error?.issues.map((i) => i.path[0]);
    expect(errori('2026-10-11', '2026-10-14')).toEqual(['dal']);
    expect(errori('2026-10-14', '2026-10-13')).toEqual(['al']);
    expect(errori('2026-10-14', '2027-10-20')).toEqual(['al']);
  });
});

describe('modulo degli orari', () => {
  const vuoto = () =>
    Object.fromEntries(
      GIORNI_SETTIMANA.flatMap((g) =>
        TURNI.flatMap((t) => Object.values(campiTurno(g, t)).map((c) => [c, ''])),
      ),
    );

  it('due turni, orario continuato, giorno chiuso; "8.30" diventa 08:30', () => {
    const orari = creaOrariSchema().parse({
      ...vuoto(),
      lun_1_apre: '8.30',
      lun_1_chiude: '12:30',
      lun_2_apre: '14:30',
      lun_2_chiude: '19:00',
      sab_1_apre: '09:00',
      sab_1_chiude: '18:00',
    });
    expect(orari.lun).toEqual([
      ['08:30', '12:30'],
      ['14:30', '19:00'],
    ]);
    expect(orari.sab).toEqual([['09:00', '18:00']]);
    expect(orari.dom).toEqual([]);
    expect(fasceAperte(orari, '2026-10-17')).toEqual(['MATTINA', 'POMERIGGIO']);
  });

  it('errori sotto il campo giusto', () => {
    const errori = (dati: Record<string, string>) =>
      creaOrariSchema()
        .safeParse({ ...vuoto(), ...dati })
        .error?.issues.map((i) => [i.path[0], i.message]);
    expect(errori({ lun_1_apre: '08:30' })).toEqual([['lun_1_chiude', "Manca l'ora di chiusura"]]);
    expect(errori({ lun_1_apre: '12:30', lun_1_chiude: '08:30' })).toEqual([
      ['lun_1_chiude', "Deve venire dopo l'apertura"],
    ]);
    expect(
      errori({
        lun_1_apre: '08:30',
        lun_1_chiude: '13:00',
        lun_2_apre: '12:00',
        lun_2_chiude: '19:00',
      }),
    ).toEqual([['lun_2_apre', 'Il secondo turno deve iniziare dopo la fine del primo']]);
    expect(errori({ mar_2_apre: '14:00', mar_2_chiude: '18:00' })).toEqual([
      ['mar_1_apre', 'Scrivi prima il primo turno'],
    ]);
    expect(errori({ mer_1_apre: '25:00', mer_1_chiude: '26:00' })?.[0]?.[1]).toBe(
      "Scrivi l'ora come 8:30",
    );
  });
});

describe('dividiVeicolo', () => {
  it('separa la marca dal modello', () => {
    expect(dividiVeicolo('Fiat Panda 1.2')).toEqual({ marca: 'Fiat', modello: 'Panda 1.2' });
    expect(dividiVeicolo('  Volkswagen   Golf ')).toEqual({ marca: 'Volkswagen', modello: 'Golf' });
  });

  it('riconosce le marche di due parole', () => {
    expect(dividiVeicolo('Alfa Romeo Giulietta')).toEqual({
      marca: 'Alfa Romeo',
      modello: 'Giulietta',
    });
    expect(dividiVeicolo('land rover Defender')).toEqual({
      marca: 'land rover',
      modello: 'Defender',
    });
  });

  it('descrizione vuota o di una parola', () => {
    expect(dividiVeicolo('')).toEqual({ marca: '', modello: '' });
    expect(dividiVeicolo('Panda')).toEqual({ marca: 'Panda', modello: '' });
  });
});

describe('capienza per fascia', () => {
  const vuoto = () =>
    Object.fromEntries(
      GIORNI_SETTIMANA.flatMap((g) =>
        TURNI.flatMap((t) => Object.values(campiTurno(g, t)).map((c) => [c, ''])),
      ),
    );
  const base = { ...vuoto(), lun_1_apre: '08:30', lun_1_chiude: '12:30' };

  it('vuoto = nessun limite; un numero da 1 a 99; altro è un errore sul campo', () => {
    const leggi = (c: string) =>
      creaOrariECapienzaSchema().safeParse({ ...base, capienza_fascia: c });
    expect(leggi('').data?.capienza).toBeNull();
    expect(leggi(' 3 ').data?.capienza).toBe(3);
    expect(leggi('99').data?.capienza).toBe(99);
    expect(leggi('').data?.orari.lun).toEqual([['08:30', '12:30']]);
    for (const c of ['0', '100', '-1', '2.5', 'abc']) {
      expect(leggi(c).error?.issues.map((i) => i.path[0])).toEqual(['capienza_fascia']);
    }
  });

  it('gli errori degli orari restano sotto il loro campo', () => {
    const r = creaOrariECapienzaSchema().safeParse({
      ...base,
      lun_1_chiude: '07:00',
      capienza_fascia: '',
    });
    expect(r.error?.issues.map((i) => i.path[0])).toEqual(['lun_1_chiude']);
  });

  it('fasceLibere toglie chiuse e piene', () => {
    const orari = {
      lun: [
        ['08:00', '12:00'],
        ['14:00', '18:00'],
      ],
    };
    const lunedi = '2026-11-02';
    expect(fasceLibere(orari, lunedi)).toEqual(['MATTINA', 'POMERIGGIO']);
    expect(fasceLibere(orari, lunedi, [], [{ giorno: lunedi, fascia: 'MATTINA' }])).toEqual([
      'POMERIGGIO',
    ]);
    expect(fasceLibere(orari, lunedi, [], [{ giorno: '2026-11-03', fascia: 'MATTINA' }])).toEqual([
      'MATTINA',
      'POMERIGGIO',
    ]);
    expect(fasceLibere(orari, lunedi, [{ dal: lunedi, al: lunedi, motivo: '' }])).toEqual([]);
    expect(
      fasceLibere(
        orari,
        lunedi,
        [],
        [
          { giorno: lunedi, fascia: 'MATTINA' },
          { giorno: lunedi, fascia: 'POMERIGGIO' },
        ],
      ),
    ).toEqual([]);
  });
});

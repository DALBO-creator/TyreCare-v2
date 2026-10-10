import { describe, expect, it } from 'vitest';
import {
  ClienteSchema,
  InvitoSchema,
  MontaPneumaticiSchema,
  SmontaPneumaticiSchema,
  VeicoloSchema,
  creaControlloSchema,
  formattaTarga,
  oggiISO,
} from './officina';

const errori = (r: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  r.error?.issues.map((i) => String(i.path[0])) ?? [];

describe('ClienteSchema', () => {
  const base = { nome: '', cognome: '', ragione_sociale: '', telefono: '', email: '', note: '' };

  it('accetta una persona e converte i campi vuoti in null', () => {
    const r = ClienteSchema.parse({ ...base, nome: ' Franco ', cognome: 'Gialli' });
    expect(r).toMatchObject({ nome: 'Franco', ragione_sociale: null, telefono: null, email: null });
  });

  it("accetta un'azienda senza nome e cognome", () => {
    expect(ClienteSchema.safeParse({ ...base, ragione_sociale: 'Trasporti Srl' }).success).toBe(
      true,
    );
  });

  it('rifiuta un cliente senza nominativo, segnalandolo sul nome', () => {
    expect(errori(ClienteSchema.safeParse(base))).toEqual(['nome']);
  });

  it("rifiuta un'email incompleta", () => {
    expect(errori(ClienteSchema.safeParse({ ...base, nome: 'A', email: 'franco@' }))).toEqual([
      'email',
    ]);
  });
});

describe('InvitoSchema', () => {
  it("pulisce l'email e la porta in minuscolo", () => {
    expect(InvitoSchema.parse({ email: ' Franco.Gialli@Esempio.IT ' })).toEqual({
      email: 'franco.gialli@esempio.it',
    });
  });

  it("rifiuta un'email vuota o incompleta", () => {
    expect(InvitoSchema.safeParse({ email: '' }).success).toBe(false);
    expect(InvitoSchema.safeParse({ email: 'franco@esempio' }).success).toBe(false);
  });
});

describe('VeicoloSchema', () => {
  const base = { targa: '', marca: '', modello: '', anno: '', telaio: '', cliente_officina_id: '' };

  it('normalizza la targa e converte anno e campi vuoti', () => {
    const r = VeicoloSchema.parse({ ...base, targa: 'ab 123-cd', anno: '2019' });
    expect(r).toMatchObject({
      targa: 'AB123CD',
      anno: 2019,
      telaio: null,
      cliente_officina_id: null,
    });
  });

  it('richiede la targa', () => {
    expect(errori(VeicoloSchema.safeParse(base))).toEqual(['targa']);
  });

  it('rifiuta anno e telaio non validi', () => {
    const r = VeicoloSchema.safeParse({ ...base, targa: 'AB123CD', anno: '19', telaio: 'ABC' });
    expect(errori(r)).toEqual(['anno', 'telaio']);
  });
});

describe('formattaTarga', () => {
  it('spazia le targhe italiane e lascia le altre', () => {
    expect(formattaTarga('AB123CD')).toBe('AB 123 CD');
    expect(formattaTarga('M1234')).toBe('M1234');
  });
});

describe('SmontaPneumaticiSchema', () => {
  it('accetta posizioni e data di oggi', () => {
    const dati = { posizioni: ['SCORTA'], smontato_il: oggiISO() };
    expect(SmontaPneumaticiSchema.parse(dati)).toEqual(dati);
  });

  it('richiede almeno una posizione e rifiuta date future o vuote', () => {
    expect(
      errori(SmontaPneumaticiSchema.safeParse({ posizioni: [], smontato_il: '2999-01-01' })),
    ).toEqual(['posizioni', 'smontato_il']);
    expect(
      errori(SmontaPneumaticiSchema.safeParse({ posizioni: ['SCORTA'], smontato_il: '' })),
    ).toEqual(['smontato_il']);
  });
});

describe('MontaPneumaticiSchema', () => {
  const base = {
    posizioni: ['ANT_SX', 'ANT_DX'],
    stagione: 'INVERNALE',
    misura: ' 175/65  r14 82t ',
    marca: 'Michelin',
    modello: '',
    dot: '',
    montato_il: oggiISO(),
  };

  it('accetta i dati e normalizza misura e DOT', () => {
    expect(MontaPneumaticiSchema.parse(base)).toMatchObject({
      misura: '175/65 R14 82T',
      dot: null,
    });
  });

  it('richiede almeno una posizione, la stagione e la misura', () => {
    const r = MontaPneumaticiSchema.safeParse({ ...base, posizioni: [], stagione: '', misura: '' });
    expect(errori(r)).toEqual(['posizioni', 'stagione', 'misura']);
  });

  it('rifiuta DOT non validi e date future', () => {
    const r = MontaPneumaticiSchema.safeParse({ ...base, dot: '5423', montato_il: '2999-01-01' });
    expect(errori(r)).toEqual(['dot', 'montato_il']);
  });
});

describe('creaControlloSchema', () => {
  const schema = creaControlloSchema(['ANT_SX', 'POST_SX', 'SCORTA']);
  const base = {
    eseguito_il: oggiISO(),
    km: '41.250',
    note: '',
    mm_ANT_SX: '6,2',
    bar_ANT_SX: '2.3',
    usura_ANT_SX: 'REGOLARE',
    danni_ANT_SX: '',
    mm_POST_SX: '1,45',
    bar_POST_SX: '',
    usura_POST_SX: '',
    danni_POST_SX: 'Bolla sul fianco',
    mm_SCORTA: '',
    bar_SCORTA: '',
    usura_SCORTA: '',
    danni_SCORTA: '',
  };

  it('trasforma il modulo nel controllo con le misure, saltando la scorta non misurata', () => {
    expect(schema.parse(base)).toEqual({
      eseguito_il: oggiISO(),
      km: 41250,
      note: '',
      misure: [
        {
          posizione: 'ANT_SX',
          battistrada_mm: 6.2,
          pressione_bar: 2.3,
          usura: 'REGOLARE',
          danni: '',
        },
        {
          posizione: 'POST_SX',
          battistrada_mm: 1.5,
          pressione_bar: null,
          usura: null,
          danni: 'Bolla sul fianco',
        },
      ],
    });
  });

  it('richiede il battistrada delle ruote montate, non della scorta', () => {
    expect(errori(schema.safeParse({ ...base, mm_ANT_SX: '' }))).toEqual(['mm_ANT_SX']);
  });

  it('rifiuta valori fuori scala o non numerici', () => {
    const r = schema.safeParse({ ...base, mm_ANT_SX: '25', bar_ANT_SX: 'due', km: '-3' });
    expect(errori(r)).toEqual(['km', 'mm_ANT_SX', 'bar_ANT_SX']);
  });
});

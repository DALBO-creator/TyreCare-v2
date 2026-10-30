import { describe, expect, it } from 'vitest';
import {
  COLONNE_CONTROLLI,
  IMPORT_CONTROLLI_SOLO_ULTIMO,
  controllaTabellaControlli,
  erroriMappaturaControlli,
  mappaturaAutomaticaControlli,
  modelloCsvControlli,
  type MappaturaControlli,
} from './importa-controlli';
import { csvRigheConErrori, tabellaDaCsv } from './importa';

const OGGI = '2026-10-25';
const INT = COLONNE_CONTROLLI.join(';');

/** Riga completa con i valori di base, sostituibili colonna per colonna. */
function riga(sovrascrivi: Partial<Record<(typeof COLONNE_CONTROLLI)[number], string>> = {}) {
  const base = {
    codice_documento: 'D1',
    targa: 'AB123CD',
    data: '2026-10-01',
    km: '45000',
    posizione: 'ANT_SX',
    battistrada_mm: '4,5',
    pressione_bar: '2,2',
    usura: '',
    danni: '',
    stagione: 'INVERNALE',
    misura: '205/55 R16',
    marca: 'Pirelli',
    modello: 'Cinturato',
    dot: '2321',
    note: '',
    ...sovrascrivi,
  };
  return COLONNE_CONTROLLI.map((c) => base[c]).join(';');
}

function controlla(righe: string[], soloUltimo = false) {
  const t = tabellaDaCsv([INT, ...righe].join('\n'))!;
  const r = controllaTabellaControlli(t, mappaturaAutomaticaControlli(t.intestazioni), {
    oggi: OGGI,
    soloUltimo,
  });
  if (!r.ok) throw new Error(r.messaggio);
  return r;
}

/** Una sola riga: la sua data (o il suo errore). */
function dataDi(testo: string) {
  const r = controlla([riga({ data: testo })]);
  return r.righe[0]?.data ?? r.errori[0]?.messaggio;
}

describe('controllaTabellaControlli: righe valide', () => {
  it('legge una riga completa nel formato della funzione SQL', () => {
    const r = controlla([riga()]);
    expect(r.errori).toEqual([]);
    expect(r.lette).toBe(1);
    expect(r.righe).toEqual([
      {
        numero: 2,
        codice_documento: 'D1',
        targa: 'AB123CD',
        data: '2026-10-01',
        km: 45000,
        posizione: 'ANT_SX',
        battistrada_mm: 4.5,
        pressione_bar: 2.2,
        usura: null,
        danni: '',
        stagione: 'INVERNALE',
        misura: '205/55 R16',
        marca: 'Pirelli',
        modello: 'Cinturato',
        dot: '2321',
        note: '',
      },
    ]);
  });

  it('accetta tutti i formati di data', () => {
    for (const d of ['2026-10-01', '01/10/2026', '1/10/2026', '01-10-2026', '1.10.2026']) {
      expect(dataDi(d)).toBe('2026-10-01');
    }
  });

  it('converte il numero seriale di Excel (giorni dal 1899-12-30)', () => {
    expect(dataDi('45567')).toBe('2024-10-02');
    expect(dataDi('45292')).toBe('2024-01-01');
  });

  it('rifiuta date inesistenti, seriali fuori intervallo e date future', () => {
    expect(dataDi('31/02/2024')).toMatch(/non è valida/);
    expect(dataDi('0')).toMatch(/non è valida/);
    expect(dataDi('100000')).toMatch(/non è valida/);
    expect(dataDi('ieri')).toMatch(/non è valida/);
    expect(dataDi('26/10/2026')).toBe('La data è nel futuro.');
    expect(dataDi('2026-10-25')).toBe('2026-10-25');
  });

  it('riconosce ogni sinonimo di posizione', () => {
    const casi: [string, string][] = [
      ['ANT_SX', 'ANT_SX'],
      ['AS', 'ANT_SX'],
      ['ant sx', 'ANT_SX'],
      ['Anteriore Sinistra', 'ANT_SX'],
      ['ant-dx', 'ANT_DX'],
      ['ad', 'ANT_DX'],
      ['ANTERIORE DESTRA', 'ANT_DX'],
      ['POST_SX', 'POST_SX'],
      ['ps', 'POST_SX'],
      ['posteriore sinistra', 'POST_SX'],
      ['POST DX', 'POST_DX'],
      ['PD', 'POST_DX'],
      ['posteriore destra', 'POST_DX'],
      ['SCORTA', 'SCORTA'],
      ['sc', 'SCORTA'],
      ['Ruota di scorta', 'SCORTA'],
    ];
    for (const [testo, atteso] of casi) {
      expect(controlla([riga({ posizione: testo })]).righe[0]?.posizione, testo).toBe(atteso);
    }
    expect(controlla([riga({ posizione: 'centro' })]).errori).toHaveLength(1);
  });

  it('legge i decimali con virgola o punto e arrotonda a un decimale', () => {
    const a = controlla([riga({ battistrada_mm: '4,56', pressione_bar: '2.24' })]).righe[0]!;
    expect(a.battistrada_mm).toBe(4.6);
    expect(a.pressione_bar).toBe(2.2);
    expect(controlla([riga({ battistrada_mm: '0' })]).righe[0]?.battistrada_mm).toBe(0);
  });

  it('km con separatore delle migliaia, vuoto o non valido', () => {
    expect(controlla([riga({ km: '45.000' })]).righe[0]?.km).toBe(45000);
    expect(controlla([riga({ km: '' })]).righe[0]?.km).toBeNull();
    expect(controlla([riga({ km: '45,5' })]).errori).toHaveLength(1);
    expect(controlla([riga({ km: '2000001' })]).errori).toHaveLength(1);
  });

  it('stagione: sinonimi, vuota → null, non valida → errore', () => {
    const s = (x: string) => controlla([riga({ stagione: x })]);
    for (const x of ['ESTIVO', 'estive', 'E', 'summer'])
      expect(s(x).righe[0]?.stagione).toBe('ESTIVO');
    for (const x of ['invernali', 'I', 'Winter']) expect(s(x).righe[0]?.stagione).toBe('INVERNALE');
    for (const x of ['QUATTRO_STAGIONI', '4 stagioni', '4S', 'all season']) {
      expect(s(x).righe[0]?.stagione).toBe('QUATTRO_STAGIONI');
    }
    expect(s('').righe[0]?.stagione).toBeNull();
    expect(s('primavera').errori).toHaveLength(1);
  });

  it('usura: minuscolo accettato, vuota → null, non valida → errore', () => {
    expect(controlla([riga({ usura: 'bordi' })]).righe[0]?.usura).toBe('BORDI');
    expect(controlla([riga({ usura: '' })]).righe[0]?.usura).toBeNull();
    expect(controlla([riga({ usura: 'tanta' })]).errori).toHaveLength(1);
  });

  it('normalizza la targa', () => {
    expect(controlla([riga({ targa: 'ab 123-cd' })]).righe[0]?.targa).toBe('AB123CD');
  });
});

describe('controllaTabellaControlli: vincoli del database (nessuna riga fuori regola in righe)', () => {
  const scartata = (sovrascrivi: Parameters<typeof riga>[0]) => {
    const r = controlla([riga(sovrascrivi)]);
    expect(r.righe).toEqual([]);
    expect(r.errori).toHaveLength(1);
    return r.errori[0]!.messaggio;
  };

  it('DOT non valido', () => {
    for (const dot of ['0021', '5421', '232', '23211', 'ABCD'])
      expect(scartata({ dot })).toMatch(/DOT/);
    expect(controlla([riga({ dot: '' })]).righe[0]?.dot).toBeNull();
    expect(controlla([riga({ dot: '5324' })]).righe).toHaveLength(1);
  });

  it('codice documento mancante o oltre 50 caratteri', () => {
    expect(scartata({ codice_documento: '' })).toMatch(/codice documento/i);
    expect(scartata({ codice_documento: 'X'.repeat(51) })).toMatch(/50/);
    expect(controlla([riga({ codice_documento: 'X'.repeat(50) })]).righe).toHaveLength(1);
  });

  it('battistrada mancante o fuori 0-20', () => {
    expect(scartata({ battistrada_mm: '' })).toMatch(/battistrada/i);
    expect(scartata({ battistrada_mm: '20,1' })).toMatch(/0 a 20/);
    expect(scartata({ battistrada_mm: 'abc' })).toMatch(/numero/);
    expect(controlla([riga({ battistrada_mm: '20' })]).righe).toHaveLength(1);
  });

  it('pressione fuori 0-9,9', () => {
    expect(scartata({ pressione_bar: '10' })).toMatch(/9,9/);
    expect(scartata({ pressione_bar: '9,96' })).toMatch(/9,9/);
    expect(controlla([riga({ pressione_bar: '9,9' })]).righe).toHaveLength(1);
  });

  it('posizione, stagione e usura non valide', () => {
    expect(scartata({ posizione: 'X' })).toMatch(/posizione/);
    expect(scartata({ stagione: 'X' })).toMatch(/stagione/);
    expect(scartata({ usura: 'X' })).toMatch(/usura/i);
  });

  it('testi troppo lunghi', () => {
    expect(scartata({ danni: 'x'.repeat(501) })).toMatch(/Danni.*500/);
    expect(scartata({ note: 'x'.repeat(2001) })).toMatch(/2000/);
    expect(scartata({ misura: 'x'.repeat(41) })).toMatch(/40/);
    expect(scartata({ marca: 'x'.repeat(51) })).toMatch(/50/);
    expect(scartata({ modello: 'x'.repeat(101) })).toMatch(/100/);
    expect(controlla([riga({ danni: 'x'.repeat(500) })]).righe).toHaveLength(1);
  });

  it('targa mancante o non valida', () => {
    expect(scartata({ targa: '' })).toMatch(/targa/i);
    expect(scartata({ targa: 'A' })).toMatch(/targa/i);
  });
});

describe('controllaTabellaControlli: documenti', () => {
  it('un documento con due targhe: errore sulle righe diverse dalla prima', () => {
    const r = controlla([
      riga({ posizione: 'ANT_SX' }),
      riga({ posizione: 'ANT_DX', targa: 'ZZ999ZZ' }),
      riga({ posizione: 'POST_SX' }),
    ]);
    // il documento entra intero o per niente: anche le righe 2 e 4 escono
    expect(r.righe).toEqual([]);
    expect(r.errori).toEqual([
      { numero: 2, messaggio: "Documento «D1» non importato: un'altra sua riga ha un errore." },
      { numero: 3, messaggio: 'Il documento D1 ha una targa diversa da quella della riga 2.' },
      { numero: 4, messaggio: "Documento «D1» non importato: un'altra sua riga ha un errore." },
    ]);
  });

  it('un documento con due date: errore sulle righe diverse dalla prima', () => {
    const r = controlla([riga(), riga({ posizione: 'ANT_DX', data: '2026-09-01' })]);
    expect(r.righe).toHaveLength(0);
    expect(r.errori.map((e) => e.numero)).toEqual([2, 3]);
    expect(r.errori[1]!.messaggio).toMatch(/data diversa/);
  });

  it('posizione doppia: errore sulla seconda', () => {
    const r = controlla([riga(), riga({ posizione: 'AS' })]);
    expect(r.righe).toEqual([]);
    expect(r.errori).toEqual([
      { numero: 2, messaggio: "Documento «D1» non importato: un'altra sua riga ha un errore." },
      { numero: 3, messaggio: 'La posizione è ripetuta nel documento D1.' },
    ]);
  });

  it('la stessa posizione in documenti diversi va bene', () => {
    const r = controlla([riga(), riga({ codice_documento: 'D2', data: '2026-10-02' })]);
    expect(r.righe).toHaveLength(2);
    expect(r.errori).toEqual([]);
  });
});

describe('soloUltimo', () => {
  const righe = [
    riga({ codice_documento: 'D1', data: '2026-01-10' }),
    riga({ codice_documento: 'D2', data: '2026-06-10' }),
    riga({ codice_documento: 'D2', data: '2026-06-10', posizione: 'ANT_DX' }),
    riga({ codice_documento: 'D3', data: '2026-06-10', targa: 'EF456GH' }),
    riga({ codice_documento: 'D4', data: '2026-02-10', targa: 'EF456GH' }),
  ];

  it('per ogni targa tiene solo il documento più recente', () => {
    const r = controlla(righe, true);
    expect(r.righe.map((x) => x.codice_documento)).toEqual(['D2', 'D2', 'D3']);
    expect(r.ignorate).toBe(2);
    expect(r.lette).toBe(5);
  });

  it('a parità di data vince il codice documento maggiore', () => {
    const r = controlla(
      [riga({ codice_documento: 'D1' }), riga({ codice_documento: 'D7', posizione: 'PD' })],
      true,
    );
    expect(r.righe.map((x) => x.codice_documento)).toEqual(['D7']);
    expect(r.ignorate).toBe(1);
  });

  it('di default non toglie nulla (scelta A)', () => {
    expect(IMPORT_CONTROLLI_SOLO_ULTIMO).toBe(false);
    const r = controlla(righe);
    expect(r.righe).toHaveLength(5);
    expect(r.ignorate).toBe(0);
  });
});

describe('documento intero', () => {
  const MSG = (d: string) => `Documento «${d}» non importato: un'altra sua riga ha un errore.`;
  const posizioni = ['ANT_SX', 'ANT_DX', 'POST_SX', 'POST_DX'];
  const doc4 = (codice: string, erratoIn = -1, extra: Record<string, string> = {}) =>
    posizioni.map((posizione, i) =>
      riga({
        codice_documento: codice,
        posizione,
        ...extra,
        ...(i === erratoIn ? { battistrada_mm: 'abc' } : {}),
      }),
    );

  it('4 righe con 1 errata: nessuna riga valida e 4 errori', () => {
    const r = controlla(doc4('D1', 2));
    expect(r.righe).toEqual([]);
    expect(r.errori.map((e) => e.numero)).toEqual([2, 3, 4, 5]);
    expect(r.errori[0]!.messaggio).toBe(MSG('D1'));
    expect(r.errori[2]!.messaggio).toMatch(/battistrada/i);
  });

  it('due documenti, uno errato: restano le righe dell altro', () => {
    const r = controlla([...doc4('D1', 0), ...doc4('D2', -1, { data: '2026-02-01' })]);
    expect(r.righe.map((x) => x.codice_documento)).toEqual(['D2', 'D2', 'D2', 'D2']);
    expect(r.errori.map((e) => e.numero)).toEqual([2, 3, 4, 5]);
  });

  it('senza errori è invariato', () => {
    const r = controlla(doc4('D1'));
    expect(r.righe).toHaveLength(4);
    expect(r.errori).toEqual([]);
  });

  it('con soloUltimo un documento errato non fa sparire il precedente completo', () => {
    const r = controlla(
      [
        riga({ codice_documento: 'D1', data: '2026-01-10' }),
        riga({ codice_documento: 'D2', data: '2026-06-10' }),
        riga({ codice_documento: 'D2', data: '2026-06-10', posizione: 'ANT_DX', usura: 'xx' }),
      ],
      true,
    );
    expect(r.righe.map((x) => x.codice_documento)).toEqual(['D1']);
    expect(r.ignorate).toBe(0);
    expect(r.errori.map((e) => e.numero)).toEqual([3, 4]);
  });

  it('la riga tolta è nel CSV da correggere con il suo messaggio', () => {
    const t = tabellaDaCsv([INT, ...doc4('D1', 1)].join('\n'))!;
    const r = controllaTabellaControlli(t, mappaturaAutomaticaControlli(t.intestazioni), {
      oggi: OGGI,
    });
    if (!r.ok) throw new Error(r.messaggio);
    const csv = csvRigheConErrori(t, r.errori);
    expect(csv.split('\r\n')).toHaveLength(5);
    expect(csv).toContain(MSG('D1'));
  });
});

describe('mappatura e tabella', () => {
  it('mappatura automatica con i sinonimi', () => {
    const m = mappaturaAutomaticaControlli([
      'N. Documento',
      'Targa',
      'Data intervento',
      'Chilometri',
      'Ruota',
      'Profondità',
      'Bar',
      'Colonna ignota',
    ]);
    expect(m).toEqual({
      codice_documento: 'N. Documento',
      targa: 'Targa',
      data: 'Data intervento',
      km: 'Chilometri',
      posizione: 'Ruota',
      battistrada_mm: 'Profondità',
      pressione_bar: 'Bar',
    });
    expect(
      mappaturaAutomaticaControlli(['pos', 'documento', 'data_controllo', 'mm', 'pressione']),
    ).toMatchObject({ posizione: 'pos', codice_documento: 'documento', data: 'data_controllo' });
  });

  it('colonna obbligatoria mancante', () => {
    const t = tabellaDaCsv('targa;data\nAB123CD;2026-10-01')!;
    const m = mappaturaAutomaticaControlli(t.intestazioni);
    expect(erroriMappaturaControlli(m, t.intestazioni)).toContain('Manca la colonna «Posizione».');
    const r = controllaTabellaControlli(t, m, { oggi: OGGI });
    expect(r.ok).toBe(false);
  });

  it('colonna associata due volte o inesistente', () => {
    const m: MappaturaControlli = { targa: 'A', data: 'A', codice_documento: 'X' };
    const e = erroriMappaturaControlli(m, ['A']);
    expect(e.some((x) => x.includes('associata due volte'))).toBe(true);
    expect(e.some((x) => x.includes('non esiste nel file'))).toBe(true);
  });

  it('file senza righe e righe vuote', () => {
    const vuoto = tabellaDaCsv(INT)!;
    const m = mappaturaAutomaticaControlli(vuoto.intestazioni);
    expect(controllaTabellaControlli(vuoto, m, { oggi: OGGI }).ok).toBe(false);
    const t = {
      ...vuoto,
      righe: [
        { numero: 2, celle: ['', '', ''] },
        { numero: 3, celle: riga().split(';') },
      ],
    };
    const r = controllaTabellaControlli(t, m, { oggi: OGGI });
    expect(r).toMatchObject({ ok: true, lette: 2, ignorate: 1 });
  });

  it('il modello si rilegge senza errori', () => {
    const t = tabellaDaCsv(modelloCsvControlli())!;
    expect(modelloCsvControlli().split('\r\n')).toHaveLength(2);
    const r = controllaTabellaControlli(t, mappaturaAutomaticaControlli(t.intestazioni), {
      oggi: OGGI,
    });
    expect(r).toMatchObject({ ok: true, errori: [] });
  });
});

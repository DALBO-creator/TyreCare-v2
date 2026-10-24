import { describe, expect, it } from 'vitest';
import {
  applicaMappatura,
  controllaImport,
  controllaTabella,
  csvClientiVeicoli,
  type ClienteDaEsportare,
  type VeicoloDaEsportare,
  csvRigheConErrori,
  erroriMappatura,
  leggiCsv,
  mappaturaAutomatica,
  modelloCsv,
  scriviCsv,
  separatoreCsv,
  tabellaDaCsv,
  type Mappatura,
} from './importa';

const INTESTAZIONE =
  'codice_cliente;nome;cognome;ragione_sociale;telefono;email;targa;marca;modello;anno;telaio';

/** Esito valido o errore del test. */
function esito(testo: string) {
  const r = controllaImport(testo);
  if (!r.ok) throw new Error(r.messaggio);
  return r;
}

describe('leggiCsv', () => {
  it('riconosce il separatore dalla prima riga', () => {
    expect(separatoreCsv('a;b;c\n1,5;2;3')).toBe(';');
    expect(separatoreCsv('a,b,c\n1;2;3')).toBe(',');
    expect(separatoreCsv('a\tb\n1\t2')).toBe('\t');
    expect(separatoreCsv('"a;b",c,d')).toBe(',');
  });

  it('gestisce virgolette, a capo nei campi, BOM e righe vuote', () => {
    const righe = leggiCsv(
      '\uFEFFnome;note\r\n"Rossi; Mario";"riga 1\nriga 2"\r\n\r\n"Detto ""Gino""";x\n',
    );
    expect(righe).toEqual([
      { numero: 1, celle: ['nome', 'note'] },
      { numero: 2, celle: ['Rossi; Mario', 'riga 1\nriga 2'] },
      { numero: 5, celle: ['Detto "Gino"', 'x'] },
    ]);
  });

  it("legge l'ultima riga senza a capo finale", () => {
    expect(leggiCsv('a,b\n1,2')).toEqual([
      { numero: 1, celle: ['a', 'b'] },
      { numero: 2, celle: ['1', '2'] },
    ]);
  });
});

describe('controllaImport', () => {
  it('il modello da scaricare è valido', () => {
    const r = esito(modelloCsv());
    expect(r.errori).toEqual([]);
    expect(r.righe).toHaveLength(2);
    expect(r.righe[1]).toMatchObject({
      cliente: { codice_gestionale: 'C0002', ragione_sociale: 'Trasporti Bianchi Srl', nome: '' },
      veicolo: { targa: 'EF456GH', anno: 2021, telaio: 'ZCFC135A005123456' },
    });
  });

  it('pulisce i valori come i moduli: targa, telefono, campi vuoti', () => {
    const r = esito(`${INTESTAZIONE}\nC1; Mario ;Rossi;;333-123.4567;;ab 123-cd;Fiat;;;`);
    expect(r.righe).toEqual([
      {
        numero: 2,
        cliente: {
          codice_gestionale: 'C1',
          nome: 'Mario',
          cognome: 'Rossi',
          ragione_sociale: null,
          telefono: '333 123 4567',
          email: null,
        },
        veicolo: { targa: 'AB123CD', marca: 'Fiat', modello: '', anno: null, telaio: null },
      },
    ]);
  });

  it('accetta intestazioni con maiuscole, spazi e sinonimi; ignora le colonne sconosciute', () => {
    const r = esito(
      'Codice,Ragione Sociale,E-mail,Targa,Colore\nC9,Ditta Srl,a@b.it,XY987ZW,rosso',
    );
    expect(r.ignorate).toEqual(['Colore']);
    expect(r.righe[0]).toMatchObject({
      cliente: { codice_gestionale: 'C9', ragione_sociale: 'Ditta Srl', email: 'a@b.it' },
      veicolo: { targa: 'XY987ZW' },
    });
  });

  it('ammette veicoli senza cliente e clienti senza veicolo', () => {
    const r = esito('codice_cliente;cognome;targa\n;;AB123CD\nC2;Bianchi;');
    expect(
      r.righe.map((x) => [x.cliente?.codice_gestionale ?? null, x.veicolo?.targa ?? null]),
    ).toEqual([
      [null, 'AB123CD'],
      ['C2', null],
    ]);
  });

  it('lo stesso cliente può avere più veicoli', () => {
    const r = esito('codice_cliente;cognome;targa\nC1;Rossi;AB123CD\nC1;Rossi;EF456GH');
    expect(r.errori).toEqual([]);
    expect(r.righe).toHaveLength(2);
  });

  it('segnala gli errori riga per riga e tiene le righe valide', () => {
    const r = esito(
      [
        INTESTAZIONE,
        'C1;Mario;Rossi;;;mario@;AB123CD;;;19;',
        ';Anna;Neri;;;;EF456GH;;;;',
        'C3;;;;;;;;;;',
        ';;;;;;;Fiat;;;',
        'C4;Luca;Blu;;;;GH789IJ;;;;',
      ].join('\n'),
    );
    expect(r.lette).toBe(5);
    expect(r.righe.map((x) => x.numero)).toEqual([6]);
    expect(r.errori).toEqual([
      { numero: 2, messaggio: "Controlla l'email: sembra incompleta (es. nome@esempio.it)" },
      { numero: 2, messaggio: "Controlla l'anno (es. 2019)" },
      {
        numero: 3,
        messaggio:
          'Manca il codice cliente: serve a riconoscere il cliente nelle importazioni successive.',
      },
      { numero: 4, messaggio: 'Inserisci nome e cognome, oppure la ragione sociale' },
      { numero: 5, messaggio: 'Inserisci la targa' },
    ]);
  });

  it('segnala targhe ripetute e clienti con dati diversi', () => {
    const r = esito(
      'codice_cliente;cognome;targa\nC1;Rossi;AB123CD\nC2;Neri;ab 123 cd\nC1;Rossini;EF456GH',
    );
    expect(r.righe.map((x) => x.numero)).toEqual([2]);
    expect(r.errori).toEqual([
      { numero: 3, messaggio: "Targa ripetuta: c'è già alla riga 2." },
      { numero: 4, messaggio: 'Il cliente C1 ha dati diversi da quelli della riga 2.' },
    ]);
  });

  it('segnala le righe con più colonne della intestazione', () => {
    const r = esito('targa;marca\nAB123CD;Fiat;Panda');
    expect(r.errori[0]?.messaggio).toMatch(/più colonne/);
  });

  it('rifiuta un file vuoto, senza dati o senza le colonne chiave', () => {
    expect(controllaImport('')).toMatchObject({ ok: false, messaggio: 'Il file è vuoto.' });
    expect(controllaImport('targa;marca\n')).toMatchObject({ ok: false });
    expect(controllaImport('nome;cognome\nMario;Rossi')).toMatchObject({ ok: false });
  });

  it('rifiuta un file troppo lungo', () => {
    const righe = Array.from({ length: 5001 }, (_, i) => `T${i}`);
    expect(controllaImport(['targa', ...righe].join('\n'))).toMatchObject({ ok: false });
  });
});

describe('mappatura delle colonne', () => {
  const FILE =
    'Id;Intestatario;Telefono fisso;Targa veicolo;Casa\r\nX1;Mario;011 7654321;ab123cd;Fiat\r\n';
  const tabella = () => tabellaDaCsv(FILE)!;
  const manuale: Mappatura = {
    codice_cliente: 'Id',
    nome: 'Intestatario',
    telefono: 'Telefono fisso',
    targa: 'Targa veicolo',
    marca: 'Casa',
  };

  it('tabellaDaCsv legge intestazioni e righe con il numero; null se vuoto', () => {
    const t = tabella();
    expect(t.intestazioni).toEqual([
      'Id',
      'Intestatario',
      'Telefono fisso',
      'Targa veicolo',
      'Casa',
    ]);
    expect(t.righe.map((r) => r.numero)).toEqual([2]);
    expect(tabellaDaCsv('')).toBeNull();
  });

  it('mappaturaAutomatica riconosce nomi e sinonimi; vince la prima intestazione', () => {
    const m = mappaturaAutomatica(['Codice', 'E-mail', 'Email', 'Targa', 'Boh']);
    expect(m).toEqual({ codice_cliente: 'Codice', email: 'E-mail', targa: 'Targa' });
  });

  it('accetta intestazioni inventate associate a mano', () => {
    expect(erroriMappatura(manuale, tabella().intestazioni)).toEqual([]);
    const r = controllaTabella(tabella(), manuale);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.errori).toEqual([]);
    expect(r.righe[0]!.veicolo).toMatchObject({ targa: 'AB123CD', marca: 'Fiat' });
    expect(r.righe[0]!.cliente).toMatchObject({ codice_gestionale: 'X1', nome: 'Mario' });
  });

  it("segnala un'intestazione usata per due colonne", () => {
    const m = { ...manuale, modello: 'Casa' };
    expect(erroriMappatura(m, tabella().intestazioni)).toEqual([
      'La colonna «Casa» del file è associata due volte.',
    ]);
    const r = controllaTabella(tabella(), m);
    expect(r).toEqual({
      ok: false,
      messaggio: 'La colonna «Casa» del file è associata due volte.',
    });
  });

  it("segnala un'intestazione che nel file non esiste", () => {
    const m = { ...manuale, anno: 'Anno inesistente' };
    const e = erroriMappatura(m, tabella().intestazioni);
    expect(e).toHaveLength(1);
    expect(e[0]).toContain('«Anno inesistente»');
    expect(controllaTabella(tabella(), m).ok).toBe(false);
  });

  it('chiede almeno la targa o il codice cliente', () => {
    const e = erroriMappatura({ nome: 'Intestatario' }, tabella().intestazioni);
    expect(e).toEqual(['Associa almeno la colonna della targa o del codice cliente.']);
    expect(erroriMappatura({ targa: 'Targa veicolo' }, tabella().intestazioni)).toEqual([]);
  });

  it('applicaMappatura: file uguale, colonne in ordine diverso, colonna mancante', () => {
    const h = tabella().intestazioni;
    expect(applicaMappatura(manuale, h)).toEqual(manuale);
    const altroOrdine = ['Casa', 'targa  veicolo', 'Id', 'Telefono Fisso', 'Intestatario', 'Extra'];
    expect(applicaMappatura(manuale, altroOrdine)).toEqual({
      codice_cliente: 'Id',
      nome: 'Intestatario',
      telefono: 'Telefono Fisso',
      targa: 'targa  veicolo',
      marca: 'Casa',
    });
    expect(applicaMappatura(manuale, ['Id', 'Intestatario', 'Targa veicolo', 'Casa'])).toBeNull();
  });

  it('ignorate = intestazioni non vuote non usate dalla mappatura', () => {
    const t = tabellaDaCsv('Id;Targa;Extra;;Casa\r\nX1;ab123cd;1;;Fiat\r\n')!;
    const r = controllaTabella(t, { codice_cliente: 'Id', targa: 'Targa' });
    expect(r.ok && r.ignorate).toEqual(['Extra', 'Casa']);
  });

  it('controllaImport dà lo stesso esito di tabella + mappatura automatica', () => {
    const testo = `${INTESTAZIONE}\r\nC1;Mario;Rossi;;;;AB123CD;Fiat;Panda;2019;\r\n`;
    const t = tabellaDaCsv(testo)!;
    expect(controllaTabella(t, mappaturaAutomatica(t.intestazioni))).toEqual(
      controllaImport(testo),
    );
  });
});

describe('scriviCsv', () => {
  it('rilegge le stesse celle con punto e virgola, virgolette e a capo dentro una cella', () => {
    const celle = [
      ['a', 'b;c', 'd'],
      ['dice "ciao"', 'riga1\nriga2', 'x\r\ny'],
      ['semplice', '', 'è ù'],
    ];
    const csv = scriviCsv(celle);
    expect(csv).toContain('"b;c"');
    expect(csv).toContain('"dice ""ciao"""');
    expect(leggiCsv(csv).map((r) => r.celle)).toEqual(celle);
  });

  it('separa le righe con \\r\\n e non mette virgolette alle celle semplici', () => {
    expect(
      scriviCsv([
        ['a', 'b'],
        ['c', 'd'],
      ]),
    ).toBe('a;b\r\nc;d');
  });
});

describe('csvRigheConErrori', () => {
  const t = tabellaDaCsv(
    [
      'targa;marca;anno',
      'AB123CD;Fiat;2019',
      'XX;Fiat;19',
      'EF456GH;Iveco', // più corta dell'intestazione: completata con una cella vuota
    ].join('\r\n'),
  )!;

  it('contiene solo le righe errate, con la colonna errore', () => {
    const csv = csvRigheConErrori(t, [
      { numero: 3, messaggio: 'Targa non valida' },
      { numero: 3, messaggio: "Controlla l'anno" },
      { numero: 4, messaggio: 'Manca qualcosa' },
    ]);
    expect(leggiCsv(csv).map((r) => r.celle)).toEqual([
      ['targa', 'marca', 'anno', 'errore'],
      ['XX', 'Fiat', '19', "Targa non valida / Controlla l'anno"],
      ['EF456GH', 'Iveco', '', 'Manca qualcosa'],
    ]);
  });

  it("senza errori restituisce solo l'intestazione", () => {
    expect(csvRigheConErrori(t, [])).toBe('targa;marca;anno;errore');
  });
});

describe('csvClientiVeicoli', () => {
  const cliente = (id: string, altro: Partial<ClienteDaEsportare> = {}): ClienteDaEsportare => ({
    id,
    codice_gestionale: `C-${id}`,
    nome: 'Mario',
    cognome: 'Rossi',
    ragione_sociale: null,
    telefono: '333 1234567',
    email: 'mario@esempio.it',
    ...altro,
  });
  const veicolo = (
    cliente_officina_id: string | null,
    targa: string,
    altro: Partial<VeicoloDaEsportare> = {},
  ): VeicoloDaEsportare => ({
    cliente_officina_id,
    targa,
    marca: 'Fiat',
    modello: 'Panda',
    anno: 2019,
    telaio: null,
    ...altro,
  });
  const righeDi = (testo: string) => leggiCsv(testo).map((r) => r.celle);

  it("l'intestazione è quella del modello", () => {
    expect(csvClientiVeicoli([], []).split('\r\n')[0]).toBe(modelloCsv().split('\r\n')[0]);
  });

  it('andata e ritorno: il file esportato si reimporta senza errori', () => {
    const f = csvClientiVeicoli(
      [
        cliente('1'),
        cliente('2', {
          codice_gestionale: 'C2',
          nome: '',
          cognome: '',
          ragione_sociale: 'Trasporti; "Bianchi" Srl',
          email: null,
        }),
      ],
      [
        veicolo('1', 'AB123CD'),
        veicolo('1', 'EF456GH', { anno: null, telaio: 'ZCFC135A005123456' }),
        veicolo('2', 'IJ789KL', { marca: 'Iveco', modello: 'Daily' }),
      ],
    );
    const t = tabellaDaCsv(f)!;
    const esito = controllaTabella(t, mappaturaAutomatica(t.intestazioni));
    expect(esito.ok).toBe(true);
    if (!esito.ok) return;
    expect(esito.errori).toEqual([]);
    expect(esito.righe).toHaveLength(3);
    expect(esito.righe.map((r) => r.veicolo?.targa)).toEqual(['AB123CD', 'EF456GH', 'IJ789KL']);
  });

  it('un cliente senza veicoli ha una riga con le colonne del veicolo vuote', () => {
    const righe = righeDi(csvClientiVeicoli([cliente('1')], []));
    expect(righe[1]).toEqual([
      'C-1',
      'Mario',
      'Rossi',
      '',
      '333 1234567',
      'mario@esempio.it',
      '',
      '',
      '',
      '',
      '',
    ]);
  });

  it('un veicolo senza cliente ha le colonne del cliente vuote', () => {
    const righe = righeDi(csvClientiVeicoli([], [veicolo(null, 'AB123CD')]));
    expect(righe[1]).toEqual(['', '', '', '', '', '', 'AB123CD', 'Fiat', 'Panda', '2019', '']);
  });

  it("l'anno nullo diventa una cella vuota", () => {
    const righe = righeDi(
      csvClientiVeicoli([cliente('1')], [veicolo('1', 'AB123CD', { anno: null })]),
    );
    expect(righe[1]![9]).toBe('');
  });

  it('ordina per nominativo e targa, con i veicoli senza cliente in fondo', () => {
    const righe = righeDi(
      csvClientiVeicoli(
        [
          cliente('1', { cognome: 'Verdi', nome: 'Anna' }),
          cliente('2', { cognome: 'Èsposito', nome: 'Carlo' }),
          cliente('3', { cognome: 'Bianchi', nome: 'Luca' }),
        ],
        [
          veicolo(null, 'AA000AA'),
          veicolo('1', 'ZZ999ZZ'),
          veicolo('1', 'BB111BB'),
          veicolo('2', 'CC222CC'),
        ],
      ),
    );
    expect(righe.slice(1).map((r) => r[6])).toEqual([
      '',
      'CC222CC',
      'BB111BB',
      'ZZ999ZZ',
      'AA000AA',
    ]);
  });

  it('punto e virgola, virgolette e a capo nei campi restano integri', () => {
    const c = cliente('1', { ragione_sociale: 'A; "B"\nC', nome: '', cognome: '' });
    const righe = righeDi(csvClientiVeicoli([c], [veicolo('1', 'AB123CD', { modello: 'Pa;nda' })]));
    expect(righe[1]![3]).toBe('A; "B"\nC');
    expect(righe[1]![8]).toBe('Pa;nda');
  });
});

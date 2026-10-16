import { describe, expect, it } from 'vitest';
import { controllaImport, leggiCsv, modelloCsv, separatoreCsv } from './importa';

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

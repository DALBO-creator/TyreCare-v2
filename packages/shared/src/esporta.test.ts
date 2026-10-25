import { describe, expect, it } from 'vitest';
import { csvControlli, type MisuraDaEsportare } from './esporta';
import { tabellaDaCsv } from './importa';
import {
  COLONNE_CONTROLLI,
  controllaTabellaControlli,
  erroriMappaturaControlli,
  mappaturaAutomaticaControlli,
} from './importa-controlli';

const misura = (extra: Partial<MisuraDaEsportare> = {}): MisuraDaEsportare => ({
  codice_documento: 'D1',
  targa: 'AB123CD',
  eseguito_il: '2026-09-14',
  km: 41250,
  posizione: 'ANT_SX',
  battistrada_mm: 4.5,
  pressione_bar: 2.2,
  usura: 'REGOLARE',
  danni: '',
  stagione: 'INVERNALE',
  misura: '175/65 R14 82T',
  marca: 'Michelin',
  modello: 'Alpin 6',
  dot: '3823',
  note: '',
  ...extra,
});

const righeDi = (csv: string) => csv.split('\r\n').map((r) => r.split(';'));

describe('csvControlli', () => {
  it("l'intestazione è quella dell'import e viene riconosciuta senza errori", () => {
    const [intestazione] = righeDi(csvControlli([]));
    expect(intestazione).toEqual([...COLONNE_CONTROLLI]);
    const m = mappaturaAutomaticaControlli(intestazione!);
    expect(erroriMappaturaControlli(m, intestazione!)).toEqual([]);
    expect(Object.keys(m)).toHaveLength(COLONNE_CONTROLLI.length);
  });

  it('scrive i decimali con la virgola e i valori nulli vuoti', () => {
    const [, riga] = righeDi(
      csvControlli([misura({ km: null, pressione_bar: null, usura: null, dot: null })]),
    );
    expect(riga).toEqual([
      'D1',
      'AB123CD',
      '2026-09-14',
      '',
      'ANT_SX',
      '4,5',
      '',
      '',
      '',
      'INVERNALE',
      '175/65 R14 82T',
      'Michelin',
      'Alpin 6',
      '',
      '',
    ]);
    expect(righeDi(csvControlli([misura({ pressione_bar: 2.2 })]))[1]![6]).toBe('2,2');
    // Un codice documento nullo (controllo fatto nell'app) resta vuoto
    expect(righeDi(csvControlli([misura({ codice_documento: null })]))[1]![0]).toBe('');
  });

  it('ordina per data, targa e posizione', () => {
    const csv = csvControlli([
      misura({ targa: 'ZZ999ZZ', eseguito_il: '2026-01-01', posizione: 'ANT_SX' }),
      misura({ targa: 'BB222BB', eseguito_il: '2026-02-01', posizione: 'POST_DX' }),
      misura({ targa: 'AA111AA', eseguito_il: '2026-02-01', posizione: 'SCORTA' }),
      misura({ targa: 'BB222BB', eseguito_il: '2026-02-01', posizione: 'ANT_DX' }),
      misura({ targa: 'BB222BB', eseguito_il: '2026-02-01', posizione: 'POST_SX' }),
      misura({ targa: 'BB222BB', eseguito_il: '2026-02-01', posizione: 'ANT_SX' }),
    ]);
    const ordine = righeDi(csv)
      .slice(1)
      .map((r) => `${r[2]} ${r[1]} ${r[4]}`);
    expect(ordine).toEqual([
      '2026-01-01 ZZ999ZZ ANT_SX',
      '2026-02-01 AA111AA SCORTA',
      '2026-02-01 BB222BB ANT_SX',
      '2026-02-01 BB222BB ANT_DX',
      '2026-02-01 BB222BB POST_SX',
      '2026-02-01 BB222BB POST_DX',
    ]);
  });

  it('un timestamp prende la data italiana, anche a cavallo della mezzanotte', () => {
    // 23:30 UTC del 14 settembre = 01:30 del 15 in Italia (ora legale)
    const estate = righeDi(csvControlli([misura({ eseguito_il: '2026-09-14T23:30:00Z' })]))[1]!;
    expect(estate[2]).toBe('2026-09-15');
    // 23:30 UTC del 14 gennaio = 00:30 del 15 in Italia (ora solare)
    const inverno = righeDi(csvControlli([misura({ eseguito_il: '2026-01-14T23:30:00Z' })]))[1]!;
    expect(inverno[2]).toBe('2026-01-15');
    // 22:30 UTC d'estate = 00:30 italiane del giorno dopo; 21:30 UTC è ancora lo stesso giorno
    expect(righeDi(csvControlli([misura({ eseguito_il: '2026-09-14T21:30:00Z' })]))[1]![2]).toBe(
      '2026-09-14',
    );
  });

  it('una nota con il punto e virgola o le virgolette va tra virgolette', () => {
    const csv = csvControlli([misura({ note: 'Sostituire; "urgente"' })]);
    expect(csv).toContain('"Sostituire; ""urgente"""');
    expect(tabellaDaCsv(csv)!.righe[0]!.celle[14]).toBe('Sostituire; "urgente"');
  });

  it("ida e ritorno: il file esportato passa il controllo dell'import con le stesse righe", () => {
    const origine = [
      misura({ codice_documento: 'D1', posizione: 'ANT_SX', battistrada_mm: 4.5 }),
      misura({
        codice_documento: 'D1',
        posizione: 'ANT_DX',
        battistrada_mm: 6,
        pressione_bar: null,
      }),
      misura({
        codice_documento: 'D2',
        targa: 'EF456GH',
        eseguito_il: '2026-10-01',
        km: null,
        posizione: 'SCORTA',
        usura: null,
        danni: 'Taglio sul fianco',
        stagione: 'ESTIVO',
        dot: null,
        note: 'Nota; con separatore',
      }),
    ];
    const tabella = tabellaDaCsv(csvControlli(origine))!;
    const m = mappaturaAutomaticaControlli(tabella.intestazioni);
    const esito = controllaTabellaControlli(tabella, m, { oggi: '2026-10-25' });
    expect(esito.ok).toBe(true);
    if (!esito.ok) return;
    expect(esito.errori).toEqual([]);
    const lette = esito.righe.map(({ numero: _n, ...r }) => r);
    expect(lette).toEqual(
      origine.map((o) => {
        const { eseguito_il, ...resto } = o;
        return { ...resto, data: eseguito_il };
      }),
    );
  });
});

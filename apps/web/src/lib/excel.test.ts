import * as XLSX from '@e965/xlsx';
import { describe, expect, it } from 'vitest';
import { tabellaDaFoglio } from './excel';

describe('tabellaDaFoglio', () => {
  it('salta le righe vuote e numera come Excel; numeri e date diventano testo', () => {
    const foglio = XLSX.utils.aoa_to_sheet([
      [],
      ['Targa', 'Nome', 'Anno', 'Immatricolazione'],
      ['AB123CD', 'Mario', 2019, new Date(Date.UTC(2019, 4, 17))],
      [],
      ['EF456GH', 'Anna', 2021],
    ]);
    const t = tabellaDaFoglio(foglio, XLSX)!;
    expect(t.intestazioni).toEqual(['Targa', 'Nome', 'Anno', 'Immatricolazione']);
    expect(t.righe.map((r) => r.numero)).toEqual([3, 5]);
    expect(t.righe[0]!.celle.slice(0, 3)).toEqual(['AB123CD', 'Mario', '2019']);
    expect(typeof t.righe[0]!.celle[3]).toBe('string');
    expect(t.righe[0]!.celle[3]).not.toBe('');
    expect(t.righe[1]!.celle).toEqual(['EF456GH', 'Anna', '2021', '']);
  });

  it('un foglio vuoto non ha tabella', () => {
    expect(tabellaDaFoglio(XLSX.utils.aoa_to_sheet([]), XLSX)).toBeNull();
  });

  it('giro completo in .xls (BIFF8): gli accenti restano intatti', () => {
    const origine = XLSX.utils.aoa_to_sheet([
      ['targa', 'nome'],
      ['AB123CD', 'Niccolò'],
    ]);
    const cartella = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(cartella, origine, 'Clienti');
    const byte = XLSX.write(cartella, { bookType: 'biff8', type: 'array' }) as ArrayBuffer;
    const letto = XLSX.read(byte, { type: 'array' });
    const t = tabellaDaFoglio(letto.Sheets[letto.SheetNames[0]!]!, XLSX)!;
    expect(t.intestazioni).toEqual(['targa', 'nome']);
    expect(t.righe).toEqual([{ numero: 2, celle: ['AB123CD', 'Niccolò'] }]);
  });
});

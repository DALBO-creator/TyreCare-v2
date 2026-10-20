import type * as Xlsx from '@e965/xlsx';
import type { WorkSheet } from '@e965/xlsx';
import type { Tabella } from '@tyrecare/shared';

// Lettura dei file Excel (.xls 97–2003 del gestionale GESTITYRE, .xlsx, .ods) nel browser (PLAN P8).
// La libreria si carica solo quando serve (`import()` dinamico): resta fuori dal codice iniziale.

/**
 * Foglio → tabella. La prima riga non vuota è l'intestazione; le righe tutte vuote si saltano;
 * `numero` è la riga come la vede l'utente in Excel (la prima è la 1).
 */
export function tabellaDaFoglio(
  foglio: WorkSheet,
  XLSX: Pick<typeof Xlsx, 'utils'>,
): Tabella | null {
  const area = foglio['!ref'];
  if (!area) return null;
  const { s, e } = XLSX.utils.decode_range(area);
  const righe: { numero: number; celle: string[] }[] = [];
  for (let r = s.r; r <= e.r; r++) {
    const celle: string[] = [];
    for (let c = s.c; c <= e.c; c++) {
      const cella = foglio[XLSX.utils.encode_cell({ r, c })] as
        { w?: string; v?: unknown } | undefined;
      celle.push(cella ? (cella.w ?? String(cella.v ?? '')) : '');
    }
    if (celle.every((x) => x.trim() === '')) continue;
    righe.push({ numero: r + 1, celle });
  }
  const [intestazione, ...dati] = righe;
  if (!intestazione) return null;
  return { intestazioni: intestazione.celle, righe: dati };
}

/** Legge il primo foglio di un file Excel. `null` se il file non ha dati. */
export async function leggiExcel(file: File): Promise<Tabella | null> {
  const XLSX = await import('@e965/xlsx');
  const cartella = XLSX.read(await file.arrayBuffer(), {
    type: 'array',
    cellFormula: false,
    cellHTML: false,
  });
  const nome = cartella.SheetNames[0];
  const foglio = nome === undefined ? undefined : cartella.Sheets[nome];
  return foglio ? tabellaDaFoglio(foglio, XLSX) : null;
}

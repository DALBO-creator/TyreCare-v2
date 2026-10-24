/** Scaricamento di file dal browser: si crea un link temporaneo e lo si fa cliccare. */

function scarica(nomeFile: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeFile;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Scarica un CSV. Il BOM iniziale fa aprire a Excel il file in UTF-8 (accenti corretti). */
export function scaricaCsv(nomeFile: string, testo: string): void {
  scarica(nomeFile, new Blob([`\uFEFF${testo}`], { type: 'text/csv;charset=utf-8' }));
}

/** Scarica dati come JSON con rientro di 2 spazi. */
export function scaricaJson(nomeFile: string, dati: unknown): void {
  scarica(
    nomeFile,
    new Blob([JSON.stringify(dati, null, 2)], { type: 'application/json;charset=utf-8' }),
  );
}

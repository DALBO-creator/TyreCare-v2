/**
 * Lettura a pagine. PostgREST restituisce al massimo 1000 righe per richiesta (`max_rows` in
 * `supabase/config.toml`): per elenchi che possono superarle si legge a pagine con `.range(da, a)`
 * finché una pagina torna più corta della dimensione richiesta.
 */

interface RispostaPagina<T> {
  data: T[] | null;
  error: unknown;
}

/**
 * Legge tutte le righe chiamando `pagina(da, a)` (estremi inclusi, come `.range`) per 0–999, 1000–1999, …
 * Si ferma alla prima pagina con meno righe di `dimensione`. Al primo errore lo lancia.
 * La query deve avere un ordinamento stabile **prima** del range, altrimenti le pagine possono
 * sovrapporsi o saltare righe.
 */
export async function leggiTutte<T>(
  pagina: (da: number, a: number) => PromiseLike<RispostaPagina<T>>,
  dimensione = 1000,
): Promise<T[]> {
  const tutte: T[] = [];
  for (let da = 0; ; da += dimensione) {
    const { data, error } = await pagina(da, da + dimensione - 1);
    if (error) throw error;
    const righe = data ?? [];
    for (const r of righe) tutte.push(r);
    if (righe.length < dimensione) return tutte;
  }
}

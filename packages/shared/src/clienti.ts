/** Il minimo di un cliente per calcolarne il nome mostrato (va bene ogni riga di `clienti_officina`). */
export interface ConNominativo {
  nome: string;
  cognome: string;
  ragione_sociale: string | null;
}

/** "Verdi Giulia" (cognome e nome), oppure la ragione sociale se c'è; `''` senza cliente. */
export function nominativo(c: ConNominativo | null): string {
  if (!c) return '';
  return c.ragione_sociale ?? `${c.cognome} ${c.nome}`.trim();
}

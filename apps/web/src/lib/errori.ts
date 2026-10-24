/**
 * Errore da mostrare così com'è nel modulo: sotto il campo `campo`, se indicato (es. "targa già
 * registrata" sotto la targa), altrimenti nel riquadro d'errore generale.
 */
export class ErroreModulo extends Error {
  constructor(
    messaggio: string,
    readonly campo?: string,
    readonly codice?: string,
  ) {
    super(messaggio);
    this.name = 'ErroreModulo';
  }
}

/** Codice d'errore di PostgreSQL/PostgREST (es. `23505` = valore duplicato), se presente. */
export function codiceErrore(errore: unknown): string | undefined {
  const codice = (errore as { code?: unknown } | null)?.code;
  return typeof codice === 'string' ? codice : undefined;
}

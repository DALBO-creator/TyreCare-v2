import { z } from 'zod';
import { TelefonoSchema } from './auth';

// Richiesta di affiliazione (R7): un gommista con un account registra la sua officina. Stessi controlli
// della funzione SQL `richiedi_affiliazione`, così l'errore compare sotto il campo.

/**
 * Vero se è una partita IVA italiana: 11 cifre, l'ultima è la cifra di controllo (algoritmo di Luhn:
 * le cifre in posizione dispari si sommano, quelle in posizione pari si raddoppiano togliendo 9 se
 * superano 9; il controllo è `(10 - somma % 10) % 10`).
 */
export function partitaIvaValida(partitaIva: string): boolean {
  if (!/^[0-9]{11}$/.test(partitaIva)) return false;
  let somma = 0;
  for (let i = 0; i < 10; i++) {
    let cifra = Number(partitaIva[i]);
    if (i % 2 === 1) {
      cifra *= 2;
      if (cifra > 9) cifra -= 9;
    }
    somma += cifra;
  }
  return (10 - (somma % 10)) % 10 === Number(partitaIva[10]);
}

export const RichiestaAffiliazioneSchema = z.object({
  ragione_sociale: z
    .string()
    .trim()
    .min(2, { error: 'Inserisci la ragione sociale (almeno 2 caratteri)', abort: true })
    .max(200, { error: 'La ragione sociale può avere al massimo 200 caratteri' }),
  partita_iva: z
    .string()
    .transform((s) => s.replace(/\s+/g, ''))
    .refine(partitaIvaValida, { error: 'Partita IVA non valida' }),
  citta: z
    .string()
    .trim()
    .min(1, { error: 'Inserisci la città', abort: true })
    .max(100, { error: 'La città può avere al massimo 100 caratteri' }),
  telefono: TelefonoSchema,
});
export type RichiestaAffiliazione = z.infer<typeof RichiestaAffiliazioneSchema>;

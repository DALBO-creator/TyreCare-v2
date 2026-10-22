import type { Commento } from '@tyrecare/shared';
import { ErroreModulo, codiceErrore } from './errori';
import { giaSalvato } from './officina';
import { conRiprova } from './rete';
import { getSupabase } from './supabase';

/**
 * Invia un commento. L'id lo sceglie il browser, così l'invio ripetuto dopo un errore di rete non crea
 * un doppione: la stessa chiave primaria dà `23505`, che vale come "già inviato".
 * `officinaId` è l'officina attiva di chi lavora in un'officina, altrimenti `null`; `percorso` è la
 * pagina da cui è partito il commento.
 */
export async function inviaCommento(
  { testo }: Commento,
  officinaId: string | null,
  percorso: string,
): Promise<void> {
  const id = crypto.randomUUID();
  const { error } = await conRiprova(() =>
    getSupabase().from('commenti').insert({ id, testo, officina_id: officinaId, percorso }),
  );
  if (!error || giaSalvato(error, 'commenti')) return;
  // Il trigger del database sollevava TROPPI_COMMENTI (20 commenti in 24 ore)
  if (codiceErrore(error) === 'P0001' && String(error.message).includes('TROPPI_COMMENTI')) {
    throw new ErroreModulo('Hai mandato molti commenti oggi: riprova domani.');
  }
  throw error;
}

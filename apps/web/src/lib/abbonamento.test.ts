import { describe, expect, it, vi } from 'vitest';
import { codiceDaErrore, messaggioPagamento } from './abbonamento';

vi.mock('./supabase', () => ({ getSupabase: () => ({}) }));

const GENERICO = 'Non riusciamo ad aprire il pagamento. Riprova tra poco.';

describe('messaggioPagamento', () => {
  it.each([
    [
      'PAGAMENTI_NON_ATTIVI',
      'Il pagamento online non è ancora attivo: per ora scrivici con «Invia un commento».',
    ],
    ['SOLO_TITOLARE', "Solo il titolare può attivare l'abbonamento."],
    ['OFFICINA_NON_ATTIVA', "Potrai attivare l'abbonamento quando la tua officina sarà attiva."],
    ['PILOTA', "La tua officina è nel pilota: l'abbonamento è gratuito."],
    ['GIA_ATTIVO', "L'abbonamento è già attivo."],
    [
      'ABBONAMENTO_DA_SISTEMARE',
      "L'ultimo pagamento non è riuscito: aggiorna la carta con «Gestisci il pagamento».",
    ],
    ['NESSUN_PAGAMENTO', 'Non risulta ancora nessun pagamento.'],
    [
      'STRIPE',
      'Il servizio di pagamento non è disponibile in questo momento: riprova più tardi o scrivici con «Invia un commento».',
    ],
  ])('%s', (codice, testo) => {
    expect(messaggioPagamento(codice)).toBe(testo);
  });
  it('codice sconosciuto, assente o di sistema → messaggio generico', () => {
    expect(messaggioPagamento('BOH')).toBe(GENERICO);
    expect(messaggioPagamento(null)).toBe(GENERICO);
    expect(messaggioPagamento('toString')).toBe(GENERICO);
  });
});

describe('codiceDaErrore', () => {
  const conCorpo = (corpo: string) => ({ context: new Response(corpo, { status: 409 }) });
  it('legge il codice dal corpo JSON di error.context', async () => {
    expect(await codiceDaErrore(conCorpo('{"errore":"GIA_ATTIVO"}'))).toBe('GIA_ATTIVO');
  });
  it('corpo non JSON, senza codice o senza context → null', async () => {
    expect(await codiceDaErrore(conCorpo('<html>'))).toBeNull();
    expect(await codiceDaErrore(conCorpo('{"altro":1}'))).toBeNull();
    expect(await codiceDaErrore(conCorpo('{"errore":5}'))).toBeNull();
    expect(await codiceDaErrore(new Error('rete'))).toBeNull();
    expect(await codiceDaErrore(null)).toBeNull();
  });
});

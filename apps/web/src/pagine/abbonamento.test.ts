import { describe, expect, it, vi } from 'vitest';
import {
  avvisoPagamento,
  mostraPagamento,
  mostraPortale,
  testoPilotaConSubscription,
  testoStato,
} from './abbonamento';
import type { AbbonamentoOfficina } from '../lib/abbonamento';

// Ambiente node, senza DOM: le icone (SVG creati con `document`) qui non servono
vi.mock('../ui/icone', () => ({ icona: () => '<svg></svg>' }));

const abb = (o: Partial<AbbonamentoOfficina>): AbbonamentoOfficina => ({
  piano: 'STARTER',
  stato: 'PROVA',
  prova_fino_al: '2999-01-01',
  stripe_customer_id: null,
  stripe_subscription_id: null,
  ...o,
});

describe('testoStato', () => {
  it('pilota: gratuito per tutta la durata', () => {
    expect(testoStato(abb({ piano: 'PILOTA', stato: 'ATTIVO' }))).toBe(
      'Gratuito per tutta la durata del pilota',
    );
  });
  it('attivo e scaduto', () => {
    expect(testoStato(abb({ stato: 'ATTIVO' }))).toBe('Abbonamento attivo');
    expect(testoStato(abb({ stato: 'SCADUTO' }))).toBe('Abbonamento scaduto');
  });
  it('prova in corso', () => {
    expect(testoStato(abb({ stato: 'PROVA' }))).toMatch(/^Prova gratuita: mancano \d+ giorni/);
  });
});

describe('mostraPagamento', () => {
  it('solo per prova, scaduto e annullato di un piano a pagamento', () => {
    expect(mostraPagamento(abb({ stato: 'PROVA' }))).toBe(true);
    expect(mostraPagamento(abb({ stato: 'SCADUTO' }))).toBe(true);
    expect(mostraPagamento(abb({ stato: 'ANNULLATO' }))).toBe(true);
    expect(mostraPagamento(abb({ stato: 'ATTIVO' }))).toBe(false);
  });
  it('mai per il pilota né senza abbonamento', () => {
    for (const stato of ['PROVA', 'ATTIVO', 'SCADUTO'] as const)
      expect(mostraPagamento(abb({ piano: 'PILOTA', stato }))).toBe(false);
    expect(mostraPagamento(null)).toBe(false);
  });
});

describe('avvisoPagamento', () => {
  it('testo per i due parametri', () => {
    expect(avvisoPagamento('ok')).toBe(
      "Pagamento ricevuto: l'abbonamento si aggiorna entro pochi minuti.",
    );
    expect(avvisoPagamento('annullato')).toBe(
      'Pagamento annullato: non ti è stato addebitato nulla.',
    );
  });
  it('altri valori: nessun avviso', () => {
    expect(avvisoPagamento(null)).toBeNull();
    expect(avvisoPagamento('boh')).toBeNull();
  });
});

describe('mostraPortale', () => {
  it('nessun abbonamento → no', () => {
    expect(mostraPortale(null)).toBe(false);
  });
  it('pilota con cliente ma senza subscription → no', () => {
    expect(mostraPortale(abb({ piano: 'PILOTA', stripe_customer_id: 'cus_1' }))).toBe(false);
  });
  it('pilota con cliente e subscription → sì', () => {
    expect(
      mostraPortale(
        abb({ piano: 'PILOTA', stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1' }),
      ),
    ).toBe(true);
  });
  it('pilota con subscription vuota o di soli spazi → no', () => {
    for (const sub of ['', '  ']) {
      expect(
        mostraPortale(
          abb({ piano: 'PILOTA', stripe_customer_id: 'cus_1', stripe_subscription_id: sub }),
        ),
      ).toBe(false);
    }
  });
  it('pilota con subscription ma senza cliente → no', () => {
    expect(mostraPortale(abb({ piano: 'PILOTA', stripe_subscription_id: 'sub_1' }))).toBe(false);
  });
  it('piano a carico senza id → no', () => {
    expect(mostraPortale(abb({ piano: 'STARTER', stripe_customer_id: null }))).toBe(false);
  });
  it('piano a carico con id → sì, in qualsiasi stato', () => {
    expect(mostraPortale(abb({ piano: 'STARTER', stripe_customer_id: 'cus_1' }))).toBe(true);
    expect(mostraPortale(abb({ piano: 'PRO', stato: 'ATTIVO', stripe_customer_id: 'cus_1' }))).toBe(
      true,
    );
    expect(
      mostraPortale(abb({ piano: 'PRO', stato: 'SCADUTO', stripe_customer_id: 'cus_1' })),
    ).toBe(true);
  });
  it('id vuoto o di soli spazi → no', () => {
    expect(mostraPortale(abb({ stripe_customer_id: '' }))).toBe(false);
    expect(mostraPortale(abb({ stripe_customer_id: '  ' }))).toBe(false);
  });
});

describe('testoPilotaConSubscription', () => {
  it('pilota con subscription viva: una frase sola', () => {
    expect(
      testoPilotaConSubscription(
        abb({
          piano: 'PILOTA',
          stato: 'ATTIVO',
          stripe_customer_id: 'cus_1',
          stripe_subscription_id: 'sub_1',
        }),
      ),
    ).toBe(
      'Sei nel pilota: TyreCare per te è gratuito. Hai ancora un abbonamento a pagamento attivo: annullalo da «Gestisci il pagamento» per non pagarlo.',
    );
  });
  it('pilota senza subscription e altri piani: nessuna frase speciale', () => {
    expect(
      testoPilotaConSubscription(
        abb({ piano: 'PILOTA', stato: 'ATTIVO', stripe_customer_id: 'cus_1' }),
      ),
    ).toBeNull();
    expect(
      testoPilotaConSubscription(
        abb({ stato: 'ATTIVO', stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1' }),
      ),
    ).toBeNull();
    expect(testoPilotaConSubscription(null)).toBeNull();
  });
});

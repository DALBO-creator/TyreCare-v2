import { describe, expect, it } from 'vitest';
import { leggiConteggiControlli } from './importa-controlli';

const valido = {
  controlli_nuovi: 2,
  controlli_gia_presenti: 1,
  pneumatici_nuovi: 4,
  misure_nuove: 8,
  misure_saltate: 0,
  targhe_non_trovate: ['AB123CD'],
};

describe('leggiConteggiControlli', () => {
  it('legge la risposta della funzione SQL', () => {
    expect(leggiConteggiControlli(valido)).toEqual(valido);
  });

  it('senza targhe non trovate usa un elenco vuoto', () => {
    const senza: Record<string, unknown> = { ...valido };
    delete senza.targhe_non_trovate;
    expect(leggiConteggiControlli(senza).targhe_non_trovate).toEqual([]);
  });

  it.each([null, 'x', 3, [], undefined])('rifiuta %j', (dati) => {
    expect(() => leggiConteggiControlli(dati)).toThrow(/non valida/);
  });

  it('rifiuta un conteggio mancante, negativo o non intero', () => {
    expect(() => leggiConteggiControlli({ ...valido, misure_nuove: undefined })).toThrow(
      /misure_nuove/,
    );
    expect(() => leggiConteggiControlli({ ...valido, controlli_nuovi: -1 })).toThrow(
      /controlli_nuovi/,
    );
    expect(() => leggiConteggiControlli({ ...valido, pneumatici_nuovi: 1.5 })).toThrow(
      /pneumatici_nuovi/,
    );
  });

  it('rifiuta targhe che non sono testi', () => {
    expect(() => leggiConteggiControlli({ ...valido, targhe_non_trovate: [1] })).toThrow(
      /targhe_non_trovate/,
    );
    expect(() => leggiConteggiControlli({ ...valido, targhe_non_trovate: 'AB' })).toThrow(
      /targhe_non_trovate/,
    );
  });
});

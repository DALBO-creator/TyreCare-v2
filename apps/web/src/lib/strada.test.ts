import { ErroreModulo } from './errori';
import { describe, expect, it } from 'vitest';
import {
  FRASE_RESPONSABILITA,
  MESSAGGI,
  RichiestaStradaSchema,
  ancoraInCorso,
  messaggioPosizione,
  traduci,
} from './strada';

const valida = { descrizione: 'Gomma a terra', telefono: '333 1234567', targa: '' };
const errori = (dati: Record<string, string>) =>
  Object.fromEntries(
    (RichiestaStradaSchema.safeParse(dati).error?.issues ?? []).map((i) => [
      String(i.path[0]),
      i.message,
    ]),
  );

describe('RichiestaStradaSchema', () => {
  it('accetta un modulo completo e pulisce i campi', () => {
    const r = RichiestaStradaSchema.parse({
      descrizione: '  Forata  ',
      telefono: '333-123.4567',
      targa: 'ab 123-cd',
    });
    expect(r).toEqual({ descrizione: 'Forata', telefono: '333 123 4567', targa: 'AB123CD' });
  });

  it('la targa è facoltativa', () => {
    expect(RichiestaStradaSchema.parse(valida).targa).toBe('');
  });

  it('senza descrizione dà un solo errore', () => {
    expect(errori({ ...valida, descrizione: '   ' })).toEqual({
      descrizione: 'Scrivi cosa è successo',
    });
  });

  it('la descrizione ha al massimo 500 caratteri', () => {
    expect(
      RichiestaStradaSchema.safeParse({ ...valida, descrizione: 'a'.repeat(500) }).success,
    ).toBe(true);
    expect(errori({ ...valida, descrizione: 'a'.repeat(501) })).toEqual({
      descrizione: 'La descrizione può avere al massimo 500 caratteri',
    });
  });

  it('il telefono è obbligatorio', () => {
    expect(errori({ ...valida, telefono: '' })).toEqual({
      telefono: 'Inserisci un telefono, così l’officina può richiamarti',
    });
  });

  it('il telefono rifiuta le lettere', () => {
    expect(errori({ ...valida, telefono: 'abc' }).telefono).toMatch(/^Controlla il numero/);
  });

  it('la targa ha al massimo 10 caratteri', () => {
    expect(errori({ ...valida, targa: 'A'.repeat(11) })).toEqual({
      targa: 'La targa può avere al massimo 10 caratteri',
    });
  });
});

describe('traduci', () => {
  const chiavi = [
    'POSIZIONE_NON_VALIDA',
    'DESCRIZIONE_NON_VALIDA',
    'TELEFONO_NON_VALIDO',
    'TARGA_NON_VALIDA',
    'RICHIESTA_GIA_APERTA',
    'NESSUNA_OFFICINA',
    'RICHIESTA_NON_DISPONIBILE',
  ];

  it('ha un messaggio italiano per ogni chiave del database', () => {
    expect(Object.keys(MESSAGGI).sort()).toEqual([...chiavi].sort());
    for (const chiave of chiavi) {
      const e = traduci({ message: chiave });
      expect(e).toBeInstanceOf(ErroreModulo);
      expect((e as ErroreModulo).message).toBe(MESSAGGI[chiave]);
      expect((e as ErroreModulo).message).not.toContain('_');
      expect((e as ErroreModulo).codice).toBe(chiave);
    }
  });

  it('i messaggi esatti', () => {
    expect(MESSAGGI.POSIZIONE_NON_VALIDA).toBe(
      'La posizione non è valida. Controlla il GPS e riprova.',
    );
    expect(MESSAGGI.NESSUNA_OFFICINA).toBe(
      "Nessuna officina vicina offre l'aiuto su strada in questo momento. Chiama un soccorso stradale; in pericolo chiama il 112.",
    );
    expect(MESSAGGI.RICHIESTA_GIA_APERTA).toBe(
      'Hai già una richiesta in corso. Ricarica la pagina per seguirla o per annullarla.',
    );
    expect(MESSAGGI.RICHIESTA_NON_DISPONIBILE).toBe(
      'Questa richiesta non è più disponibile: è già stata chiusa, annullata o è scaduta.',
    );
    expect(MESSAGGI.DESCRIZIONE_NON_VALIDA).toBe(
      'Scrivi cosa è successo, al massimo in 500 caratteri.',
    );
    expect(MESSAGGI.TARGA_NON_VALIDA).toBe('La targa può avere al massimo 10 caratteri.');
    expect(MESSAGGI.TELEFONO_NON_VALIDO).toMatch(/^Controlla il numero/);
  });

  it('collega descrizione, telefono e targa al loro campo', () => {
    expect((traduci({ message: 'DESCRIZIONE_NON_VALIDA' }) as ErroreModulo).campo).toBe(
      'descrizione',
    );
    expect((traduci({ message: 'TELEFONO_NON_VALIDO' }) as ErroreModulo).campo).toBe('telefono');
    expect((traduci({ message: 'TARGA_NON_VALIDA' }) as ErroreModulo).campo).toBe('targa');
    expect((traduci({ message: 'NESSUNA_OFFICINA' }) as ErroreModulo).campo).toBeUndefined();
  });

  it('un errore sconosciuto resta com’è', () => {
    const altro = { message: 'boom' };
    expect(traduci(altro)).toBe(altro);
    expect(traduci(null)).toBeNull();
  });
});

describe('messaggioPosizione', () => {
  it('distingue permesso negato, tempo scaduto e altro', () => {
    expect(messaggioPosizione(1)).toBe(
      'Non riusciamo a sapere dove sei: controlla i permessi di posizione del browser.',
    );
    expect(messaggioPosizione(3)).toBe(
      'Non riusciamo a trovare la tua posizione in tempo: controlla che il GPS sia acceso e riprova.',
    );
    expect(messaggioPosizione()).toBe(
      'Non riusciamo a sapere dove sei: controlla i permessi di posizione del browser e il GPS.',
    );
  });
});

describe('ancoraInCorso', () => {
  const adesso = new Date('2026-11-01T12:00:00Z');
  it('una richiesta aperta vale fino alla scadenza', () => {
    const base = { stato: 'APERTA', accettata_il: null };
    expect(ancoraInCorso({ ...base, scade_il: '2026-11-01T12:00:01Z' }, adesso)).toBe(true);
    expect(ancoraInCorso({ ...base, scade_il: '2026-11-01T11:59:59Z' }, adesso)).toBe(false);
  });
  it('una accettata vale 24 ore dall’accettazione', () => {
    const base = { stato: 'ACCETTATA', scade_il: '2026-11-01T00:00:00Z' };
    expect(ancoraInCorso({ ...base, accettata_il: '2026-10-31T12:00:01Z' }, adesso)).toBe(true);
    expect(ancoraInCorso({ ...base, accettata_il: '2026-10-31T11:59:59Z' }, adesso)).toBe(false);
  });
  it('le altre non sono in corso', () => {
    expect(
      ancoraInCorso({ stato: 'ANNULLATA', scade_il: '2027-01-01T00:00:00Z', accettata_il: null }),
    ).toBe(false);
  });
});

describe('FRASE_RESPONSABILITA', () => {
  it('è la frase di R18', () => {
    expect(FRASE_RESPONSABILITA).toBe(
      "TyreCare inoltra la richiesta alle officine vicine che offrono il servizio: l'intervento lo fa e lo concorda l'officina. In pericolo chiama il 112.",
    );
  });
});

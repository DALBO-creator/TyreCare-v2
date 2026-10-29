import { describe, expect, it } from 'vitest';
import { RichiestaAffiliazioneSchema, partitaIvaValida } from './affiliazione';

/** Aggiunge la cifra di controllo a 10 cifre (calcolata qui con la stessa regola di Luhn). */
function conControllo(dieci: string): string {
  let somma = 0;
  for (let i = 0; i < 10; i++) {
    let c = Number(dieci[i]);
    if (i % 2 === 1) c = c * 2 > 9 ? c * 2 - 9 : c * 2;
    somma += c;
  }
  return dieci + String((10 - (somma % 10)) % 10);
}

const VALIDA = conControllo('1234567890');

describe('partitaIvaValida', () => {
  it('accetta una partita IVA con la cifra di controllo giusta', () => {
    expect(VALIDA).toHaveLength(11);
    expect(partitaIvaValida(VALIDA)).toBe(true);
    // Esempio noto: 00743110157
    expect(partitaIvaValida('00743110157')).toBe(true);
  });

  it('rifiuta la cifra di controllo sbagliata', () => {
    const sbagliata = VALIDA.slice(0, 10) + String((Number(VALIDA[10]) + 1) % 10);
    expect(partitaIvaValida(sbagliata)).toBe(false);
  });

  it('rifiuta lettere e lunghezze sbagliate', () => {
    expect(partitaIvaValida('1234567890A')).toBe(false);
    expect(partitaIvaValida('IT' + VALIDA.slice(0, 9))).toBe(false);
    expect(partitaIvaValida(VALIDA.slice(0, 10))).toBe(false);
    expect(partitaIvaValida(VALIDA + '0')).toBe(false);
    expect(partitaIvaValida('')).toBe(false);
  });
});

describe('RichiestaAffiliazioneSchema', () => {
  const base = {
    ragione_sociale: 'Gomme Verdi',
    partita_iva: VALIDA,
    citta: 'Torino',
    telefono: '',
  };
  const errori = (v: Record<string, string>) =>
    Object.fromEntries(
      (RichiestaAffiliazioneSchema.safeParse(v).error?.issues ?? []).map((i) => [
        String(i.path[0]),
        i.message,
      ]),
    );

  it('accetta una richiesta valida e pulisce i campi', () => {
    const r = RichiestaAffiliazioneSchema.parse({
      ragione_sociale: '  Gomme Verdi  ',
      partita_iva: ` ${VALIDA.slice(0, 5)} ${VALIDA.slice(5)} `,
      citta: ' Torino ',
      telefono: '+39 011 1234567',
    });
    expect(r).toEqual({
      ragione_sociale: 'Gomme Verdi',
      partita_iva: VALIDA,
      citta: 'Torino',
      telefono: '+39 011 1234567',
    });
  });

  it('il telefono è facoltativo: vuoto diventa null', () => {
    expect(RichiestaAffiliazioneSchema.parse(base).telefono).toBeNull();
  });

  it('rifiuta una ragione sociale troppo corta o troppo lunga', () => {
    expect(errori({ ...base, ragione_sociale: 'A' })).toHaveProperty('ragione_sociale');
    expect(errori({ ...base, ragione_sociale: ' ' })).toHaveProperty('ragione_sociale');
    expect(errori({ ...base, ragione_sociale: 'A'.repeat(201) })).toHaveProperty('ragione_sociale');
    expect(errori({ ...base, ragione_sociale: 'A'.repeat(200) })).toEqual({});
  });

  it('rifiuta la partita IVA non valida con il messaggio previsto', () => {
    expect(errori({ ...base, partita_iva: '12345678901' }).partita_iva).toBe(
      'Partita IVA non valida',
    );
  });

  it('rifiuta la città mancante o troppo lunga', () => {
    expect(errori({ ...base, citta: '  ' })).toHaveProperty('citta');
    expect(errori({ ...base, citta: 'T'.repeat(101) })).toHaveProperty('citta');
  });

  it('rifiuta un telefono non valido', () => {
    expect(errori({ ...base, telefono: 'abc' })).toHaveProperty('telefono');
  });
});

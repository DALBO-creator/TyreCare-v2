import { describe, expect, it } from 'vitest';
import {
  DATI_FORNITORE,
  SITO_URL,
  datiFornitoreCompleti,
  eSegnaposto,
  sitoLeggibile,
  type DatiFornitore,
} from './fornitore';

const COMPLETI: DatiFornitore = {
  nome: 'Mario Rossi',
  indirizzo: 'Via Roma 1, 20100 Milano (MI)',
  partitaIva: '01234567890',
  registroImprese: 'REA MI-1234567',
  emailContatti: 'info@esempio.it',
  emailPrivacy: 'privacy@esempio.it',
  pec: 'esempio@pec.it',
};

describe('dati del fornitore', () => {
  it('riconosce i segnaposto tra parentesi quadre', () => {
    expect(eSegnaposto('[Partita IVA]')).toBe(true);
    expect(eSegnaposto('  [PEC] ')).toBe(true);
    expect(eSegnaposto('01234567890')).toBe(false);
  });

  it('sono completi solo senza segnaposto e senza campi vuoti', () => {
    expect(datiFornitoreCompleti(COMPLETI)).toBe(true);
    expect(datiFornitoreCompleti({ ...COMPLETI, pec: '[PEC]' })).toBe(false);
    expect(datiFornitoreCompleti({ ...COMPLETI, nome: ' ' })).toBe(false);
  });

  it('nessun campo è vuoto: o è il dato vero o è un segnaposto visibile', () => {
    for (const valore of Object.values(DATI_FORNITORE)) expect(valore.trim()).not.toBe('');
  });

  it('il sito è un indirizzo https valido e si mostra senza schema', () => {
    expect(SITO_URL).toMatch(/^https:\/\/[a-z0-9.-]+\/?$/);
    expect(sitoLeggibile('https://tyrecare.it/')).toBe('tyrecare.it');
  });
});

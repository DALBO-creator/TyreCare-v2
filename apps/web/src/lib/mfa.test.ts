import { describe, expect, it } from 'vitest';
import { fattoreAttivo, livelloToken, secondoLivello, serveCodice } from './mfa';

const token = (corpo: object) =>
  `x.${btoa(JSON.stringify(corpo)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}.y`;
const totp = { id: 'f1', factor_type: 'totp', status: 'verified' };

describe('livelloToken', () => {
  it('legge aal1 e aal2 dal token', () => {
    expect(livelloToken(token({ aal: 'aal1' }))).toBe('aal1');
    expect(livelloToken(token({ aal: 'aal2', nome: 'Niccolò è qui?' }))).toBe('aal2');
  });
  it('token mancante, rotto o con un valore strano: null', () => {
    expect(livelloToken(null)).toBeNull();
    expect(livelloToken('non-un-token')).toBeNull();
    expect(livelloToken('a.%%%.c')).toBeNull();
    expect(livelloToken(token({ aal: 'aal3' }))).toBeNull();
  });
});

describe('serveCodice', () => {
  it('senza fattori non serve il codice', () => {
    expect(serveCodice({ access_token: token({ aal: 'aal1' }), user: {} })).toBe(false);
    expect(serveCodice(null)).toBe(false);
  });
  it('un fattore non verificato non conta', () => {
    const user = { factors: [{ ...totp, status: 'unverified' }] };
    expect(fattoreAttivo({ access_token: '', user })).toBeUndefined();
    expect(serveCodice({ access_token: token({ aal: 'aal1' }), user })).toBe(false);
  });
  it('con un fattore verificato serve finché la sessione è aal1', () => {
    const user = { factors: [totp] };
    expect(serveCodice({ access_token: token({ aal: 'aal1' }), user })).toBe(true);
    expect(serveCodice({ access_token: token({ aal: 'aal2' }), user })).toBe(false);
    expect(secondoLivello({ access_token: token({ aal: 'aal2' }), user })).toBe(true);
  });
  it('un token illeggibile con un fattore attivo chiede il codice', () => {
    expect(serveCodice({ access_token: 'rotto', user: { factors: [totp] } })).toBe(true);
  });
});

import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from './app';

const ISSUER = 'http://supabase.test/auth/v1';
const UTENTE = 'a0000000-0000-4000-8000-000000000004';

// Coppia di chiavi ES256 come quelle di Supabase: la privata firma i token di prova, la pubblica
// (in un JWKS locale) li verifica. Nessuna chiamata di rete.
const { privateKey, publicKey } = await generateKeyPair('ES256');
const jwk = { ...(await exportJWK(publicKey)), kid: 'test', alg: 'ES256' };

function token(modifica: (jwt: SignJWT) => SignJWT = (jwt) => jwt, chiave = privateKey) {
  const jwt = new SignJWT({ email: 'cliente@tyrecare.test', role: 'authenticated' })
    .setProtectedHeader({ alg: 'ES256', kid: 'test' })
    .setSubject(UTENTE)
    .setIssuer(ISSUER)
    .setAudience('authenticated')
    .setIssuedAt()
    .setExpirationTime('1h');
  return modifica(jwt).sign(chiave);
}

describe('API', () => {
  const app = buildApp({ auth: { chiavi: createLocalJWKSet({ keys: [jwk] }), issuer: ISSUER } });
  beforeAll(() => app.ready());
  afterAll(() => app.close());

  const getMe = (authorization?: string) =>
    app.inject({ method: 'GET', url: '/me', headers: authorization ? { authorization } : {} });

  it('GET /health risponde ok senza login', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  it('GET /me con un token valido restituisce l’utente', async () => {
    const res = await getMe(`Bearer ${await token()}`);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ id: UTENTE, email: 'cliente@tyrecare.test' });
  });

  it('GET /me senza token risponde 401', async () => {
    const res = await getMe();
    expect(res.statusCode).toBe(401);
    expect(res.headers['www-authenticate']).toBe('Bearer');
  });

  it.each([
    ['scaduto', () => token((jwt) => jwt.setIssuedAt('-2h').setExpirationTime('-1h'))],
    ['di un altro emittente', () => token((jwt) => jwt.setIssuer('http://altro.test/auth/v1'))],
    ['per un altro destinatario', () => token((jwt) => jwt.setAudience('anon'))],
    [
      'firmato con un’altra chiave',
      async () => token(undefined, (await generateKeyPair('ES256')).privateKey),
    ],
    ['malformato', () => Promise.resolve('non-un-jwt')],
  ])('GET /me con un token %s risponde 401', async (_, crea) => {
    const res = await getMe(`Bearer ${await crea()}`);
    expect(res.statusCode).toBe(401);
  });
});

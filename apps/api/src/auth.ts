import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import type { FastifyReply, FastifyRequest, onRequestAsyncHookHandler } from 'fastify';

/** Utente autenticato, ricavato dal JWT di Supabase Auth. */
export interface Utente {
  id: string;
  email: string | null;
}

export interface OpzioniAuth {
  /** Chiavi pubbliche con cui Supabase firma i token (JWKS). */
  chiavi: JWTVerifyGetKey;
  /** Emittente atteso dei token: `<SUPABASE_URL>/auth/v1`. */
  issuer: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    utente: Utente | null;
  }
}

/** Opzioni per il progetto Supabase indicato: le chiavi si scaricano (e si tengono in cache) da `jose`. */
export function opzioniAuthSupabase(supabaseUrl: string): OpzioniAuth {
  const base = supabaseUrl.replace(/\/+$/, '');
  return {
    chiavi: createRemoteJWKSet(new URL(`${base}/auth/v1/.well-known/jwks.json`)),
    issuer: `${base}/auth/v1`,
  };
}

/**
 * Verifica il token `Authorization: Bearer …` e restituisce l'utente, oppure `null` se il token manca o
 * non è valido (firma, emittente, destinatario o scadenza).
 */
export async function verificaToken(
  header: string | undefined,
  { chiavi, issuer }: OpzioniAuth,
): Promise<Utente | null> {
  const token = /^Bearer (\S+)$/i.exec(header ?? '')?.[1];
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, chiavi, {
      issuer,
      audience: 'authenticated',
      algorithms: ['ES256', 'RS256'],
    });
    if (!payload.sub) return null;
    return { id: payload.sub, email: typeof payload.email === 'string' ? payload.email : null };
  } catch {
    return null;
  }
}

/** Hook che blocca con 401 le richieste senza un token valido e altrimenti imposta `request.utente`. */
export function richiediUtente(opzioni: OpzioniAuth): onRequestAsyncHookHandler {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    request.utente = await verificaToken(request.headers.authorization, opzioni);
    if (!request.utente) {
      return reply
        .code(401)
        .header('WWW-Authenticate', 'Bearer')
        .send({ errore: 'Accesso richiesto' });
    }
  };
}

/** L'utente della richiesta, per le rotte protette da `richiediUtente`. */
export function utenteDi(request: FastifyRequest): Utente {
  if (!request.utente) throw new Error('Rotta senza richiediUtente');
  return request.utente;
}

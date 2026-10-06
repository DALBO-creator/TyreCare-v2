import type { FastifyPluginAsync } from 'fastify';
import { utenteDi } from '../auth';

/** Rotte dell'utente autenticato. */
export const meRoutes: FastifyPluginAsync = async (app) => {
  app.get('/me', async (request) => utenteDi(request));
};

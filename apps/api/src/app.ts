import Fastify, { type FastifyServerOptions } from 'fastify';
import { richiediUtente, type OpzioniAuth } from './auth';
import { healthRoutes } from './routes/health';
import { meRoutes } from './routes/me';

export interface OpzioniApp {
  fastify?: FastifyServerOptions;
  auth: OpzioniAuth;
}

/** Crea l'istanza Fastify senza avviarla: usata dal server e dai test. */
export function buildApp({ fastify = {}, auth }: OpzioniApp) {
  const app = Fastify(fastify);
  app.decorateRequest('utente', null);

  // Rotte pubbliche
  app.register(healthRoutes);

  // Rotte protette: l'hook vale solo dentro questo plugin (incapsulamento di Fastify)
  app.register(async (protette) => {
    protette.addHook('onRequest', richiediUtente(auth));
    await protette.register(meRoutes);
  });

  return app;
}

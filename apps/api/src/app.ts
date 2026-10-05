import Fastify, { type FastifyServerOptions } from 'fastify';
import { healthRoutes } from './routes/health';

/** Crea l'istanza Fastify senza avviarla: usata dal server e dai test. */
export function buildApp(options: FastifyServerOptions = {}) {
  const app = Fastify(options);
  app.register(healthRoutes);
  return app;
}

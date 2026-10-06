import { buildApp } from './app';
import { opzioniAuthSupabase } from './auth';
import { loadEnv } from './env';

const env = loadEnv();
const app = buildApp({
  fastify: { logger: { level: env.LOG_LEVEL } },
  auth: opzioniAuthSupabase(env.SUPABASE_URL),
});

try {
  await app.listen({ port: env.PORT, host: env.HOST });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

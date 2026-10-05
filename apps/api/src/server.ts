import { buildApp } from './app';
import { loadEnv } from './env';

const env = loadEnv();
const app = buildApp({ logger: { level: env.LOG_LEVEL } });

try {
  await app.listen({ port: env.PORT, host: env.HOST });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

import { defineConfig } from 'vitest/config';

// Un'unica esecuzione di test per tutto il monorepo, un "project" per workspace
export default defineConfig({
  test: {
    projects: [
      { test: { name: 'shared', root: 'packages/shared', environment: 'node' } },
      { test: { name: 'api', root: 'apps/api', environment: 'node' } },
      { test: { name: 'web', root: 'apps/web', environment: 'node', passWithNoTests: true } },
      { test: { name: 'funzioni', root: 'supabase/functions', environment: 'node' } },
    ],
  },
});

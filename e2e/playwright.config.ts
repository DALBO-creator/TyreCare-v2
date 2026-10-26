import { defineConfig, devices } from '@playwright/test';

// Test end-to-end dei flussi principali, nel browser contro Supabase locale (`npm run db:start`).
// I test creano dati con nomi unici: non serve `npm run db:reset` prima di ogni esecuzione.
export default defineConfig({
  testDir: 'tests',
  // Un solo browser alla volta: i flussi usano lo stesso Supabase locale e lo stesso server Vite
  workers: 1,
  // Ogni flusso passa da più pagine, account ed email: Vite in sviluppo e Supabase in Docker
  // (soprattutto su Windows) rispondono più lentamente del sito pubblicato
  timeout: 60_000,
  expect: { timeout: 10_000 },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    // In sviluppo il service worker è attivo (vite-plugin-pwa): nei test darebbe pagine in cache
    serviceWorkers: 'block',
    locale: 'it-IT',
    timezoneId: 'Europe/Rome',
    // "Riduci movimento" è un comportamento reale dell'app: senza animazione d'entrata (`tc-entra`)
    // gli elementi non spostano i pulsanti sotto il clic del test (instabile sul telefono)
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'telefono', use: { ...devices['Pixel 7'] } }],
  webServer: {
    command: 'npm run dev:web',
    cwd: '..',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

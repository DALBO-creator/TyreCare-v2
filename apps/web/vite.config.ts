import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  css: {
    preprocessorOptions: {
      scss: {
        // Bootstrap 5.3 usa ancora @import e le funzioni globali di Sass: avvisi noti, si
        // risolveranno con Bootstrap 6. Nascosti per non coprire eventuali avvisi nostri.
        quietDeps: true,
        silenceDeprecations: ['import', 'global-builtin', 'color-functions', 'if-function'],
      },
    },
  },
  plugins: [
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'logo.svg'],
      manifest: {
        name: 'TyreCare',
        short_name: 'TyreCare',
        description: 'Lo stato dei tuoi pneumatici, sempre sotto controllo.',
        lang: 'it',
        start_url: '/',
        display: 'standalone',
        theme_color: '#0a0a0a',
        background_color: '#0a0a0a',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Oltre ai file di default precarica icone e i font dei soli caratteri latini (italiano):
        // gli altri alfabeti si scaricano solo se servono
        globPatterns: ['**/*.{js,css,html,ico,png,svg}', '**/*-latin-wght-normal-*.woff2'],
        // Notifiche push (Fase 5): gestori `push` e `notificationclick` in public/sw-push.js
        importScripts: ['sw-push.js'],
        globIgnores: ['**/sw-push.js'],
      },
      // Service worker attivo anche in `npm run dev`, per provare la PWA in locale (classico, non
      // "module": `importScripts` funziona solo nei service worker classici)
      devOptions: { enabled: true },
    }),
  ],
});

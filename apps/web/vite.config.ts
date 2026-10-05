import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
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
        theme_color: '#0d6efd',
        background_color: '#ffffff',
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
      // Service worker attivo anche in `npm run dev`, per provare la PWA in locale
      devOptions: { enabled: true, type: 'module' },
    }),
  ],
});

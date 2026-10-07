import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Icone della schermata Home (maskable per Android, apple-touch per iOS): il sistema le ritaglia
// da sé, quindi servono quadrate e piene. Lo sfondo predefinito è bianco: qui lo si fa nero come il logo
const sfondoNero = { background: '#0a0a0a', fit: 'contain' } as const;

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, padding: 0.1, resizeOptions: sfondoNero },
    apple: { ...minimal2023Preset.apple, padding: 0.1, resizeOptions: sfondoNero },
  },
  images: ['public/logo.svg'],
});

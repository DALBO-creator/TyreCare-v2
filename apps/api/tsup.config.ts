import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  format: 'esm',
  target: 'node24',
  platform: 'node',
  clean: true,
  // Il pacchetto condiviso è pubblicato come sorgente TS: va incluso nel bundle
  noExternal: ['@tyrecare/shared'],
});

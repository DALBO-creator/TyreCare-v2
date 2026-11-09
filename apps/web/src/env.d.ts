interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Definite da `vite.config.ts` (non esistono in vitest: leggerle con `typeof … === 'string'`). */
declare const __ULTIMA_MIGRAZIONE__: string;
declare const __VERSIONE_APP__: string;

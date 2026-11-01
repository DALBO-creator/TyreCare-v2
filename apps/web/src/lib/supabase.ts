import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@tyrecare/shared';

/** Chiave di `localStorage` in cui supabase-js tiene la sessione (quella predefinita). */
export function chiaveSessione(url: string): string {
  return `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
}

let client: SupabaseClient<Database> | undefined;

/** Client Supabase condiviso, creato al primo utilizzo. Tipizzato sullo schema (`npm run db:types`). */
export function getSupabase(): SupabaseClient<Database> {
  if (client) return client;

  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Configura VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY in apps/web/.env');
  }

  client = createClient<Database>(url, key);
  return client;
}

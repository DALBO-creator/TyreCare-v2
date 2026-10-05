# STRUCT — Linguaggi, framework e librerie

> Ogni tecnologia usata nel progetto, con il motivo e come la usiamo. Aggiornato ad ogni nuova dipendenza.
> Stato: ✅ in uso · 🟡 pianificata · ⚪ opzionale.

## Linguaggi

| Tecnologia | Stato | Uso in TyreCare |
|------------|-------|-----------------|
| **HTML5** | 🟡 | Struttura delle pagine della PWA. |
| **CSS3** | 🟡 | Stili personalizzati sopra Bootstrap (variabili CSS per colori e temi). |
| **TypeScript** | 🟡 | Backend (obbligatorio) e, se approvata la proposta P1, anche frontend. Tipi statici: gli errori emergono in fase di scrittura e non a runtime. |
| **SQL (PostgreSQL)** | 🟡 | Solo per migrazioni, policy RLS e funzioni del database. Le query applicative passano dal client Supabase. |

## Frontend

| Tecnologia | Stato | Uso in TyreCare |
|------------|-------|-----------------|
| **Bootstrap 5** | 🟡 | Griglia responsive, componenti (navbar, card, modali, form). Personalizzato tramite variabili per il design system. |
| **Vite** | 🟡 | Server di sviluppo con hot reload e build ottimizzata per la produzione. |
| **vite-plugin-pwa** | 🟡 | Genera `manifest.webmanifest` (icone, nome, colori: rende l'app installabile) e il **service worker** (Workbox) per cache offline e ricezione delle notifiche push. |
| **@supabase/supabase-js** | 🟡 | Login/registrazione, lettura e scrittura dati (`supabase.from('veicoli').select()`), upload su Storage, aggiornamenti realtime, chiamata a Edge Functions. |

## Backend

| Tecnologia | Stato | Uso in TyreCare |
|------------|-------|-----------------|
| **Node.js (LTS)** | 🟡 | Runtime del backend. Versione installata in locale: 24.x. |
| **Fastify** | 🟡 | API HTTPS: rotte, validazione, hook `onRequest` per verificare il token Supabase e il ruolo prima di ogni operazione. |
| **Zod** | 🟡 | Schemi di validazione dei dati in ingresso; da uno schema si ricava anche il tipo TypeScript (`z.infer`). |
| **web-push** | 🟡 | Invio notifiche push dal server con chiavi VAPID. |

## Database e servizi

| Tecnologia | Stato | Uso in TyreCare |
|------------|-------|-----------------|
| **Supabase** | 🟡 | PostgreSQL gestito + Auth + Storage + Realtime + Edge Functions. Sicurezza tramite **Row Level Security**. |
| **Supabase CLI** | 🟡 | Database locale (Docker), migrazioni versionate in `supabase/migrations`, generazione tipi TS. |
| **Supabase Cron / scheduled functions** | 🟡 | Job giornaliero che calcola e invia i reminder. |
| **Vercel** | 🟡 | Hosting della PWA e del backend Fastify (funzioni serverless), anteprima per ogni PR. |

## Qualità e sviluppo

| Tecnologia | Stato | Uso in TyreCare |
|------------|-------|-----------------|
| **Git + GitHub** | ✅ | Versionamento; repo privato `DALBO-creator/TyreCare-v2`. |
| **ESLint** | 🟡 | Trova errori e cattive pratiche nel codice. |
| **Prettier** | 🟡 | Formattazione automatica uniforme. |
| **Vitest** | 🟡 | Test automatici (logica di stato pneumatici, import, validazioni). |
| **Lighthouse** | 🟡 | Audit PWA, performance, accessibilità, best practices, SEO. |

## Opzionali

| Tecnologia | Stato | Uso previsto |
|------------|-------|--------------|
| **PowerSync** | ⚪ | Sincronizzazione offline avanzata (scrittura offline in officina). |
| **Stripe** | ⚪ | Abbonamenti delle officine. |

## Strumenti di design

| Tecnologia | Stato | Uso |
|------------|-------|-----|
| **ui-ux-pro-max** (skill Claude Code) | ✅ | Generazione del design system (palette, tipografia, componenti, linee guida UX). |

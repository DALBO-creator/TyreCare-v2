# STRUCT — Linguaggi, framework e librerie

> Ogni tecnologia usata nel progetto, con il motivo e come la usiamo. Aggiornato ad ogni nuova dipendenza.
> Stato: ✅ in uso · 🟡 pianificata · ⚪ opzionale. Versioni installate al 2026-10-06.

## Struttura del repository

```
TyreCare-v2/
├── apps/
│   ├── web/          # PWA (@tyrecare/web): Vite + TypeScript + Bootstrap 5
│   └── api/          # Backend (@tyrecare/api): Fastify + TypeScript
├── packages/
│   └── shared/       # @tyrecare/shared: schemi Zod, tipi, regole condivise
├── supabase/         # configurazione Supabase CLI (migrazioni, funzioni)
├── .github/workflows # CI GitHub Actions
└── DOCS/
```

Gestita con **npm workspaces**: un solo `npm install` nella root installa tutto.

## Comandi principali (dalla root)

| Comando | Cosa fa |
|---------|---------|
| `npm install` | Installa le dipendenze di tutti i workspace |
| `npm run dev:web` | Avvia la PWA in sviluppo (http://localhost:5173) |
| `npm run dev:api` | Avvia l'API in sviluppo con riavvio automatico (http://127.0.0.1:3000) |
| `npm run check` | Esegue tutto ciò che fa la CI: formattazione, lint, tipi, test, build |
| `npm run test` / `npm run test:watch` | Test una volta / in modalità watch |
| `npm run format` | Formatta il codice con Prettier |
| `npm run icons -w @tyrecare/web` | Rigenera le icone PWA da `apps/web/public/logo.svg` |

## Linguaggi

| Tecnologia | Versione | Stato | Uso in TyreCare |
|------------|----------|-------|-----------------|
| **HTML5** | — | ✅ | Struttura delle pagine della PWA (`apps/web/index.html`). |
| **CSS3** | — | ✅ | Stili personalizzati sopra Bootstrap (`apps/web/src/style.css`). |
| **TypeScript** | 6.0 | ✅ | Frontend, backend e pacchetto condiviso (PLAN P1). Configurazione comune in `tsconfig.base.json` con controlli severi (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`). |
| **SQL (PostgreSQL)** | — | 🟡 | Migrazioni, policy RLS e funzioni del database. |

## Frontend (`apps/web`)

| Tecnologia | Versione | Stato | Uso in TyreCare |
|------------|----------|-------|-----------------|
| **Bootstrap 5** | 5.3 | ✅ | Griglia responsive e componenti. Per ora importato per intero (CSS ~230 kB): in Fase 1 si passerà all'import selettivo via Sass. |
| **Vite** | 8.3 | ✅ | Server di sviluppo con hot reload e build ottimizzata. |
| **vite-plugin-pwa** | 2.0 | ✅ | Genera `manifest.webmanifest` e il service worker (Workbox) con precache dell'app. Aggiornamenti in modalità `prompt`: l'utente sceglie quando ricaricare. |
| **@vite-pwa/assets-generator** | 2.0 | ✅ | Genera favicon, icone PWA e icona Apple dal logo SVG. |
| **@supabase/supabase-js** | 2.117 | ✅ | Client Supabase (`src/lib/supabase.ts`), creato al primo utilizzo. Auth, query, storage, realtime. |

## Backend (`apps/api`)

| Tecnologia | Versione | Stato | Uso in TyreCare |
|------------|----------|-------|-----------------|
| **Node.js (LTS)** | 24 | ✅ | Runtime. Versione fissata in `.nvmrc` e `engines`. |
| **Fastify** | 5.12 | ✅ | API HTTPS. Per ora solo `GET /health`. |
| **Zod** | 4.6 | ✅ | Validazione: variabili d'ambiente (`src/env.ts`) e, in seguito, dati in ingresso. Usato anche in `packages/shared`. |
| **tsx** | 4.23 | ✅ | Esegue TypeScript direttamente in sviluppo, con riavvio automatico (`npm run dev:api`). |
| **tsup** | 8.5 | ✅ | Compila l'API in un unico file JavaScript (`dist/server.js`), includendo il codice di `@tyrecare/shared`. |
| **web-push** | — | 🟡 | Invio notifiche push con chiavi VAPID (Fase 5). |

## Database e servizi

| Tecnologia | Versione | Stato | Uso in TyreCare |
|------------|----------|-------|-----------------|
| **Supabase** | — | 🟡 | PostgreSQL gestito + Auth + Storage + Realtime + Edge Functions. Sicurezza con **RLS**. Progetto cloud da creare. |
| **Supabase CLI** | 2.119 | ✅ | Installata come dipendenza (`npx supabase …`). Configurazione in `supabase/config.toml`. Il database locale richiede **Docker Desktop** (non ancora installato). |
| **Supabase Cron** | — | 🟡 | Job giornaliero dei reminder (Fase 5). |
| **Vercel** | — | 🟡 | Hosting di PWA e API. Account e collegamento al repo da configurare. |

## Qualità e sviluppo

| Tecnologia | Versione | Stato | Uso in TyreCare |
|------------|----------|-------|-----------------|
| **Git + GitHub** | — | ✅ | Repo privato `DALBO-creator/TyreCare-v2`. |
| **GitHub Actions** | — | ✅ | `.github/workflows/ci.yml`: ad ogni push su `main` e ad ogni PR esegue formattazione, lint, tipi, test e build. |
| **ESLint** | 10.12 | ✅ | Configurazione "flat" in `eslint.config.js` con `typescript-eslint`; `eslint-config-prettier` disattiva le regole di stile gestite da Prettier; `globals` definisce le variabili di browser e Node. |
| **Prettier** | 3.9 | ✅ | Formattazione (`.prettierrc.json`: apici singoli, 100 colonne, fine riga LF). `DOCS/` è esclusa. |
| **Vitest** | 5.0 | ✅ | Test di tutto il monorepo con un solo comando: un "project" per workspace in `vitest.config.ts`. |
| **Lighthouse** | — | 🟡 | Audit PWA/performance/accessibilità (manuale, poi in CI). |
| **EditorConfig** | — | ✅ | `.editorconfig`: UTF-8, 2 spazi, LF per tutti gli editor. |

## Opzionali

| Tecnologia | Stato | Uso previsto |
|------------|-------|--------------|
| **PowerSync** | ⚪ | Sincronizzazione offline avanzata (scrittura offline in officina). |
| **Stripe** | ⚪ | Abbonamenti delle officine. |

## Strumenti di design

| Tecnologia | Stato | Uso |
|------------|-------|-----|
| **ui-ux-pro-max** (skill Claude Code) | ✅ | Generazione del design system (Fase 1). |

## Note di sicurezza sulle dipendenze

- `npm audit` segnala una vulnerabilità **bassa** in `esbuild` 0.27 (dipendenza di `tsup` e `vite`), relativa
  al server di sviluppo integrato di esbuild su Windows. Il progetto **non usa** quel server: nessun impatto.
  Si risolverà aggiornando `tsup`.
- npm 11 blocca gli script di installazione non approvati: `esbuild` è stato approvato con `npm approve-scripts`.

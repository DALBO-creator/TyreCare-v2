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
| **Bootstrap 5** | 5.3 | ✅ | Griglia responsive e componenti. Importato **via Sass in modo selettivo** (`src/styles/_tema-bootstrap.scss`) con i colori del design system. |
| **Sass** (dart-sass) | 1.105 | ✅ | Preprocessore CSS (dev): variabili, cicli e personalizzazione di Bootstrap. Compilato da Vite. Gli avvisi di deprecazione di Bootstrap sono silenziati in `vite.config.ts`. |
| **Lexend** + **Source Sans 3** (`@fontsource-variable/*`) | 5.3 | ✅ | Font di titoli e testo, **inclusi nell'app** (no Google Fonts: offline + GDPR). |
| **Lucide** | 1.52 | ✅ | Icone SVG (`src/ui/icone.ts`); si importano solo quelle usate. |
| **Vite** | 8.3 | ✅ | Server di sviluppo con hot reload e build ottimizzata. |
| **vite-plugin-pwa** | 2.0 | ✅ | Genera `manifest.webmanifest` e il service worker (Workbox) con precache dell'app. Aggiornamenti in modalità `prompt`: l'utente sceglie quando ricaricare. |
| **@vite-pwa/assets-generator** | 2.0 | ✅ | Genera favicon, icone PWA e icona Apple dal logo SVG. |
| **@supabase/supabase-js** | 2.117 | ✅ | Client Supabase (`src/lib/supabase.ts`), creato al primo utilizzo. Auth, query, storage, realtime. |

## Backend (`apps/api`)

| Tecnologia | Versione | Stato | Uso in TyreCare |
|------------|----------|-------|-----------------|
| **Node.js (LTS)** | 24 | ✅ | Runtime. Versione fissata in `.nvmrc` e `engines`. |
| **fnm** (Fast Node Manager) | 1.39 | ✅ | Solo sul PC scolastico: installa Node 24 per l'utente senza permessi di amministratore (Node di sistema è v22). Va attivato in ogni terminale: vedi `NEXT.md` → Promemoria permanenti. |
| **Fastify** | 5.12 | ✅ | API HTTPS. Per ora solo `GET /health`. |
| **Zod** | 4.6 | ✅ | Validazione: variabili d'ambiente (`src/env.ts`) e, in seguito, dati in ingresso. Usato anche in `packages/shared`. |
| **tsx** | 4.23 | ✅ | Esegue TypeScript direttamente in sviluppo, con riavvio automatico (`npm run dev:api`). |
| **tsup** | 8.5 | ✅ | Compila l'API in un unico file JavaScript (`dist/server.js`), includendo il codice di `@tyrecare/shared`. |
| **web-push** | — | 🟡 | Invio notifiche push con chiavi VAPID (Fase 5). |

## Database e servizi

| Tecnologia | Versione | Stato | Uso in TyreCare |
|------------|----------|-------|-----------------|
| **Supabase** | — | ✅ | PostgreSQL gestito + Auth + Storage + Realtime + Edge Functions. Sicurezza con **RLS**. Progetto cloud `boqksbqcqulrtmyshhxe` (eu-west-1). |
| **Supabase CLI** | 2.119 | ✅ | Installata come dipendenza (`npx supabase …`). Configurazione in `supabase/config.toml`. Il database locale (`npx supabase start`) gira su **Docker Desktop**: API http://127.0.0.1:54321, Studio http://127.0.0.1:54323. |
| **Supabase Cron** | — | 🟡 | Job giornaliero dei reminder (Fase 5). |
| **Vercel** | — | ✅ | Hosting della PWA: https://tyre-care-v2.vercel.app (Root Directory `apps/web`). L'API avrà un secondo progetto Vercel in Fase 1. |

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
| **ui-ux-pro-max** (skill Claude Code) | ✅ | Generazione del design system (Fase 1) → [`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md). |

## Note di sicurezza sulle dipendenze

- `npm audit` segnala una vulnerabilità **bassa** in `esbuild` 0.27 (dipendenza di `tsup` e `vite`), relativa
  al server di sviluppo integrato di esbuild su Windows. Il progetto **non usa** quel server: nessun impatto.
  Si risolverà aggiornando `tsup`.
- npm 11 blocca gli script di installazione non approvati: `esbuild` è stato approvato con `npm approve-scripts`.
  `@parcel/watcher` (dipendenza di Sass, serve solo a `sass --watch` da riga di comando) **non** è approvato:
  Vite non lo usa, nessun impatto.
- Il bundle JS della PWA include **Zod** (~55 kB, ~17 kB gzip) tramite `@tyrecare/shared`: è voluto (stessi
  schemi per validare i form, PLAN P1). Se diventasse un problema: `zod/mini`.

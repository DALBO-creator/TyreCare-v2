# NEXT — Stato sessioni

> **Da aggiornare in ogni sessione.** All'inizio di una sessione si legge la sezione "Prossima sessione";
> alla fine si sposta il lavoro svolto nello storico e si scrive cosa fare dopo.

## Prossima sessione

**Completare la Fase 0** (richiede azioni del titolare del progetto):

- [ ] Installare **Docker Desktop** (serve per il database Supabase locale: `npx supabase start`)
- [ ] Creare il progetto **Supabase** cloud (regione UE, PLAN P17) e compilare `apps/web/.env` da `.env.example`
- [ ] Creare l'account **Vercel**, collegare il repo e configurare il deploy di `apps/web` (e di `apps/api`)
- [ ] Verificare che la CI su GitHub Actions sia verde dopo il push

**Poi avviare la Fase 1 — Fondamenta:**

- [ ] Design system con la skill `ui-ux-pro-max` (palette, tipografia, componenti) → Bootstrap via Sass
- [ ] Prima migrazione: `profiles`, `officine`, `officina_utenti` con ruoli e policy RLS
- [ ] Auth: registrazione/login, verifica del JWT Supabase nelle rotte Fastify

**Ancora in sospeso dalla sessione 1:**

- [ ] Rispondere alle domande aperte di `PLAN.md` §7 (soprattutto: quale gestionale e quali export)
- [ ] Rivedere prezzi e ipotesi in `PRODUZIONE-MARKETING.md`
- [ ] Inserire nome e dati del titolare in `LICENSE.md`

## Storico

### Sessione 2 — 2026-10-06

**Fatto**

- Accettate tutte le proposte P1–P19 di `PLAN.md`
- **Fase 0 (codice):**
  - monorepo npm workspaces: `apps/web`, `apps/api`, `packages/shared`
  - TypeScript ovunque, configurazione comune in `tsconfig.base.json`
  - ESLint (flat config + typescript-eslint) e Prettier, EditorConfig
  - Vitest con un project per workspace — 4 test passano
  - `apps/web`: Vite + Bootstrap 5 + vite-plugin-pwa (manifest, service worker, icone generate da `logo.svg`)
    + client Supabase
  - `apps/api`: Fastify con `GET /health`, validazione env con Zod, build con tsup (verificato avvio reale)
  - `packages/shared`: ruoli, stagioni, soglie battistrada e funzione `statoBattistrada`
  - Supabase CLI installata e `supabase/config.toml` creato
  - CI GitHub Actions: formattazione, lint, tipi, test, build
- Aggiornati `STRUCT.md`, `NOTES.md`, `PLAN.md`

**Note**

- `npm run check` esegue in locale gli stessi controlli della CI.
- Il logo in `apps/web/public/logo.svg` è provvisorio: verrà sostituito in Fase 1.
- La build web impiega ~1 minuto per la generazione del service worker (lento su Windows, non è un errore).

### Sessione 1 — 2026-10-05

**Fatto**

- Installata e configurata GitHub CLI, clonato il repo `TyreCare-v2`
- Installata la skill `ui-ux-pro-max` (plugin Claude Code)
- Creata la cartella `DOCS/` con: `PLAN.md`, `NEXT.md`, `NOTES.md`, `STRUCT.md`,
  `PRODUZIONE-MARKETING.md`, `IMPLEMENTAZIONI.md`, `LICENSE.md`, `first-prompt.md`
- `PLAN.md`: inserita la struttura ideata (Parte A) + 19 proposte di modifica (Parte B) + roadmap
- Creato `CLAUDE.md` nella root con le regole di lavoro sui documenti

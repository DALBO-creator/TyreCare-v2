# NEXT — Stato sessioni

> **Da aggiornare in ogni sessione.** All'inizio di una sessione si legge la sezione "Prossima sessione";
> alla fine si sposta il lavoro svolto nello storico e si scrive cosa fare dopo.

## Prossima sessione

### ⚠️ PRIMA COSA DA FARE: verificare WSL + Docker dopo il riavvio

A fine sessione 2 il titolare ha eseguito `wsl --install --no-distribution` (PowerShell amministratore) e
riavviato il PC. Situazione prima del riavvio: Docker Desktop 4.94 installato in
`C:\Users\albod\AppData\Local\Programs\DockerDesktop`, WSL **non** installato (`wsl --status` → exit 50),
virtualizzazione attiva (`HypervisorPresent = True`, il BIOS non va toccato).

Controlli da eseguire (aggiornare prima il PATH della shell: `$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')`):

- [ ] `wsl --status` e `wsl --version` → devono rispondere senza errori, versione predefinita 2
  - se mostrano solo l'elenco dei comandi o exit 50 → l'installazione non è andata a buon fine: ripetere
    `wsl --install --no-distribution` da PowerShell **amministratore** e riavviare
- [ ] `docker info --format "{{.ServerVersion}}"` → deve restituire una versione
  - se `failed to connect to the docker API … docker_engine` → Docker Desktop non è aperto: avviarlo da
    `C:\Users\albod\AppData\Local\Programs\DockerDesktop\Docker Desktop.exe` e attendere *Engine running*
  - se Docker Desktop segnala errori su WSL → `wsl --update` (ora disponibile), poi riavviare Docker Desktop
- [ ] `npx supabase start` nella root del repo → al termine stampa URL e chiavi locali (prima volta: diversi
  minuti per scaricare le immagini)
- [ ] `npx supabase status` → tutti i servizi attivi; Studio locale su http://127.0.0.1:54323

**Completare la Fase 0** (richiede azioni del titolare del progetto):

- [x] Installare **Docker Desktop**
- [x] Creare il progetto **Supabase** cloud — Project ID `boqksbqcqulrtmyshhxe`
- [x] Vercel: PWA online su **https://tyre-care-v2.vercel.app** (Root Directory `apps/web`, variabili
  `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` configurate)
- [x] CI su GitHub Actions verde
- [x] Supabase CLI autenticata e repo collegato al cloud (`npx supabase link`, regione eu-west-1)
- [x] WSL 2: comando di installazione eseguito + riavvio (**esito da verificare**, vedi sopra)
- [ ] Docker Desktop in esecuzione e Supabase locale avviato (`npx supabase start`)
- [ ] Sicurezza: revocare il token Supabase CLI comparso in chat e rifare il login con un token nuovo da un
  terminale normale (`npx supabase login --token …`), non tramite Claude
- [ ] Compilare `apps/web/.env` in locale da `.env.example`
- [ ] Deploy di `apps/api` su un secondo progetto Vercel (in Fase 1, quando avrà rotte vere)

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
- CI: azioni aggiornate a `@v7`; `.gitattributes` forza fine riga LF
- **Vercel:** `apps/web/vercel.json` (header di cache per service worker e manifest); build fallita per `tsc`
  non trovato → corretta dichiarando `typescript` in ogni workspace (Vercel installa solo le dipendenze del
  workspace). PWA online su https://tyre-care-v2.vercel.app (gli URL dei singoli deploy sono protetti da login)
- **Supabase:** CLI autenticata con token, repo collegato al progetto `boqksbqcqulrtmyshhxe` (eu-west-1)
- **Docker:** Docker Desktop installato ma senza WSL → avviata installazione WSL e riavvio
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

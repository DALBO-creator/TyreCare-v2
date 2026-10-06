# NEXT — Stato sessioni

> **Da aggiornare in ogni sessione.** All'inizio di una sessione si legge la sezione "Prossima sessione";
> alla fine si sposta il lavoro svolto nello storico e si scrive cosa fare dopo.

## 📌 Promemoria permanenti

> Sezione fissa: **non** va spostata nello storico. Claude deve ricordarla all'inizio di ogni sessione.

### 🏫 PC scolastico → attivare fnm (Node 24)

Sul PC scolastico Node di sistema è la **v22** (`C:\Program Files\nodejs`, non aggiornabile senza permessi di
amministratore), mentre il progetto richiede **Node 24**. Node 24 è installato per l'utente tramite **fnm**
(Fast Node Manager). **In ogni nuovo terminale PowerShell, prima di lavorare sul progetto:**

```powershell
fnm env --use-on-cd --shell powershell | Out-String | Invoke-Expression
fnm use 24
node --version   # deve stampare v24.x
```

Se `node --version` stampa `v22.x`, fnm non è attivo: `npm install`, `npm run check` e la build possono
fallire o comportarsi in modo diverso dalla CI.

Sul PC scolastico l'esecuzione di script PowerShell è disabilitata: `npm`/`npx` di fnm sono file `.ps1` e
vengono bloccati (*"L'esecuzione di script è disabilitata nel sistema in uso"*). Usare **`npm.cmd`** e
**`npx.cmd`** (es. `npx.cmd supabase status`), oppure, se consentito, `Set-ExecutionPolicy -Scope CurrentUser
RemoteSigned`.

Docker Desktop sul PC scolastico chiede di condividere le cartelle: in *Settings → Resources → File sharing*
è stata aggiunta `C:\Users\76672576\Documents\GitHub`.

Altre particolarità del PC scolastico:

- La rete passa da un **proxy (Squid)**: `curl` da Bash verso `localhost` risponde con una pagina d'errore
  del proxy → usare `curl --noproxy '*' http://localhost:…`.
- **Chrome headless è bloccato** (esce con codice 21): per gli screenshot automatici usare **Edge**
  (`msedge.exe --headless=new --screenshot=…`). Larghezza minima della finestra headless ~500 px.
- GitHub CLI è in `%LOCALAPPDATA%\gh\bin\gh.exe` (versione portable).

## Prossima sessione

**Da fare dal titolare (fuori da Claude):**

- [ ] Sicurezza: revocare il vecchio token Supabase CLI e generarne uno nuovo su
  https://supabase.com/dashboard/account/tokens, poi **da un terminale normale** (PC scolastico: `npx.cmd`):
  `npx supabase login --token …` e `npx supabase link --project-ref boqksbqcqulrtmyshhxe`

**Fase 1 — Fondamenta (continuare) — prossimo passo: la prima migrazione**

- [x] Design system con la skill `ui-ux-pro-max` → [`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md), Bootstrap via Sass
  (v3: "cruscotto sportivo" stile My Porsche, rosso e nero)
- [ ] Logo definitivo nello stile del design v3 (quello in `apps/web/public/logo.svg` è provvisorio) →
  rigenerare le icone PWA (`npm run icons -w @tyrecare/web`)
- [ ] (Facoltativo) rifinire il disegno dell'auto in `src/ui/auto.ts` se il titolare lo desidera
- [ ] **Prima migrazione:** `profiles`, `officine`, `officina_utenti` con ruoli (P16) e policy RLS; `supabase/seed.sql`
  con dati di prova; `supabase gen types` per i tipi TypeScript del database
- [ ] Auth: registrazione/login (schermate secondo il design system), verifica del JWT Supabase nelle rotte Fastify
- [ ] Router lato client e prime schermate reali al posto di `src/anteprima.ts`
- [ ] Deploy di `apps/api` su un secondo progetto Vercel (quando avrà rotte vere)

**Ancora in sospeso dalla sessione 1:**

- [ ] Rispondere alle domande aperte di `PLAN.md` §7 (soprattutto: quale gestionale e quali export)
- [ ] Rivedere prezzi e ipotesi in `PRODUZIONE-MARKETING.md`
- [ ] Inserire nome e dati del titolare in `LICENSE.md`

## Storico

### Sessione 3 — 2026-10-06 (PC scolastico)

**Fatto**

- **Ambiente sul PC scolastico** (vedi Promemoria permanenti):
  - GitHub CLI portable (installazione MSI bloccata senza permessi di amministratore) + `gh auth login`
    (account `DALBO-creator`) + `gh auth setup-git`
  - Node di sistema è v22 → installato **fnm** per l'utente con Node 24.21
  - `npm install`, `npm run check` verde; Python 3.13 presente
  - WSL 2 e Docker 28.1 funzionanti; condivisa la cartella `Documents\GitHub` in Docker Desktop;
    **Supabase locale avviato**
  - `apps/web/.env` e `apps/api/.env` creati (puntano a Supabase locale)
  - Skill `ui-ux-pro-max` reinstallata
- **Fase 1 — design system** ([`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md)):
  - palette navy + blu per le azioni; verde/ambra/rosso riservati allo stato degli pneumatici, contrasti
    verificati (tutti ≥ 4.5:1, chiaro e scuro); scartata la prima proposta della skill (rosso come colore
    delle azioni, stile da landing page)
  - font Lexend + Source Sans 3 inclusi nell'app (offline, GDPR); icone Lucide
  - Bootstrap importato via Sass in modo selettivo (`apps/web/src/styles/`), tema scuro automatico
  - componenti: barra superiore, navigazione inferiore, badge di stato, scheda pneumatico con misuratore
    del battistrada; pagina di anteprima `src/anteprima.ts`
  - `theme-color` della PWA → navy `#0f172a`; font latini nella precache del service worker
- **Design system v2** su richiesta del titolare: interfaccia **premium rosso e nera**, tema sempre scuro,
  font Outfit + Inter, rosso brand `#E10600` per le azioni e rosso corallo `#FF6B6B` (con ottagono) per lo
  stato "da sostituire"; nuovi componenti scheda veicolo, targa, avviso di stato, etichette di sezione.
  Verificato con screenshot headless di Edge (Chrome headless è bloccato sul PC scolastico)
- **Design system v3** (la v2 è stata giudicata "spoglia, non premium"): direzione **cruscotto sportivo**
  con riferimento **My Porsche** scelta dal titolare. Auto vista dall'alto in SVG con ruote illuminate del
  colore dello stato, indicatori a contagiri per ogni ruota, solo font Inter, liste "di lusso", hero con
  modello in grande, animazioni d'ingresso. Corretto un bug di layout (area di griglia chiamata `auto`).
  **Approvato dal titolare** dopo averlo visto dal telefono su Vercel
- Commit su `main` (CI verde, deploy Vercel riuscito su https://tyre-care-v2.vercel.app):
  `cca8174` design system v1, `5a70057` NEXT, `5e8027c` design system v3
- Aggiornati `NOTES.md`, `STRUCT.md` (anche righe Supabase/Vercel ferme alla sessione 1), `PLAN.md`

**Note**

- Avvisi di deprecazione Sass di Bootstrap 5.3 silenziati in `vite.config.ts` (spariranno con Bootstrap 6).
- Il bundle JS include Zod tramite `@tyrecare/shared` (~17 kB gzip): voluto.
- La v2 non è mai stata pubblicata (sostituita dalla v3 prima del commit).
- Lezione sul design: per "premium" non basta ricolorare Bootstrap; serve un **elemento protagonista**
  (qui l'auto + contagiri) e una tipografia con forti contrasti di dimensione. Chiedere subito riferimenti
  visivi al titolare (es. app che considera premium) prima di disegnare.

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

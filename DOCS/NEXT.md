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

> **Obiettivo della sessione 5: chiudere definitivamente la Fase 1**, poi (se avanza tempo) iniziare la
> Fase 2. La Fase 1 è chiusa quando tutti i punti A–D sono spuntati, `npm run check` e la CI sono verdi e
> registrazione + recupero password funzionano **dal telefono sul sito Vercel**, con email in italiano.

**Avvio sessione (PC di casa):** aprire Docker Desktop → `npm run db:start` → `npm run dev:web` (e
`npm run dev:api` se serve). In un terminale normale usare `npx.cmd`/`npm.cmd`.

**A — Configurazione online (titolare, dalla dashboard; Claude guida passo passo)**

- [x] Vercel: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` del cloud — accesso dal sito funzionante
- [ ] Supabase → *Authentication → URL Configuration*: **Site URL** `https://tyre-care-v2.vercel.app`,
  **Redirect URLs** `https://tyre-care-v2.vercel.app/**` (da verificare se già fatto)
- [ ] Supabase → *Authentication → Providers → Email*: lunghezza minima password **8** (come in locale)
- [ ] **SMTP proprio**: scegliere il servizio (proposta: **Resend**, gratuito fino a 3.000 email/mese) e il
  mittente (es. `noreply@<dominio>`; serve un dominio verificato — se non c'è ancora, decidere quale
  acquistare); configurarlo in *Project Settings → Authentication → SMTP Settings*; alzare il limite in
  *Authentication → Rate Limits*. Senza questo il servizio incluso manda ~2 email l'ora

**B — Email in italiano (Claude)**

- [ ] Template HTML in italiano, nello stile nero/rosso del design, per: conferma registrazione, recupero
  password, cambio email. File in `supabase/templates/*.html`, collegati in `supabase/config.toml`
  (`[auth.email.template.*]`) → provati in locale su Mailpit (http://127.0.0.1:54324)
- [ ] Copiarli nel cloud: dashboard → *Authentication → Email Templates* (oggetto + corpo)

**C — Profilo (Claude)**

- [ ] Modifica di nome, cognome e telefono dalla pagina Profilo (schema Zod in `packages/shared`, la RLS già
  permette di modificare solo il proprio profilo e il trigger blocca il ruolo)
- [ ] Cambio password da utente già autenticato (riusa `impostaNuovaPassword`)

**D — Rifiniture del design (titolare decide, Claude esegue)**

- [ ] Colore del marchio: in `_componenti.scss` `--tc-rosso` (rosso brand) è sovrascritta dal ciclo degli
  stati (= corallo `#ff6b6b`): "CARE", pallino della navigazione e fanali dell'auto escono corallo. Mostrare
  al titolare le due versioni (screenshot) e, se approva, rinominare la variabile del brand in `--tc-brand`
- [ ] Logo definitivo nello stile del design v3 (`apps/web/public/logo.svg` è provvisorio) → rigenerare le
  icone PWA (`npm run icons -w @tyrecare/web`)
- [ ] (Facoltativo) rifinire il disegno dell'auto in `src/ui/auto.ts`

**Chiusura Fase 1:** `npm run check` + `npm run db:test` verdi, prova completa dal telefono (registrazione
con email reale → conferma → accesso → modifica profilo → esci → recupero password), PLAN.md → Fase 1 ✅.

**Rimandati (non bloccano la Fase 1):**

- Invito di un utente in un'officina (oggi un titolare può aggiungere un `profile_id` ma non ha modo di
  trovarlo): flusso di invito via email/codice su Fastify → **Fase 2**, insieme ai clienti dell'officina
- Job CI con `supabase start` + `npm run db:test` (oggi i test pgTAP girano solo in locale) → quando le
  migrazioni aumentano (Fase 2)
- Deploy di `apps/api` su un secondo progetto Vercel → quando servirà la prima rotta usata dal web (import
  CSV in Fase 2); servirà anche CORS (`@fastify/cors`) e la variabile `SUPABASE_URL`

**Poi — Fase 2 (Dati):** migrazione `veicoli`, `veicoli_officina`, `clienti_officina`, `pneumatici`,
`controlli`, `misure_pneumatico` (PLAN P12) con RLS e test pgTAP; inserimento di un controllo dall'app
(lato officina); garage del cliente con il cruscotto dell'anteprima alimentato da dati veri.

**Ancora in sospeso dalla sessione 1:**

- [ ] Rispondere alle domande aperte di `PLAN.md` §7 (soprattutto: quale gestionale e quali export)
- [ ] Rivedere prezzi e ipotesi in `PRODUZIONE-MARKETING.md`
- [ ] Inserire nome e dati del titolare in `LICENSE.md`

## Storico

### Sessione 4 — 2026-10-06 (PC di casa)

**Fatto**

- **Ambiente sul PC di casa:** Node 24.19 di sistema (fnm non serve), `npm install` + `npm run check` verdi,
  Docker 29.8 → **Supabase locale avviato**; creati `apps/web/.env` (chiavi demo locali) e `apps/api/.env`
- **Prima migrazione** `supabase/migrations/20261006120000_fondamenta.sql`: tabelle `profiles`, `officine`,
  `officina_utenti` (TITOLARE/OPERATORE), enum, funzioni dei ruoli `security definer`, policy RLS, trigger
  (creazione profilo alla registrazione, campi riservati solo ADMIN, almeno un titolare per officina)
- `supabase/seed.sql`: 4 utenti di prova (password `password123`) e 2 officine; login verificato via API
- **Test pgTAP** `supabase/tests/database/fondamenta.test.sql`: 17 test sulle policy per ogni ruolo, tutti
  verdi (hanno trovato un bug nel trigger dei campi riservati, corretto)
- Tipi del database generati in `packages/shared/src/database.types.ts`, client Supabase del web tipizzato;
  test che verifica l'allineamento enum Zod ↔ database
- Script npm `db:start`, `db:reset`, `db:test`, `db:types`
- Titolare: token Supabase CLI rinnovato, login + link, **migrazione pubblicata sul cloud** con `db push`
  (commit `81bfabd`)
- **Auth (web):** router lato client senza librerie, pagine accedi / registrati / password dimenticata /
  nuova password / home / profilo con "Esci" / 404; `/anteprima` resta come riferimento del design.
  Moduli accessibili (skill `ui-ux-pro-max`) con schemi Zod condivisi in `packages/shared/src/auth.ts`
- **Auth (API):** verifica dei JWT di Supabase con `jose` e le chiavi pubbliche JWKS; rotte protette in un
  plugin Fastify; `GET /me`. 7 test (token valido, assente, scaduto, altro emittente/destinatario/chiave)
- `supabase/config.toml`: site URL `http://localhost:5173`, conferma email attiva, password minima 8
- Verificato in locale: `/me` con token reale, registrazione → email di conferma su Mailpit → profilo creato
  dal trigger; screenshot delle pagine con Edge headless
- Aggiornati `NOTES.md`, `STRUCT.md`, `PLAN.md`

**Note**

- Il token Supabase CLI per il cloud **non** serve per lavorare in locale: serve solo per `link`/`db push`.
- Link delle email aperti su iPhone → errore `NSURLErrorDomain`: puntavano a `localhost` perché nel progetto
  cloud il Site URL non era ancora impostato (Supabase ignora i redirect non in elenco e usa il Site URL).
- Creare un account senza email: dashboard → *Authentication → Users → Add user → Create new user* con
  "Auto Confirm User"; nome, cognome e ruolo si impostano con un `update public.profiles` dal SQL Editor.
- Anche sul PC di casa PowerShell blocca gli script `.ps1`: in un terminale normale usare `npx.cmd`/`npm.cmd`
  (oppure `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`).
- Ruolo globale e stato di affiliazione li cambia solo un ADMIN (o il backend con service role): decisione
  coerente con P2 (operazioni sensibili lato server).

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

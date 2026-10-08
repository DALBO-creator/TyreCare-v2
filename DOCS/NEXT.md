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

### 🏠 PC di casa → porte di Supabase riservate da Windows

Se `supabase start` fallisce con *"ports are not available … bind: An attempt was made to access a socket
in a way forbidden"*, Windows (Hyper-V/WinNAT) si è riservato le porte 54xxx. Il 2026-10-07 sono state
riservate in modo permanente le porte **54320–54329** (`netsh … add excludedportrange`); se ricapita, in
PowerShell **come amministratore**: `net stop winnat` → `net start winnat`. Docker Desktop è in
`%LOCALAPPDATA%\Programs\DockerDesktop\Docker Desktop.exe`.

## Prossima sessione

> **Obiettivo: Fase 2 (Dati) — completare il lato officina e iniziare il garage del cliente.**
> Le schermate officina per inserire dati ci sono (sessione 7); mancano modifica/eliminazione e l'import.

**Avvio sessione (PC di casa):** aprire Docker Desktop → `npm run db:start` → `npm run dev:web`. Dopo un
`git pull` con nuove migrazioni: `npm run db:reset` (ricrea il database locale con il seed).

**Per prima cosa:** controllare che la CI e il deploy Vercel del commit della sessione 7 siano verdi.

**0 — Pubblicare la migrazione sul cloud (titolare + Claude)**

- [x] (2026-10-08, dal titolare) `npx.cmd supabase db push` della migrazione
  `20261008130000_scritture_ripetibili.sql`
- [x] (2026-10-08, dal titolare) `npx.cmd supabase db push` della migrazione `20261008120000_operazioni_officina.sql` (funzioni
  `registra_controllo` e `monta_pneumatici`). **Senza, sul sito online "Monta pneumatici" e "Nuovo
  controllo" falliscono.** Token della CLI: `npx.cmd supabase login` se scaduto
- [x] (2026-10-08) Prova dal telefono sul sito Vercel con l'officina di prova creata sul cloud: riuscita, a
  parte il primo salvataggio che falliva (corretto, vedi storico)

**1 — Lato officina (Claude)**

- [ ] **Modifica** di cliente, veicolo, pneumatico e controllo (errori di battitura); **eliminazione** di
  cliente e veicolo per il TITOLARE (la RLS c'è già), con conferma
- [ ] Elenco e scheda dei clienti dell'officina (vedi `IMPLEMENTAZIONI.md`)
- [ ] Smontare uno pneumatico senza sostituirlo (es. ruota di scorta rimossa)

**2 — Lato cliente (Claude)**

- [ ] Garage del cliente: i suoi veicoli **uniti per targa** tra le officine, con il cruscotto di
  `/anteprima` (auto + contagiri) alimentato dall'ultimo controllo. Si possono riusare `cruscotto()` e lo
  storico di `pagine/veicolo.ts` (spostandoli in `ui/`)

**3 — Poi**

- [ ] Formato CSV standard di TyreCare + import (P8) — l'adattatore GESTITYRE aspetta il file di esempio
- [ ] Job CI con `supabase start` + `npm run db:test` (ora le migrazioni sono tre e i test pgTAP 54)
- [ ] Test end-to-end (Playwright, PLAN P7): in sessione 7 i flussi sono stati provati con uno script
  DevTools fatto al volo, da trasformare in test veri

**Rimandati:**

- **SMTP definitivo** con il dominio di LA SANTI GOMME: verificare il dominio su Resend (record DNS SPF/DKIM,
  serve chi gestisce il loro dominio), mittente `noreply@<dominio>`, aggiornare *SMTP Settings* in Supabase,
  poi controllare che le email **non finiscano in Spam**. Fino ad allora Resend in prova consegna **solo** a
  `albodavide1@gmail.com`
- Rifinire il disegno dell'auto in `src/ui/auto.ts` (facoltativo)
- Invito di un utente in un'officina (oggi un titolare può aggiungere un `profile_id` ma non ha modo di
  trovarlo): flusso di invito via email/codice su Fastify
- "Rivendicazione" dei veicoli da parte del cliente (collega `clienti_officina.profile_id` al suo account:
  codice invito dell'officina o targa + telefono) — oggi lo può fare solo ADMIN/service role
- Deploy di `apps/api` su un secondo progetto Vercel → quando servirà la prima rotta usata dal web; servirà
  anche CORS (`@fastify/cors`) e la variabile `SUPABASE_URL`

**Da chiedere a LA SANTI GOMME (primo partner, gestionale GESTITYRE — vedi `PLAN.md` P8):**

- [ ] Un **file `.xls` di esempio** esportato da GESTITYRE, se possibile con dati anonimizzati o finti
  (nomi, telefoni, targhe). **Richiesto il 2026-10-06, al 2026-10-07 non ancora arrivato**: il titolare lo
  comunicherà quando lo avrà (non metterlo nel repo se contiene dati reali di clienti)
- [ ] Quali **esportazioni** offre GESTITYRE (clienti, veicoli, pneumatici montati, deposito gomme,
  interventi/controlli con misure del battistrada?) e quali campi contengono
- [ ] Ogni quanto riuscirebbero a esportare (giornaliero, settimanale…) e chi lo farebbe in officina
- [ ] Nome/dati dell'officina per creare il suo profilo officina sul cloud (ragione sociale, P.IVA, indirizzo,
  orari) — e chi sarà il **TITOLARE** in TyreCare
- [ ] Dominio email dell'officina e chi ne gestisce i DNS (per l'SMTP definitivo)

**Ancora in sospeso dalla sessione 1:**

- [ ] Rispondere alle domande aperte di `PLAN.md` §7 (gestionale: **GESTITYRE, export `.xls`** — restano
  campi e frequenza, vedi sopra le domande per LA SANTI GOMME)
- [ ] Rivedere prezzi e ipotesi in `PRODUZIONE-MARKETING.md`
- [ ] Inserire nome e dati del titolare in `LICENSE.md`

## Storico

### Sessione 7 — 2026-10-08 (PC di casa)

**Fatto**

- CI e deploy Vercel della sessione 6 verdi; ambiente avviato (Docker, Supabase locale, `db:reset`)
- **Database:** migrazione `20261008120000_operazioni_officina.sql` con le funzioni `registra_controllo`
  (controllo + misure in una transazione, pneumatico ricavato dalla posizione) e `monta_pneumatici`
  (smonta e monta, cambio stagionale in un colpo), `security invoker`; 17 nuovi test pgTAP (totale 54,
  verdi); tipi rigenerati
- **Schemi Zod** in `packages/shared/src/officina.ts`: cliente, veicolo (targa normalizzata), montaggio
  pneumatici (DOT), controllo (decimali all'italiana, schema creato dalle ruote montate); `statoPeggiore`;
  16 nuovi test Vitest (totale 41)
- **Schermate officina** (skill `ui-ux-pro-max` per le regole di moduli, ricerca e stati vuoti): home con
  riepilogo e filtro per stato, ricerca ed elenco per urgenza; nuovo veicolo; nuovo cliente; scheda veicolo
  con cruscotto, cliente, pneumatici raggruppati e storico; monta pneumatici; nuovo controllo pensato per
  tablet e telefono (campi grandi con unità, `inputmode="decimal"`, stato della ruota in diretta, due ruote
  per riga sul tablet)
- `ui/modulo.ts`: menu a tendina, area di testo, gruppi di caselle, unità nei campi, errori del salvataggio
  sotto il campo (`ErroreModulo`); avviso di conferma comune (`vaiConConferma`)
- Provate nel browser (Chrome headless a 390 e 820 px) con i dati di prova: errori di validazione e focus,
  controllo salvato, cambio pneumatici con data incoerente, nuovo cliente → veicolo, targa duplicata,
  ricerca vuota, filtro, cliente che apre la scheda officina ("non trovato"). `npm run check` verde
- Aggiornati `NOTES.md`, `PLAN.md` (P2: funzioni SQL per le scritture su più tabelle), `DESIGN-SYSTEM.md`,
  `IMPLEMENTAZIONI.md`
- Migrazione pubblicata sul cloud (titolare); creata sul cloud l'**officina di prova** "Officina di prova
  TyreCare" (IN_ATTESA) con il titolare come TITOLARE; **prova dal telefono riuscita**
- **Bug dal telefono:** il primo salvataggio dopo qualche minuto falliva ("Qualcosa è andato storto"), il
  secondo funzionava. Causa: connessione chiusa durante la compilazione, e postgrest-js ripete da solo solo
  le letture. Correzione: le scritture si ripetono una volta dopo un errore di rete, con id scelti dal web e
  funzioni SQL che riconoscono una scrittura già arrivata (migrazione `20261008130000_scritture_ripetibili.sql`,
  `lib/rete.ts`); 4 nuovi test pgTAP (58) e 5 Vitest (46). Vedi `NOTES.md`

**Note**

- Sul PC di casa la copia aggiornata del repo è `C:\Users\albod\TyreCare-v2`; quella in
  `Documents\GitHub\TyreCare-v2` è vecchia (14 commit indietro): non usarla, o allinearla con `git pull`.
- Nessuna nuova dipendenza (`STRUCT.md` invariato).

### Sessione 6 — 2026-10-07 (PC di casa, breve)

**Fatto**

- Errore "Non riusciamo a caricare i tuoi dati" sul sito online: **risolto** per il titolare rifacendo
  l'accesso (era la sessione salvata non più valida dopo i cambi di password)
- Miglioramento: se il caricamento dei dati fallisce per una sessione non valida (`PGRST301`/`PGRST303`,
  profilo assente `PGRST116`, errori Auth 401/`bad_jwt`/`session_not_found`), l'app esce e torna ad
  `/accedi` invece di mostrare l'errore generico (`sessioneNonValida` in `lib/profilo.ts`,
  `gestisciErroreCaricamento` in `pagine/comune.ts`). `npm run check` verde; non provato nell'app


### Sessione 5 — 2026-10-07 (PC di casa)

**Fatto**

- **Profilo (C):** pagine `/profilo/dati` (nome, cognome, telefono) e `/profilo/password` (password attuale +
  nuova), sezione "Account" nel Profilo, avviso verde dopo il salvataggio; schemi Zod
  `ModificaProfiloSchema` e `CambioPasswordSchema` con test. Provato contro Supabase locale: salvataggio,
  telefono non valido rifiutato, profilo altrui bloccato dalla RLS, password attuale errata riconosciuta
- **Email (B, parte locale):** 4 template in italiano nello stile del design, provati su Mailpit con
  screenshot
- Risolto il blocco delle porte di Supabase su Windows (vedi Promemoria permanenti)
- **Configurazione online (A):** Site URL e Redirect URLs, password minima 8, SMTP con Resend in prova,
  4 template copiati nel cloud
- **Colore del marchio (D):** nuova variabile `--tc-brand` (rosso `#e10600`) per marchio, fanali, pallini
  di navigazione e notifica; il corallo resta solo per stati ed errori. Approvato dal titolare
- **Logo definitivo (D):** contagiri con zona rossa e lancetta rossa, scelto dal titolare tra 3 varianti;
  icone PWA rigenerate con sfondo nero (prima il generatore aggiungeva un bordo bianco)
- **Prova completa dal telefono sul sito Vercel superata** (commit `41ef3eb`, CI verde)
- **Fase 1 chiusa** (PLAN.md aggiornato). Rimandati: SMTP col dominio dell'officina, rifinitura dell'auto
- **Fase 2 iniziata — database:** migrazione `20261007120000_dati.sql` con `clienti_officina`, `veicoli`,
  `pneumatici`, `controlli`, `misure_pneumatico`, RLS e trigger; **decisione del titolare: veicoli per
  officina** (niente `veicoli_officina`, vedi PLAN P12); seed con seconda officina e titolare
  (`titolare2@tyrecare.test`); 20 nuovi test pgTAP (totale 37, verdi); tipi rigenerati; enum Zod
  `PosizioneSchema` e `UsuraSchema` con test di allineamento al database. **Pubblicata sul cloud** con `db push` dal titolare

**Note**

- Gmail mette in Spam le email da `onboarding@resend.dev` e lì disattiva i link: segnarle come "non spam".
- Se l'app è installata sul telefono, la nuova icona compare solo dopo averla rimossa e aggiunta di nuovo.
- `supabase start` dopo un riavvio di Docker può lasciare i container senza porte pubblicate:
  `npx.cmd supabase stop` e poi di nuovo `start`.


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

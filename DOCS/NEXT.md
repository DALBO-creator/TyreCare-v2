# NEXT — Stato sessioni

> **Da aggiornare in ogni sessione.** All'inizio di una sessione si legge solo la sezione "Prossima
> sessione"; alla fine si scrive il resoconto del lavoro svolto **in cima** a [`STORICO.md`](STORICO.md) e
> si aggiorna qui cosa fare dopo.

## Prossima sessione

> **Obiettivo: scegliere il passo successivo.** Ultima sessione: sessione agenti del 2026-10-20 (T001,
> solo documentazione: storico spostato in `STORICO.md`, regole di lettura più leggere, decisioni P22 e
> P23 in `PLAN.md`). L'ultima funzionalità è l'**import CSV standard di clienti e veicoli** (sessione 19,
> `/clienti/importa`), provato dal titolare: funziona. Con **P22** non si aspetta più il file `.xls` di
> GESTITYRE: il prossimo passo sull'import è la **mappatura delle colonne**.

**0 — Da chiedere al titolare**

- [ ] (facoltativo) Idee in `IMPLEMENTAZIONI.md`: gomme vecchie (DOT), stima del consumo, pulizia delle
  notifiche vecchie, preferenze, annullare un import
- [ ] P23: quale **dominio di TyreCare** usare per le email e quando configurarne i DNS su Resend
  (SPF/DKIM), una volta sola

**1 — Lavoro di Claude (da scegliere con il titolare)**

- [ ] P8: **import dei controlli** dal CSV (una riga per pneumatico misurato) — prima decidere come
  montare gli pneumatici storici (vedi `IMPLEMENTAZIONI.md`)
- [ ] P22: **import con mappatura delle colonne** — (2026-10-20, T008: fatta la logica condivisa in
  `importa.ts`: `tabellaDaCsv`, `mappaturaAutomatica`, `erroriMappatura`, `applicaMappatura`,
  `controllaTabella`; T009: lettura di .xls/.xlsx/.ods nel browser con `leggiTabella`; T010: schermata
  "Associa le colonne"; restano le mappature salvate, T012) — l'officina carica qualsiasi Excel/CSV e associa le sue
  colonne a quelle di TyreCare (sostituisce l'adattatore GESTITYRE `.xls`: non serve più aspettare il file
  di esempio)
- [ ] Fase 5: **email di riserva** — dopo l'email dal dominio di TyreCare (P23, vedi "Rimandati")
- [ ] Fase 4: officine vicine (geolocalizzazione); capienza/slot

Per l'avvio dell'ambiente vedi "Sessioni nel cloud" o "Solo per i PC di Davide" (sotto).

**Fatto in passato (riferimento):**

- [x] (2026-10-09, sessione 10) Garage del cliente con i veicoli uniti per targa
- [x] (2026-10-09, sessione 11) Report del singolo controllo con stampa/PDF
- [x] (2026-10-09, sessione 11) Stato di salute del singolo pneumatico (grafico, consumo, stima, età)
- [x] (2026-10-09, sessione 11) Job CI `database` con `supabase db start` + `db:test` + tipi allineati
- [x] (2026-10-10, sessione 12) Rivendicazione dei veicoli con l'invito via email (chiude la Fase 3, a parte
  il link pubblico del report rimandato)
- [x] (2026-10-11, sessione 13) Inviti pubblicati sul cloud e provati dal telefono; messaggio chiaro quando
  l'email di conferma non parte
- [x] (2026-10-12, sessione 14) Test end-to-end con Playwright sul flusso degli inviti, job CI `e2e`
- [x] (2026-10-12, sessione 14) Fase 4: catalogo dei servizi, richiesta con giorno e fascia, risposte
  dell'officina, appuntamenti di cliente e officina, calendario, orari e chiusure straordinarie (provata
  dal telefono)
- [x] (2026-10-13, sessione 15) "Prenota" dal garage con il veicolo già scelto
- [x] (2026-10-13, sessione 15) Cliente e veicolo creati dalla richiesta di appuntamento
- [x] (2026-10-14, sessione 16) Fase 5: notifiche nell'app per le prenotazioni, con badge in tempo reale
- [x] (2026-10-14, sessione 16) Fase 5: notifiche push (Edge Function `invia-notifica`, pg_net, VAPID)
- [x] (2026-10-14, sessione 17) Fase 5: promemoria del giorno prima (pg_cron)
- [x] (2026-10-14, sessione 17) Fase 5: promemoria degli pneumatici (esito del controllo, cambio stagionale)
- [x] (2026-10-15, sessione 18) Invito alle push dopo la richiesta; il report segna letta la sua notifica
- [x] (2026-10-16, sessione 19) Import CSV standard di clienti e veicoli (anteprima, registro)

**Rimandati:**

- **Link pubblico del report**: per ora basta il PDF (decisione del titolare, 2026-10-10)
- **Email dal dominio di TyreCare** (P23, decisione del 2026-10-20; sostituisce l'"SMTP definitivo" con il
  dominio di LA SANTI GOMME): mittente unico `noreply@<dominio TyreCare>` per tutte le officine. Il titolare
  verifica **una volta** il dominio su Resend (record DNS SPF/DKIM), poi si aggiornano le *SMTP Settings* in
  Supabase e si controlla che le email **non finiscano in Spam**. Fino ad allora Resend in prova consegna
  **solo** a `albodavide1@gmail.com`
- Rifinire il disegno dell'auto in `src/ui/auto.ts` (facoltativo)
- Invito di un utente in un'officina (oggi un titolare può aggiungere un `profile_id` ma non ha modo di
  trovarlo): flusso di invito via email/codice su Fastify
- Deploy di `apps/api` su un secondo progetto Vercel → quando servirà la prima rotta usata dal web; servirà
  anche CORS (`@fastify/cors`) e la variabile `SUPABASE_URL`

**Da chiedere a LA SANTI GOMME (primo partner, gestionale GESTITYRE — vedi `PLAN.md` P8):**

- [ ] Un **file `.xls` di esempio** esportato da GESTITYRE, se possibile con dati anonimizzati o finti
  (nomi, telefoni, targhe). **Richiesto il 2026-10-06, al 2026-10-07 non ancora arrivato**: il titolare lo
  comunicherà quando lo avrà (non metterlo nel repo se contiene dati reali di clienti). **Non più
  bloccante** (P22, 2026-10-20): con la mappatura delle colonne serve solo per provarla su un file vero
- [ ] Quali **esportazioni** offre GESTITYRE (clienti, veicoli, pneumatici montati, deposito gomme,
  interventi/controlli con misure del battistrada?) e quali campi contengono
- [ ] Ogni quanto riuscirebbero a esportare (giornaliero, settimanale…) e chi lo farebbe in officina
- [ ] Nome/dati dell'officina per creare il suo profilo officina sul cloud (ragione sociale, P.IVA, indirizzo,
  orari) — e chi sarà il **TITOLARE** in TyreCare
- [x] ~~Dominio email dell'officina e chi ne gestisce i DNS (per l'SMTP definitivo)~~ → non serve più: le
  email partono dal dominio di TyreCare (P23, 2026-10-20)

**Ancora in sospeso dalla sessione 1:**

- [ ] Rispondere alle domande aperte di `PLAN.md` §7 (gestionale: **GESTITYRE, export `.xls`** — con P22 i
  campi li associa l'officina; resta la frequenza, vedi sopra le domande per LA SANTI GOMME)
- [ ] Rivedere prezzi e ipotesi in `PRODUZIONE-MARKETING.md`
- [ ] Inserire nome e dati del titolare in `LICENSE.md`

## Sessioni nel cloud

> Per le sessioni degli agenti (e di Claude Code nel cloud), su Linux senza Docker.

- **Node 24** (richiesto da `.nvmrc`): se `node --version` è più vecchio, `npm i -g node@24 --silent &&
  hash -r`, poi `npm ci`.
- **Niente Docker**: `db:start`, `db:test`, `db:types` e `test:e2e` non girano. Il **database** (pgTAP, tipi
  allineati) e i test **end-to-end** si verificano solo nella **CI** (job `database` ed `e2e`).
- Dopo una migrazione `packages/shared/src/database.types.ts` va aggiornato a mano, coerente con la
  migrazione: la CI lo confronta con quello generato e stampa la differenza.
- Girano invece: `format`, `lint`, `typecheck`, `test` (Vitest) e `build`.

## Solo per i PC di Davide

> Promemoria permanenti per i PC Windows: **non** vanno spostati nello storico. Da leggere all'inizio di
> ogni sessione su uno di questi PC.

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

### 🏠 Avvio sessione (PC di casa)

Aprire Docker Desktop → `npm run db:start` → `npm run dev:web`. Dopo un
`git pull` con nuove migrazioni: `npm run db:reset` (ricrea il database locale con il seed).
**`npm run db:test` gira sui dati attuali del DB locale:** dopo prove nel browser che modificano il seed
(es. "Smonta" sulla Panda) i test pgTAP falliscono → `npm run db:reset` prima di `db:test`.
Dopo uno **standby** del PC il container `supabase_vector` (solo log di Studio) può restare in loop di
riavvio (*"Network unreachable … :2375"*): non tocca l'app; si risolve riavviando Docker Desktop.
**Test end-to-end:** `npm run test:e2e` con Supabase locale avviato (il server Vite parte da solo). Non
serve `db:reset`: i test creano dati con nomi unici.

## Storico

Lo storico delle sessioni è in [`STORICO.md`](STORICO.md) (dalla più recente alla più vecchia).

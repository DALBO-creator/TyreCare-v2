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

> **Obiettivo: provare i promemoria dal telefono e scegliere il passo successivo.** Sessione 17
> (2026-10-14, chiusa): **promemoria del giorno prima** e **promemoria degli pneumatici** (esito del controllo,
> cambio stagionale). **Prima di tutto** chiedere se è arrivato il file `.xls` di GESTITYRE (se c'è si
> riprende P8) e com'è andata la prova dei promemoria.

**0 — Da chiedere al titolare**

- [ ] **Promemoria del giorno prima**: confermare un appuntamento per **domani**; dopo le 18 (entro l'ora
  successiva) deve arrivare "Domani hai un appuntamento" (nell'app e come push)
- [ ] **Esito del controllo**: in officina registrare un controllo con una gomma sotto 1,6 mm su un veicolo
  collegato all'account di prova → il cliente riceve subito "Gomme da sostituire"; toccandola si apre il
  report
- [ ] **Cambio stagionale**: oggi (dal 15 ottobre) parte alle 10 per i veicoli nel garage con gomme
  **estive** montate. Da domani mattina il cliente di prova dovrebbe ricevere "È ora delle gomme invernali"
  (se ha estive montate)
- [ ] (facoltativo) In Supabase → *Integrations → Cron*: i job `promemoria-appuntamenti` e
  `promemoria-pneumatici` girano senza errori
- [ ] (facoltativo) Idee in `IMPLEMENTAZIONI.md`: gomme vecchie (DOT), stima del consumo, pulizia delle
  notifiche vecchie, preferenze

**1 — Lavoro di Claude (da scegliere con il titolare)**

- [ ] Invitare ad attivare le push anche dopo l'invio di una richiesta (oggi solo nella pagina Notifiche)
- [ ] Aprire il report di un controllo potrebbe segnare letta la sua notifica (come già l'appuntamento)
- [ ] Fase 5: **email di riserva** — dopo l'SMTP definitivo (vedi "Rimandati")
- [ ] Fase 4: officine vicine; capienza/slot
- [ ] Formato CSV standard di TyreCare + import (P8) — l'adattatore GESTITYRE aspetta il file di esempio

**Avvio sessione (PC di casa):** aprire Docker Desktop → `npm run db:start` → `npm run dev:web`. Dopo un
`git pull` con nuove migrazioni: `npm run db:reset` (ricrea il database locale con il seed).
**`npm run db:test` gira sui dati attuali del DB locale:** dopo prove nel browser che modificano il seed
(es. "Smonta" sulla Panda) i test pgTAP falliscono → `npm run db:reset` prima di `db:test`.
Dopo uno **standby** del PC il container `supabase_vector` (solo log di Studio) può restare in loop di
riavvio (*"Network unreachable … :2375"*): non tocca l'app; si risolve riavviando Docker Desktop.
**Test end-to-end:** `npm run test:e2e` con Supabase locale avviato (il server Vite parte da solo). Non
serve `db:reset`: i test creano dati con nomi unici.

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

**Rimandati:**

- **Link pubblico del report**: per ora basta il PDF (decisione del titolare, 2026-10-10)
- **SMTP definitivo** con il dominio di LA SANTI GOMME: verificare il dominio su Resend (record DNS SPF/DKIM,
  serve chi gestisce il loro dominio), mittente `noreply@<dominio>`, aggiornare *SMTP Settings* in Supabase,
  poi controllare che le email **non finiscano in Spam**. Fino ad allora Resend in prova consegna **solo** a
  `albodavide1@gmail.com`
- Rifinire il disegno dell'auto in `src/ui/auto.ts` (facoltativo)
- Invito di un utente in un'officina (oggi un titolare può aggiungere un `profile_id` ma non ha modo di
  trovarlo): flusso di invito via email/codice su Fastify
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

### Sessione 17 — 2026-10-14 (PC di casa)

**Fatto**

- Il file `.xls` di GESTITYRE **non è ancora arrivato**. Il titolare ha provato le **push dal telefono:
  funzionano**. Scelto il **promemoria del giorno prima**
- **Database:** migrazione `20261014180000_promemoria_appuntamenti.sql`: nuovo tipo di notifica
  `PROMEMORIA`, colonna `prenotazioni.promemoria_per`, funzione `crea_promemoria_appuntamenti(p_adesso)` e
  job **pg_cron** `promemoria-appuntamenti` ogni ora (minuto 5): dalle 18 italiane avvisa il cliente degli
  appuntamenti confermati del giorno dopo, una volta per orario (di nuovo se l'appuntamento è spostato).
  `promemoria.test.sql`: **13 pgTAP** (totale **247**); tipi rigenerati
- **Web:** icona sveglia per i promemoria nella pagina Notifiche
- `npm run check` verde, `db:test` verde, CI verde. Il token della Supabase CLI era scaduto: il titolare ha
  rifatto `npx supabase login` **in un PowerShell esterno** (dentro Claude Code il login interattivo non
  funziona). **Pubblicato sul cloud** con `db push`; verificato con `supabase db query --linked` che il job
  `promemoria-appuntamenti` esiste ed è attivo
- **Promemoria degli pneumatici** (P11). Scelte del titolare: esito del controllo e cambio stagionale, solo al
  cliente, alle 10 (scartati per ora: gomme vecchie e stima del consumo). Migrazione
  `20261014200000_promemoria_pneumatici.sql`: tipi `ESITO_CONTROLLO` e `CAMBIO_STAGIONE`, colonna
  `notifiche.chiave` (unica per destinatario: niente doppioni), `stato_battistrada()` (soglie come
  `packages/shared`), constraint trigger **deferred** `controlli_notifica_esito`, funzione
  `crea_promemoria_pneumatici()` e job pg_cron `promemoria-pneumatici` (minuto 15). 21 pgTAP (totale
  **268**); verificato a mano che il trigger scatta al commit. Icone nella pagina Notifiche. Commit
  `d0ad309`, CI verde, **pubblicato sul cloud** con `db push`: i due job pg_cron risultano attivi

### Sessione 16 — 2026-10-14 (PC di casa)

**Fatto**

- Il file `.xls` di GESTITYRE **non è ancora arrivato**. Il titolare ha **confermato la decisione P14**
  (cliente creato dalla richiesta collegato all'account senza invito) e ha scelto la **Fase 5: notifiche**
- **Database:** migrazione `20261014120000_notifiche.sql`: tabella `notifiche` (titolo, testo e link in
  italiano), trigger `prenotazioni_notifica` su ogni cambio di stato (nuova richiesta, proposta accettata,
  annullamento → officina; conferma, proposta, rifiuto → cliente; chi agisce non riceve nulla),
  `testo_quando()`, RLS (solo il destinatario; dall'app si cambia solo `letta_il`), tabella in Realtime.
  `notifiche.test.sql`: **31 pgTAP** (totale **226**); tipi rigenerati
- **Web:** voce **"Notifiche"** (campanella, quinta voce) con badge rosso delle non lette aggiornato in
  tempo reale (`lib/notifiche.ts`, Supabase Realtime); pagina `/notifiche` (ultime 50, nuove evidenziate,
  aprirla le segna lette); aprire un appuntamento segna lette le sue. Skill `ui-ux-pro-max` consultata
  (badge sulla voce che si azzera dopo la visita, conteggio annunciato come frase, link diretti)
- 6 Vitest nuovi (totale **106**); e2e `notifiche.spec.ts` (badge che arriva senza ricaricare, dai due
  lati): **15/15 e2e verdi**. `npm run check` verde. Screenshot a 390 e 1440 px controllati: corretto un
  problema (aprendo direttamente `/notifiche` chi lavora in officina vedeva le voci del cliente)
- Aggiornati `NOTES.md`, `PLAN.md` (P21, roadmap), `STRUCT.md` (Realtime), `IMPLEMENTAZIONI.md`

**Note**

- Nessuna nuova libreria.
- Commit `56b13df` (codice) e `4d13a93` (documenti). **Migrazione pubblicata sul cloud da Claude** (ok del
  titolare, prima `--dry-run`): 12 migrazioni allineate, trigger e Realtime verificati sul cloud
- La prima CI ha fallito solo nel job `e2e`: Supabase partiva **senza Realtime** (`-x realtime` in
  `ci.yml`) e il badge non arrivava. Tolto dalla lista (`ci:` commit successivo): **CI tutta verde**,
  deploy Vercel verde
- Test del titolare superati. **Web Push** (autorizzazione del titolare a fare e pubblicare tutto; P21
  confermata): migrazione `20261014150000_notifiche_push.sql` (`iscrizioni_push`, `iscrivi_push()`,
  trigger `notifiche_push` con pg_net e segreti nel Vault), Edge Function `invia-notifica` (`web-push`,
  iscrizioni scadute eliminate), `public/sw-push.js` importato nel service worker, `lib/push.ts` e sezione
  "Avvisi sul telefono" nella pagina Notifiche (permesso chiesto solo dopo il tocco, istruzioni per iPhone).
  8 pgTAP in `push.test.sql` (totale **234**), `npm run check` verde, e2e delle notifiche verdi
- **Pubblicato sul cloud da Claude:** segreti della funzione (`VAPID_*`, `PUSH_SEGRETO`), deploy di
  `invia-notifica`, migrazione (prima `--dry-run`), segreti nel Vault. Verificato: funzione 401 senza
  segreto, 404 con id inventato; notifica di prova con iscrizione finta → la funzione è stata chiamata dal
  database e ha risposto 200 (`dispositivi: 1`). Dati di prova cancellati. **Consegna vera sul telefono non
  ancora provata** (serve un dispositivo reale)
- Commit `684d5da`: **CI (`check`, `database`, `e2e`) e deploy Vercel verdi**. La chiave privata VAPID è
  solo nei segreti di Supabase (copia locale cancellata): se si perde, nuove chiavi e nuove iscrizioni
- Le notifiche nascono nel database: Web Push ed email leggeranno la stessa tabella (P21).

### Sessione 15 (in parallelo) — 2026-10-13: impaginazione da computer

Lavoro svolto da un secondo agente in parallelo alla sessione 15, nel worktree
`desktop-ottimizzazione` (ramo `worktree-desktop-ottimizzazione`), senza toccare i file di `src/pagine/`
su cui lavorava l'altro agente.

**Fatto**

- **Richiesta del titolare:** ottimizzare la versione da computer, perché le officine accedono di solito
  dal PC (decisione in `PLAN.md` P20). Skill `ui-ux-pro-max` consultata (navigazione che non copre il
  contenuto, ordine del Tab uguale a quello visivo, larghezza di lettura limitata)
- Da 992 px **barra laterale** al posto delle barre del telefono; moduli 40 rem, elenchi 60 rem, schede
  76 rem su **due colonne** (home dell'officina, scheda del veicolo con cruscotto fermo, scheda del
  cliente, dettaglio dell'appuntamento compresa la nuova sezione "Nella tua officina", calendario con
  mattina e pomeriggio affiancati, garage del cliente con le carte affiancate)
- **"Salta al contenuto"** e tasto **`/`** per la ricerca
- Tutto in `ui/layout.ts` (attributo `data-pagina` per percorso) e nel nuovo `styles/_desktop.scss`;
  telefono e stampa invariati (screenshot a 390 px controllato)
- Nuovo e2e `computer.spec.ts` (1280×800). **12/12 e2e verdi** (contro il Vite del worktree), `npm run
  check` verde. Screenshot controllati a 1440 e 1024 px
- Aggiornati `NOTES.md`, `DESIGN-SYSTEM.md`, `PLAN.md` (P20), `IMPLEMENTAZIONI.md` (4 idee nuove)

**Note**

- Nessuna migrazione e nessuna nuova libreria (`STRUCT.md` invariato).
- Unito in `main` dopo la chiusura della sessione 15 (richiesta del titolare); unico conflitto in
  `NOTES.md`, risolto tenendo entrambe le parti.
- CI di `48e1cef` (`check`, `database`, `e2e`) **verde**; worktree e ramo cancellati. **Provata dal titolare
  dal PC dell'officina: funziona** (barra laterale, colonne, tasto `/`).
- Le colonne dipendono dalla struttura delle pagine (figli di `.tc-contenuto`): se si riordina una di
  quelle pagine, controllarla a 1440 px (vedi `NOTES.md`, "Impaginazione da computer").

### Sessione 15 — 2026-10-13 (PC di casa)

**Fatto**

- Il file `.xls` di GESTITYRE **non è ancora arrivato**; scelta del titolare: **"Prenota" dal garage**
- **Carta dell'officina** nella scheda del garage: pulsante rosso "Prenota" a tutta larghezza sopra
  Chiama/Indicazioni, solo per le officine prenotabili (ATTIVA, servizi prenotabili, orari);
  `caricaOfficinePrenotabili()` in una query, errore ignorato (è solo una scorciatoia)
- **Avviso sulle ruote** nel garage: "Prenota la sostituzione" (rosso) / "Prenota un controllo" (giallo)
  verso l'officina prenotabile più recente. Il report del controllo resta senza "Prenota"
- **Modulo `/prenota`** con `targa=`: compila targa e descrizione con quel veicolo; "Annulla" torna al garage
- Nuovo e2e (Giulia del seed: Prenota solo per Gomme Rossi, non per Pneus Express in attesa; modulo
  compilato; Annulla): **11/11 verdi**. `npm run check` verde (97 Vitest). Screenshot a 390 px controllato
- Aggiornati `NOTES.md`, `PLAN.md` (roadmap), `IMPLEMENTAZIONI.md` (due idee fatte)

**Note**

- Nessuna migrazione e nessuna nuova libreria (`STRUCT.md` invariato).
- Commit `b496bdc` (codice) e `7c2d720` (documenti): deploy Vercel verde, ma il job CI `database` è
  fallito per un **bug di date in `orari.test.sql`** (nulla a che fare con "Prenota"): di **martedì**
  `prossimo(3)` (domani) viene prima di `prossimo(2)` (tra 7 giorni). Corretto usando `prossimo(2) + 1`;
  `db:test` 176/176
- Titolare: "Prenota" visto dal telefono nella scheda del veicolo ("La tua officina")
- **Cliente e veicolo dalla richiesta:** migrazione `20261013120000_cliente_da_prenotazione.sql` con
  `registra_cliente_da_prenotazione` (`security definer`, solo membri dell'officina; cliente nuovo
  collegato all'account o veicolo sulla scheda già collegata; si ferma se la targa c'è già o la richiesta
  è chiusa; ripetibile). 17 pgTAP (totale **193**); tipi rigenerati. `dividiVeicolo` in shared con 3
  Vitest (totale **100**). Dettaglio della richiesta: sezione "Nella tua officina" sotto le azioni, con
  dialogo di conferma. Nuovo e2e: **12/12 verdi**. Screenshot a 390 px controllati (sezione spostata sotto
  "Conferma appuntamento" per non spingerlo in basso). Commit `0e5b4d9` (codice) e
  `c6a6d75` (documenti). **Migrazione pubblicata sul cloud da Claude** (ok del titolare, prima
  `--dry-run`): 10 migrazioni allineate, funzione presente. CI e deploy Vercel verdi
- **Bug dal telefono (titolare):** "Aggiungi cliente e veicolo" falliva ("Qualcosa è andato storto") con
  un account senza nome nel profilo (creato dalla dashboard): vincolo `clienti_officina_nominativo`.
  Correzione nella migrazione `20261013150000_cliente_da_prenotazione_senza_nome.sql`: nome di ripiego
  dalla parte dell'email prima della @ (o "Cliente"). 2 pgTAP (totale **195**); testo "Chi ha prenotato"
  quando manca il nome. Commit `7b3f29f` (CI verde); migrazione **pubblicata dal titolare** con `db push`
  (prima `--dry-run`): 11 migrazioni allineate, ripiego verificato nella funzione sul cloud
- **Prove dal telefono del titolare riuscite:** "Prenota" nella carta "La tua officina"; "Aggiungi cliente
  e veicolo" funziona (dopo la correzione del profilo senza nome)
- Un altro agente lavora in parallelo sulla **versione desktop**: questo lavoro non tocca stili né
  `ui/layout.ts`

### Sessione 14 — 2026-10-12 (PC di casa)

**Fatto**

- Il file `.xls` di GESTITYRE **non è ancora arrivato** (arriverà a breve): il titolare ha scelto di passare
  alla **Fase 4** dopo i test end-to-end
- **Test end-to-end con Playwright** (PLAN P7): nuovo workspace `e2e/` (`@playwright/test` 1.64, Chromium
  con schermo da telefono), `npm run test:e2e`. Primi 4 test sul flusso degli inviti: invito completo con la
  vera email di conferma letta da Mailpit (registrazione → conferma → collega → garage → "Usa l'app" →
  "Invito già usato" per un altro), email diversa, invito annullato, codice inventato. **4/4 verdi** in
  ~1 minuto, anche ripetuti senza `db:reset` (dati con nomi unici)
- Nuovo job CI `e2e` (Supabase senza i servizi inutili, report di Playwright tra gli artifact se fallisce)
- Test pgTAP "l'operatore vede solo i veicoli della propria officina" reso indipendente dal numero di
  veicoli (gli e2e ne aggiungono): `db:test` 107/107 anche dopo gli e2e. `npm run check` verde
- Aggiornati `STRUCT.md` (Playwright), `NOTES.md`, `PLAN.md` (P7). Commit `d1780c1` e `b9a459c`: **CI verde,
  anche il nuovo job `e2e`** (3 min 26 s)
- **Fase 4 — decisioni del titolare:** prenotazioni da **tutte le officine attive**, **giorno + fascia**
  (l'officina conferma con l'ora), **prezzo indicativo facoltativo** nel catalogo
- **Database:** migrazione `20261012120000_prenotazioni.sql` — `servizi_officina` (catalogo, lo modifica il
  TITOLARE), `prenotazioni` (scrittura solo dalle funzioni `richiedi_prenotazione`,
  `rispondi_prenotazione`, `rispondi_proposta`, `annulla_prenotazione`), `fasce_aperte`, `oggi_in_italia`.
  Seed: 4 servizi di Gomme Rossi e una richiesta di Giulia. `prenotazioni.test.sql`: **50 test pgTAP**
  (totale **157**); tipi rigenerati. **Pubblicata sul cloud da Claude** con `db push` (ok del titolare,
  prima `--dry-run`): 8 migrazioni allineate
- **Shared:** `prenotazioni.ts` (fasce, date italiane con ora legale, schemi di servizio, richiesta,
  conferma, proposta, rifiuto), 19 nuovi Vitest (totale **87**)
- **Web:** catalogo `/servizi` (Profilo → "Servizi e prezzi"); per il cliente voce "Officine" → scheda
  dell'officina con servizi e orari → `/prenota` (veicoli del garage come scorciatoie, fascia chiusa
  spenta); voce "Appuntamenti" per tutti con elenco e dettaglio (conferma con l'ora, proponi un altro
  orario, rifiuta/annulla con motivo, completato/non presentato; il cliente accetta la proposta o annulla);
  avviso "richieste da confermare" nella home dell'officina. Skill `ui-ux-pro-max` consultata (date per
  esteso, stato con icona e testo, conferma prima di annullare)
- **E2e:** 4 test sulle prenotazioni (cliente nuovo per ogni test, creato dall'API di Auth): **8/8 verdi**.
  Screenshot a 390 px controllati (corretti spazio sopra "Rifiuta" e suggerimento sul giorno chiuso).
  Test pgTAP resi indipendenti dai dati lasciati dagli e2e. `npm run check` verde
- Aggiornati `NOTES.md`, `PLAN.md` (P14, roadmap, §7 prezzi), `DESIGN-SYSTEM.md`, `IMPLEMENTAZIONI.md`

- CI (`check`, `database`, `e2e`) e deploy Vercel di `86eff70`: **verdi**
- **Officina di prova sul cloud resa prenotabile da Claude** (richiesta del titolare) con
  `npx supabase db query --linked`: `ATTIVA`, orari lun–ven 8:30–12:30 e 14:30–19:00, sabato mattina. Il
  servizio "Controllo di routine" (da 75 €) c'era già. Verificato come utente anonimo che officina e
  servizio sono visibili
- **Calendario dell'officina** (richiesta del titolare) `/appuntamenti/calendario`: settimana con il numero
  di appuntamenti per giorno, agenda del giorno per mattina/pomeriggio (ore in ordine, richieste "da
  fissare"), proposte nel giorno proposto; selettore Calendario/Elenco. `lib/calendario.ts` con 5 Vitest
- **Orari e chiusure** (titolare, Profilo → "Orari e chiusure"): editor degli orari (due turni al giorno,
  copia del lunedì), chiusure straordinarie (dal/al/motivo). Migrazione `20261012150000_orari_chiusure.sql`:
  vincolo `orari_validi`, tabella `chiusure_officina`, `richiedi_prenotazione` rifiuta i giorni di
  chiusura; seed con una chiusura "Inventario" tra 20 e 22 giorni. `orari.test.sql`: 19 pgTAP (totale
  **176**). Chiusure nel modulo "Prenota", nella scheda dell'officina e nel calendario. **Migrazione pubblicata
  sul cloud da Claude** (ok del titolare): 9 migrazioni allineate, orari dell'officina di prova validi
- 2 nuovi e2e (orari, chiusura) + controllo del calendario nel test della conferma: **10/10 verdi**;
  Vitest **97**; `npm run check` verde. Screenshot controllati (campi ora affiancati: pagina lunga la metà)
- Commit `03d4600` (codice) e `ff71f61` (documenti): **CI e deploy Vercel verdi**
- **Prova dal telefono del titolare: funziona tutto** (prenotazioni, calendario, orari e chiusure)

**Note**

- Nessuna nuova libreria per la Fase 4 (`STRUCT.md` invariato).
- Claude può interrogare il database cloud con `npx supabase db query --linked "…"` (CLI autenticata sul
  PC di casa): utile per controlli e piccole correzioni di dati, sempre con l'ok del titolare.
- Niente notifiche ancora (Fase 5): le novità si vedono aprendo l'app.

### Sessione 13 — 2026-10-11 (PC di casa)

**Fatto**

- CI (`check` e `database`) e deploy Vercel di `7d04c0c` (fine sessione 12): verdi
- **Migrazione `20261010120000_inviti_cliente.sql` pubblicata sul cloud da Claude** con `npx supabase db
  push` (con l'ok del titolare; prima un `--dry-run`). Ora tutte e 7 le migrazioni risultano anche sul
  cloud; `info_invito` chiamata senza accesso con un codice inventato risponde `[]`. Redirect URLs già a
  posto (titolare)
- **Prove dal telefono del titolare:** A (invito come titolare), B (come cliente) e C (email diversa,
  invito annullato) **riuscite**. C3 ("Invito già usato") saltata su richiesta del titolare
- **Problema trovato nella B:** "Crea account" con un'email diversa da `albodavide1@gmail.com` →
  "Qualcosa è andato storto". Causa: Resend in prova rifiuta il destinatario, Supabase risponde 500
  `unexpected_failure` "Error sending confirmation email". Non è un bug dell'app; la B è stata completata
  creando l'account dalla dashboard con "Auto Confirm User" e poi "Accedi" dal link dell'invito
- **Correzione:** `messaggioErrore` riconosce l'email non inviata e mostra "Non riusciamo a inviarti
  l'email in questo momento…"; 2 test in `lib/auth.test.ts` (Vitest **68**). `npm run check` verde
- Aggiornati `NOTES.md` (Auth) e questo file

**Note**

- Pubblicare le migrazioni con `npx supabase db push` (CLI già autenticata sul PC di casa) invece del SQL
  Editor: così finiscono nello storico del cloud e un `db push` futuro non prova a rieseguirle.
- Claude non può leggere i log di Supabase dal PC (servirebbe estrarre il token della CLI dal Gestore
  credenziali, bloccato): per errori sul cloud chiedere al titolare *Logs → Auth* dalla dashboard.
- Non verificato se Resend in prova accetta gli alias Gmail con `+`.

### Sessione 12 — 2026-10-10 (PC di casa)

**Fatto**

- **Prove dal telefono della sessione 11 riuscite** (titolare): report del controllo, PDF, stato di salute
  dello pneumatico. Controllati da Claude CI (`check` e `database`) e deploy Vercel di `81245ec`: verdi
- **Decisioni del titolare:** link pubblico del report **non serve per ora** (basta il PDF);
  rivendicazione dei veicoli con **invito via email dall'officina**
- **Migrazione `20261010120000_inviti_cliente.sql`:** tabella `inviti_cliente` (solo lettura per i membri,
  si scrive dalle funzioni), `crea_invito_cliente`, `annulla_invito_cliente`, `info_invito` (anche senza
  accesso), `accetta_invito`. Codice casuale di 128 bit salvato solo come SHA-256, scadenza 14 giorni, un
  nuovo invito annulla i precedenti, si accetta solo con **la stessa email confermata**. Il trigger
  `proteggi_collegamento_cliente` ora lascia scrivere `profile_id` a una funzione `security definer`
- `inviti.test.sql`: 27 test pgTAP (totale **107**)
- **App:** sezione "App TyreCare" nella scheda del cliente; pagina `/cliente/invito` (email, "Scrivi
  l'email" con `mailto:`, "Condividi il link", "Copia il link"); pagina pubblica `/invito?codice=…` per il
  cliente (crea account / accedi con l'email già scritta, collega, email diversa, annullato, scaduto, già
  usato, non valido); il link di conferma della registrazione riporta alla pagina richiesta; avviso verde
  nel garage dopo il collegamento; testo nuovo del garage vuoto. `InvitoSchema` e `lib/inviti.ts` con test
  (Vitest **66**)
- Provato in Chrome headless (390 px) contro Supabase locale, con l'email di conferma vera letta da Mailpit:
  **22 verifiche verdi**. `npm run check` verde, `db:test` 107/107
- Aggiornati `NOTES.md`, `PLAN.md` (decisione e roadmap), `IMPLEMENTAZIONI.md` (invio automatico,
  scollegare, invito da "Nuovo cliente", filtro "da invitare")

**Note**

- Nessuna nuova libreria (`STRUCT.md` invariato).
- L'email d'invito parte dal programma di posta dell'officina (`mailto:`), non da TyreCare: con Resend in
  prova le email automatiche arriverebbero solo al titolare. Con l'SMTP definitivo si potrà aggiungere
  l'invio automatico.
- Il push è stato fatto **prima** della migrazione sul cloud (scelta del titolare, per fare tutto nella
  prossima sessione). Per non rompere la scheda del cliente nel frattempo, il caricamento dell'invito in
  corso ignora gli errori (`caricaInvitoInCorso(id).catch(() => null)` in `pagine/cliente.ts`).
- Commit `020a8bb` (codice), `49443f6` (documenti) e quello finale con questa nota.

### Sessione 11 — 2026-10-09 (PC di casa)

**Fatto**

- Migrazione `garage_cliente` già pubblicata sul cloud dal titolare. Prove dal telefono delle sessioni 9 e
  10 **riuscite** (titolare). Spiegato come collegare un account cliente a un cliente dell'officina dal SQL
  Editor (query con email dell'account e nome del cliente, senza copiare gli UUID)
- **Report del controllo** `/controllo?id=…` (Fase 3, PLAN §2.3): data, targa, auto e km; cruscotto di quel
  controllo; avviso sull'esito (anche "tutto in buono stato"); una carta per ruota con stato, battistrada,
  pressione, usura, danni e pneumatico; soglie spiegate; note; officina con Chiama e Indicazioni. Lo vedono
  il cliente e chi lavora nell'officina che l'ha eseguito (RLS); un'altra officina con la stessa targa no
- "Apri il report" nello storico del garage e della scheda officina; "Correggi o elimina" anche nel
  report per l'officina; "Torna al veicolo" verso il garage o la scheda dell'officina
- **Stampa o salva in PDF** con foglio di stile di stampa (nero su bianco, senza barre e pulsanti, telefono
  dell'officina, data di stampa); il titolo della pagina dà il nome al PDF. Nuovo token `$tc-grigio-stampa`
- Avviso delle ruote spostato in `ui/avviso-pneumatici.ts` (garage e report); `cruscotto()` con
  `{ ultimo: false }`; `cartaOfficina()` esportata
- Skill `ui-ux-pro-max` consultata (navigazione indietro prevedibile, carte invece di tabelle sul
  telefono; nessuna regola sulla stampa nel suo database: usate regole generali)
- Provato in Chrome headless (390 px e stampa emulata) come cliente, titolare, operatore e titolare di
  un'altra officina: **25 verifiche verdi**. `npm run check` verde (52 Vitest), `db:test` 80/80
- Aggiornati `NOTES.md`, `PLAN.md` (roadmap), `DESIGN-SYSTEM.md`, `IMPLEMENTAZIONI.md`
- Commit `9d11bf4` (codice) e `34821f5` (documenti) su `main`: **CI e deploy Vercel verdi**. Prova dal
  telefono non ancora fatta
- *Seconda parte, senza il titolare (non poteva usare il telefono):*
- **CI:** nuovo job `database` (`supabase db start` solo Postgres, `db:test`, tipi generati uguali a quelli
  nel repo); simulato in locale e **verde su GitHub** (~2 min, commit `f66f8e1`)
- **Stato di salute dello pneumatico** `/pneumatico?id=…` (PLAN §2.4): contagiri dell'ultima misura,
  grafico SVG dell'andamento con le soglie (skill `dataviz`), consumo al mese e ogni 10.000 km (retta dei
  minimi quadrati), stima di quando arriverà alla soglia, età dal DOT con avviso oltre i 5 anni, elenco
  delle misure con link ai report. Si apre toccando un contagiri del cruscotto (garage, scheda officina,
  report) o da "Stato di salute" nel report. `lib/salute.ts` con 8 test Vitest (totale 60)
- Corretto dopo gli screenshot: etichette delle soglie spostate in una legenda sotto il grafico (si
  sovrapponevano all'ultimo valore); "Oggi" → "Ultima" sotto il contagiri
- Provato in Chrome headless (390 px) con un secondo controllo aggiunto a mano al DB locale: **22 verifiche
  verdi**. `npm run check` verde, `db:test` 80/80
- Scritto in cima a questo file l'elenco completo delle prove del titolare (punto 0)
- Commit `c3b6692` (codice) e `c906c02` (documenti) su `main`: **CI (`check` e `database`) e deploy Vercel
  verdi**

**Note**

- Nessuna nuova libreria (`STRUCT.md` invariato), nessuna migrazione. Il grafico è SVG scritto a mano.
- Il seed ha un solo controllo: per vedere il grafico in locale serve un controllo più vecchio aggiunto
  dal SQL (`npm run db:reset` lo toglie).
- Il link pubblico del report è rimandato: richiede un token revocabile letto lato server, non una policy
  RLS aperta (vedi `IMPLEMENTAZIONI.md`).

### Sessione 10 — 2026-10-09 (PC di casa)

**Fatto**

- **Controllo dopo lo standby:** repo pulito e allineato, CI e Vercel della sessione 9 verdi,
  `npm run check` verde. Un test pgTAP falliva per i dati lasciati dalle prove della sessione 9 ("Smonta"
  sulla Panda) → `db:reset`, 74/74 verdi. `supabase_vector` in loop di riavvio dopo lo standby (solo log,
  non tocca l'app). Allineata con `git pull` anche la copia `Documents\GitHub\TyreCare-v2`
- **Database:** migrazione `20261009120000_garage_cliente.sql` — il cliente collegato legge anche le
  officine non attive di cui è cliente (`is_cliente_officina` + policy); 6 test pgTAP in
  `garage.test.sql` (totale 80, verdi); tipi rigenerati. **Da pubblicare sul cloud** (titolare)
- **Garage del cliente** (Fase 3): home con una carta per veicolo (stato, ultimo controllo e officina),
  veicoli **uniti per targa** tra le officine (`lib/garage.ts`, `unisciPerTarga` con 4 test Vitest, totale
  52); scheda `/garage/veicolo?targa=…` in sola lettura con cruscotto, avviso sulle ruote da sostituire,
  pneumatici montati, storico di tutte le officine e carte delle officine (Chiama, Indicazioni)
- `cruscotto()` e storico spostati in `ui/cruscotto.ts` e `ui/storico.ts`, usati da entrambe le schede
- Skill `ui-ux-pro-max` consultata (carte cliccabili, stato non solo col colore, stato vuoto)
- Provato in Chrome headless (390 px) come cliente, titolare e admin: **24 verifiche verdi**.
  `npm run check` verde
- Aggiornati `NOTES.md`, `PLAN.md` (roadmap), `DESIGN-SYSTEM.md`, `IMPLEMENTAZIONI.md`
- Commit `d4622f0` (codice) e `2a4e9a6` (documenti) su `main`: **CI e deploy Vercel verdi**. Migrazione
  **non ancora pubblicata** sul cloud; prova dal telefono non ancora fatta

**Note**

- Nessuna nuova libreria (`STRUCT.md` invariato).
- Chi lavora in un'officina vede sempre la home dell'officina, anche se è cliente di un'altra: il suo
  garage non è ancora raggiungibile (idea in `IMPLEMENTAZIONI.md`).

### Sessione 9 — 2026-10-09 (PC di casa)

**Fatto**

- Ambiente avviato (Docker, Supabase locale, `db:reset`); repo già allineato a `origin/main`
- **Elenco clienti** `/clienti`: ordine alfabetico, targhe e telefono in ogni riga, ricerca per nome,
  email, targa e telefono (solo cifre); "Nuovo cliente" che porta alla scheda del cliente creato
- **Scheda cliente** `/cliente?id=…`: contatti (Chiama/Scrivi), note, "Usa l'app TyreCare" se collegato a
  un account, veicoli con lo stato (stesse righe della home), "Nuovo veicolo" con il cliente già scelto,
  "Modifica dati del cliente". Ora si raggiungono anche i clienti senza veicoli
- **Navigazione:** voce "Clienti" nella barra in basso solo per chi lavora in officina; nella scheda del
  veicolo il nome del cliente porta alla sua scheda; modifica/eliminazione del cliente tornano alla scheda
  o all'elenco
- **Smonta pneumatici** senza sostituirli (`/veicolo/pneumatici/smonta`, "Smonta" nella scheda del
  veicolo): posizioni + data, errore sotto la data se precede il montaggio; schema
  `SmontaPneumaticiSchema` con 2 test Vitest (totale 48). Nessuna migrazione (update diretto, P2)
- Skill `ui-ux-pro-max` consultata per navigazione inferiore e righe della lista
- Provato in Chrome headless (390 px) come titolare, operatore e cliente: **37 verifiche verdi**.
  `npm run check` verde
- Aggiornati `NOTES.md`, `PLAN.md` (roadmap), `DESIGN-SYSTEM.md`, `IMPLEMENTAZIONI.md`

**Note**

- Nessuna nuova libreria (`STRUCT.md` invariato).
- Il driver di prova (`cdp.mjs`) usa Chrome headless via DevTools Protocol con il `WebSocket` di Node 24:
  va avviato con un profilo Chrome vuoto, altrimenti la sessione salvata reindirizza `/accedi` alla home.

### Sessione 8 — 2026-10-08 (PC di casa)

**Fatto**

- CI e deploy Vercel della sessione 7 verdi; ambiente avviato (Docker, Supabase locale)
- **Database:** migrazione `20261008150000_modifica_controllo.sql` con la funzione `modifica_controllo`
  (data, km, note e misure per posizione in una transazione, ripetibile); 16 nuovi test pgTAP in
  `modifiche.test.sql` (totale 74, verdi): correzione, errori senza modifiche a metà, permessi di altre
  officine e del cliente, eliminazione di controllo e cliente; tipi rigenerati
- **Correzioni (web)** dalla scheda del veicolo: modifica cliente (`/clienti/modifica`), modifica veicolo
  (`/veicolo/modifica`, targa duplicata sotto il campo), correzione di un gruppo di pneumatici
  (`/veicolo/pneumatici/modifica`, togliendo una posizione il gruppo si divide), correzione di un controllo
  (`/controllo/modifica`, anche su pneumatici ora smontati). I moduli "nuovo" e "modifica" condividono i
  campi (`campiCliente`, `campiVeicolo`, `campiPneumatico`, `campiControllo`)
- **Eliminazioni** con dialogo di conferma (`ui/conferma.ts`, `<dialog>` nativo, skill `ui-ux-pro-max`):
  cliente e veicolo solo per il TITOLARE, controllo anche per l'OPERATORE; il dialogo dice cosa si perde
- Provato in Chrome headless (390 px) con uno script DevTools come titolare, operatore e cliente: 21
  verifiche verdi. `npm run check` verde (46 test Vitest)
- Aggiornati `NOTES.md`, `PLAN.md` (P2, roadmap), `DESIGN-SYSTEM.md` (dialogo, pulsante elimina),
  `IMPLEMENTAZIONI.md`
- Commit `cf22e57` (codice) e `28c099d` (documenti) su `main`: **CI e deploy Vercel verdi**, le nuove
  schermate sono online. Migrazione pubblicata sul cloud dal titolare. **Non ancora fatta** la prova dal
  telefono

**Note**

- La copia `Documents\GitHub\TyreCare-v2` del PC di casa ora è allineata (stesso commit di inizio
  sessione), ma si lavora sempre in `C:\Users\albod\TyreCare-v2`.
- Nessuna nuova libreria (`STRUCT.md` invariato).

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
  `lib/rete.ts`); 4 nuovi test pgTAP (58) e 5 Vitest (46). Vedi `NOTES.md`. **Riprovato dal telefono dal
  titolare: funziona** (commit `83e1aa3`, `151faa6`; CI e Vercel verdi)

**Note**

- Sul PC di casa la copia aggiornata del repo è `C:\Users\albod\TyreCare-v2`; quella in
  `Documents\GitHub\TyreCare-v2` è vecchia (14 commit indietro): non usarla, o allinearla con `git pull`.
- Nessuna nuova libreria (`STRUCT.md` invariato). `vitest` ora è dichiarato anche in `apps/web`: il primo
  test del web (`lib/rete.test.ts`) aveva fatto fallire il deploy Vercel, perché la build del web controlla i
  tipi di tutto `src/` e Vercel installa solo le dipendenze del workspace. **Regola:** ogni pacchetto usato
  in un workspace va dichiarato nel suo `package.json`, anche se c'è già nella root.

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

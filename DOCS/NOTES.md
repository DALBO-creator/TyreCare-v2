# NOTES — Spiegazione del codice e delle funzionalità

> Per ogni funzionalità implementata: come funziona, quali file coinvolge, e spiegazione delle righe di codice
> più complesse. Aggiornato ad ogni funzionalità.

## Come scrivere una voce

```md
## <Nome funzionalità>

**File coinvolti:** `percorso/file.ts`, …
**Come funziona:** descrizione del flusso (chi fa cosa, quali dati passano dove).

### Codice complesso
`percorso/file.ts:42` — cosa fa questa riga/blocco e perché è scritto così.
```

---

## Fase 0 — Monorepo e strumenti

**File coinvolti:** `package.json`, `tsconfig.base.json`, `eslint.config.js`, `vitest.config.ts`,
`apps/*/package.json`, `packages/shared/package.json`, `.github/workflows/ci.yml`

**Come funziona:** la root dichiara `"workspaces": ["apps/*", "packages/*"]`. npm collega ogni workspace in
`node_modules/@tyrecare/…` come link alla cartella reale, così `import { … } from '@tyrecare/shared'` funziona
in web e api senza pubblicare nulla.

### Codice complesso

`packages/shared/package.json` — `"exports": { ".": "./src/index.ts" }`: il pacchetto condiviso espone
direttamente il **sorgente TypeScript**, senza una fase di build. Funziona perché chi lo usa sa compilare TS:
Vite (web), tsx e tsup (api), Vitest (test). Per questo in `apps/api/tsup.config.ts` c'è
`noExternal: ['@tyrecare/shared']`: tsup normalmente lascia fuori dal bundle le dipendenze, ma Node non sa
eseguire un `.ts` dentro `node_modules`, quindi il pacchetto va incluso nel file finale.

`tsconfig.base.json` — `"moduleResolution": "Bundler"` + `"noEmit": true`: TypeScript viene usato **solo per
controllare i tipi** (`npm run typecheck`); a produrre il JavaScript sono Vite e tsup. Questo evita di dover
scrivere le estensioni `.js` negli import. `verbatimModuleSyntax` obbliga a scrivere `import type` per i soli
tipi, così il compilatore sa cosa eliminare senza analizzare l'intero progetto.

`eslint.config.js` — l'ordine conta: le configurazioni successive sovrascrivono le precedenti, perciò
`eslint-config-prettier` è **ultimo**, per spegnere qualsiasi regola di formattazione che litigherebbe con Prettier.

## API — avvio e health check

**File coinvolti:** `apps/api/src/app.ts`, `server.ts`, `env.ts`, `routes/health.ts`, `app.test.ts`

**Come funziona:** `buildApp()` crea e configura Fastify **senza** metterlo in ascolto; `server.ts` lo avvia
sulla porta indicata. La separazione permette ai test di usare `app.inject()`, che simula una richiesta HTTP
senza aprire porte di rete (test veloci e affidabili).

### Codice complesso

`apps/api/src/env.ts` — `z.coerce.number()`: le variabili d'ambiente sono sempre stringhe; `coerce` converte
`"3000"` in `3000` prima di validarlo. Se un valore è errato `EnvSchema.parse` lancia un errore e il server
**non parte**, invece di fallire più tardi in modo poco chiaro.

`apps/api/src/server.ts` — `await app.listen(…)` al livello principale del file (*top-level await*), possibile
perché il pacchetto è un modulo ES (`"type": "module"`).

## Web — PWA

**File coinvolti:** `apps/web/vite.config.ts`, `src/main.ts`, `src/lib/supabase.ts`, `public/`

**Come funziona:** `VitePWA` in fase di build genera il manifest (rende l'app installabile) e il service worker
`sw.js`, che mette in cache tutti i file dell'app (*precache*) così l'interfaccia si apre anche offline.
`registerSW` in `main.ts` registra il service worker e, quando esce una nuova versione, chiede all'utente se
ricaricare (`registerType: 'prompt'`): evita che l'app si aggiorni da sola mentre l'utente sta compilando un form.

**Logo e icone:** il logo è `public/logo.svg` (contagiri: arco bianco con tacche, zona rossa, lancetta
rossa, su quadrato nero arrotondato). `npm run icons -w @tyrecare/web` genera da lì favicon, icone PWA,
maskable (Android) e apple-touch (iOS) secondo `pwa-assets.config.ts`: preset `minimal-2023`, ma con
**sfondo nero** e margine del 10% per maskable e Apple (il predefinito è bianco, e il sistema ritaglia
l'icona a cerchio o a quadrato arrotondato). Dopo aver cambiato il logo va rilanciato il comando.

### Codice complesso

`apps/web/src/lib/supabase.ts` — il client viene creato **al primo utilizzo** e non all'avvio: finché il progetto
Supabase non è configurato, l'app si apre comunque e l'errore compare solo quando una funzione prova davvero a
usare il database, con un messaggio che spiega cosa configurare.

## Web — Design system (Fase 1)

**File coinvolti:** `apps/web/src/styles/` (`_tokens.scss`, `_tema-bootstrap.scss`, `_componenti.scss`,
`main.scss`), `src/ui/` (`icone.ts`, `stato.ts`, `auto.ts`, `indicatore.ts`), `src/anteprima.ts`, `vite.config.ts`.
Regole visive in [`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md).

**Come funziona:** Vite compila `main.scss` con Sass. I colori sono definiti una sola volta in `_tokens.scss`;
`_tema-bootstrap.scss` li passa a Bootstrap (che genera pulsanti, alert ecc. già con i nostri colori) e
importa **solo i moduli usati** (CSS da ~230 kB a ~174 kB, font inclusi a parte). `_componenti.scss` aggiunge i
componenti TyreCare (`tc-…`). In TypeScript, `badgeStato()` trasforma uno `StatoSalute` del pacchetto condiviso
nel badge corrispondente: le regole (soglie) stanno in `@tyrecare/shared`, l'aspetto in `apps/web`.
Il tema è **sempre scuro** (design v2 rosso/nero): `data-bs-theme="dark"` è scritto direttamente in
`index.html`, così non c'è un lampo bianco all'avvio.

### Codice complesso

`src/ui/indicatore.ts` — l'arco "contagiri" è un `<circle>` con `stroke-dasharray`: il primo numero è la
lunghezza del tratto disegnato, il secondo lo spazio vuoto. Con `ARCO = 75%` della circonferenza e una
rotazione di 135° si ottiene un arco di 270° aperto in basso; il valore è `ARCO × (mm / 8)`. Le tacche si
calcolano con seno e coseno (`punto()`), una per millimetro più quella del limite di legge.
L'animazione CSS `tc-arco` parte da `stroke-dasharray: 0 999` e arriva al valore scritto nell'attributo,
quindi l'arco "si riempie" senza JavaScript.

`_componenti.scss` → `.tc-cruscotto` — griglia con aree nominate (`'as veicolo ad' 'ps veicolo pd'`): l'auto
occupa le due righe della colonna centrale. L'area **non** può chiamarsi `auto`, perché `grid-area: auto` è
una parola chiave (posizionamento automatico): l'auto finiva nella sola prima riga e il cruscotto si
allungava. Per lo stesso motivo il quadrante ha `width: 6.75rem` fisso e non `min(100%, …)`.

`_tema-bootstrap.scss` — l'ordine è obbligato: prima `functions`, poi **le nostre variabili**, poi `variables`
di Bootstrap. Le variabili di Bootstrap sono dichiarate con `!default` ("usa questo valore solo se non ne è
già stato dato uno"), quindi i nostri valori, definiti prima, vincono.

`_componenti.scss` — `@each $stato, $valori in $tc-stati` genera con un ciclo le variabili CSS
(`--tc-verde`, `--tc-verde-tenue`, …) e le classi `.tc-stato--verde`, `.tc-avviso--verde`,
`.tc-battistrada--verde` ecc. Aggiungere uno stato = aggiungere una voce alla mappa in `_tokens.scss`.

`_tema-bootstrap.scss` — con `data-bs-theme="dark"` Bootstrap usa le variabili `…-dark`
(`$body-bg-dark`, `$link-color-dark`…): per questo sono impostate quelle, oltre alle chiare.

`.btn-primary { --bs-btn-hover-bg: … }` — Bootstrap 5.3 disegna i pulsanti con variabili CSS locali:
basta ridefinirle per cambiare il colore al passaggio/pressione senza riscrivere il componente.

`src/ui/icone.ts` — `createElement(nodo, …).outerHTML` di Lucide crea l'elemento SVG e lo converte in stringa,
così si può inserire nei template HTML. Ogni icona si importa per nome (`import { Car } from 'lucide'`): il
bundler include solo quelle usate (*tree-shaking*).

`vite.config.ts` → `silenceDeprecations` — Bootstrap 5.3 usa ancora `@import` e funzioni Sass globali, che
Dart Sass segnala come deprecate (centinaia di avvisi a ogni build). Sono nascosti perché non dipendono da noi;
spariranno con Bootstrap 6. `workbox.globPatterns` aggiunge alla precache i font **latini** (`*-latin-wght-*`,
esclude `latin-ext`, cirillico ecc.): offline l'app mantiene i suoi font senza scaricare alfabeti inutili.

`src/anteprima.ts` — il misuratore del battistrada usa `role="meter"` con `aria-valuetext`: un lettore di
schermo legge "3,4 millimetri, da controllare" invece di una percentuale senza significato.

## Regole pneumatici condivise

**File coinvolti:** `packages/shared/src/pneumatici.ts`, `pneumatici.test.ts`

**Come funziona:** `statoBattistrada(mm, stagione)` restituisce `ROSSO` sotto 1,6 mm (limite di legge),
`GIALLO` sotto la soglia consigliata per la stagione (3 mm estivi, 4 mm invernali/4 stagioni), altrimenti
`VERDE` (PLAN P10). È il primo mattone dell'indicatore di salute.

### Codice complesso

`as const satisfies { … }` — `as const` rende i valori letterali e immutabili; `satisfies` verifica che
l'oggetto rispetti la forma richiesta (es. una soglia per **ogni** stagione) senza perdere i tipi precisi.
Se in futuro si aggiunge una stagione a `StagioneSchema`, TypeScript segnala subito la soglia mancante.

## Database — fondamenta: profili, officine, ruoli e RLS (Fase 1)

**File coinvolti:** `supabase/migrations/20261006120000_fondamenta.sql`, `supabase/seed.sql`,
`supabase/tests/database/fondamenta.test.sql`, `packages/shared/src/database.types.ts` (generato),
`packages/shared/src/ruoli.test.ts`, `apps/web/src/lib/supabase.ts`

**Come funziona:**

- **`profiles`**: un profilo per ogni account di Supabase Auth, creato in automatico alla registrazione dal
  trigger `on_auth_user_created`. Contiene il ruolo globale (`ADMIN` / `OFFICINA` / `CLIENTE`, default
  `CLIENTE`), nome, cognome, telefono.
- **`officine`**: anagrafica (ragione sociale, P.IVA a 11 cifre unica, indirizzo, coordinate, orari in JSON)
  e `stato_affiliazione` (`IN_ATTESA` → `ATTIVA` / `SOSPESA`).
- **`officina_utenti`**: chi lavora in quale officina e con che livello, `TITOLARE` o `OPERATORE` (PLAN P16).

Chi può fare cosa (policy RLS):

| Tabella | Lettura | Modifica |
|---------|---------|----------|
| `profiles` | il proprio, i colleghi di officina, ADMIN tutti | il proprio (non il ruolo); ADMIN tutti |
| `officine` | **tutti, anche senza login, se ATTIVA**; i membri la propria; ADMIN tutte | TITOLARE la propria (non lo stato); crea/elimina solo ADMIN |
| `officina_utenti` | i membri della stessa officina; ADMIN | TITOLARE della propria officina; ADMIN |

Regole aggiuntive garantite da trigger:

- il **ruolo** di un profilo e lo **stato di affiliazione** di un'officina li cambia solo un ADMIN (o il
  backend con la service role);
- un'officina **non può restare senza titolare** (un titolare non può rimuoversi o declassarsi se è l'unico).

Dati di prova (`npm run db:reset`): `admin@`, `titolare@`, `operatore@`, `cliente@tyrecare.test`, password
`password123`; officine "Gomme Rossi" (ATTIVA, con titolare e operatore) e "Pneus Express" (IN_ATTESA).

Flusso di lavoro sul database: modificare lo schema **solo con nuove migrazioni**
(`npx supabase migration new <nome>`), poi `npm run db:reset`, `npm run db:test`, `npm run db:types`.

### Codice complesso

Funzioni `is_admin()`, `is_membro_officina()`, `is_titolare_officina()`, `is_collega()` — sono
**`security definer`**: girano con i permessi del proprietario e quindi leggono `profiles`/`officina_utenti`
**senza** passare dalle policy. Senza questo, una policy su `officina_utenti` che interroga
`officina_utenti` richiamerebbe sé stessa all'infinito (errore di ricorsione). Sono sicure perché rispondono
solo su chi sta chiamando (`auth.uid()`), e hanno `set search_path = ''` (ogni nome è scritto con lo schema,
così nessuno può "sostituire" una tabella creandone una omonima in un altro schema).

`(select auth.uid())` invece di `auth.uid()` — con il `select` Postgres calcola il valore **una volta per
query** invece che una volta per riga: consiglio ufficiale di Supabase per le prestazioni delle policy.

`proteggi_campi_riservati()` — le policy RLS decidono **quali righe** si possono modificare, non **quali
colonne**: per impedire a un utente di cambiarsi il ruolo serve un trigger. Se `auth.uid()` è nullo la
modifica viene dal backend (service role), da una migrazione o dal seed, ed è permessa. I controlli sono
`IF` annidati e non `tabella = 'x' and new.campo …`: PL/pgSQL valuta comunque `new.campo`, e su una tabella
che non ha quel campo dà errore (bug trovato dai test).

`crea_profilo_nuovo_utente()` — il ruolo **non** viene mai preso dai metadati della registrazione
(`raw_user_meta_data`), perché li sceglie l'utente: chiunque potrebbe registrarsi come ADMIN.

`verifica_titolare_rimasto()` — trigger `after` (conta i titolari _dopo_ la modifica). È disattivato per
ADMIN e service role, così l'eliminazione a cascata di un'officina o di un account non viene bloccata.

`seed.sql` — gli utenti si inseriscono direttamente in `auth.users` con la password cifrata
(`extensions.crypt(…, gen_salt('bf'))`) e una riga in `auth.identities`; i campi token vanno messi a `''`
perché con `NULL` il login di Supabase Auth fallisce.

`fondamenta.test.sql` — ogni test simula un utente con `set local role authenticated` e il JWT in
`request.jwt.claims` (da cui `auth.uid()` legge il `sub`). Un `update` bloccato dalla RLS **non** dà errore:
semplicemente non modifica righe, per questo il test dell'operatore rilegge il valore invece di aspettarsi
un'eccezione. Tutto è in una transazione annullata con `rollback`.

`ruoli.test.ts` — confronta gli enum Zod (`RuoloSchema`, `RuoloOfficinaSchema`) con quelli generati dal
database (`Constants.public.Enums`): se una migrazione cambia un enum e lo schema Zod no, il test fallisce.

## Auth — accesso, registrazione, recupero password (Fase 1)

**File coinvolti:** `packages/shared/src/auth.ts` (schemi Zod), `apps/web/src/main.ts` (rotte),
`apps/web/src/lib/{auth,router,profilo,html}.ts`, `apps/web/src/ui/{modulo,layout}.ts`,
`apps/web/src/pagine/*.ts`, `apps/web/src/styles/_pagine.scss`, `apps/api/src/auth.ts`,
`apps/api/src/routes/me.ts`, `supabase/config.toml` (sezione `[auth]`)

**Come funziona:**

- **Pagine:** `/accedi`, `/registrati`, `/password-dimenticata`, `/nuova-password` (arrivo dal link email),
  `/` home, `/profilo` (dati + "Esci"), `/anteprima` (design system con dati finti), 404 per il resto.
- **Router** (`lib/router.ts`, senza librerie): URL puliti con la History API. Ogni rotta dichiara
  l'accesso: `utente` (serve il login → altrimenti `/accedi?dopo=<pagina>`), `ospite` (solo senza login →
  altrimenti home), `pubblica`. Su Vercel `vercel.json` → `rewrites` serve `index.html` per ogni URL che non
  è un file, così si può aprire o ricaricare direttamente `/profilo`.
- **Sessione** (`lib/auth.ts`): Supabase salva la sessione nel browser e la rinnova da solo.
  `onAuthStateChange` avvisa `main.ts`, che sposta l'utente: dopo l'accesso alla pagina richiesta, dopo
  l'uscita su `/accedi`, dal link di recupero su `/nuova-password`.
- **Registrazione:** nome e cognome vanno nei metadati dell'utente; il trigger del database crea il profilo
  (ruolo sempre CLIENTE). Con la **conferma email** attiva (locale e cloud) si mostra "Controlla la posta":
  in locale le email si leggono su **Mailpit** http://127.0.0.1:54324.
- **Moduli** (`ui/modulo.ts`): stessi schemi Zod di `@tyrecare/shared` (riusabili da Fastify). Etichette
  sempre visibili, errore sotto il campo all'uscita dal campo, focus sul primo errore all'invio, errore
  generale annunciato (`role="alert"`), pulsante con spinner, mostra/nascondi password, incolla permesso,
  `autocomplete` corretto per i password manager. Messaggi d'errore di Supabase tradotti per codice.
  Fa eccezione l'email non inviata (es. Resend in prova che rifiuta il destinatario): Supabase risponde
  500 con codice generico `unexpected_failure` e testo `Error sending … email`, riconosciuto dal testo in
  `messaggioErrore` ("Non riusciamo a inviarti l'email…", test in `lib/auth.test.ts`).
- **API:** le rotte registrate nel plugin "protette" di `app.ts` richiedono `Authorization: Bearer <token>`
  (il token di Supabase dell'utente). `GET /me` restituisce `{ id, email }`. Senza token valido: 401.

### Codice complesso

`apps/api/src/auth.ts` → `jwtVerify` di **jose** — Supabase firma i token con una chiave **privata**
(ES256) e pubblica le chiavi **pubbliche** su `/auth/v1/.well-known/jwks.json`. L'API verifica la firma
con quelle, senza conoscere alcun segreto; `createRemoteJWKSet` le scarica una volta e le tiene in cache
(e le riscarica se Supabase cambia chiave). Si controllano anche emittente (`iss`), destinatario
(`aud: authenticated`) e scadenza. I test creano una coppia di chiavi propria e firmano token validi,
scaduti, di altri emittenti o firmati con un'altra chiave.

`app.register(async (protette) => { protette.addHook('onRequest', …) })` — in Fastify un plugin crea un
contesto **incapsulato**: l'hook vale solo per le rotte registrate lì dentro. Una nuova rotta è protetta se
viene registrata in quel blocco, pubblica se fuori (come `/health`).

`lib/html.ts` → `esc()` — le pagine sono template HTML inseriti con `innerHTML`: ogni dato che viene
dall'utente o dal database va passato da `esc()`, altrimenti un nome come `<img src=x onerror=…>`
eseguirebbe codice (XSS).

`lib/router.ts` → `destinazioneDopoAccesso()` — accetta solo percorsi che iniziano con `/` ma non con `//`:
`//sito-malevolo.it` è un URL di un altro sito, e un link `/accedi?dopo=//…` porterebbe lì l'utente
appena autenticato (*open redirect*).

`lib/router.ts` → `generazione` / `ancoraAttuale(n)` — home e profilo caricano dati in modo asincrono; se
nel frattempo l'utente ha cambiato pagina, al termine il risultato viene scartato invece di sovrascrivere
la pagina nuova.

`lib/auth.ts` → `setTimeout` in `onAuthStateChange` — la documentazione di Supabase avverte che chiamare
altre funzioni di Supabase dentro quel callback può bloccare il client: si rimanda al giro successivo.

`pagine/password-dimenticata.ts` — il messaggio di conferma è lo stesso che l'email sia registrata o no: non
si rivela a un estraneo chi ha un account.

## Profilo — modifica dati e cambio password (Fase 1)

**File coinvolti:** `packages/shared/src/auth.ts` (`ModificaProfiloSchema`, `CambioPasswordSchema`),
`apps/web/src/lib/{profilo,auth}.ts` (`salvaProfilo`, `cambiaPassword`),
`apps/web/src/pagine/{profilo,modifica-profilo,cambia-password}.ts`, `apps/web/src/ui/modulo.ts`

**Come funziona:**

- Dal Profilo, sezione **Account**: "Modifica i tuoi dati" → `/profilo/dati` (nome, cognome, telefono
  facoltativo) e "Cambia password" → `/profilo/password` (password attuale + nuova). Email e ruolo non si
  cambiano da qui.
- Dopo il salvataggio si torna al Profilo con un avviso verde di conferma (`tornaAlProfilo`). La voce
  "Profilo" della navigazione inferiore resta evidenziata anche nelle sottopagine.
- **Telefono:** trattini, punti e parentesi diventano spazi, campo vuoto → `null`; poi lo stesso controllo
  del vincolo `check` del database (`^\+?[0-9 ]{6,20}$`), così l'errore compare sotto il campo e non arriva
  dal database.
- La modifica passa direttamente da Supabase: la RLS permette di aggiornare solo il proprio profilo e il
  trigger blocca ruolo e campi riservati.

### Codice complesso

`lib/auth.ts` → `cambiaPassword()` — Supabase permetterebbe di cambiare la password con la sola sessione
aperta; prima si verifica quella attuale **rifacendo l'accesso** con `signInWithPassword` (Supabase limita i
tentativi). Così chi trova il telefono sbloccato non può cambiarla. L'errore `invalid_credentials` viene
ricodificato come `password_attuale_errata` per mostrare "La password attuale non è corretta" invece di
"Email o password non corrette".

`lib/profilo.ts` → `salvaProfilo()` usa `.select('id').single()` — un `update` bloccato dalla RLS non dà
errore, aggiorna 0 righe; chiedendo la riga aggiornata, 0 righe diventano un errore (`PGRST116`).

## Elimina account: uscita forzata

**File coinvolti:** `apps/web/src/pagine/elimina-account.ts`, `apps/web/src/lib/profilo.ts`
(`eliminaAccount`), `apps/web/src/lib/auth.ts` (`esci`, `sessioneCorrente`), `apps/web/src/main.ts`
**Come funziona:** dopo `eliminaAccount()` la pagina chiama `esci()`; il ritorno a `/accedi` lo fa `main.ts`
su SIGNED_OUT. L'utente arriva sempre a `/accedi` con "Il tuo account è stato eliminato.", anche se `esci()`
fallisce. Gli errori di `eliminaAccount()` restano nel dialogo.

### Codice complesso
`pagine/elimina-account.ts` — se `esci()` lancia e `sessioneCorrente()` non è nulla, la pagina riprova
`signOut({ scope: 'local' })` dentro un try e poi fa `vaiA('/accedi', { sostituisci: true })`. Limite noto
(raro): con la rete caduta la sessione locale resta e `/accedi`, vedendola attiva, rimanda alla home.

## Email in italiano (Fase 1)

**File coinvolti:** `supabase/templates/{conferma,recupero,cambio-email,password-cambiata}.html`,
`supabase/config.toml` (`[auth.email.template.*]`, `[auth.email.notification.password_changed]`)

**Come funziona:**

- Quattro email nello stile del design (nero, rosso `#e10600`, marchio TYRE**CARE**): conferma della
  registrazione, recupero password, cambio email (va a entrambi gli indirizzi), **avviso di password
  cambiata** (notifica di sicurezza).
- Variabili di Supabase (template Go): `{{ .ConfirmationURL }}`, `{{ .Email }}`, `{{ .NewEmail }}`,
  `{{ .SiteURL }}`, `{{ .Data.nome }}` (metadati salvati alla registrazione: "Ciao Giulia,", oppure "Ciao,"
  se manca).
- HTML per client email: tabelle e stili in linea (molti client ignorano `<style>` e flexbox), nessuna
  immagine (spesso bloccate), link testuale sotto il pulsante.
- `config.toml` vale **solo in locale** (prova su Mailpit http://127.0.0.1:54324). Nel cloud oggetto e
  corpo vanno copiati dalla dashboard: *Authentication → Emails*.

## Database — dati di officina: clienti, veicoli, pneumatici, controlli (Fase 2)

**File coinvolti:** `supabase/migrations/20261007120000_dati.sql`, `supabase/seed.sql`,
`supabase/tests/database/dati.test.sql`, `packages/shared/src/pneumatici.ts` (enum Zod),
`packages/shared/src/database.types.ts` (generato)

**Come funziona:**

- `clienti_officina` → `veicoli` → `pneumatici` (per posizione; `smontato_il` nullo = montato) e
  `controlli` → `misure_pneumatico` (una per pneumatico misurato). Tutto è **dell'officina**: la stessa
  targa in due officine sono due schede separate (decisione in PLAN P12).
- **Chi vede cosa:** i membri dell'officina leggono e scrivono i dati della propria officina (eliminare
  clienti e veicoli solo il TITOLARE); il cliente con l'account collegato legge i propri veicoli con
  pneumatici, controlli e misure; anonimi e ADMIN non vedono nulla.
- **Import idempotente (P8):** `clienti_officina.codice_gestionale` e `controlli.codice_documento` sono
  unici per officina, `veicoli.targa` è unica per officina: reimportare lo stesso file aggiorna invece di
  duplicare.
- **Seed:** Gomme Rossi ha Giulia (account `cliente@tyrecare.test`) con la Panda AB123CD, 4 invernali e un
  controllo con le stesse misure di `/anteprima`, più Franco (senza account) con una Golf. Pneus Express
  (titolare `titolare2@tyrecare.test`) ha di nuovo Giulia con la stessa Panda.
- **Test pgTAP** (20): isolamento tra officine, cliente in sola lettura, ADMIN escluso, coerenza delle
  chiavi composte, targa normalizzata, un solo pneumatico montato per posizione, collegamento all'account
  vietato alle officine, eliminazione solo del titolare.

### Codice complesso

Chiavi esterne composte, es. `foreign key (veicolo_id, officina_id) references veicoli (id, officina_id)` —
richiedono `unique (id, officina_id)` sulla tabella di arrivo. Impediscono a un'officina di scrivere un
controllo con il proprio `officina_id` ma il veicolo di un'altra (la RLS controlla solo `officina_id`). In
`misure_pneumatico` le chiavi `(controllo_id, veicolo_id)` e `(pneumatico_id, veicolo_id)` obbligano
controllo e pneumatico a essere dello stesso veicolo.

`on delete set null (cliente_officina_id)` (PostgreSQL ≥ 15) — se si elimina il cliente, sul veicolo si
azzera solo quella colonna: con una chiave composta un `set null` normale azzererebbe anche `officina_id`.

`create unique index … where smontato_il is null` — indice unico **parziale**: vale solo per gli
pneumatici montati, così lo storico può avere più pneumatici smontati nella stessa posizione.

`normalizza_veicolo()` — trigger che porta targa e telaio in forma canonica ("ab 123-cd" → "AB123CD")
prima del vincolo di unicità: così l'import trova i duplicati anche se il gestionale scrive la targa con
spazi.

## Officina — elenco veicoli, clienti, pneumatici e controlli (Fase 2)

**File coinvolti:** `supabase/migrations/20261008120000_operazioni_officina.sql`,
`supabase/tests/database/operazioni.test.sql`, `packages/shared/src/officina.ts` (+ test),
`packages/shared/src/pneumatici.ts` (`statoPeggiore`), `apps/web/src/lib/{officina,errori}.ts`,
`apps/web/src/pagine/{home-officina,nuovo-veicolo,nuovo-cliente,veicolo,monta-pneumatici,nuovo-controllo}.ts`,
`apps/web/src/ui/modulo.ts`, `apps/web/src/styles/_officina.scss`

**Come funziona:**

- **Home officina** (`/`, per chi è in `officina_utenti`): tre numeri (veicoli, da sostituire, da
  controllare) che fanno anche da filtro, pulsante "Nuovo veicolo", ricerca per targa, cliente o modello,
  elenco ordinato per urgenza (rosso, giallo, verde, mai controllati). Lo stato di un veicolo è il
  **peggiore** tra le misure del suo **ultimo** controllo. Con più officine compare un menu per scegliere
  quella attiva (ricordata nel browser, chiave `tc-officina`).
- **Nuovo veicolo** (`/veicoli/nuovo`) con il cliente scelto da un menu; "Cliente nuovo? Aggiungilo" porta a
  **Nuovo cliente** (`/clienti/nuovo`), che al salvataggio torna al veicolo con il cliente già scelto.
  Targa già registrata → errore sotto la targa.
- **Scheda veicolo** (`/veicolo?id=…`): cruscotto dell'ultimo controllo (auto + quattro contagiri, come
  `/anteprima`), cliente con Chiama/Scrivi, pneumatici montati (uguali raggruppati: "Tutte e quattro le
  ruote"), storico dei controlli apribile.
- **Monta pneumatici** (`/veicolo/pneumatici?id=…`): posizioni da spuntare (di default le quattro ruote),
  stagione, misura (proposta quella attuale), marca, modello, DOT, data. Quelli montati nelle posizioni
  scelte vengono smontati con quella data e restano nello storico.
- **Nuovo controllo** (`/veicolo/controllo?id=…`): data, km, e per ogni ruota montata battistrada e
  pressione (tastiera decimale, "6,2" o "6.2"), usura, danni; note. Mentre si scrive il battistrada
  compare lo stato della ruota con la soglia della sua stagione.
- Le pagine del veicolo si aprono solo ai membri della sua officina: un cliente che apre l'URL della
  propria auto vede "Veicolo non trovato" (il suo garage arriverà con la Fase 3).

### Codice complesso

`registra_controllo` / `monta_pneumatici` — funzioni PL/pgSQL chiamate con `supabase.rpc(...)`. Una
chiamata è **una transazione**: se una misura fallisce (posizione senza pneumatico, posizione ripetuta,
valore fuori scala) PostgreSQL annulla anche il controllo già inserito, quindi non resta mai un controllo a
metà. Sono `security invoker` (girano con i permessi di chi chiama): valgono le stesse policy RLS degli
insert diretti, nessun privilegio in più. Il client manda la **posizione** e non l'id dello pneumatico: la
funzione usa quello montato ora, così non si può misurare uno pneumatico smontato o di un altro veicolo.
Scelte al posto di una rotta Fastify perché l'API non è ancora pubblicata (PLAN P2 aggiornato).

`monta_pneumatici` → prima `update … set smontato_il`, poi `insert`: l'indice unico parziale "un montato
per posizione" (vedi sopra) sarebbe violato facendo il contrario. Una data precedente al montaggio attuale
viola il `check (smontato_il >= montato_il)` (codice `23514`), che il web mostra sotto il campo data.

`lib/officina.ts` → `caricaVeicoli` — `.order(…, { referencedTable: 'controlli' })` e
`.limit(1, { referencedTable: 'controlli' })` ordinano e limitano la tabella **incorporata**: per ogni
veicolo arriva solo l'ultimo controllo con le sue misure, in una sola richiesta. In `caricaSchedaVeicolo`
`.is('pneumatici.smontato_il', null)` filtra allo stesso modo gli pneumatici incorporati.

`lib/errori.ts` → `ErroreModulo(messaggio, campo?)` — un errore che il salvataggio lancia e che
`collegaModulo` mostra **sotto il campo** indicato, come un errore di validazione (es. targa duplicata,
codice `23505`).

`ui/modulo.ts` → caselle — `FormData` con più caselle dello stesso nome darebbe solo la prima con
`Object.fromEntries`: per i gruppi (`data-gruppo`) si usa `getAll`, e una casella non spuntata non compare
proprio in `FormData`, quindi il gruppo vale `[]` e lo schema Zod può dire "Scegli almeno una posizione".

`packages/shared/src/officina.ts` → `creaControlloSchema(posizioni)` — lo schema dipende dalle ruote
montate, perciò è creato da una funzione. I campi hanno nomi piatti (`mm_ANT_SX`) perché il modulo mostra
l'errore sotto il campo che ha quel nome; la `transform` finale li ricompone in `{ misure: [...] }`.

`decimale()` → `Math.round(Number(`${s}e1`)) / 10` — arrotonda a un decimale come `numeric(3, 1)`.
`1.45 * 10` in virgola mobile vale 14,4999… e darebbe 1,4; `Number('1.45e1')` è esattamente 14,5 → 1,5.

## Scritture ripetibili dopo un errore di rete

**File coinvolti:** `apps/web/src/lib/rete.ts` (+ test), `apps/web/src/lib/{officina,profilo,auth}.ts`,
`supabase/migrations/20261008130000_scritture_ripetibili.sql`, `supabase/tests/database/operazioni.test.sql`

**Il problema (trovato provando dal telefono il 2026-10-08):** il primo salvataggio dopo qualche minuto
passato a compilare un modulo dava "Qualcosa è andato storto", il secondo funzionava. Nel frattempo la
connessione verso Supabase si era chiusa (inattività sulla rete mobile) e il browser se ne accorge solo al
primo invio. postgrest-js ripete da solo le richieste fallite per la rete, ma **solo GET/HEAD/OPTIONS**:
per questo le letture non sbagliavano mai e le scritture sì.

**Come funziona:** `conRiprova(() => richiesta)` esegue la scrittura e, se la risposta ha `status: 0`
(nessuna risposta dal server), la ripete una volta dopo 400 ms. Ripetere una scrittura è sicuro solo se il
database riconosce quella già arrivata, quindi **gli id li sceglie il web** (`crypto.randomUUID()`):

- clienti e veicoli: l'id va nell'insert; se la ripetizione trova la chiave primaria già usata (`23505`
  su `…_pkey`) il primo tentativo era arrivato, ed è un successo (`giaSalvato`). Una targa duplicata dà
  invece `23505` sul vincolo della targa → errore sotto il campo, come prima;
- `registra_controllo(…, p_id)`: se il controllo `p_id` esiste già, restituisce il suo id e non fa nulla;
- `monta_pneumatici`: ogni pneumatico porta il suo `id`; se c'è già, lo salta senza smontare nulla;
- profilo: un `update` si può ripetere così com'è.

Se anche la ripetizione fallisce compare "La connessione non risponde. Controlla la rete e riprova."
Provato simulando nel browser la caduta della connessione su ogni scrittura (DevTools,
`Fetch.failRequest`): tutto salvato al primo tocco e nessun doppione.

### Codice complesso

`drop function public.registra_controllo(uuid, jsonb, date, integer, text)` — in PostgreSQL due funzioni
con lo stesso nome ma parametri diversi sono **due funzioni** (overload): aggiungere `p_id` con
`create or replace` lascerebbe in giro anche la vecchia. Per `monta_pneumatici` la firma non cambia (l'id
sta dentro il JSON), quindi basta `create or replace`.

## Officina — correzioni ed eliminazioni (Fase 2)

**File coinvolti:** `supabase/migrations/20261008150000_modifica_controllo.sql`,
`supabase/tests/database/modifiche.test.sql`, `apps/web/src/lib/officina.ts`,
`apps/web/src/pagine/{modifica-cliente,modifica-veicolo,modifica-pneumatici,modifica-controllo}.ts`,
`apps/web/src/ui/conferma.ts`, `apps/web/src/styles/_officina.scss`

**Come funziona:** tutto parte dalla scheda del veicolo.

- **Cliente** — "Modifica" accanto al titolo "Cliente" → `/clienti/modifica?id=…&veicolo=…`: stesso
  modulo del nuovo cliente, precompilato; al salvataggio si torna alla scheda.
- **Veicolo** — "Modifica dati del veicolo" in fondo alla scheda → `/veicolo/modifica?id=…`: cliente,
  targa (duplicata → errore sotto il campo), marca, modello, anno, telaio.
- **Pneumatici** — ogni riga di "Pneumatici montati" (con la matita) → `/veicolo/pneumatici/modifica?id=…&p=…`:
  corregge il **gruppo** della riga (es. le quattro ruote montate insieme). Togliendo la spunta a una
  posizione, quella non cambia e il gruppo si divide. Per pneumatici diversi resta "Cambia pneumatici",
  che conserva lo storico; la correzione invece riscrive i dati (era un errore di battitura).
- **Controllo** — "Correggi o elimina" nel dettaglio di un controllo dello storico →
  `/controllo/modifica?id=…`: data, km, note e le misure degli pneumatici **misurati quel giorno** (anche
  se nel frattempo smontati). Svuotando il battistrada della scorta, la sua misura si toglie.
- **Eliminazioni** — pulsante "Elimina …" in fondo alla pagina di modifica, poi un dialogo di conferma che
  dice cosa si perde. Cliente e veicolo: **solo il TITOLARE** (all'OPERATORE il pulsante non compare, e
  la RLS lo blocca comunque); il controllo: anche l'OPERATORE. Eliminando un cliente i suoi veicoli
  restano, senza cliente; eliminando un veicolo spariscono pneumatici, controlli e misure (`on delete
  cascade`).
- Un cliente che apre questi URL per la propria auto vede "… non trovato", come per la scheda.

Provato nel browser (Chrome headless, 390 px) con i dati di prova come titolare, operatore e cliente:
precompilazione, errori sotto i campi, salvataggi, gruppo di pneumatici diviso, dialogo (focus su
"Annulla", ritorno del focus), le tre eliminazioni e i pulsanti nascosti per operatore e cliente.

### Codice complesso

`modifica_controllo(p_id, p_misure, p_eseguito_il, p_km, p_note)` — come `registra_controllo`, una
funzione `security invoker` (una chiamata = una transazione, con le RLS di chi chiama). Le misure si
riconoscono per **posizione** tra quelle già presenti nel controllo (join con `pneumatici`): non si può
aggiungere una misura nuova né spostarla su un altro pneumatico; una posizione assente da `p_misure` perde
la misura. Imposta valori fissi, quindi rieseguirla dà lo stesso risultato: `conRiprova` la può ripetere
senza id scelti in anticipo.

`lib/officina.ts` → `elimina()` — con la RLS un `delete` non permesso **non dà errore**: elimina zero
righe. Per questo si chiede `.select('id')` e, se non è tornato nulla, si controlla se il record esiste
ancora: se c'è mancano i permessi (messaggio nel dialogo), se non c'è era già stato eliminato (per esempio
dal primo tentativo, prima di un errore di rete) ed è un successo. Gli `update` usano `.single()` per lo
stesso motivo: zero righe aggiornate diventano un errore.

`ui/conferma.ts` → `chiediConferma()` — `<dialog>` nativo aperto con `showModal()`: il browser rende inerte
il resto della pagina, tiene il focus dentro e chiude con Esc (`cancel`), bloccato mentre l'eliminazione è
in corso. All'apertura il focus va su "Annulla"; chiudendo torna al pulsante d'origine, passato
esplicitamente (`collegaElimina`) perché Safari non mette a fuoco i pulsanti toccati. Se l'azione
fallisce, l'errore compare nel dialogo, che resta aperto.

## Officina — elenco e scheda dei clienti, smontaggio senza sostituzione (Fase 2)

**File coinvolti:** `apps/web/src/pagine/{clienti,cliente,smonta-pneumatici}.ts`,
`apps/web/src/lib/officina.ts` (`caricaElencoClienti`, `caricaVeicoli`, `smontaPneumatici`),
`apps/web/src/ui/layout.ts`, `apps/web/src/lib/profilo.ts` (`lavoraInOfficina`),
`packages/shared/src/officina.ts` (`SmontaPneumaticiSchema`)

**Come funziona:**

- **Navigazione** — chi lavora in un'officina ha una terza voce "Clienti" nella barra in basso (Home ·
  Clienti · Profilo); il cliente no.
- **Elenco clienti** (`/clienti`) — clienti dell'officina attiva in ordine alfabetico, con le targhe dei
  loro veicoli (al più due, poi "e altri N") e il telefono. Ricerca per nome, email, targa (spazi e
  trattini non contano) e telefono (contano solo le cifre, da 3 in su). "Nuovo cliente" da qui porta
  poi alla scheda del cliente creato (`/clienti/nuovo?da=clienti`).
- **Scheda cliente** (`/cliente?id=…`) — nome (per un'azienda la ragione sociale, con il referente
  sotto), "Usa l'app TyreCare" se l'anagrafica è collegata a un account, contatti (Chiama/Scrivi), note,
  veicoli ordinati per urgenza con il loro stato, "Nuovo veicolo" con il cliente già scelto (Annulla
  torna alla scheda) e "Modifica dati del cliente". Da qui si raggiungono anche i clienti **senza
  veicoli**, che prima non avevano una pagina.
- **Modifica cliente** — senza `&veicolo=…` torna alla scheda del cliente; dopo un'eliminazione va
  all'elenco dei clienti. Nella scheda del veicolo il nome del cliente porta alla sua scheda.
- **Smonta pneumatici** (`/veicolo/pneumatici/smonta?id=…`, "Smonta" accanto a "Pneumatici montati") —
  per togliere pneumatici **senza montarne altri** (ruota di scorta tolta, gomme portate via): si scelgono
  le posizioni e la data. Gli pneumatici restano nello storico con i loro controlli; il prossimo
  controllo chiede solo le posizioni ancora montate. Una data precedente al montaggio dà errore sotto il
  campo (vincolo `smontato_il >= montato_il`, codice `23514`).

Provato nel browser (Chrome headless, 390 px) come titolare, operatore e cliente: 37 verifiche verdi
(ricerche, ritorni, nuovo cliente → scheda, eliminazione → elenco, cliente di un'altra officina "non
trovato", voce "Clienti" assente per il cliente, smontaggio con errori e nuovo controllo a tre ruote).

### Codice complesso

`ui/layout.ts` → `paginaApp()` è sincrona e non sa chi è l'utente: per decidere se mostrare "Clienti"
legge `lavoraInOfficina()`, un valore che `caricaDatiUtente()` aggiorna a ogni caricamento. Ogni pagina con
login carica i dati dell'utente e poi ridisegna il guscio, quindi la barra è giusta da quel momento; solo il
primissimo indicatore di caricamento dopo l'apertura dell'app può mostrare la barra senza "Clienti".

`lib/officina.ts` → `caricaVeicoli({ officinaId } | { clienteId })` — la stessa lettura (veicolo, cliente,
ultimo controllo e stato peggiore) serve alla home dell'officina e alla scheda del cliente: cambia solo la
colonna filtrata. Le righe sono le stesse (`rigaVeicolo`, senza il nome del cliente nella scheda).

`smontaPneumatici()` è un `update` diretto (una sola tabella, come le altre correzioni di P2) con valori
fissi, quindi ripetibile dopo un errore di rete; se tornano meno righe di quelle chieste (RLS) è un errore.

## Cliente — garage con i veicoli uniti per targa (Fase 3)

**File coinvolti:** `supabase/migrations/20261009120000_garage_cliente.sql`,
`supabase/tests/database/garage.test.sql`, `apps/web/src/lib/garage.ts` (+ `garage.test.ts`),
`apps/web/src/pagine/{home,garage-veicolo}.ts`, `apps/web/src/ui/{cruscotto,storico}.ts`,
`apps/web/src/styles/_garage.scss`

**Come funziona:**

- **Home del cliente** (`/`) — "I tuoi veicoli": una carta per veicolo, in ordine di urgenza (prima i
  veicoli da sostituire). Ogni carta è un unico collegamento con marca, modello, targa, stato dell'ultimo
  controllo (badge e barra colorata a sinistra) e "Controllo del … · officina". Senza veicoli resta il
  messaggio "Ancora nessun veicolo".
- **Unione per targa** — ogni officina ha la sua scheda del veicolo (PLAN P12): la Panda di Giulia
  registrata da due officine diventa **un solo veicolo** nel garage. Lo storico contiene i controlli di
  tutte le officine, ognuno con il nome di chi l'ha eseguito. Marca, modello, anno e pneumatici montati
  vengono dalla scheda dell'officina che ha visto il veicolo **più di recente** (ultimo controllo, ultimo
  montaggio o creazione della scheda): i dati vecchi di un'altra officina possono non essere più veri.
  Un campo vuoto non copre quello di un'altra officina.
- **Scheda nel garage** (`/garage/veicolo?targa=AB123CD`) — come la scheda dell'officina ma in sola
  lettura: cruscotto dell'ultimo controllo (con l'officina nella nota), **avviso** con le ruote da
  sostituire o da tenere d'occhio e cosa fare, pneumatici montati ("Registrati da …" se le officine sono
  più di una), storico senza "Correggi", e le **officine** del veicolo con "Chiama" e "Indicazioni"
  (Google Maps). Una targa non nel garage mostra "Veicolo non trovato" con l'invito a chiedere
  all'officina di collegarla all'account.
- **Database** — prima il cliente vedeva solo le officine `ATTIVA`: per un'officina in attesa (come
  l'officina di prova sul cloud) il garage non avrebbe saputo dire chi ha fatto il controllo. La nuova
  policy `officine: lettura dei propri clienti` (funzione `is_cliente_officina`, `security definer`) lascia
  leggere al cliente le officine di cui è cliente collegato, in qualunque stato, senza poterle modificare.
  6 test pgTAP (totale 80).

Provato nel browser (Chrome headless, 390 px) come cliente, titolare e admin senza veicoli: 24 verifiche
verdi (unione della Panda, stato e avviso, officine, Golf di un altro cliente e scheda officina "non
trovato", scheda officina invariata dopo lo spostamento del cruscotto e dello storico).

### Codice complesso

`lib/garage.ts` → `caricaGarage()` legge le schede con `clienti_officina!inner (profile_id)` e
`.eq('cliente.profile_id', utente)`: l'`!inner` trasforma il filtro sul cliente in un filtro sui veicoli.
Senza, chi lavora in un'officina ed è anche cliente vedrebbe nel garage tutti i veicoli della sua officina
(la RLS glieli mostra). `unisciPerTarga()` è una funzione pura, provata con 4 test Vitest: le targhe
arrivano già normalizzate dal trigger del database, quindi basta raggrupparle.

`ui/cruscotto.ts` e `ui/storico.ts` — spostati da `pagine/veicolo.ts` per usarli in entrambe le schede.
`cruscotto(controllo, officina?)` aggiunge l'officina alla nota; `sezioneStorico(controlli, { correggi })`
mostra "Correggi o elimina" solo all'officina e il nome dell'officina se la voce ce l'ha.
`gruppiPneumatici()` e `descrizionePneumatico()` restano in `pagine/veicolo.ts`, esportate.

## Avviso gomme vecchie nel garage

**File coinvolti:** `apps/web/src/lib/salute.ts` (+ test), `apps/web/src/pagine/home.ts`,
`apps/web/src/pagine/comune.ts`
**Come funziona:** la carta del veicolo nel garage mostra un `<small>` in `tc-garage__piede` se una o più
gomme montate hanno più di 5 anni dal DOT (singolare/plurale); se il numero è 0 non compare nulla. La soglia
è la stessa della scheda pneumatico (`pagine/pneumatico.ts`).

### Codice complesso
`lib/salute.ts` — `MESI_GOMMA_VECCHIA = 60` è l'unica soglia dei 5 anni. `gommeVecchie(pneumatici, oggi)`
conta le gomme montate con età dal DOT >= 60 mesi (il bordo conta); senza DOT valido o con DOT nel futuro
non contano. `cartaVeicolo` in `home.ts` riceve `oggi` dall'helper di `pagine/comune.ts`.

## Cliente — report del singolo controllo (Fase 3)

**File coinvolti:** `apps/web/src/lib/report.ts`, `apps/web/src/pagine/report.ts`,
`apps/web/src/ui/{avviso-pneumatici,cruscotto,storico}.ts`, `apps/web/src/pagine/garage-veicolo.ts`,
`apps/web/src/main.ts`, `apps/web/src/styles/{_garage,_officina,_tokens}.scss`

**Come funziona:**

- **Pagina** `/controllo?id=…` ("Report del controllo"): data del controllo come titolo, targa, auto, anno
  e km; cruscotto di **quel** controllo (non dell'ultimo); avviso sull'esito, che qui compare anche quando
  va tutto bene ("Tutti gli pneumatici misurati sono in buono stato"); una **carta per ruota** misurata
  (scorta compresa) con stato, battistrada, pressione, usura, danni e lo pneumatico misurato quel giorno
  (anche se ora smontato); spiegazione delle soglie; note dell'officina; "Eseguito da" con la carta
  dell'officina (Chiama, Indicazioni).
- **Chi la vede** — una sola lettura da Supabase, la decide la RLS: il cliente collegato al veicolo e chi
  lavora nell'officina che ha eseguito il controllo. Un'altra officina che ha la stessa auto (stessa targa)
  non la vede. Id non valido o non visibile → "Controllo non trovato".
- **Da dove si apre** — "Apri il report" nel dettaglio di ogni voce dello storico, sia nel garage del
  cliente sia nella scheda del veicolo dell'officina. "Torna al veicolo" porta il cliente al garage e chi
  lavora nell'officina alla scheda dell'officina; solo questi ultimi vedono anche "Correggi o elimina".
- **Stampa o salva in PDF** — `window.print()`: dal menu di stampa del telefono o del computer si sceglie
  la stampante oppure "Salva come PDF". Il titolo della pagina (`Controllo AB 123 CD 2026-09-14 · TyreCare`)
  diventa il nome del file. Il foglio di stile di stampa (`@media print` in `_garage.scss`) rende la
  pagina nero su bianco senza sfondi, toglie barre e pulsanti, mette le ruote due per riga, stampa il
  telefono dell'officina al posto di "Chiama" e aggiunge in fondo "Report di TyreCare · stampato il …".
  Lo stato resta leggibile da icona ed etichetta; contagiri e auto (SVG) tengono i loro colori.
- **Condivisione con link pubblico:** fatta con T064 (vedi "Report condiviso con link pubblico (T064)"). Il
  PDF si può già mandare via WhatsApp o email.

Provato nel browser (Chrome headless, 390 px e stampa A4 emulata) come cliente, titolare, operatore e
titolare di un'altra officina: 25 verifiche verdi; screenshot a video e in stampa controllati.

### Codice complesso

`lib/report.ts` → `caricaReport()`: `controlli` non ha una chiave esterna verso `officine` (solo la coppia
`veicolo_id, officina_id` verso `veicoli`), quindi l'officina si legge passando dal veicolo:
`veicolo:veicoli (…, officina:officine (…))`. Gli pneumatici si leggono interi (`pneumatici (*)`) per la
descrizione nella carta della ruota.

`ui/avviso-pneumatici.ts` → `avvisoPneumatici(misure, { ancheVerde })`: è l'avviso che prima stava solo
nella scheda del garage (`avvisoStato`), ora riceve le misure di un controllo qualsiasi. `cruscotto()` ha
l'opzione `{ ultimo: false }`: niente nota "Ultimo controllo: …" (la data è già nel titolo) ed etichetta
accessibile "a questo controllo". `cartaOfficina()` è esportata da `pagine/garage-veicolo.ts`.

Stampa: `.tc-pagina *` riceve `color` nero e `background: transparent` con `!important`, perché molti
componenti hanno colori chiari scritti nei token (es. il modello dell'auto in `$tc-bianco`); le variabili
di Bootstrap (`--bs-secondary-color`, `--bs-border-color`) passano al nuovo token `$tc-grigio-stampa`.

## Cliente — stato di salute del singolo pneumatico (Fase 3)

**File coinvolti:** `apps/web/src/lib/salute.ts` (+ `salute.test.ts`), `apps/web/src/pagine/pneumatico.ts`,
`apps/web/src/ui/grafico-battistrada.ts`, `apps/web/src/ui/cruscotto.ts`, `apps/web/src/pagine/report.ts`,
`apps/web/src/lib/{garage,officina}.ts`, `apps/web/src/styles/_garage.scss`

**Come funziona:**

- **Pagina** `/pneumatico?id=…`: posizione, marca e modello, targa, stagione e misura; contagiri
  dell'ultima misura con data e km; **grafico** dell'andamento del battistrada (da due misure in su) con
  le soglie della stagione; frase sul **consumo** ("cala di circa 0,3 mm al mese (3,1 mm ogni 10.000 km)")
  e **stima** di quando arriverà alla soglia consigliata e al limite di legge, presentata come stima;
  dati (montato il, DOT, **età dal DOT**, smontato il) con un avviso oltre i 5 anni; elenco delle misure
  dalla più recente, ognuna collegata al report del controllo. Uno pneumatico smontato mostra un avviso.
- **Da dove si apre** — i quattro **contagiri del cruscotto** sono collegamenti (garage del cliente, scheda
  del veicolo dell'officina, report del controllo); nel report anche "Stato di salute" in fondo alla carta
  di ogni ruota (non stampato).
- **Chi la vede** — la decide la RLS come per il report: cliente collegato e officina dello pneumatico.
  "Torna al veicolo" porta al garage o alla scheda dell'officina.
- **CI** — nuovo job `database` in `.github/workflows/ci.yml`: `supabase db start` (solo Postgres, senza
  gli altri servizi), `npm run db:test` e controllo che `database.types.ts` sia uguale a quello generato
  dalle migrazioni (`npm run db:types` + `git diff --exit-code`). Circa 2 minuti.

Provato nel browser (Chrome headless, 390 px) come cliente, titolare e titolare di un'altra officina, con un
secondo controllo aggiunto a mano al database locale (il seed ne ha uno solo): 22 verifiche verdi.

### Codice complesso

`lib/salute.ts` — funzioni pure provate con 8 test Vitest:

- `mesiDalDot(dot, oggi)`: il DOT `SSAA` è settimana e anno di produzione; la settimana si conta dal 1°
  gennaio (approssimazione di pochi giorni). Un DOT nel futuro dà `null`.
- `tendenza(punti)`: pendenza della **retta dei minimi quadrati** di mm rispetto ai giorni (e, se ci sono
  almeno due km diversi, rispetto ai km). Con tutte le misure si attenua l'errore di una singola lettura.
  Se il battistrada non cala (`pendenza >= 0`) non si stima nulla: di solito è un errore di misura o uno
  pneumatico rimontato.
- `dataSoglia(punti, soglia)`: dall'ultima misura, al ritmo della tendenza; `null` se è già sotto.

`ui/grafico-battistrada.ts` — SVG senza librerie, seguendo la skill `dataviz`: una serie (niente legenda
della serie), linea neutra di 2 px, punti di 10 px del colore dello stato con anello della superficie,
griglia recessiva, solo l'ultimo valore etichettato. Le soglie sono tratteggiate e spiegate in una legenda
sotto il grafico: dentro il grafico le loro etichette si sovrapponevano ai punti vicini alla soglia. Ogni
punto ha un `<title>`; l'elenco delle misure sotto fa da tabella. Con meno di due misure il grafico non c'è.

Le misure caricate da garage e scheda officina includono ora l'`id` dello pneumatico (tipo `Misura`), che
serve ai collegamenti del cruscotto.

## Cliente — rivendicazione dei veicoli con l'invito dell'officina (Fase 3)

**Decisione del titolare (2026-10-10):** il cliente collega il suo account con un **invito via email
dall'officina** (scartati il codice stampato e "targa + telefono").

**File coinvolti:** `supabase/migrations/20261010120000_inviti_cliente.sql`,
`supabase/tests/database/inviti.test.sql`, `apps/web/src/lib/inviti.ts` (+ `inviti.test.ts`),
`apps/web/src/pagine/{invita-cliente,invito,cliente,home,accedi,registrati}.ts`, `apps/web/src/lib/auth.ts`,
`apps/web/src/main.ts`, `packages/shared/src/officina.ts` (`InvitoSchema`), `apps/web/src/styles/_officina.scss`

**Come funziona:**

- **Officina** — nella scheda del cliente la sezione "App TyreCare" mostra lo stato: collegato ("Usa l'app
  TyreCare"), invito in corso (email, data, scadenza, "Nuovo invito" e "Annulla invito") oppure "Invita
  nell'app". La pagina `/cliente/invito?id=…` chiede l'email (già scritta se il cliente ce l'ha), crea
  l'invito e mostra **"Scrivi l'email"** (link `mailto:` con destinatario, oggetto e testo pronti: l'email
  parte dal programma di posta dell'officina), "Condividi il link" (menu del telefono: WhatsApp…, solo se
  il browser lo supporta) e "Copia il link". Il link si vede solo in quel momento.
- **Cliente** — il link porta a `/invito?codice=…` (pagina pubblica). Senza accesso: officina, email da
  usare, "Crea account" e "Ho già un account" con l'email già scritta; dopo la registrazione il link di
  conferma riporta all'invito (`emailRedirectTo` usa `?dopo=`). Con l'accesso giusto: "Collega i miei
  veicoli" → garage con l'avviso "Fatto! I veicoli registrati da … sono nel tuo garage." Con un'altra email:
  spiegazione ed "Esci e cambia account". Invito annullato, scaduto, già usato o inesistente: un messaggio
  chiaro.
- **Regole (tutte nel database):** invita qualunque membro dell'officina (titolare o operatore), solo un
  cliente non ancora collegato; l'invito vale **14 giorni**; un nuovo invito annulla i precedenti; si
  accetta solo con un account che ha **la stessa email, confermata** (maiuscole ignorate). Accettare due
  volte lo stesso invito con lo stesso account non è un errore (scritture ripetibili).
- Garage vuoto: il testo ora dice di chiedere l'invito all'officina.

Provato nel browser (Chrome headless, 390 px) contro Supabase locale, con la vera email di conferma letta da
Mailpit: invito, registrazione dal link, collegamento, invito annullato, email diversa, codice non valido.
**22 verifiche verdi.**

### Codice complesso

**Il codice non si salva.** `crea_invito_cliente` genera 16 byte casuali (`extensions.gen_random_bytes`,
32 caratteri esadecimali) e salva solo `sha256` (`impronta_codice`); il codice in chiaro esce una volta
sola, come risultato della chiamata. Chi legge la tabella (i membri dell'officina) non può ricostruire i
link.

**Perché una funzione può scrivere `profile_id`.** Il trigger `proteggi_collegamento_cliente` vietava a
tutti gli utenti di cambiare `clienti_officina.profile_id`. Ora lo permette anche quando
`current_user` non è `authenticated`/`anon`: succede solo dentro una funzione `security definer`, che gira
come il suo proprietario. Le richieste dell'app girano sempre come `authenticated` o `anon`, quindi un
titolare continua a non poter collegare un cliente a un account a caso.

**`info_invito` è leggibile anche senza accesso** (serve per la pagina prima del login): chi ha il codice è
il destinatario e può sapere officina, email dell'invito e stato. Senza il codice (128 bit) non si
indovina nulla.

**Errori attesi** — le funzioni usano `raise exception 'CHIAVE'` (codice `P0001`): `lib/inviti.ts` traduce
la chiave in un messaggio (`ErroreModulo`), `EMAIL_NON_VALIDA` va sotto il campo email.

**`mailto:`** — `encodeURIComponent` per oggetto e testo (i programmi di posta non leggono `+` come spazio),
ma la `@` dell'indirizzo resta scritta così. Le funzioni del testo (`testoInvito`, `mailtoInvito`,
`linkInvito`) sono pure e provate con Vitest.

**Perché `mailto:` e non un'email mandata da TyreCare.** Fino all'SMTP definitivo Resend in prova consegna
solo all'indirizzo del titolare; e un'email dall'indirizzo dell'officina, che il cliente conosce, finisce
meno nello spam. Quando ci sarà l'SMTP col dominio si potrà aggiungere l'invio automatico (Edge Function o
rotta Fastify) riusando la stessa tabella e le stesse funzioni (vedi `IMPLEMENTAZIONI.md`).

## Test end-to-end con Playwright (PLAN P7)

**File coinvolti:** `e2e/playwright.config.ts`, `e2e/tests/aiuti.ts`, `e2e/tests/inviti.spec.ts`,
`.github/workflows/ci.yml` (job `e2e`), `supabase/tests/database/dati.test.sql`.

**Come funziona:** `npm run test:e2e` avvia (o riusa, in locale) il server Vite su `localhost:5173` e apre
Chromium con lo schermo di un telefono (Pixel 7) contro **Supabase locale**, che deve essere già avviato
(`npm run db:start`). Ogni test usa più "browser" separati (`browser.newContext()`): uno per l'officina e
uno per il cliente, come due telefoni diversi.

Primo gruppo di test, il flusso degli inviti (sessione 12):

1. **invito completo:** il titolare crea un cliente e un veicolo, prepara l'invito; il cliente apre il link,
   crea l'account con l'email già scritta, apre il link di conferma letto da Mailpit, collega i veicoli e
   li trova nel garage; la scheda del cliente in officina dice "Usa l'app TyreCare"; lo stesso link aperto
   da un altro dice "Invito già usato";
2. **email diversa:** Giulia (seed) apre l'invito di un altro → avviso, nessun pulsante per collegare,
   "Esci e cambia account" riporta alla scelta "Crea account / Ho già un account";
3. **invito annullato** dalla scheda del cliente → "Invito annullato";
4. **codice inventato** → "Invito non valido".

In locale i 4 test durano circa un minuto. Prima esecuzione su un PC nuovo: `npx playwright install
chromium` (scarica il browser di Playwright).

### Codice complesso

**Dati unici, niente `db:reset`.** I test creano clienti, email (`e2e-…@tyrecare.test`) e targhe con un
suffisso diverso a ogni esecuzione (`unico()`), quindi si possono ripetere sullo stesso database. Per lo
stesso motivo il test pgTAP "l'operatore vede solo i veicoli della propria officina" non conta più i veicoli
(erano 2 nel seed): controlla che siano tutti di Gomme Rossi.

**Il link dell'invito** si legge dal `mailto:` del pulsante "Scrivi l'email" (`preparaInvito`), cioè dal
testo che l'officina manderebbe davvero, senza dipendere dagli appunti del browser.

**Email di conferma da Mailpit.** `linkConferma()` chiede all'API di Mailpit
(`http://127.0.0.1:54324/api/v1/search?query=to:"…"`) l'ultima email arrivata all'indirizzo, riprovando per
qualche secondo (`expect.poll`), poi prende dall'HTML il link `…/auth/v1/verify…` (con `&amp;` → `&`).
Aprendolo, Supabase conferma l'account e rimanda a `redirect_to`, cioè alla pagina dell'invito.

**Service worker bloccato** (`serviceWorkers: 'block'`): in sviluppo vite-plugin-pwa lo attiva e potrebbe
servire pagine in cache. Nel terminale compare l'avviso "Service Worker registration blocked by Playwright":
è voluto.

**Tempi.** 60 s per test e 10 s per ogni attesa: Vite in sviluppo e Supabase in Docker su Windows rispondono
più lentamente del sito pubblicato (con i 5 s predefiniti l'accesso a volte non finiva in tempo).

**In CI** (job `e2e`) si avvia Supabase senza i servizi che non servono (Studio, Storage, Realtime…), si
scrive `apps/web/.env` con l'URL locale e la chiave pubblica "demo" letta da `supabase status`, e si
lanciano i test. Se falliscono, il report HTML di Playwright (con tracce e screenshot) si scarica dagli
artifact dell'esecuzione (`playwright-report`).

## Prenotazioni — catalogo dei servizi e richieste di appuntamento (Fase 4)

**Decisioni del titolare (2026-10-12):** il cliente può chiedere un appuntamento a **tutte le officine
attive**; sceglie **giorno e fascia** (mattina/pomeriggio) e l'officina conferma con l'ora precisa, propone
un altro orario o rifiuta; nel catalogo il **prezzo indicativo è facoltativo** ("da 40 €", vuoto = su
preventivo).

**File coinvolti:** `supabase/migrations/20261012120000_prenotazioni.sql`, `supabase/seed.sql`,
`supabase/tests/database/prenotazioni.test.sql`, `packages/shared/src/prenotazioni.ts`,
`apps/web/src/lib/prenotazioni.ts`, `apps/web/src/pagine/servizi.ts`, `pagine/officine.ts`,
`pagine/appuntamenti.ts`, `ui/prenotazione.ts`, `ui/modulo.ts` (`sceltaUnica`, campo `time`),
`ui/conferma.ts`, `ui/layout.ts`, `pagine/home-officina.ts`, `pagine/profilo.ts`,
`styles/_prenotazioni.scss`, `e2e/tests/prenotazioni.spec.ts`.

**Come funziona:**

- **Catalogo** (`servizi_officina`): nome, descrizione, durata e prezzo indicativi, "prenotabile dall'app".
  Lo vede chi lavora in officina (`/servizi`, anche da Profilo → "Servizi e prezzi" e dagli Appuntamenti),
  lo modifica solo il **TITOLARE** (`/servizi/nuovo`, `/servizi/modifica`). I servizi prenotabili delle
  officine attive sono pubblici come le officine.
- **Cliente:** voce "Officine" nella barra in basso (solo per chi non lavora in officina) → elenco con
  ricerca per nome/città → scheda `/officina?id=…` con Chiama/Indicazioni, servizi ("Prenota") e orari →
  modulo `/prenota`: servizio, targa (già compilata con i veicoli del garage, un tocco per cambiarli),
  giorno, fascia, telefono (dal profilo), note. Dopo l'invio si apre il dettaglio dell'appuntamento.
- **Appuntamenti** (`/appuntamenti`, voce nella barra per tutti): il cliente vede "In programma" e
  "Passati e annullati"; l'officina vede "Da confermare", "Prossimi appuntamenti" e "Passati: com'è
  andata?" (ultimo mese). Nella home dell'officina un avviso giallo porta alle richieste da confermare.
- **Dettaglio** `/appuntamento?id=…`: per l'officina conferma con l'ora (nel giorno chiesto), "Proponi un
  altro orario" (`/appuntamento/proponi`, anche per spostare un appuntamento confermato), "Rifiuta"/"Annulla
  l'appuntamento" con motivo (`/appuntamento/rifiuta`), dopo il giorno "Completato"/"Non presentato"; se la
  targa è già registrata in officina c'è il collegamento alla scheda del veicolo. Per il cliente: accetta o
  rifiuta l'orario proposto, annulla (con dialogo di conferma), chiama l'officina.
- Stati: `RICHIESTA → CONFERMATA → COMPLETATA / NON_PRESENTATO`, `RICHIESTA/CONFERMATA → PROPOSTA →
  CONFERMATA` (il cliente accetta), `RIFIUTATA` (officina), `ANNULLATA` (cliente).
- **Niente notifiche per ora** (Fase 5): cliente e officina vedono le novità aprendo l'app.

Provato: **50 test pgTAP** (totale 157), **19 Vitest** nuovi in `shared` (totale 87), **4 test e2e**
(richiesta → conferma con l'ora → annullamento; proposta accettata; rifiuto con messaggio; catalogo
con servizio non prenotabile ed eliminazione) e screenshot a 390 px.

### Codice complesso

**Le prenotazioni si scrivono solo dalle funzioni** `richiedi_prenotazione`, `rispondi_prenotazione`,
`rispondi_proposta`, `annulla_prenotazione` (`security definer`, nessuna policy di scrittura): così le
regole sugli stati valgono per tutti e un cliente non può confermarsi da solo. Ogni funzione controlla chi
chiama (cliente della prenotazione o membro dell'officina, altrimenti `42501` come la RLS) e lo stato di
partenza (`STATO_NON_VALIDO`). Sono **ripetibili**: la richiesta usa un id scelto dal web (`p_id`) e una
risposta uguale a quella già registrata non dà errore, come per le altre scritture dopo un errore di rete.

**Nome e telefono copiati nella prenotazione.** Il cliente non è ancora un `clienti_officina` e l'officina
non può leggere i `profiles` dei clienti: `richiedi_prenotazione` copia il nome dal profilo e il telefono
dal modulo. Allo stesso modo il nome del servizio resta anche se il servizio viene eliminato
(`on delete set null (servizio_id)`).

**Fasce di apertura, stessa regola in SQL e TypeScript.** `fasce_aperte(orari, giorno)` e `fasceAperte()`:
mattina = un intervallo che inizia prima delle 13, pomeriggio = uno che finisce dopo le 13 (un orario
continuato le ha entrambe). Il giorno della settimana si calcola da `AAAA-MM-GG` a mezzogiorno UTC, così
non cambia con il fuso. Il modulo spegne la fascia chiusa e la sceglie da sola se ne resta una; il
controllo vero è nello schema Zod e nel database (`OFFICINA_CHIUSA`).

**Date italiane.** "Oggi" è `oggi_in_italia()` / `oggiInItalia()` (fuso `Europe/Rome`), non UTC né il fuso
del telefono. L'ora scelta dall'officina diventa un istante con `istanteItaliano(giorno, ora)`, che ricava
lo scarto da UTC con `Intl.DateTimeFormat` (+1 h d'inverno, +2 h d'estate, provato con Vitest);
`inItalia()` fa il contrario per mostrarla. La conferma deve cadere nel giorno chiesto (altrimenti si
propone un altro orario); quando il cliente accetta una proposta, giorno e fascia si aggiornano all'orario
proposto.

**Contro gli abusi:** al massimo 3 richieste in attesa (`RICHIESTA`/`PROPOSTA`) per cliente e officina
(`TROPPE_RICHIESTE`), giorni prenotabili da domani a 60 giorni (`giorni_prenotabili()`).

**Veicoli del cliente nel modulo.** `caricaMieiVeicoli()` legge i veicoli collegati all'account con un join
`clienti_officina!inner (profile_id)` filtrato sull'utente: chi lavora in un'officina altrimenti vedrebbe
tutti i veicoli della sua officina.

**Test indipendenti dai dati.** Gli e2e creano un **cliente nuovo** per ogni test (`nuovoAccountCliente`:
registrazione dall'API di Auth e conferma letta da Mailpit, senza browser), così il limite delle 3
richieste non blocca le esecuzioni ripetute; i test pgTAP delle prenotazioni verificano le regole senza
contare le righe.

## Officina — calendario degli appuntamenti e orari con chiusure (Fase 4)

**Richiesta del titolare (2026-10-12):** un "simil calendario" per gestire gli appuntamenti dell'officina,
poi l'editor degli orari.

**File coinvolti:** `apps/web/src/lib/calendario.ts` (+ test), `pagine/calendario.ts`, `lib/orari.ts`,
`pagine/orari.ts`, `pagine/appuntamenti.ts` (selettore Calendario/Elenco), `pagine/officine.ts`,
`styles/_prenotazioni.scss`, `supabase/migrations/20261012150000_orari_chiusure.sql`,
`supabase/tests/database/orari.test.sql`, `packages/shared/src/prenotazioni.ts`,
`e2e/tests/orari.spec.ts`.

**Come funziona:**

- **Calendario** `/appuntamenti/calendario?giorno=AAAA-MM-GG` (da Appuntamenti → "Calendario"): in alto la
  settimana (frecce, "Torna a oggi"), un pulsante per giorno con il numero di appuntamenti, i giorni chiusi
  attenuati, oggi sottolineato in rosso. Sotto, l'agenda del giorno scelto: orari di apertura (o "Chiuso",
  con il motivo della chiusura), poi **Mattina** e **Pomeriggio** con gli appuntamenti in ordine di ora e,
  in fondo a ogni fascia, le richieste ancora "da fissare". Ogni riga apre il dettaglio.
- **Orari e chiusure** `/officina/orari` (Profilo → "Orari e chiusure", solo TITOLARE): per ogni giorno
  primo turno e secondo turno facoltativo (campi ora affiancati), "Copia il lunedì da martedì a venerdì",
  "Salva orari". Sotto, le **chiusure straordinarie** in programma con elimina (dialogo di conferma) e
  "Aggiungi una chiusura" (`/officina/chiusura`: dal, al compreso, motivo facoltativo).
- Le chiusure valgono ovunque: il modulo "Prenota" non propone quei giorni (sotto il giorno: "…: l'officina
  è chiusa (ferie)"), la scheda dell'officina le elenca in "Chiusure in programma", il calendario le
  mostra come giorni chiusi, `richiedi_prenotazione` le rifiuta (`OFFICINA_CHIUSA`).

### Codice complesso

**Una proposta sta nel giorno proposto.** `posizioneInAgenda()` usa l'ora fissata (`appuntamento`, in ora
italiana) quando c'è, altrimenti giorno e fascia chiesti dal cliente. Per questo `caricaSettimana()` legge
con un `or` le prenotazioni chieste per quei giorni **oppure** con l'ora in quei giorni (l'intervallo delle
ore è largo un giorno per lato, il filtro esatto lo fa `posizioneInAgenda`). Annullate e rifiutate non sono
in agenda.

**Cambiare giorno non ricarica.** Nella stessa settimana la pagina si ridisegna con i dati già caricati;
l'indirizzo si aggiorna con `history.replaceState`, così "indietro" non ripercorre ogni giorno toccato.
Cambiando settimana si caricano prenotazioni e chiusure di quella settimana.

**Orari validati nel database.** `orari_validi(jsonb)` è un vincolo `check` su `officine.orari`: chiavi
lun … dom, al massimo 3 turni al giorno, ore `HH:MM` a due cifre, apertura prima della chiusura, turni in
ordine senza sovrapposizioni. È scritta come una `case` con i controlli in ordine, perché in SQL le
condizioni di un `or` non si fermano alla prima vera: `jsonb_array_length` su un valore che non è un
elenco darebbe errore. Lo schema `creaOrariSchema()` ha le stesse regole e mette l'errore sotto il campo
giusto (es. "Deve venire dopo l'apertura"); accetta anche "8.30" scritto a mano.

**Campi con nome e aria-label.** Ogni ora ha l'etichetta breve visibile ("Apre", "Chiude") e un
`aria-label` completo ("Lunedì, primo turno: chiude") per i lettori di schermo e per i test.

**Test e2e e dati rimasti.** Il test delle chiusure usa un giorno a più di 4 settimane (lontano dagli altri
test e dalla chiusura del seed, tra 20 e 22 giorni) e controlla il suggerimento senza il motivo esatto: una
chiusura rimasta da un'esecuzione interrotta non lo fa fallire.

## Cliente — "Prenota" dal garage (Fase 4)

**File:** `apps/web/src/pagine/garage-veicolo.ts`, `ui/avviso-pneumatici.ts`, `lib/prenotazioni.ts`
(`caricaOfficinePrenotabili`), `pagine/officine.ts` (`mostraPrenota`), `styles/_componenti.scss`,
`e2e/tests/prenotazioni.spec.ts`.

- **Carta dell'officina** nella scheda del garage: se l'officina accetta prenotazioni dall'app (ATTIVA,
  almeno un servizio prenotabile, almeno un giorno di apertura) c'è il pulsante rosso **"Prenota"** a tutta
  larghezza sopra "Chiama" e "Indicazioni". Un'officina non ancora attiva (es. Pneus Express del seed)
  resta con i soli contatti. Nel report del controllo la carta non ha "Prenota".
- **Avviso sulle ruote**: se il veicolo ha pneumatici da sostituire o da controllare, sotto l'avviso c'è
  "Prenota la sostituzione" (rosso) o "Prenota un controllo" (giallo), verso l'officina prenotabile che ha
  visto il veicolo più di recente.
- Entrambi aprono `/prenota?officina=…&targa=…`: il modulo compila targa e descrizione con quel veicolo
  (anche se la targa non è tra quelli dell'account, la targa resta scritta) e "Annulla" torna alla scheda
  del garage invece che alla scheda dell'officina.

### Codice complesso

`caricaOfficinePrenotabili(ids)` legge in **una sola query** le officine del veicolo con
`servizi_officina!inner (id)` filtrati su `prenotabile = true`: l'`!inner` scarta le officine senza servizi
prenotabili; gli orari si controllano nella pagina con `haOrari()`. L'errore di questa lettura è ignorato
(il pulsante è solo una scorciatoia): il garage si vede comunque. `cartaOfficina(o, prenota?)` riceve
l'indirizzo già pronto, quindi in `sezioneOfficine` si usa `officine.map((o) => cartaOfficina(o, …))` e non
`map(cartaOfficina)` (che passerebbe l'indice come secondo argomento).

## Officina — cliente e veicolo dalla richiesta di appuntamento (Fase 4)

**File:** `supabase/migrations/20261013120000_cliente_da_prenotazione.sql`,
`supabase/tests/database/cliente-da-prenotazione.test.sql`, `packages/shared/src/prenotazioni.ts`
(`dividiVeicolo`), `apps/web/src/lib/prenotazioni.ts` (`registraClienteDaPrenotazione`,
`caricaClienteDellaPrenotazione`), `apps/web/src/pagine/appuntamenti.ts`, `e2e/tests/prenotazioni.spec.ts`.

- Nel dettaglio di una richiesta, se la targa **non** è registrata in officina, sotto le azioni c'è la
  sezione "Nella tua officina":
  - chi ha prenotato non è ancora cliente → **"Aggiungi cliente e veicolo"**: il cliente prende nome e
    cognome dal profilo, il telefono dalla richiesta, l'email confermata dall'account, ed è **collegato
    all'account** (il veicolo compare subito nel suo garage, senza invito);
  - è già cliente (scheda collegata all'account) → **"Aggiungi il veicolo"** alla sua scheda.
  Un dialogo di conferma dice cosa succede; poi si apre la scheda del veicolo ("Controlla marca e modello e
  monta gli pneumatici"). Marca e modello si ricavano dalla descrizione libera ("Alfa Romeo Giulietta" →
  Alfa Romeo / Giulietta).
- Se la targa è già registrata la richiesta mostra, come prima, "Apri la scheda del veicolo". Richieste
  rifiutate o annullate non hanno la sezione.

### Codice complesso

`registra_cliente_da_prenotazione` è `security definer` per due motivi: scrivere `profile_id` (il
trigger `proteggi_collegamento_cliente` lo vieta agli utenti) e leggere profilo ed email di chi ha
prenotato. Per questo controlla da sola che chi chiama sia **membro dell'officina della richiesta**
(altrimenti `PRENOTAZIONE_NON_TROVATA`, anche per chi ha prenotato). Si ferma con
`VEICOLO_GIA_REGISTRATO` se la targa c'è già: quel veicolo ha un cliente e uno storico, e collegarlo
all'account senza la verifica dell'email dell'invito mostrerebbe dati di altri. Gli id di cliente e veicolo
li sceglie il web: una ripetizione dopo un errore di rete trova il veicolo con quell'id e lo restituisce
senza creare un secondo cliente (19 test pgTAP).

**Profilo senza nome.** Un account creato dalla dashboard di Supabase ha nome e cognome vuoti, ma
`clienti_officina_nominativo` vuole un nominativo: la prima versione falliva con "Qualcosa è andato
storto" (trovato dal titolare dal telefono). La migrazione `20261013150000_cliente_da_prenotazione_senza_nome.sql`
usa come nome la parte dell'email prima della @ (`mario.rossi`), o "Cliente" senza email confermata;
l'officina lo corregge con "Modifica dati del cliente".

## Impaginazione da computer (officine al PC)

**File:** `apps/web/src/ui/layout.ts` (`paginaApp`, `IMPAGINAZIONE`, `attivaScorciatoie`),
`apps/web/src/styles/_desktop.scss`, `apps/web/src/styles/_tokens.scss` (`$tc-desktop`,
`$tc-barra-laterale`), `e2e/tests/computer.spec.ts`.

Le officine usano TyreCare soprattutto dal computer. Da **992 px** (breakpoint `lg` di Bootstrap):

- la navigazione in basso diventa una **barra laterale** a sinistra (15 rem) con il marchio in alto e le
  voci con icona e testo; la voce attiva ha lo sfondo più chiaro e una barretta rossa. La barra superiore
  sparisce (il marchio è già nella barra laterale);
- i **moduli** restano larghi 40 rem (leggibili), centrati nello spazio a destra della barra;
- gli **elenchi** (clienti, appuntamenti, officine, servizi, scheda dell'officina) arrivano a 60 rem;
- le **schede** arrivano a 76 rem e si dividono in colonne:
  - **home dell'officina**: avviso delle richieste, riepilogo (i tre numeri uno sotto l'altro) e "Nuovo
    veicolo" a sinistra; ricerca ed elenco dei veicoli a destra;
  - **scheda del veicolo** (officina e garage del cliente): cruscotto a sinistra, **fermo** mentre si
    scorrono a destra pneumatici, storico e officine (solo se la finestra è alta almeno 46 rem);
  - **scheda del cliente**: contatti e app a sinistra, veicoli a destra;
  - **dettaglio dell'appuntamento**: stato, dettagli, "Nella tua officina" e ritorno all'elenco a
    sinistra; ora, messaggio e pulsanti di risposta a destra;
  - **calendario**: giorni della settimana più alti, mattina e pomeriggio affiancati;
  - **home del cliente**: carte del garage affiancate (almeno 20 rem l'una).
- **Tastiera:** "Salta al contenuto" è il primo elemento raggiungibile con Tab (compare solo con il
  focus) e porta il focus sul `<main>`; il tasto **`/`** porta nel campo di ricerca della pagina (home
  dell'officina, clienti, officine), se non si sta già scrivendo in un campo.
- Telefono e **stampa** non cambiano: tutte le regole sono in `@media screen and (min-width: 62rem)`.

### Codice complesso

**Nessuna pagina sa come si impagina al computer.** `paginaApp()` scrive sul `<main>` l'attributo
`data-pagina` scelto dal percorso (`IMPAGINAZIONE` in `layout.ts`; `/` vale `home-officina` o
`home-cliente`, i percorsi non elencati valgono `modulo`). `_desktop.scss` usa quell'attributo più la
struttura che le pagine hanno già (figli diretti di `.tc-contenuto`, `:has()`), così i file in
`src/pagine/` non sono stati toccati. **Se si cambia la struttura di una di queste pagine** (ordine o
tipo dei blocchi dentro `.tc-contenuto`), controllarla a 1440 px.

Le colonne usano una griglia con righe esplicite (`repeat(n, auto) 1fr`): i blocchi di sinistra occupano
una riga ciascuno e il blocco di destra va da `grid-row: 1 / -1` (o `2 / -1`), cioè fino all'ultima riga
esplicita. L'ultima riga `1fr` prende lo spazio che avanza, così un elenco lungo a destra non allarga le
righe dei blocchi di sinistra. `n` deve essere almeno il numero massimo di blocchi a sinistra (4 nella
home, 5 nel cliente, 6 nell'appuntamento): un blocco in più finirebbe in una riga implicita sotto la
colonna di destra (si vede male, ma la pagina funziona).

Nel dettaglio dell'appuntamento a destra va solo l'errore delle azioni (`[data-errore-azione]`), non
qualunque `.tc-avviso`: l'avviso di conferma resta a sinistra, in cima.

Il router intercetta **tutti** i link interni (anche `#tc-principale`) e ricaricherebbe la pagina: per
questo "Salta al contenuto" ha un ascoltatore di `click` in **fase di cattura**, che parte prima di quello
del router, sposta il focus e chiama `preventDefault()`; il router vede `defaultPrevented` e non fa nulla.
Gli ascoltatori si registrano una volta sola (`attivaScorciatoie`), al primo `paginaApp()`.

`computer.spec.ts` gira nel progetto `telefono` di Playwright ma con `test.use({ viewport: 1280×800,
isMobile: false })`: controlla la barra laterale, l'elenco dei veicoli a destra del riepilogo, `/` e
"Salta al contenuto".

## Notifiche nell'app (Fase 5, primo passo)

Primo passo della Fase 5 (2026-10-14, sessione 16): le novità delle prenotazioni arrivano come
**notifiche dentro l'app**. Web Push ed email arriveranno dopo e useranno la stessa tabella.

- A ogni cambio di stato di una prenotazione il database crea una notifica per chi deve saperlo:
  - **officina** (titolare e operatori): nuova richiesta, orario proposto accettato dal cliente, appuntamento
    annullato dal cliente;
  - **cliente**: appuntamento confermato, nuovo orario proposto (anche un secondo o uno spostamento),
    appuntamento non accettato. Il messaggio dell'officina va in fondo, tra « ».
  - Chi fa l'azione non riceve nulla (né i suoi colleghi, quando risponde l'officina). "Completato" e
    "Non presentato" non avvisano nessuno.
- Voce **"Notifiche"** (campanella) nella navigazione, per officina e cliente (quinta voce): badge rosso con
  il numero delle non lette (oltre 9 → "9+"), aggiornato **in tempo reale** senza ricaricare.
- Pagina **`/notifiche`**: le ultime 50, le nuove evidenziate (titolo marcato e barretta rossa); ogni
  notifica apre l'appuntamento. Aprire la pagina le segna come lette (il badge si azzera, l'evidenza resta
  finché si è sulla pagina). Aprire un appuntamento, da dove si vuole, segna come lette le sue.

### Codice complesso

**Database** (`20261014120000_notifiche.sql`). Tabella `notifiche` con titolo, testo e link **già pronti in
italiano**: app, push ed email useranno lo stesso testo. La scrive solo il trigger `prenotazioni_notifica`
(`after insert or update of stato, appuntamento`), quindi vale per tutte le funzioni che toccano le
prenotazioni, anche future. Chi ha fatto l'azione è `auth.uid()`: serve per distinguere una conferma dopo
una proposta (se l'ha fatta il cliente è `PROPOSTA_ACCETTATA` per l'officina, se l'ha fatta l'officina è
`CONFERMATA` per il cliente) e per non avvisare chi agisce. Le risposte ripetute (rete instabile) non creano
doppioni: le funzioni non toccano la riga se lo stato è già quello. `testo_quando()` scrive "martedì 13
ottobre, ore 9:30" in SQL (nomi di giorni e mesi negli array: `to_char` dipende dalla lingua del server).

Permessi: lettura e aggiornamento solo del destinatario (RLS); dall'app si può cambiare **solo la colonna
`letta_il`** (`grant update (letta_il)`), niente inserimenti né eliminazioni. La tabella è nella
pubblicazione `supabase_realtime`: Realtime applica la RLS, quindi ogni utente riceve solo i propri eventi.
31 test pgTAP in `notifiche.test.sql` (dentro una transazione `created_at` è uguale per tutte le righe:
i test confrontano i tipi in ordine alfabetico).

**Web.** `lib/notifiche.ts` tiene il contatore: `avviaNotifiche()` è chiamata da ogni `paginaApp()` e parte
una volta per account (se l'account cambia riparte, `fermaNotifiche()` all'uscita). Legge il numero delle
non lette (`count: 'exact', head: true`) e apre un canale Realtime filtrato su `destinatario_id`: a ogni
evento rilegge il numero (più semplice e sempre giusto, invece di contare gli eventi). Rilegge anche quando
l'app torna in primo piano (`visibilitychange`), perché sul telefono il canale può cadere. La navigazione si
ridisegna a ogni pagina con l'ultimo numero noto; i badge già sullo schermo si aggiornano dagli attributi
`data-notifiche-badge` / `data-notifiche-testo`. Per i lettori di schermo il numero è nel nome della voce
("Notifiche, 1 notifica da leggere") e un solo `role="status"` annuncia le notifiche nuove.

La pagina `/notifiche` carica anche `caricaDatiUtente()`: senza, aprendola direttamente la navigazione
mostrerebbe le voci del cliente a chi lavora in officina.

E2e `notifiche.spec.ts` (due browser, cliente e titolare): il badge del titolare passa a 1 **senza
ricaricare** quando la cliente chiede l'appuntamento, e viceversa per la conferma. `entra` e `chiedi` sono
state spostate in `aiuti.ts` per usarle anche qui.

## Notifiche push (Fase 5, Web Push)

Secondo passo della Fase 5 (2026-10-14, sessione 16): ogni notifica dell'app arriva anche come **avviso
sul telefono/computer**, anche con l'app chiusa.

- Nella pagina **Notifiche**, sezione "Avvisi sul telefono": "Avvisami su questo dispositivo" chiede il
  permesso (solo dopo il tocco) e iscrive il dispositivo; "Disattiva gli avvisi" lo toglie. Se il permesso è
  bloccato spiega come riattivarlo; su **iPhone/iPad senza l'app nella schermata Home** spiega come
  aggiungerla (lì le push funzionano solo così, P5).
- Toccando l'avviso si apre l'appuntamento (in una finestra dell'app già aperta, se c'è). Avvisi dello stesso
  appuntamento non si accumulano: il nuovo sostituisce il vecchio (`tag`).

### Codice complesso

Catena: `notifiche` (insert) → trigger `notifiche_push` → `net.http_post` (**pg_net**, asincrono: parte
dopo il commit e non rallenta la risposta) → Edge Function **`invia-notifica`** (Deno,
`supabase/functions/invia-notifica/index.ts`) → `web-push` con le chiavi VAPID → servizio push del browser →
`public/sw-push.js` nel service worker.

- **Segreti.** La funzione legge `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `PUSH_SEGRETO` (`supabase secrets
  set`). Il database legge indirizzo della funzione e segreto dal **Vault** (`url_invia_notifica`,
  `segreto_invia_notifica`) e lo manda nell'intestazione `x-segreto`: la funzione è pubblica
  (`verify_jwt = false` in `config.toml`) ma senza il segreto risponde 401. Senza i segreti nel Vault (DB
  locale, CI) il trigger non fa nulla. La chiave **pubblica** VAPID è scritta in `lib/push.ts` (non è un
  segreto); se si cambiano le chiavi, tutti i dispositivi vanno iscritti di nuovo.
- **Iscrizioni.** `iscrizioni_push` (RLS: solo le proprie). Si scrive con `iscrivi_push()` (`security
  definer`): lo stesso browser può essere iscritto da un altro account e la riga vecchia, invisibile per la
  RLS, bloccherebbe l'`unique` sull'endpoint. Le iscrizioni che il servizio push dà per scadute (404/410)
  le elimina la funzione.
- **Service worker.** Resta quello generato da vite-plugin-pwa (`generateSW`) con
  `workbox.importScripts: ['sw-push.js']`; in sviluppo il service worker ora è **classico** (non `module`),
  perché `importScripts` non funziona nei service worker module.
- Verificato sul cloud (2026-10-14): una notifica inserita a mano con un'iscrizione finta → la funzione
  risponde 200 `{"inviate":0,"dispositivi":1}` (l'endpoint finto non esiste); dati di prova cancellati.
  8 pgTAP in `push.test.sql`. La consegna vera sul telefono va provata dal titolare.

## Promemoria del giorno prima (Fase 5)

Terzo passo della Fase 5 (2026-10-14, sessione 17): la sera prima di un appuntamento **confermato** il
cliente riceve "Domani hai un appuntamento" con officina, ora e servizio (es. *"Gomme Rossi S.n.c. ti
aspetta martedì 20 ottobre, ore 9:30 · Cambio gomme stagionale"*). È una notifica come le altre: compare
nella pagina Notifiche (icona sveglia) e arriva anche come push. Chi lavora in officina non la riceve (ha il
calendario).

### Codice complesso

Migrazione `20261014180000_promemoria_appuntamenti.sql`.

- **Job.** `pg_cron` (Supabase Cron) esegue `crea_promemoria_appuntamenti()` **ogni ora al minuto 5**
  (`cron.job`, nome `promemoria-appuntamenti`). La funzione non fa nulla prima delle **18:00 italiane**;
  dalle 18 avvisa gli appuntamenti `CONFERMATA` del giorno dopo. Il giro orario (invece di uno al giorno)
  evita i problemi dell'ora legale (pg_cron ragiona in UTC) e recupera un giro saltato.
- **Una volta sola per orario.** Nuova colonna `prenotazioni.promemoria_per`: l'`appuntamento` per cui il
  promemoria è già partito. La funzione fa in un'unica istruzione `update … returning` (segna) + `insert`
  in `notifiche`; se l'officina sposta l'appuntamento a un altro giorno, `promemoria_per` non coincide più
  e al nuovo orario parte un altro promemoria. L'update tocca solo `promemoria_per`, quindi non scatta il
  trigger `prenotazioni_notifica` (che guarda `stato` e `appuntamento`).
- **Test.** `p_adesso` (predefinito `now()`) permette ai 13 pgTAP di `promemoria.test.sql` di simulare l'ora.
  La funzione restituisce quanti promemoria ha creato; non è chiamabile dagli utenti (solo dal job).
- **Nuovo tipo** `PROMEMORIA` in `tipo_notifica` (`alter type … add value`): il valore non si può usare
  nella stessa transazione in cui nasce, per questo compare solo dentro il corpo della funzione.
- Per provarlo a mano sul database locale (SQL editor di Studio) si passa un momento dopo le 18 del giorno
  prima dell'appuntamento, es. `select public.crea_promemoria_appuntamenti('2026-10-19 18:30 Europe/Rome');`

## Promemoria degli pneumatici (Fase 5, P11)

Quarto passo della Fase 5 (2026-10-14, sessione 17). Scelte del titolare: **esito del controllo** e
**cambio stagionale**; solo al **cliente** con il veicolo nel garage (mai all'officina); promemoria
stagionale alle **10**. Come le altre notifiche arrivano anche come push.

- **Esito del controllo.** Appena l'officina registra un controllo con gomme gialle o rosse, il cliente
  riceve *"Gomme da sostituire"* (almeno una rossa) o *"Gomme da tenere d'occhio"* (solo gialle), es.
  *"Gomme Rossi S.n.c. ha controllato AB123CD (Fiat Panda): 1 gomma sotto il limite di legge e 1 gomma
  sotto la soglia consigliata. Apri il report per i dettagli."* → apre il report (`/controllo?id=…`).
  Nulla se sono tutte verdi, per i controlli importati, per quelli registrati più di 7 giorni dopo e per
  le correzioni (`modifica_controllo`).
- **Cambio stagionale.** Dal 15 ottobre a fine anno, se risultano montate gomme **estive**: *"È ora delle
  gomme invernali"*. Dal 15 marzo a fine maggio, se risultano montate gomme **invernali**: *"È ora delle
  gomme estive"*. Le 4 stagioni e la ruota di scorta non contano. Un promemoria per stagione e per targa →
  apre il veicolo del garage (`/garage/veicolo?targa=…`), dove c'è "Prenota".

### Codice complesso

Migrazione `20261014200000_promemoria_pneumatici.sql`; 21 pgTAP in `promemoria-pneumatici.test.sql`.

- **`stato_battistrada(mm, stagione)`** ripete in SQL le soglie di `statoBattistrada()` di
  `packages/shared/src/pneumatici.ts` (1,6 mm; 3 estivi, 4 invernali e 4 stagioni). **Se cambiano le
  soglie, vanno cambiate in tutti e due i posti** (i pgTAP fissano i valori di confine).
- **Esito: trigger "deferred".** `controlli_notifica_esito` è un `constraint trigger … deferrable
  initially deferred` su `controlli`: scatta alla **fine della transazione**, quando `registra_controllo`
  ha già scritto anche le misure (un trigger normale sull'insert del controllo non le vedrebbe ancora).
  Vale anche per scritture future fuori da quella funzione. Nei test si forza con `set constraints …
  immediate`, perché la transazione dei test finisce con un rollback.
- **`notifiche.chiave`** + indice unico parziale `(destinatario_id, chiave)`: una notifica con la stessa
  chiave non si ripete (`insert … on conflict do nothing`). Chiavi: `ESITO_CONTROLLO:<id controllo>`,
  `CAMBIO_STAGIONE:<stagione da montare>:<anno>:<targa>`. La targa (non il veicolo) perché la stessa auto
  può essere in due officine del cliente; `distinct on` evita due righe nello stesso giro.
- **Job** `promemoria-pneumatici` (pg_cron, minuto 15 di ogni ora): `crea_promemoria_pneumatici()` non fa
  nulla prima delle 10 italiane; dopo, la chiave impedisce i doppioni nei giri successivi. Prova a mano:
  `select public.crea_promemoria_pneumatici('2026-10-20 10:30 Europe/Rome');`

## Rifiniture delle notifiche (Fase 5)

2026-10-15, sessione 18. Due ritocchi scelti dal titolare dopo la prova dei promemoria dal telefono.

- **Invito ad attivare gli avvisi dopo una richiesta.** Inviata la richiesta di appuntamento, la pagina
  dell'appuntamento mostra sotto la conferma verde la sezione *"Vuoi sapere subito quando risponde?"* con
  "Avvisami su questo dispositivo". Compare **solo** se le push si possono ancora attivare (stato
  `spente`: niente iscrizione e permesso non negato) e **una volta sola**: riaprendo l'appuntamento non
  c'è più (per accenderle resta la pagina Notifiche). Dopo il tocco: *"Avvisi attivi"*, senza pulsante
  per spegnerle.
- **Il report segna letta la sua notifica.** Aprire il report di un controllo (`/controllo?id=…`, anche
  non dalla notifica) segna letta la notifica *"Gomme da sostituire / da tenere d'occhio"* di quel
  controllo, come già succede per gli appuntamenti.

### Codice complesso

- **`ui/avvisi-push.ts`**: la sezione "Avvisi sul telefono" spostata fuori da `pagine/notifiche.ts` per
  usarla in due posti. `collegaAvvisiPush(contenitore, { invito })`: con `invito` usa i testi della
  tabella `INVITO` (per gli stati che non ci sono si torna a quelli di `PUSH`) e, se lo stato iniziale non
  è `spente`, lascia il contenitore vuoto (`[data-sezione-push]:empty` è nascosto dal CSS).
- **"Una volta sola"**: `invitaAgliAvvisi()` (in `pagine/appuntamenti.ts`) alza un flag prima di
  `vaiConConferma()` dalla pagina della richiesta; `mostraAppuntamento` lo legge e lo azzera subito
  all'inizio, così vale solo per la pagina che segue (stesso schema dell'avviso di conferma).
- **`segnaLette(filtro?)`** ora prende `{ prenotazione: id }` o `{ controllo: id }`. Per il controllo
  filtra sulla `chiave` `ESITO_CONTROLLO:<id>` scritta da `notifica_esito_controllo()`: nessuna
  migrazione (la RLS e il `grant update (letta_il)` già bastano).
- **E2e** (`notifiche.spec.ts`): Playwright blocca il service worker e Chromium senza finestra nega le
  notifiche, quindi l'app vedrebbe `non-supportate`/`bloccate`. Il test, con `addInitScript`, finge una
  registrazione senza iscrizione e `Notification.permission = 'default'`. La lettura della notifica dal
  report è stata provata a mano (notifica inserita con `psql` sulla Panda del seed, poi rimossa): un e2e
  vero richiederebbe di montare le gomme e registrare un controllo su un veicolo collegato a un account.

## Import di clienti e veicoli dal CSV standard (Fase 2, P8)

2026-10-16, sessione 19. Primo passo dell'import dal gestionale, senza aspettare il file di GESTITYRE:
il **formato CSV standard di TyreCare** per clienti e veicoli e la pagina **`/clienti/importa`** (solo
il TITOLARE; in *Clienti* c'è il pulsante "Importa dal gestionale").

- **Formato**: una riga per veicolo, con il suo cliente. Colonne `codice_cliente, nome, cognome,
  ragione_sociale, telefono, email, targa, marca, modello, anno, telaio` (modello scaricabile dalla
  pagina). Separatore `;` `,` o tabulatore, riconosciuto dall'intestazione; intestazioni senza badare a
  maiuscole, spazi e accenti, con qualche sinonimo (`codice`, `cellulare`, `e-mail`, `vin`…); colonne
  sconosciute ignorate e segnalate. Serve almeno la targa o il codice cliente: righe con solo il
  veicolo (senza cliente) o solo il cliente (senza veicolo) vanno bene. Massimo 5000 righe.
- **Chiavi** (import idempotente): il cliente si ritrova con `codice_cliente` →
  `clienti_officina.codice_gestionale`, il veicolo con la targa (in forma canonica). Reimportare lo
  stesso file non cambia nulla ("Nessuna modifica").
- **Celle vuote** non cancellano i dati già presenti (es. il telefono inserito dall'app). Una riga con il
  codice cliente collega il veicolo a quel cliente (anche spostandolo da un altro); senza codice, il
  collegamento resta com'era. Clienti e veicoli nuovi hanno `origine = 'IMPORT'`.
- **Anteprima**: righe lette / pronte / con errori, quanti clienti e veicoli sarebbero nuovi o
  aggiornati, l'elenco degli errori per riga (i primi 100). Le righe con errori vengono **saltate**: si
  importano le altre e, corretto il file, lo si ricarica.
- **Esito dell'anteprima**: con righe da scrivere compare "Importa N righe"; se tutto è già in TyreCare
  il riquadro verde *"Nessuna modifica"*; se le righe valide sono già importate ma ce ne sono **con
  errori**, un riquadro **rosso** dice che quelle righe non sono state importate e vanno corrette (prima
  compariva il verde, che sembrava un via libera: segnalato dal titolare il 2026-10-16).
- **Registro**: ogni import (non le anteprime) lascia una riga in `import_log` (file, righe importate e
  saltate, conteggi, autore); la pagina mostra gli ultimi 10.

**Decisione del titolare (2026-10-16):** il file si legge e si controlla **nel browser**, non in Fastify
come diceva P8 (apps/api non è pubblicata e il file è dell'officina, che quei dati li vede già); i
controlli con le misure arriveranno in un secondo momento.

### Mappatura delle colonne (P22, solo logica)

2026-10-20, T008. `importa.ts` separa tre passi: `tabellaDaCsv` (intestazioni + righe con il numero nel
file), la **mappatura** (`Mappatura` = colonna di TyreCare → intestazione del file, testo esatto) e
`controllaTabella(tabella, mappatura)`, che prima chiama `erroriMappatura` (intestazione usata due volte,
inesistente, né targa né codice cliente: se ci sono, `ok: false` con i messaggi uniti) e poi controlla le
righe come prima. `mappaturaAutomatica` è il riconoscimento di sempre (nome standard o sinonimo, vince la
prima intestazione); `controllaImport(testo)` = i tre passi insieme, con lo stesso messaggio di prima se
mancano targa e codice. `applicaMappatura(salvata, intestazioni)` ritrova una mappatura salvata in un altro
file (confronto con `nomeColonna`, quindi ignora maiuscole/accenti) e dà `null` se manca anche una sola
intestazione. `ignorate` = intestazioni non vuote non usate dalla mappatura. Interfaccia e salvataggio
delle mappature: passi successivi.

### File Excel nel browser (P8/P22)

2026-10-20, T009. **File coinvolti:** `apps/web/src/lib/excel.ts`, `apps/web/src/lib/importa.ts`,
`apps/web/src/pagine/importa.ts`. **Come funziona:** `/clienti/importa` accetta `.csv`, `.txt`, `.xls`
(Excel 97–2003, quello di GESTITYRE), `.xlsx` e `.ods`. `leggiTabella(file)` guarda l'estensione (senza
badare alle maiuscole): per Excel chiama `leggiExcel`, che carica la libreria `@e965/xlsx` (SheetJS CE
0.20.3) con `import()` dinamico, legge il **primo foglio** e lo trasforma in `Tabella`; per il resto
legge il CSV come prima. File oltre 10 MB rifiutati con un messaggio; file Excel illeggibili danno
"Non riusciamo a leggere il file Excel". Poi l'anteprima è identica: `controllaTabella` con
`mappaturaAutomatica`. La mappatura a mano delle colonne è descritta sotto (T010).

- **`excel.ts` `tabellaDaFoglio`**: scorre l'area `!ref` cella per cella; il testo è `cell.w` (quello che
  si vede in Excel: date e numeri come formattati) o, se manca, `String(cell.v)`. Salta le righe tutte
  vuote; la prima non vuota è l'intestazione; `numero` è la riga di Excel. Prende la libreria come
  argomento (solo i tipi sono importati) così il modulo non la porta nel codice iniziale: la libreria
  (492 kB, 160 kB gzip) è un pezzo a parte che si scarica solo scegliendo un file Excel.

### Associa le colonne dell'import (P22)

2026-10-20, T010. **File coinvolti:** `apps/web/src/pagine/importa.ts`, `apps/web/src/ui/mappatura.ts`,
`apps/web/src/styles/_officina.scss` (`.tc-mappatura__campi`), `e2e/tests/import.spec.ts`.
**Come funziona:** dopo la lettura del file `leggiEMostra` calcola `mappaturaAutomatica`. Se trova la
targa o il codice cliente **e** ogni intestazione non vuota è usata (`tuttoRiconosciuto`), va dritto
all'anteprima come prima. Altrimenti compare **"Associa le colonne"**: 11 `<select>` (uno per colonna di
TyreCare, con etichetta visibile), opzioni "— Non c'è nel file —" + le intestazioni, ognuna con un
esempio (prima cella non vuota della colonna, tagliata a 30 caratteri). Le scelte iniziali sono quelle
automatiche. "Mostra l'anteprima" chiama `erroriMappatura`: se dà messaggi li mostra in un riquadro
rosso (`role="alert"`) e mette il focus sul primo `<select>` coinvolto (`primoSelectCoinvolto`: uno con
l'intestazione scelta due volte, altrimenti quello della targa); altrimenti `controllaTabella` e
l'anteprima di sempre. Sopra l'anteprima "Cambia le colonne" riporta al passo con le scelte fatte
(restano in memoria solo finché la pagina è aperta: salvarle è T012). Da 992 px i `<select>` stanno su
due colonne (P20).

### Codice complesso (associa le colonne)

- `importa.ts` `leggiEMostra` / `mostraAnteprima` / `mostraMappatura`: condividono un `ContestoImport`
  (tabella letta, file, `attuale()`); `attuale()` combina `ancoraAttuale(n)` e il contatore `scelta`, e
  ogni passo asincrono lo controlla prima di toccare il DOM, così una risposta arrivata dopo aver
  cambiato file o pagina viene scartata.
- `mappatura.ts` `tuttoRiconosciuto`: confronta il numero di intestazioni non vuote con quello delle
  intestazioni usate; un'intestazione ripetuta nel file conta come non riconosciuta e fa comparire il
  passo di associazione. Le opzioni dei `<select>` non ripetono le intestazioni uguali.

### Associazioni di colonne salvate (P22, database)

2026-10-21, T011. **File coinvolti:** `supabase/migrations/20261021120000_import_mappature.sql`,
`supabase/tests/database/import-mappature.test.sql`, `packages/shared/src/database.types.ts`.
**Come funziona:** tabella `import_mappature` (una riga per associazione salvata: `officina_id`, `nome`
unico nell'officina, 1–60 caratteri, `colonne` = `{ colonna di TyreCare: intestazione del file }`,
`creata_da` = chi l'ha salvata). Come l'import è **solo del titolare**: le quattro policy (select, insert,
update, delete) usano `is_titolare_officina(officina_id)`; operatore, altre officine, clienti e anonimi
non vedono e non scrivono nulla. Il contenuto di `colonne` lo controlla `mappatura_import_valida` in un
vincolo `check`. Solo database: l'interfaccia per salvare e scegliere le associazioni è T012 (userà
`applicaMappatura` per ritrovarle in un file nuovo).

### Codice complesso (associazioni salvate)

- `mappatura_import_valida(jsonb)`: `immutable` (serve per usarla in un `check`) e con le 11 chiavi di
  `COLONNE_IMPORT` scritte nella funzione: se si aggiunge una colonna all'import va aggiunta **anche
  qui** (con una nuova migrazione). Il `case` iniziale esclude i valori che non sono oggetti prima di
  `jsonb_each`, che su un array o un numero darebbe errore invece di `false`.
- La policy di `update` ha `using` **e** `with check`: senza il secondo un titolare potrebbe spostare
  una riga in un'officina non sua cambiando `officina_id` (c'è un test).
- `import-mappature.test.sql`: i tentativi di modifica ed eliminazione dell'operatore e di titolare2 sono
  `update`/`delete` "nudi" (la RLS non dà errore, non trova righe); il test successivo, come titolare,
  controlla che la riga sia rimasta uguale.


### Salvare e riusare le associazioni di colonne (P22)

2026-10-21, T012. **File coinvolti:** `apps/web/src/lib/importa.ts` (`caricaMappature`, `salvaMappatura`,
`eliminaMappatura`), `apps/web/src/pagine/importa.ts`, `apps/web/src/ui/mappatura.ts`,
`e2e/tests/import.spec.ts`. **Come funziona:** caricando un file, `leggiEMostra` legge le associazioni
salvate dell'officina (più recente prima; se la lettura fallisce si lavora senza). Se il riconoscimento
automatico non basta, usa la prima per cui `applicaMappatura` non dà `null` (e `erroriMappatura` è
vuoto) e va all'anteprima con la riga "Colonne associate con «nome»" e "Cambia le colonne". Nel passo
"Associa le colonne", se ce ne sono, compare "Usa un'associazione salvata" (riempie i `<select>`; se
non corrisponde al file avvisa) con il pulsante "Elimina" (conferma di `chiediConferma`). Il campo
"Salva queste scelte come" (max 60 caratteri) salva con upsert su `officina_id,nome` quando si preme
"Mostra l'anteprima" e le scelte sono valide; se il salvataggio fallisce un avviso giallo compare
nell'anteprima, che si mostra lo stesso. Il nome è testo dell'utente: sempre con `esc`. Il test e2e
elimina la sua associazione in un `finally`, perché le intestazioni inventate sono le stesse del test
di T010 e una associazione rimasta lo farebbe saltare il passo di associazione.

### Codice complesso

- **`packages/shared/src/importa.ts`**: `leggiCsv` è un piccolo lettore RFC 4180 (virgolette, `""`, a capo
  dentro i campi, BOM, righe vuote saltate) che restituisce anche il **numero di riga nel file** per i
  messaggi. `controllaImport` riusa `ClienteSchema` e `VeicoloSchema` dei moduli (stessi vincoli `check`
  del database) e in più controlla i doppioni nel file: targa ripetuta, stesso codice cliente con
  anagrafica diversa. Un problema del file intero (vuoto, senza colonne chiave, troppe righe) dà
  `ok: false` con un solo messaggio.
- **Codifica**: `leggiFile` (in `apps/web/src/lib/importa.ts`) prova UTF-8 con `fatal: true` e, se il file
  non lo è, lo rilegge come **Windows-1252** (i CSV di Excel in italiano: "Niccolò" non diventa "Niccol�").
  Il modello scaricato ha il BOM, così Excel lo apre in UTF-8.
- **`importa_clienti_veicoli(p_officina_id, p_righe, p_nome_file, p_righe_scartate, p_simula)`**
  (migrazione `20261016120000_import_clienti_veicoli.sql`, `security invoker` → valgono le RLS): una
  chiamata = una transazione, tutto o niente. Gli aggiornamenti usano
  `where (colonne) is distinct from (nuovi valori)`, così `found` dice se qualcosa è cambiato davvero e
  si contano solo gli "aggiornati" veri. Lo stesso cliente su più righe si conta una volta (`v_visti`).
- **Anteprima con la stessa funzione**: con `p_simula` le scritture avvengono dentro un blocco
  `begin … exception` (una sottotransazione) che alla fine solleva l'errore `TCSIM` e lo cattura: tutto
  viene annullato, ma i contatori (variabili PL/pgSQL) restano. Così l'anteprima conta con lo stesso
  codice dell'import vero, compresi i casi limite.
- **Test**: `importa.test.ts` (13 Vitest), `supabase/tests/database/import.test.sql` (17 pgTAP: permessi,
  simulazione senza scritture, conteggi, celle vuote, idempotenza, tutto o niente, registro),
  `e2e/tests/import.spec.ts` (CSV in Windows-1252 con una riga sbagliata, import, reimport, operatore).
  Nei pgTAP il JSON delle righe sta in una tabella temporanea: `\set` di psql non accetta valori su più
  righe.

## Pilota — commenti degli utenti (database)

**File coinvolti:** `supabase/migrations/20261022150000_commenti.sql`,
`supabase/tests/database/commenti.test.sql`, `packages/shared/src/database.types.ts`

**Come funziona:** durante il pilota officine e clienti mandano dall'app commenti e segnalazioni, salvati
in `public.commenti` (l'interfaccia "Invia un commento" arriva con T016). Ogni commento ha l'autore (chi
è collegato), un'officina facoltativa (solo se chi scrive ne è membro: il cliente la lascia vuota), la
pagina dell'app da cui è partito (`percorso`) e il testo (3–2000 caratteri, spazi ai lati esclusi). Li
legge solo l'autore (i propri) e l'ADMIN; nessuno li modifica o li elimina dall'app. Al massimo **20
commenti in 24 ore** per persona: il ventunesimo dà l'errore `TROPPI_COMMENTI`.

### Codice complesso

- **`id` senza default**: lo genera il browser (`crypto.randomUUID()`), come le altre scritture ripetibili
  (vedi "Scritture ripetibili dopo un errore di rete"): se l'invio viene ripetuto dopo un errore di rete,
  la stessa chiave primaria dà `23505` invece di creare un doppione.
- **Trigger `limita_commenti`** (`before insert`): conta i commenti dell'autore nelle ultime 24 ore e
  solleva `TROPPI_COMMENTI` (P0001) se sono già 20. **Non** è `security definer`: gira come chi scrive, e
  la RLS gli mostra proprio le sue righe, quelle da contare. In un `insert … select` di più righe ogni riga
  vede quelle inserite prima nello stesso comando (regola di Postgres per i trigger `before` di riga),
  quindi anche un inserimento multiplo si ferma al ventunesimo. Il trigger forza `created_at := now()`:
  con una data vecchia scelta dal browser il commento non entrerebbe nel conteggio.
- **Ordine dei controlli**: prima il trigger, poi la policy RLS (`with check`), poi i `check` delle
  colonne. Per questo nel test del testo corto l'autore è quello giusto (altrimenti l'errore sarebbe
  `42501`).
- **Limite non "atomico"**: due invii nello stesso istante da due schede possono superare di poco i 20
  (ognuno conta prima che l'altro sia visibile). Per un freno agli abusi basta; non serve un blocco.
- **Test** (13 pgTAP): il cliente invia e rilegge il suo; testo corto, autore diverso, officina non sua e
  modifica → rifiutati; l'operatore invia per la sua officina con una data vecchia e trova `now()`; non
  vede i commenti altrui; l'ADMIN li vede tutti; l'anonimo non invia; 20 commenti con `generate_series`
  passano e il ventunesimo dà `TROPPI_COMMENTI`.

## Pilota — commenti degli utenti (app)

**File coinvolti:** `apps/web/src/pagine/commento.ts`, `apps/web/src/lib/commenti.ts`,
`packages/shared/src/commenti.ts` (+ test), `apps/web/src/lib/router.ts` (`paginaPrecedente`),
`apps/web/src/pagine/profilo.ts`, `apps/web/src/main.ts`, `e2e/tests/commenti.spec.ts`

**Come funziona:** dal Profilo, sezione **Account**, "Invia un commento su TyreCare" porta a
`/commento?da=<pagina da cui si veniva>`. Il modulo ha un solo campo, "Cosa vuoi dirci?" (3–2000
caratteri senza gli spazi ai lati, con contatore); dopo l'invio si torna al Profilo con "Grazie, abbiamo
ricevuto il tuo commento." Chi lavora in un'officina scrive con `officina_id` dell'officina attiva, il
cliente con `null`. Se si superano i 20 commenti in 24 ore compare "Hai mandato molti commenti oggi:
riprova domani." **Non c'è una pagina per leggere i commenti**: l'amministratore li legge dalla
dashboard di Supabase (tabella `commenti`).

### Codice complesso

- `inviaCommento()` segue le scritture ripetibili (vedi "Scritture ripetibili dopo un errore di rete"):
  l'id nasce nel browser e `conRiprova` ripete l'insert una volta se la rete non risponde; un `23505` su
  `commenti_pkey` (`giaSalvato`) significa che il primo tentativo era arrivato ed è un successo.
  `TROPPI_COMMENTI` arriva come errore `P0001` con quel testo e diventa un `ErroreModulo`.
- Il testo dell'utente non entra mai come HTML: la textarea parte vuota e il testo va al database come
  parametro; il contatore usa `textContent`.
- `?da=` arriva dall'indirizzo e non è fidato: `percorsoCommento` accetta solo percorsi interni ("/…" non
  "//…") di al massimo 200 caratteri, altrimenti `''`. La pagina precedente la ricorda il router
  (`vaiA` salva `location.pathname` prima di cambiare pagina): dal Profilo è quindi la pagina da cui
  si era arrivati al Profilo.

## Dati dell'officina e posizione (Fase 4)

**File coinvolti:** `apps/web/src/pagine/dati-officina.ts`, `apps/web/src/lib/dati-officina.ts`,
`packages/shared/src/officina.ts` (`leggiCoordinate`, `DatiOfficinaSchema`), `apps/web/src/main.ts`
(rotta `/officina/dati`), `apps/web/src/pagine/profilo.ts` (voce solo per il TITOLARE),
`e2e/tests/dati-officina.spec.ts`.
**Come funziona:** il titolare apre Profilo → Officina → "Dati dell'officina", modifica indirizzo, contatti
e posizione e salva con un `update` su `officine` (policy "officine: modifica titolare o admin", nessuna
migrazione). Ragione sociale e partita IVA sono solo mostrate: le cambia solo l'amministratore, e anche
via API il titolare riceve `42501` — protetto dal trigger `proteggi_campi_riservati` (T024; inviare lo stesso
valore di prima è permesso). La posizione è un unico campo di testo:
si incolla "45.070312, 7.686856" o un link di Google Maps, oppure si preme "Usa la posizione attuale".
Campo vuoto = `latitudine`/`longitudine` a `null` (l'officina non sarà ordinata per distanza). Un operatore
vede solo l'avviso "Solo il titolare…".

### Codice complesso
`packages/shared/src/officina.ts` (`leggiCoordinate`) — due espressioni regolari: il link di Maps cerca
`@lat,lon,`, altrimenti due numeri col punto separati da virgola e/o spazi. La virgola decimale non si
indovina ("45,07 7,68" potrebbe essere due coordinate o quattro numeri): è rifiutata e lo schema chiede il
punto. Il valore è arrotondato con `toFixed(6)` (come `numeric(9, 6)`) e controllato negli intervalli.
`DatiOfficinaSchema` — la trasformazione finale trasforma `posizione` in latitudine e longitudine; con
errori sugli altri campi Zod non la esegue, quindi l'errore della posizione compare dopo aver corretto
gli altri campi.

## Cliente — officine ordinate per distanza (Fase 4)

**File coinvolti:** `packages/shared/src/distanza.ts` (+ `distanza.test.ts`), `apps/web/src/lib/prenotazioni.ts`
(`COLONNE_OFFICINA` e `OfficinaPubblica` con `latitudine` e `longitudine`), `apps/web/src/pagine/officine.ts`
(`mostraOfficine`), `e2e/tests/officine.spec.ts`.
**Come funziona:** in `/officine` il pulsante "Vicino a me" chiede la posizione al browser
(`getCurrentPosition`, `timeout` 10 s, `maximumAge` 5 minuti). Durante l'attesa è disabilitato e dice "Cerco
la tua posizione…". Poi l'elenco si riordina (`ordinaPerDistanza`: prima le officine con coordinate, dalla
più vicina; dopo quelle senza, nell'ordine di prima) e ogni scheda mostra "A 3,2 km da te". Se il permesso
è negato o la lettura fallisce compare l'avviso giallo "Non riusciamo a sapere dove sei…" e l'elenco resta
com'era. La ricerca per testo lavora sull'elenco mostrato, quindi anche su quello riordinato. Le coordinate
delle officine si inseriscono in "Dati dell'officina" (T018).
**Privacy:** la posizione del cliente **non** si salva da nessuna parte (né database né `localStorage`):
vive in una variabile della funzione e sparisce alla chiusura della pagina; la distanza si calcola nel
browser, senza servizi esterni (niente mappe né geocodifica).

### Codice complesso
`packages/shared/src/distanza.ts` (`distanzaKm`) — formula dell'emisenoverso con raggio 6371 km, linea d'aria
(non il percorso stradale). `formattaDistanza` arrotonda a 50 m sotto 1 km, un decimale sotto 10 km, interi
oltre; "1,0 km" invece di "1000 m". `ordinaPerDistanza` aggiunge `distanza_km` (`null` senza coordinate) e
non modifica l'elenco ricevuto. Nel seed c'è una sola officina ATTIVA: l'ordinamento si verifica con Vitest,
l'e2e prova solo la distanza e l'avviso.

## Prenotazioni — capienza per fascia (database, Fase 4)

**Decisione (T020, dedotta da P14 e dalle decisioni del 2026-10-12):** restano le **richieste** che
l'officina conferma; la capienza limita solo le richieste nuove dei clienti. Niente prenotazione diretta,
niente slot orari. L'interfaccia è descritta sotto (T021).

**File coinvolti:** `supabase/migrations/20261023150000_capienza_fasce.sql`,
`supabase/tests/database/capienza.test.sql`, `packages/shared/src/database.types.ts`.

**Come funziona:**

- `officine.capienza_fascia` (1–99, `null` = nessun limite, il valore iniziale): quante richieste
  l'officina accetta al massimo per la mattina o per il pomeriggio di un giorno. La imposta il TITOLARE
  con la policy "officine: modifica titolare o admin"; per l'operatore l'aggiornamento non cambia niente.
- `occupazione_fascia(officina, giorno, fascia)` conta chi occupa la fascia: le `RICHIESTA` nel giorno e
  nella fascia chiesti, le `PROPOSTA` e `CONFERMATA` nel giorno e nella fascia dell'ora fissata
  (`appuntamento` in ora italiana; prima delle 13:00 mattina, dalle 13:00 pomeriggio). Rifiutate,
  annullate, completate e non presentate non contano. È **interna**: non è concessa ad `anon` né ad
  `authenticated`, perché conta prenotazioni di altri clienti.
- `fasce_piene(officina)` è pubblica (anon e authenticated): le coppie giorno/fascia da domani a
  `giorni_prenotabili()` con occupazione ≥ capienza. Per un'officina non ATTIVA o senza capienza non
  restituisce righe; non restituisce mai conteggi né dati delle prenotazioni.
- `richiedi_prenotazione` dopo il controllo delle chiusure solleva `FASCIA_PIENA` se la fascia è piena.
  L'officina invece può sempre confermare, proporre o spostare un appuntamento anche in una fascia piena.

Provato: **29 test pgTAP** (provati anche in locale con Postgres 16 e pgTAP, insieme a quelli delle
prenotazioni, degli orari e delle notifiche), più una prova a mano di due richieste contemporanee.

### Interfaccia della capienza (T021)

**File:** `apps/web/src/pagine/orari.ts`, `apps/web/src/lib/orari.ts`, `apps/web/src/pagine/officine.ts`
(`mostraPrenota`), `apps/web/src/lib/prenotazioni.ts`, `packages/shared/src/prenotazioni.ts`,
`e2e/tests/capienza.spec.ts`.

- Il titolare trova in `/officina/orari`, sotto gli orari, "Richieste al massimo per fascia": vuoto = nessun
  limite, altrimenti 1–99 (`creaOrariECapienzaSchema`; errore sotto il campo). Si salva con "Salva orari"
  nella stessa `update` di `orari` e `capienza_fascia`.
- Nel modulo "Prenota" `caricaFascePiene` chiama `fasce_piene`; se la chiamata fallisce si usa l'elenco
  vuoto (il database controlla comunque). Scelto il giorno, `fasceLibere` toglie le fasce chiuse (orari e
  chiusure) e quelle piene: le fasce piene restano disabilitate con "(piena)" accanto al nome. Un giorno
  aperto con tutte le fasce piene mostra "le richieste sono al completo, scegli un altro giorno".
- Se la fascia si riempie dopo il caricamento della pagina, il database risponde `FASCIA_PIENA` e il
  messaggio compare sotto il campo fascia (tabella `ERRORI` di `lib/prenotazioni.ts`). L'elenco delle fasce
  piene non si aggiorna da solo: si ricarica la pagina.

### Codice complesso

`20261023150000_capienza_fasce.sql` (`richiedi_prenotazione`) — `pg_advisory_xact_lock` sull'hash di
officina, giorno e fascia (`hashtextextended`) mette in fila le richieste della stessa fascia fino alla
fine della transazione: senza, due clienti che chiedono insieme l'ultimo posto contano entrambi "1 libero" e passano
entrambi. Il conteggio dopo il lucchetto è un'istruzione nuova, quindi in `read committed` vede la
richiesta già salvata dall'altro. Due fasce diverse con lo stesso hash si aspettano a vicenda per un
attimo: nessun errore. La ripetizione con lo stesso `p_id` resta **prima** di tutti i controlli, così una
richiesta già riuscita ripetuta dopo un errore di rete non diventa `FASCIA_PIENA`.

`capienza.test.sql` — una `CONFERMATA` con l'ora in un giorno diverso da quello chiesto non si ottiene
dalle funzioni (accettando una proposta giorno e fascia si aggiornano), quindi il test la scrive
direttamente per provare che conta il giorno dell'appuntamento; il caso reale "spostata" è la `PROPOSTA`,
provata con `rispondi_prenotazione` alle 13:00 (pomeriggio).

---

## Pilota — creare un'officina (T027)

**File coinvolti:** `supabase/migrations/20261024150000_crea_officina.sql`,
`supabase/tests/database/crea-officina.test.sql`.
**Come funziona:** dall'editor SQL di Supabase si lancia
`select public.crea_officina_con_titolare('LA SANTI GOMME ...', '<partita IVA>', '<email>');` (l'account del
titolare deve già esistere). La funzione crea l'officina `IN_ATTESA`, porta il profilo da CLIENTE a OFFICINA
(un ADMIN resta ADMIN) e inserisce il TITOLARE. Possono chiamarla solo un admin o chi non ha un utente (editor
SQL). Errori: `ACCOUNT_NON_TROVATO`, `PARTITA_IVA_GIA_PRESENTE`, `42501`. Dopo la firma del DPA:
`update public.officine set stato_affiliazione = 'ATTIVA' where id = '<id>';`. Provata con 14 test pgTAP.
I passi completi per Davide sono in `DOCS/pilota/crea-officina.md`; la password dimenticata si reimposta
con `update auth.users … crypt(…)` nell'editor SQL, finché non c'è il dominio.

---

## Unire due clienti (T031)

**File coinvolti:** `supabase/migrations/20261024160000_unisci_clienti.sql`,
`supabase/tests/database/unisci-clienti.test.sql`.
**Come funziona:** `unisci_clienti(p_da, p_in)` unisce due anagrafiche dello stesso officina. Solo il titolare
(altrimenti `CLIENTI_NON_VALIDI` / `42501`); se i due hanno account diversi risponde `ACCOUNT_DIVERSI`. Sposta
veicoli e inviti su `p_in`, elimina `p_da`, poi completa i campi vuoti di `p_in` (profile_id,
codice_gestionale, telefono, email, ragione_sociale, nome, cognome) con quelli di `p_da`; le note si accodano
(max 2000 caratteri) e `consenso_marketing` è l'`or` dei due. Provata con 19 test pgTAP.

### Codice complesso
L'eliminazione di `p_da` precede la copia di codice gestionale e account su `p_in`: i vincoli unique li
rifiuterebbero finché esistono due righe con lo stesso valore. Le altre chiavi esterne verso
`clienti_officina` sono solo veicoli e inviti (verificato), quindi basta spostare quelle.

### Inviti dopo l'unione (T073)
Dalla migrazione `20261030150000_unisci_clienti_inviti.sql`, alla fine dell'unione la funzione annulla
(`annullato_il = now()`) gli inviti ancora aperti della scheda rimasta (non usati, non annullati, non
scaduti), compresi quelli arrivati dalla scheda eliminata. Con un account collegato (coalesce dei due
`profile_id`) li annulla tutti, perché accettarli darebbe errore; senza, lascia aperto solo il più recente
(`created_at`, a parità `id`), come quando si crea un invito nuovo. Inviti usati o scaduti non cambiano. Il
resto della funzione è identico a T031. Test: `unisci-clienti-inviti.test.sql`.

---

## Unisci con un altro cliente (T032)

**File coinvolti:** `apps/web/src/pagine/unisci-cliente.ts` (nuovo, rotta `/cliente/unisci`),
`apps/web/src/pagine/clienti.ts` (`filtraClienti`), la scheda cliente, `unisciClienti()` nel livello dati.
**Come funziona:** solo il titolare (`eTitolare`) vede il link nella scheda cliente, che porta a
`/cliente/unisci?id=<attuale>`. La pagina elenca gli altri clienti dell'officina filtrati con `filtraClienti`;
dopo la scelta `chiediConferma` e poi `unisciClienti(scelto, attuale)` chiama la rpc `unisci_clienti` (T031).
A unione riuscita `vaiConConferma` mostra "Clienti uniti.". `ACCOUNT_DIVERSI` e `CLIENTI_NON_VALIDI` sono
`ErroreModulo` con messaggio per l'utente. L'errore dell'unione lo mostra solo `chiediConferma`: il dialogo
resta aperto e la pagina non ha un secondo avviso (T081).

### Codice complesso
`filtraClienti` è la ricerca dell'elenco clienti estratta e esportata da `pagine/clienti.ts`, insieme a
`testoRicerca` e `cifre`: le due pagine usano le stesse regole (4 test). `unisciClienti` non usa `conRiprova`:
una riprova dopo un'unione già riuscita darebbe `CLIENTI_NON_VALIDI`.

---

## Prenota: fascia riempita durante la compilazione (T025)

**File coinvolti:** `apps/web/src/lib/prenotazioni.ts`, `apps/web/src/pagine/officine.ts` (`mostraPrenota`),
`e2e/tests/capienza-corsa.spec.ts`.
**Come funziona:** `traduci` passa la chiave del database come `codice` di `ErroreModulo`. In `mostraPrenota`
il gestore di `collegaModulo` intercetta `FASCIA_PIENA`, rilegge `caricaFascePiene`, richiama `aggiorna()` e
rilancia lo stesso errore, che il modulo mostra sotto "fascia". Se la rilettura fallisce si tengono le fasce
precedenti. L'e2e usa il giorno feriale 32 (`prossimoFeriale(32 + retry)`).

### Codice complesso
`piene` è una `let` letta da `aggiorna()` a ogni chiamata: per questo basta riassegnarla e richiamare
`aggiorna()` perché la fascia appena riempita si spenga.

---

## Nuovo cliente con invito (T034)

**File coinvolti:** `apps/web/src/pagine/nuovo-cliente.ts` (`mostraNuovoCliente`), `e2e/tests/nuovo-cliente-invito.spec.ts`.
**Come funziona:** «Nuovo cliente» ha la casella «Invitalo nell'app dopo il salvataggio»; se spuntata, dopo il
salvataggio si va a `/cliente/invito?id=`. Vale per `?da=clienti` e per il percorso verso «Nuovo veicolo».

### Codice complesso
La casella `invita` è nel solo modulo di `mostraNuovoCliente`, non in `campiCliente` (condiviso con la
modifica). `ClienteSchema` non cambia: zod scarta il campo, e il gestore lo legge dal form prima di
`creaCliente`.

---

## Eliminare l'account (database, T038)

**File coinvolti:** `supabase/migrations/` (nuova migrazione `elimina_account`), `supabase/tests/database/`
(test pgTAP, 17 test), `packages/shared/src/database.types.ts`.
**Come funziona:** `elimina_account()` (security definer) cancella l'account di chi la chiama. Rifiuta gli
ADMIN (`ACCOUNT_AMMINISTRATORE`), i titolari di un'officina (`TITOLARE_DI_OFFICINA`) e chi ha prenotazioni
RICHIESTA, PROPOSTA o CONFERMATA (`PRENOTAZIONI_IN_CORSO`); altrimenti fa `delete from auth.users`.
Con l'account spariscono, a cascata, profilo, `officina_utenti`, **le prenotazioni fatte come cliente
(anche quelle passate)**, notifiche, iscrizioni push e commenti. Restano all'officina, scollegati
(`set null`): `clienti_officina`, veicoli, controlli, inviti e import. Per ora esiste solo la funzione nel
database, senza pulsante nell'app. La sparizione delle prenotazioni passate è una domanda per il consulente
(`DOCS/legale/README.md`, domanda 14).

## Eliminazione dell'account e aiuto su strada (T225)

**File coinvolti:** migrazione `20261107000100`, pgTAP
`supabase/tests/database/elimina-account-strada.test.sql`
(8 asserzioni, le esegue la CI con `npm run db:test`).
**Come funziona:** `elimina_account()` controlla nell'ordine ADMIN, TITOLARE, prenotazioni in corso, aiuto su
strada in corso. Blocca una richiesta del chiamante APERTA con `scade_il >= now()` o ACCETTATA con
`accettata_il` nelle ultime 24 ore (stessi limiti di `crea_richiesta_strada`). Le richieste oltre i limiti le
chiude la lettura o il job e non bloccano. Errore `RICHIESTA_STRADA_IN_CORSO` (P0001): prima si annulla la
richiesta. Con l'account le richieste spariscono a cascata. Il testo per l'utente arriva con T226.

---

## Import dei controlli (database, T043)

**File coinvolti:** `supabase/migrations/` (nuova migrazione `importa_controlli`: funzione, 4 colonne di
`import_log`, tipo CONTROLLI), `supabase/tests/database/` (20 test pgTAP), `database.types.ts`.
**Come funziona:** `importa_controlli` riceve le righe del CSV (una per pneumatico misurato) e crea
controlli e misure. Simula con TCSIM e non manda notifiche (origine IMPORT).

### Codice complesso
Le sei regole con cui la funzione decide cosa fare:

1. Le righe sono ordinate per data, documento e posizione prima di essere elaborate, così un file in ordine
   non cronologico dà lo stesso risultato.
2. Il veicolo si trova per targa; se manca, la targa finisce in `targhe_non_trovate`.
3. Se il documento esiste già, le sue righe sono saltate e contate in `controlli_gia_presenti`.
4. "Stessa gomma" = misura + marca + DOT confrontati con `lower(btrim(…))`; una cella vuota vale uguale.
5. Pneumatico della posizione alla data d: se la stessa gomma è già montata e copre d, si usa quella; se
   nello storico c'è un pneumatico con `smontato_il`, il montaggio successivo è quello giusto; se c'è uno
   smontaggio con nuovo montaggio in d, si usa il nuovo; altrimenti la riga è saltata.
6. Stagione: quella del file, poi quella dell'ultima misura della posizione, poi dal mese (novembre–marzo
   INVERNALE, altrimenti ESTIVA).

---

## Lettura a pagine (oltre 1000 righe) (T042)

**File coinvolti:** `apps/web/src/lib/a-pagine.ts`, `caricaVeicoli`, `caricaClienti`, `caricaElencoClienti`.
**Come funziona:** PostgREST restituisce al massimo 1000 righe per richiesta (`max_rows`). `leggiTutte(pagina,
dimensione = 1000)` chiama `.range(da, a)` pagina dopo pagina finché una pagina torna più corta della
dimensione e lancia il primo errore incontrato. Gli elenchi dell'officina (veicoli, clienti, elenco clienti)
la usano, quindi oltre 1000 righe non spariscono più.

### Codice complesso
Per non perdere né ripetere righe tra una pagina e l'altra serve un `.order()` stabile prima del range:
`targa` per i veicoli, `id` per i clienti.

---

## Import: righe con errori in CSV (T029)

**File coinvolti:** `packages/shared/src/importa.ts` (`scriviCsv`, `csvRigheConErrori`),
`apps/web/src/lib/scarica.ts` (`scaricaCsv`, `scaricaJson`), `apps/web/src/pagine/importa.ts`.
**Come funziona:** nell'anteprima dell'import il pulsante "Scarica le righe con errori" scarica
`tyrecare-righe-con-errori.csv`. Il file ha le colonne originali più `errore` (messaggi uniti da " / ") e si
può correggere e reimportare. `scaricaModello` usa ora `scaricaCsv`.

### Codice complesso
`scriviCsv` scrive con `;` e `\r\n` e mette le virgolette solo quando servono. `scaricaCsv` antepone il BOM
UTF-8, così Excel legge bene le lettere accentate.

---

## Esportazione di clienti e veicoli (CSV) (T030)

**File coinvolti:** `packages/shared/src/importa.ts` (`csvClientiVeicoli`), `apps/web/src/pagine/importa.ts`,
`apps/web/src/lib/scarica.ts`, test unitari in shared ed e2e `esporta.spec.ts`.
**Come funziona:** in fondo a `/clienti/importa` la sezione "Esporta i dati" scarica un CSV con clienti e
veicoli dell'officina nelle stesse colonne del modello di import, quindi il file si reimporta senza
modifiche. Il pulsante resta disabilitato con "Preparazione…" finché i dati non sono letti.

### Codice complesso
`csvClientiVeicoli` usa `scriviCsv` e `COLONNE_IMPORT`. Una riga per veicolo con i dati del cliente; i veicoli
senza cliente hanno le colonne cliente vuote e vanno in fondo; i clienti senza veicoli hanno le colonne
veicolo vuote. Ordine per nominativo (`localeCompare('it')`), poi per targa. Un cliente senza codice e senza
veicoli esce senza chiavi e quindi non si reimporta.
`caricaPerEsportazione` legge `clienti_officina` e `veicoli` con `leggiTutte` (`.eq('officina_id')`,
`.order('id')`, `.range`), così oltre 1000 righe non si perdono. `scaricaCsv` antepone il BOM e il file
finisce con `\r\n`.

---

## Sito — intestazioni di sicurezza (T036)

**File coinvolti:** `apps/web/vercel.json`, `apps/web/src/vercel.test.ts` (Vitest).
**Come funziona:** la regola `/(.*)` aggiunge `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
`Referrer-Policy: strict-origin-when-cross-origin` e `Permissions-Policy` (camera, microfono e pagamenti
vietati; geolocalizzazione solo `self`, per "Vicino a me"). HSTS dura 2 anni, senza `includeSubDomains` né
`preload` perché il dominio non è ancora scelto (P23). Le regole di cache restano.

### Codice complesso
La CSP è `Content-Security-Policy-Report-Only`: il browser segnala le violazioni in console senza bloccare
nulla. Si rende obbligatoria dopo averle controllate sul sito pubblicato.

---

## Pulizia delle notifiche (T049)

**File coinvolti:** `supabase/migrations/20261024184000_pulizia_notifiche.sql`,
`supabase/tests/database/pulizia-notifiche.test.sql`.
**Come funziona:** il job `pulizia-notifiche` (pg_cron, ogni notte alle 1:40 UTC) chiama
`pulisci_notifiche(p_adesso)`. Cancella le notifiche lette da più di 180 giorni (dalla lettura) e tutte quelle
create da più di 365 giorni. Le notifiche recenti o non lette da meno di un anno restano.

### Codice complesso
`pulisci_notifiche` è `security definer` e gli utenti non possono chiamarla: la esegue solo il job. Il
parametro `p_adesso` permette ai test di simulare la data. Per cambiare i tempi si scrive una nuova migrazione
con `create or replace function`; per l'orario, `cron.schedule` con lo stesso nome sostituisce il job.

---

## Accettazione dei termini (T054)

**File coinvolti:** `supabase/migrations/20261024184100_termini_accettati.sql`,
`supabase/tests/database/termini.test.sql`.
**Come funziona:** `profiles` ha `termini_versione` e `termini_accettati_il`. Alla registrazione il trigger
`crea_profilo_nuovo_utente` li compila dal metadato `termini_versione`; il ruolo resta sempre CLIENTE. Per
riaccettare una versione nuova l'utente chiama `accetta_termini(p_versione)`. La registrazione web deve ancora
passare `termini_versione` nei metadati di `signUp` (lavoro di C3, T056).

### Codice complesso
La versione è tagliata dagli spazi e al massimo di 40 caratteri. Errori: `42501` se non autenticato, `22023`
con `VERSIONE_NON_VALIDA` se la versione è vuota o troppo lunga. L'utente può scrivere i due campi anche con
un update sul proprio profilo: è una sua dichiarazione, non una prova legale.

## Richiesta di affiliazione (T059)

**File coinvolti:** `supabase/migrations/20261025000100_richiedi_affiliazione.sql`,
`supabase/tests/database/affiliazione.test.sql`, `packages/shared/src/database.types.ts`.
**Come funziona:** `public.richiedi_affiliazione(ragione_sociale, partita_iva, citta, telefono?)` crea
un'officina `IN_ATTESA`; chi la chiama ne diventa `TITOLARE` e la prepara subito, mentre i clienti la vedono
solo dopo l'attivazione (policy "officine: lettura attive"). È `security definer` e solo per `authenticated`.
L'email dell'officina è quella dell'account (`auth.users`); il ruolo globale resta `CLIENTE` (lo
cambia T061).

### Codice complesso
Errori `P0001`: `GIA_IN_OFFICINA`, `PARTITA_IVA_NON_VALIDA` (solo il formato: la cifra di controllo la
verifica la pagina, T060), `RAGIONE_SOCIALE_NON_VALIDA`, `CITTA_MANCANTE`, `PARTITA_IVA_GIA_PRESENTE`; senza
utente `42501`. Un `pg_advisory_xact_lock` per account impedisce due officine da richieste contemporanee; una
`unique_violation` sulla partita IVA diventa `PARTITA_IVA_GIA_PRESENTE`.

## Link pubblico del report (T063)

**File coinvolti:** `supabase/migrations/20261025000200_link_report.sql`,
`supabase/tests/database/link-report.test.sql`, `packages/shared/src/database.types.ts`.
**Come funziona:** `crea_link_report(controllo_id)` genera un codice casuale di 128 bit, salva solo la sua
impronta SHA-256 (`impronta_codice`, la stessa degli inviti) e restituisce il codice in chiaro una volta sola;
il link scade dopo 30 giorni e più link validi possono coesistere. `revoca_link_report(controllo_id)` li
disattiva tutti. Crea e revoca solo i membri dell'officina: controllo inesistente o di un'altra officina
dà `42501`. La tabella è leggibile solo dai membri (RLS), senza scritture dirette.

### Codice complesso
`report_pubblico(codice)` (anche anon) restituisce un jsonb con le chiavi di `Report`
(`apps/web/src/lib/report.ts`; lo pneumatico solo con i campi principali) oppure `null` se il codice è
sbagliato, scaduto o disattivato. Non escono cliente, `cliente_officina_id` né telaio; le note del
controllo sì.

## Report condiviso con link pubblico (T064)

**File coinvolti:** `apps/web/src/lib/report.ts`, `apps/web/src/pagine/report.ts`,
`apps/web/src/pagine/report-pubblico.ts`, `apps/web/src/ui/cruscotto.ts`, `e2e/tests/report-pubblico.spec.ts`.
**Come funziona:** `lib/report.ts` ha le tre rpc di T063 (`crea_link_report`, `revoca_link_report`,
`report_pubblico`) e due funzioni pure, `linkReport` e `linkWhatsApp`. Nel report del controllo chi lavora
in officina apre il riquadro "Condividi il report": ogni apertura crea un link nuovo `/r?c=…` (la funzione
SQL li accumula), con "Copia" e WhatsApp; "Disattiva i link" li revoca tutti. La pagina `/r`
(`pagine/report-pubblico.ts`) legge il codice, chiama `caricaReportPubblico` e disegna lo stesso report. Ha
un contenitore senza menu (con "Salta al contenuto"), non chiama `caricaDatiUtente` né le notifiche; il
tipo `PneumaticoReport` è un Pick dei campi esposti dal jsonb pubblico.

### Codice complesso
`pagine/report.ts` — `htmlReport(report, { membro, pubblico })` è usato sia da `mostraReport` sia da `/r`:
con `pubblico` toglie modifica, condivisione e "Torna al veicolo" e ogni link alle pagine private.
`cruscotto(..., { collegamenti: false })` disegna i contagiri come immagini invece che come link a
`/pneumatico`. Il `document.title` è impostato sia in `report.ts` sia in `report-pubblico.ts` (duplicato
noto). Il codice resta nell'URL: chi ha il link vede il report fino a scadenza o revoca.

## Clienti: filtro Senza app (T033)

**File coinvolti:** `apps/web/src/pagine/clienti.ts`, `apps/web/src/styles/_prenotazioni.scss`,
`e2e/tests/clienti-filtro.spec.ts`.
**Come funziona:** `caricaElencoClienti` legge anche `profile_id`: un cliente senza app ha `profile_id`
nullo. La logica pura sta in `pagine/clienti.ts`: `senzaApp(clienti)` per il conteggio e
`filtraClienti(clienti, testo, soloSenzaApp)`, che applica prima il filtro e poi la ricerca. Le righe dei
clienti senza app riportano "Non usa l'app". Lo stile riusa `.tc-vista__voce`, che ora vale anche per i
`<button>` con `aria-pressed`.

### Codice complesso
`collegaElenco` tiene lo stato `soloSenzaApp` nella chiusura; i pulsanti `[data-senza-app]` aggiornano
`aria-pressed` e ridisegnano; "Mostra tutti i clienti" azzera anche il filtro. `data-conteggio` riflette il
risultato combinato; il "(n)" del pulsante è calcolato una volta sull'elenco completo.

## Calendario: occupazione delle fasce (T035)

**File coinvolti:** `apps/web/src/lib/calendario.ts`, `apps/web/src/pagine/calendario.ts`.
**Come funziona:** `caricaOrariECapienza` (al posto di `caricaOrari`) legge `orari` e `capienza_fascia`
insieme, a ogni apertura del calendario. L'h3 della fascia riceve "· n su c richieste" (e "· piena" se
n ≥ c) solo se la capienza non è nulla.

### Codice complesso
`occupazioneFascia(prenotazioni, data, fascia)` in `lib/calendario.ts` replica `occupazione_fascia()` del
database: RICHIESTA conta per `giorno`/`fascia` chiesti anche se ha già un `appuntamento`; PROPOSTA e
CONFERMATA per giorno e fascia dell'appuntamento (`posizioneInAgenda`, ora italiana, dalle 13:00
POMERIGGIO); senza appuntamento non contano; gli altri stati no.

## Elimina il tuo account (T039)

**File coinvolti:** `apps/web/src/lib/profilo.ts`, `apps/web/src/pagine/elimina-account.ts`,
`apps/web/src/pagine/comune.ts`, `apps/web/src/pagine/accedi.ts`, `e2e/tests/elimina-account.spec.ts`.
**Come funziona:** da Profilo → "Elimina il tuo account" (`/profilo/elimina`) si legge la spiegazione e si
conferma con "Sì, elimina". `eliminaAccount()` (`lib/profilo.ts`) chiama la funzione SQL `elimina_account`.
Le chiavi di rifiuto `TITOLARE_DI_OFFICINA`, `PRENOTAZIONI_IN_CORSO` e `ACCOUNT_AMMINISTRATORE` le traduce
`messaggioEliminazione` e le mostra il dialogo di `chiediConferma`. Il link è visibile a tutti: i casi
vietati li decide il database.

### Codice complesso
Dopo il successo `impostaConferma` (`pagine/comune.ts`) memorizza il messaggio senza navigare, poi `esci()`
fa scattare `SIGNED_OUT`, `main.ts` porta a `/accedi` e `accedi.ts` stampa `avvisoConferma()`. Non si usa
`vaiConConferma`: con la sessione ancora attiva la rotta da ospite rimanda alla home. L'ordine
`impostaConferma` prima di `esci()` è voluto.

## Conferma in sospeso sulle pagine ospite (T092)

**File coinvolti:** `apps/web/src/pagine/comune.ts`, `apps/web/src/pagine/accedi.ts`,
`apps/web/src/pagine/registrati.ts`, `apps/web/src/pagine/password-dimenticata.ts`.
**Come funziona:** `impostaConferma()` e `vaiConConferma()` di `pagine/comune.ts` salvano un messaggio
(es. "Il tuo account è stato eliminato."). La prima pagina ospite disegnata (`accedi`, `registrati`,
`password-dimenticata`) lo mostra con `avvisoConferma()` sopra il modulo e lo consuma. Le schermate
"Controlla la posta" non lo richiamano.

### Codice complesso
Un errore del modulo non ridisegna la pagina, quindi non riconsuma né perde l'avviso già mostrato. Per
l'ordine `impostaConferma` prima di `esci()` vedi "Elimina il tuo account (T039)".

## Scarica i tuoi dati (T040)

**File coinvolti:** `apps/web/src/lib/miei-dati.ts`, `apps/web/src/pagine/profilo.ts`,
`e2e/tests/miei-dati.spec.ts`.
**Come funziona:** Profilo → "Scarica i tuoi dati" produce un JSON `versione: 1` con profilo, email, schede
nelle officine, garage, prenotazioni, notifiche, commenti, officine in cui si lavora e numero di iscrizioni
push (portabilità, art. 20 GDPR). Nome file `tyrecare-i-miei-dati-AAAA-MM-GG.json` con `oggiInItalia()`.
Restano fuori `inviti_cliente`, `import_*` e `link_report` (audit dell'officina).

### Codice complesso
`raccogliMieiDati` legge con le query normali e filtri espliciti sull'id dell'utente: chi lavora in
officina vedrebbe per RLS anche le righe dei clienti. Le liste a pagine usano `leggiTutte` con
`.order('id')` (`officina_utenti` per `officina_id`, unica sotto il filtro); il garage viene da
`caricaGarage`. `componiMieiDati` (pura, testata) compone il file; delle push esce solo il conteggio:
`endpoint`, `p256dh` e `auth` non escono mai.

---

## Import controlli: controllo del file (`importa-controlli.ts`) (T044)

**File coinvolti:** `packages/shared/src/importa-controlli.ts` (e il suo test).
**Come funziona:** `controllaTabellaControlli(t, m, {oggi, soloUltimo})` legge nel browser la tabella del
file (CSV/Excel) con la mappatura `m` e restituisce `righe` valide (nel formato di `importa_controlli`,
T043), `errori` per riga, `lette` e `ignorate`. Una riga con errori non entra mai in `righe`; le righe
vuote sono saltate e contate in `ignorate`. Con `soloUltimo` resta il documento più recente di ogni targa.

### Codice complesso
- Date: ISO, `GG/MM/AAAA`, `GG-MM-AAAA`, `GG.MM.AAAA` e seriale Excel (giorni dal 1899-12-30, in UTC);
  data inesistente o futura = errore. Un numero di 1-5 cifre è letto come seriale ("2024" = 1905-07-17).
- Posizione, stagione e usura sono riconosciute senza maiuscole, spazi, `_`, `-` e accenti; i km accettano
  il punto delle migliaia.
- Un documento ha stessa targa e data in tutte le righe (riferimento: la prima) e ogni posizione una sola
  volta.
- `soloUltimo`: a parità di data vince il codice documento maggiore.
- Documento intero o niente (T094): `controllaTabellaControlli` raccoglie in un `Set` i `codice_documento`
  con almeno una riga in errore (le righe con più colonne dell'intestazione non contano: celle sfasate).
  Dopo il ciclo e prima di `soloUltimo` le righe valide di quei documenti escono da `righe` e diventano
  errori "Documento «…» non importato…" con il loro numero di riga, così un documento scartato non fa
  sparire il precedente completo. Gli errori sono ordinati per riga; `csvRigheConErrori` include anche le
  righe tolte; il conteggio `scartate` della pagina cresce da solo.

---

## Import dei controlli: la pagina (T047)

**File coinvolti:** `apps/web/src/pagine/importa-controlli.ts`, `apps/web/src/lib/importa-controlli.ts`,
rotta `pigra` in `apps/web/src/main.ts`, `e2e/tests/import-controlli.spec.ts`.
**Come funziona:** `/clienti/importa-controlli` (solo titolare) legge il file con `leggiTabella` e lo
controlla con `controllaTabellaControlli`: le righe con errori sono scartate una per una. L'anteprima
chiama `importaControlli({ simula: true })`; l'import vero usa gli stessi dati con `simula: false`.

### Codice complesso
- `leggiConteggiControlli` valida il JSON della RPC (targhe non trovate: al massimo 50).
- Con 0 controlli nuovi non c'è il pulsante. L'anteprima avvisa che i documenti con righe sbagliate
  vengono saltati per intero e si reimportano dopo aver corretto il file (T094). Il pulsante si
  disabilita subito, contro il doppio clic.
- Il link dalla pagina dell'import c'è da T052 (vedi la voce sotto).

---

## Import: collegamento ai controlli (T052)

**File coinvolti:** `apps/web/src/pagine/importa.ts`, `e2e/tests/import.spec.ts`.
**Come funziona:** in `/clienti/importa`, tra il registro degli import e "Esporta i dati", c'è la sezione
`tc-storico-controlli` con il riquadro "Hai anche lo storico dei controlli?" e il link a
`/clienti/importa-controlli`. La vede solo il titolare. Flusso consigliato: prima clienti e veicoli, poi i
controlli (che si agganciano ai veicoli già importati).

### Codice complesso
Il link è un normale `<a href>`: lo gestisce il router, senza codice di navigazione. L'e2e controlla che il
clic porti alla pagina dell'import dei controlli.

---

## Esportazione dei controlli (T041)

**File coinvolti:** `packages/shared/src/esporta.ts`, `apps/web/src/pagine/importa.ts` (pulsante).
**Come funziona:** `csvControlli(righe)` scrive l'intestazione da `COLONNE_CONTROLLI`, quindi il file si
reimporta con `controllaTabellaControlli`. Una riga per pneumatico misurato, in ordine data, targa, codice
documento, posizione (ANT_SX, ANT_DX, POST_SX, POST_DX, SCORTA). Il pulsante "Scarica i controlli" è in
`/clienti/importa`.

### Codice complesso
- Decimali con la virgola, nulli vuoti, data `AAAA-MM-GG` (un timestamp diventa il giorno italiano).
- Il web legge `misure_pneumatico` con `leggiTutte` ordinando su `controllo_id`, `pneumatico_id` (chiave
  primaria) e FK composte esplicite (`controlli!…`, `pneumatici!…`, `veicoli!…`).
- Un `codice_documento` nullo (controllo fatto in app) resta vuoto e quella riga non si reimporta (R11).

---

## Pagine pigre (`lib/pigra.ts`) (T046)

**File coinvolti:** `apps/web/src/lib/pigra.ts`, `apps/web/src/main.ts` (rotte).
**Come funziona:** ogni rotta tranne `accedi`, `registrati`, `home` e `non-trovata` usa
`mostra: pigra(() => import('./pagine/x'), 'mostraX')`: la pagina si scarica solo alla prima apertura
(`index-*.js` iniziale da 315 a 20 kB). Le rotte nuove devono usare `pigra`; più rotte dello stesso modulo
condividono un solo chunk. Il service worker precarica comunque tutti i chunk (precache 21 → 110 voci).

### Codice complesso
- Se l'import fallisce con i messaggi noti (Chrome, Safari, Firefox: tipico dopo un deploy nuovo) e
  `sessionStorage['tc-ricarica-pagina']` non c'è, `pigra` scrive il flag e ricarica; altrimenti rilancia
  l'errore. La decisione è in `deveRicaricare()` (pura, testata); il flag si toglie a ogni import riuscito.
- Corsa tra navigazioni: se l'utente cambia pagina durante l'import, la pagina in ritardo non si disegna
  (`visualizzazioneCorrente` / `ancoraAttuale`).
- Il router non gestisce ancora gli errori di caricamento (idea T095).

---

## Soglia sulla dimensione del codice iniziale (T070)

**File coinvolti:** `apps/web/scripts/dimensioni.mjs`, `apps/web/package.json` (script `build`),
`eslint.config.js`.
**Come funziona:** dopo `vite build`, `dimensioni.mjs` legge `dist/index.html`, prende `<script
type="module">`, i `modulepreload` e gli stylesheet, somma la dimensione gzip (`zlib.gzipSync`, 1 kB = 1000
byte) e stampa una riga coi numeri. Soglie: JS 70 kB (60,7 misurati il 2026-10-30, +15%), CSS 40 kB. I chunk
delle pagine ed Excel (import dinamici) non contano. Se supera: exit 1 e messaggio con cosa supera. Gira
anche in CI, che esegue `npm run build`.

### Codice complesso
- Prima si riduce il codice (`pigra()` in `main.ts`, niente import statici di `pagine/` da `main.ts` o
  `lib/`); per alzare la soglia si cambiano `SOGLIA_JS_KB`/`SOGLIA_CSS_KB` aggiornando data e misura nel
  commento, con il motivo nel messaggio di commit.
- Lo script `.mjs` è coperto da ESLint con i globali Node.

---

## Import dei controlli: valori mancanti = stessa gomma (T074)

**File coinvolti:** `supabase/migrations/20261026000100_import_controlli_mancanti.sql`,
`supabase/tests/database/import-controlli-mancanti.test.sql`.
**Come funziona:** la ricerca "1) stessa gomma" di `importa_controlli` confronta misura, marca e DOT senza
badare a maiuscole e spazi. Un valore vuoto conta come uguale da entrambe le parti: cella vuota del file
(T043) oppure valore vuoto o nullo nel database (T074). Così una gomma montata dall'app senza DOT non viene
più smontata né duplicata.

### Codice complesso
- Una gomma con tutti e tre i valori vuoti corrisponde a qualunque riga della sua posizione; se più
  pneumatici coprono la data vale il più recente (`order by montato_il desc`).
- La migrazione ricopia il corpo di T043 cambiando solo le tre condizioni (`create or replace`): firma e
  permessi invariati.
- La misura con gli indici ("205/55 R16 91V") resta una gomma diversa da "205/55 R16".

---

## Termini accettati: protetti dagli update diretti (T078)

**File coinvolti:** `supabase/migrations/20261026000200_termini_protetti.sql`,
`supabase/tests/database/termini.test.sql`.
**Come funziona:** la policy "profiles: modifica propria o admin" lascia all'utente il suo profilo, ma il
trigger `profiles_proteggi_termini` (funzione `proteggi_termini`) blocca con 42501 ogni cambio di
`termini_versione` e `termini_accettati_il`. Restano liberi admin, service role (`auth.uid()` nullo) e
`accetta_termini`; la registrazione non cambia (`crea_profilo_nuovo_utente` fa un insert).

### Codice complesso
- `accetta_termini` apre il permesso con `set_config('tyrecare.accetta_termini','si',true)` e lo richiude
  subito dopo il suo `update`, così la data resta `now()` del database (P17).
- Limite: con una connessione SQL diretta il permesso si apre da sé, via API no.

---

## Periodo delle date nell'anteprima dell'import controlli (T096)

**File coinvolti:** `apps/web/src/lib/importa-controlli.ts`, `apps/web/src/pagine/importa-controlli.ts`.
**Come funziona:** la pagina calcola il periodo sulle righe pronte da importare, lo formatta con
`formattaData` di `pagine/comune.ts` e mostra "Controlli dal X al Y" (o "Controlli del X" se la data è una
sola) in `[data-periodo]`, sotto `[data-conteggi]`. Serve a notare una colonna data letta male (es. un
numero di Excel).

### Codice complesso
- `periodoDate(righe)` in `lib/importa-controlli.ts` restituisce `{ da, a }` in formato ISO oppure `null`.
- Minimo e massimo si trovano confrontando le stringhe ISO, che si ordinano come le date; le date vuote
  sono ignorate.

---

## Import controlli: anteprima più chiara (T146)

**File coinvolti:** `apps/web/src/lib/importa-controlli.ts`, `apps/web/src/pagine/importa-controlli.ts`.
**Come funziona:** l'anteprima dice quanti documenti saltano per intero ("N documenti con righe sbagliate
verranno saltati per intero", con `plurale`, solo se ce ne sono; T176), ha un solo invito a correggere il
file (tolta la frase "Se vuoi che il controllo sia completo…") e mostra l'avviso giallo
`data-periodo-sospetto` se il controllo più vecchio ha più di 15 anni, suggerendo di controllare la colonna
«Data». Le date future restano errori di riga.

### Codice complesso
- `controllaTabellaControlli` restituisce anche `documentiSaltati`: i documenti con almeno una riga in
  errore, contati prima di `soloUltimo`.
- `periodoSospetto(periodo, oggi)` confronta `periodo.da` con `oggi` meno 15 anni come stringhe `AAAA-MM-GG`
  (niente fusi orari; il 29 febbraio funziona).

## Clienti: testi dello stato vuoto (T089)

**File coinvolti:** `apps/web/src/pagine/clienti.ts`.
**Come funziona:** `testoVuoto(testo, soloSenzaApp, haClienti)` sceglie titolo e sotto-testo dell'elenco
quando non c'è nulla da mostrare. Con "Senza app" attivo e ricerca vuota dice "Tutti i clienti usano già
l'app."; con ricerca e filtro insieme aggiunge "tra chi non usa l'app".

### Codice complesso
- La funzione è pura e restituisce testi non escapati: il chiamante usa `esc`, perché la ricerca è input
  dell'utente.
- La ricerca si considera dopo `trim()`, come in `filtraClienti`.
- Disegna sia "nessun risultato" sia "Ancora nessun cliente" (una sola fonte): un nuovo filtro dell'elenco
  si aggiunge qui, non nel template.

---

## e2e: movimento ridotto (T088)

**File coinvolti:** `e2e/playwright.config.ts`.
**Come funziona:** la config imposta `use.reducedMotion: 'reduce'`. L'app attiva l'animazione `tc-entra`
solo con `prefers-reduced-motion: no-preference` (`_componenti.scss`), quindi nei test l'animazione è
spenta come per un utente con "riduci movimento" e non sposta i pulsanti sotto il clic.

### Codice complesso
- I contesti creati con `browser.newContext()` ereditano l'opzione (Playwright Test unisce le opzioni di
  `use` in `runBeforeCreateBrowserContext`), salvo un contesto che passi la sua `reducedMotion`.

---

## Rotte segnaposto del lancio (T099)

**File coinvolti:** `apps/web/src/main.ts`, `apps/web/src/pagine/legale.ts`, `registra-officina.ts`,
`admin-officine.ts`, `admin-commenti.ts`, `per-le-officine.ts`, `report-pubblico.ts`, `abbonamento.ts`.
**Come funziona:** 8 rotte caricate con `pigra` (un chunk ciascuno). Pubbliche (`paginaAuth`): `/privacy`,
`/termini`, `/per-le-officine`, `/r`. Per utente (`paginaApp` + `intestazioneSottopagina`):
`/officina/registra`, `/officina/abbonamento`, `/admin/officine`, `/admin/commenti`. Ogni segnaposto mostra
titolo, "Pagina in preparazione." e il link alla home.

### Codice complesso
- I compiti successivi riscrivono solo il corpo mantenendo il nome della funzione esportata, senza
  toccare `main.ts`; `legale.ts` esporta `mostraPrivacy` e `mostraTermini` (un chunk).
- Le rotte `/admin/*` richiedono solo l'utente: il controllo admin lato database spetta a T061 e T103.

---

## PWA: libreria Excel fuori dal precache (T045)

**File coinvolti:** `apps/web/vite.config.ts`, `apps/web/src/lib/excel.ts`.
**Come funziona:** `workbox.globIgnores` esclude `**/xlsx-*.js`, il chunk che Rollup crea da
`await import('@e965/xlsx')` in `lib/excel.ts`. Serve solo al titolare per l'import: chi installa l'app
(clienti dal telefono) non scarica ~490 kB inutili. Una regola `runtimeCaching` `CacheFirst` (RegExp
`/\/assets\/xlsx-.*\.js$/`, cache `tc-excel`, `maxEntries: 2`) salva il file al primo uso: poi l'import
funziona anche offline e le versioni vecchie spariscono dopo un aggiornamento. Il primo import offline
non funziona.

### Codice complesso
- Se il nome del chunk cambia vanno aggiornati sia `globIgnores` sia la RegExp.
- Verifica: `grep -o 'url:"assets/xlsx[^"]*"' apps/web/dist/sw.js` deve essere vuoto.

---

## Pagine legali (informativa e termini) (T055)

**File coinvolti:** `apps/web/src/pagine/legale.ts`, `apps/web/src/lib/legale.ts`,
`DOCS/legale/informativa-privacy.md`, `DOCS/legale/termini-di-servizio.md`, `e2e/tests/legale.spec.ts`.
**Come funziona:** `pagine/legale.ts` importa i due testi da `DOCS/legale/` con `?raw` di Vite: finiscono
nel chunk lazy `legale` insieme a `marked`. `legaleInHtml` (`lib/legale.ts`) li converte in HTML; l'avviso
giallo di bozza resta finché `TESTI_LEGALI_DEFINITIVI` è `false`. Per aggiornare i testi basta modificare
i due file in `DOCS/legale/`.

### Codice complesso
- `lib/legale.ts` — `riscriviLink` riscrive i link ai file `.md` (informativa → `/privacy`, termini →
  `/termini`, altri `.md` → solo testo; link esterni e ancore invariati) e `tabindex="-1"` va sull'unico
  `h1` (il titolo del file). L'HTML viene solo dai file del repository, mai da dati degli utenti: per
  questo va in `innerHTML`.
- Dopo la revisione legale si mette `TESTI_LEGALI_DEFINITIVI = true` (sparisce l'avviso) e si aggiorna
  l'e2e `e2e/tests/legale.spec.ts`, che controlla il testo dell'avviso.
- Se cambiano i termini si aggiorna `VERSIONE_TERMINI`, che T056 salva alla registrazione.

## Report pubblico e officine sospese (T083)

**File coinvolti:** `supabase/migrations/20261028000100_report_pubblico_sospese.sql`,
`supabase/tests/database/` (test pgTAP del report pubblico).
**Come funziona:** `report_pubblico(codice)` restituisce il report solo se il link esiste, non è scaduto né
revocato e l'officina del controllo non è SOSPESA (IN_ATTESA e ATTIVA vanno bene). La sospensione non revoca i
link: li spegne finché dura; riattivata l'officina, i link non scaduti tornano a funzionare.

### Codice complesso
- `report_pubblico` è `security definer` e `sql stable`: chi apre il link è anon e non legge le tabelle. Il
  controllo sull'officina usa una join `oc` separata dalla sottoquery che cerca l'officina del veicolo: sono due
  officine diverse (quella del controllo e quella del veicolo) e non vanno confuse.
- Chi apre il link vede null in ogni caso: non distingue un codice sbagliato da un'officina sospesa.

## Attivare e sospendere un'officina (T100)

**File coinvolti:** `supabase/migrations/` (funzioni `attiva_officina` e `sospendi_officina`),
`supabase/tests/database/` (27 test pgTAP), `packages/shared/src/database.types.ts`.
**Come funziona:** `attiva_officina(id)` mette l'officina ATTIVA e promuove a OFFICINA i titolari ancora
CLIENTE (un ADMIN resta ADMIN). `sospendi_officina(id)` la mette SOSPESA, così sparisce ai clienti (la lettura
pubblica vuole ATTIVA), e lascia i ruoli invariati (R14). Stato e ruoli cambiano in una sola transazione; le
funzioni sono ripetibili.

### Codice complesso
- Possono chiamarle solo un admin o chi non ha un utente (service role); gli altri ricevono 42501 e anon non ha
  EXECUTE. Officina inesistente -> `OFFICINA_NON_TROVATA`, ma solo dopo il controllo admin, così non si rivela
  se un'officina esiste.
- In `security definer` `auth.uid()` resta quello del chiamante: il trigger `proteggi_campi_riservati` vede
  l'admin e lascia passare il cambio di ruolo dei titolari.

## Abbonamenti delle officine (T067)

**File coinvolti:** `supabase/migrations/20261028000300_abbonamenti.sql`,
`supabase/tests/database/abbonamenti.test.sql` (26 test pgTAP), `packages/shared/src/database.types.ts`.
**Come funziona:** ogni officina ha una riga in `public.abbonamenti` (chiave `officina_id`, 1:1, cancellata
con l'officina). La crea il trigger `officine_crea_abbonamento` su ogni insert in `officine`, comprese
`richiedi_affiliazione` e `crea_officina_con_titolare`: piano STARTER, stato PROVA, prova fino a oggi + 30
giorni. Le officine già esistenti ricevono la riga dalla migrazione. RLS: select per il titolare e l'admin
(l'operatore non la vede); insert, update e delete solo per l'admin; il webhook Stripe (Fase 7, T071)
scriverà con il service role. Anon non ha permessi.

### Codice complesso
- `crea_abbonamento_officina` è `security definer` con EXECUTE tolto a tutti: i trigger non controllano il
  permesso, quindi la funzione non è chiamabile da nessuno a mano.
- `piano` e `stato` sono text con check, non enum: per aggiungere un valore basta cambiare il check.
- Il titolare legge anche le colonne `stripe_*` (eventualmente da nascondere con una vista).

## Notifiche: email di riserva (T066)

**File coinvolti:** `supabase/functions/invia-notifica/index.ts`, `supabase/functions/invia-notifica/email.ts`
(+ test), `vitest.config.ts` (project `funzioni`).
**Come funziona:** in `index.ts`, dopo le push, se `inviate === 0` ed `EMAIL_NOTIFICHE=si` legge l'email del
destinatario con `auth.admin.getUserById` e compone il messaggio con `componiEmailNotifica` di `email.ts`.
Invio: POST a `https://api.resend.com/emails` con fetch (nessun SDK). La risposta aggiunge
`email: true|false`; un errore va solo in `console.error`. Variabili tutte facoltative: `EMAIL_NOTIFICHE`
(`si` per accendere), `RESEND_API_KEY`, `EMAIL_MITTENTE` (es. `TyreCare <notifiche@dominio>`), `SITO_URL`
(es. `https://dominio`).
**Per accenderla** (con il dominio verificato su Resend): `supabase secrets set EMAIL_NOTIFICHE=si
RESEND_API_KEY=<chiave-resend> EMAIL_MITTENTE="TyreCare <notifiche@<dominio>>" SITO_URL=https://<dominio>`.
**Perché è spenta (R3):** senza dominio verificato Resend non invia a indirizzi qualsiasi e un mittente non
verificato finirebbe nello spam; senza `EMAIL_NOTIFICHE=si` il comportamento è identico a prima.

### Codice complesso
- `componiEmailNotifica`: oggetto `TyreCare · <titolo>`; testo semplice e HTML con link assoluto
  `SITO_URL + link` (barre normalizzate, link vuoto -> home); `& < > " '` protetti; pulsante "Apri TyreCare";
  piede che spiega perché arriva.
- L'email parte anche quando ci sono dispositivi ma tutte le push falliscono (es. iscrizioni scadute).
- ESLint ignora `supabase/functions/**` e Deno non è nella CI: `index.ts` non è coperto da test,
  solo `email.ts`.

## Router: pagina non disponibile (T095)

**File coinvolti:** `apps/web/src/lib/router.ts`, `apps/web/src/lib/router.test.ts`.
**Come funziona:** `mostraPagina` esegue `rotta.mostra` in un `try/catch`. Se il codice della pagina non arriva
o la pagina va in errore, l'errore va in `console.error`; se la navigazione è ancora quella attuale il
contenitore mostra `riquadroPaginaNonDisponibile(url)` ("Pagina non disponibile" con "Riprova"). "Riprova" è un
link all'URL attuale: il router lo intercetta e richiama `mostraPagina`. `pigra` resta com'è (ricarica una volta).

### Codice complesso
- `ancoraAttuale(n)`: se nel frattempo l'utente è andato altrove, il riquadro non si scrive e la pagina nuova
  non si tocca.
- L'URL nel riquadro passa da `esc()`.
- I test usano `vi.stubGlobal` con oggetti finti, perché l'ambiente `web` dei test è node.

## Test di accessibilità (`e2e/tests/accessibilita.spec.ts`) (T051, T069)

**File coinvolti:** `e2e/tests/accessibilita.spec.ts`, `e2e/package.json`.
**Come funziona:** lo spec analizza con `@axe-core/playwright` (tag `wcag2a`/`wcag2aa`) le pagine pubbliche
(`/accedi`, `/registrati`, `/password-dimenticata`) e 7 pagine con accesso: home, veicolo Panda e officine del
cliente; home officina, clienti, appuntamenti e calendario del titolare. `controllaAccessibilita(page,
percorso)` attende la fine delle animazioni, lancia axe e fallisce con violazioni critical o serious (il
messaggio elenca `id` e selettori), senza escludere regole: si corregge la pagina con i token del design
system. Un test per pagina, divisi in ospite, cliente e titolare; ogni test aspetta l'h1 visibile. Una pagina
nuova si aggiunge agli array `PAGINE*`.

### Codice complesso
- Prima di analizzare si attende che nessuna animazione sia `running`: durante `tc-entra` il contrasto è
  misurato a metà transizione (falso positivo). Le animazioni finite con `fill: both` restano in
  `getAnimations()`, quindi si controlla lo stato e non la presenza.
- Un'animazione infinita su una pagina farebbe andare l'attesa in timeout.
- Gli h1 dinamici si riconoscono con regex (`/^Ciao/`, `/Panda/`).

## Accessibilità: moduli dell'officina (T105)

**File coinvolti:** `e2e/tests/accessibilita.spec.ts`, `apps/web/src/ui/modulo.ts`.
**Come funziona:** `PAGINE_TITOLARE` ha 4 pagine di modulo: `/clienti/nuovo`,
`/veicoli/nuovo?cliente=<Giulia c0…01>`, `/veicolo/controllo?id=<Panda d0…01>`, `/clienti/importa`. Il test
con gli errori preme "Salva cliente" a modulo vuoto e attende `[aria-invalid="true"]` prima di
`controllaAccessibilita`.

### Codice complesso
- Gli errori li gestisce `collegaModulo` in `ui/modulo.ts`: `aria-invalid`, messaggio in
  `#campo-<nome>-errore` collegato con `aria-describedby`, colore `--tc-rosso-testo`.
- `/veicolo/controllo` serve un veicolo con pneumatici montati, altrimenti rimanda a `/veicolo/pneumatici`
  (la Panda del seed ne ha 4; nessun e2e li smonta).

## Registra la tua officina (R7)

**File coinvolti:** `packages/shared/src/affiliazione.ts`, `packages/shared/src/index.ts`,
`apps/web/src/lib/affiliazione.ts`, `apps/web/src/pagine/registra-officina.ts`, `apps/web/src/pagine/home.ts`,
`e2e/tests/registra-officina.spec.ts`.
**Come funziona:** dalla home il cliente senza officina vede il link a `/officina/registra`. Il modulo è
validato da `RichiestaAffiliazioneSchema`; `lib/affiliazione.ts` chiama la rpc `richiedi_affiliazione` senza
riprova (non è idempotente) e traduce gli errori P0001 in `ErroreModulo`: `PARTITA_IVA_GIA_PRESENTE` sotto il
campo, `GIA_IN_OFFICINA` nel riquadro. Il telefono vuoto non viene passato. Dopo l'invio `caricaDatiUtente()`
aggiorna `membroOfficina` e la home mostra l'area officina con "Officina in attesa".

### Codice complesso
`packages/shared/src/affiliazione.ts` — `partitaIvaValida`: 11 cifre più cifra di controllo (le cifre in
posizione pari si raddoppiano, −9 se > 9; controllo = (10 − somma % 10) % 10); gli spazi vengono tolti prima.

## Accettazione dei termini alla registrazione

**File coinvolti:** `packages/shared/src/auth.ts`, `apps/web/src/lib/auth.ts`, `apps/web/src/lib/legale.ts`,
`apps/web/src/pagine/registrati.ts`, `e2e/tests/registrazione.spec.ts`, `e2e/tests/inviti.spec.ts`.
**Come funziona:** il modulo di registrazione ha la spunta "Ho letto l'informativa privacy e accetto i
termini di servizio" con link a `/privacy` e `/termini`. `registrati()` salva `termini_versione`
(`VERSIONE_TERMINI`) nei metadati di `signUp` e il trigger del database la copia nel
profilo. `accetto` non va nei metadati.

### Codice complesso
- `RegistrazioneSchema.accetto` è `z.preprocess(v => v === true || v === 'on', z.literal(true))` perché
  `FormData.get` dà `'on'` o `''`.
- La casella usa `id="campo-accetto"` e `#campo-accetto-errore` (convenzione di `modulo.ts`): `collegaModulo`
  mostra errore e `aria-invalid` senza codice nuovo.
- `VERSIONE_TERMINI` sta in `packages/shared/src/auth.ts` perché `lib/auth.ts` è nel file iniziale, mentre
  `lib/legale.ts` importa `marked`; `legale.ts` la ri-esporta.

## Amministratore: attivare e sospendere le officine (T061)

**File coinvolti:** `apps/web/src/lib/admin.ts`, `apps/web/src/pagine/admin-officine.ts`,
`apps/web/src/pagine/profilo.ts`, `e2e/tests/admin-officine.spec.ts`.
**Come funziona:** `lib/admin.ts` legge `officine` con `officina_utenti(ruolo, profiles(nome, cognome))` via
`leggiTutte` (ordine `created_at`, `id`); l'admin vede tutto per RLS e il titolare si filtra lato client.
`ordinaOfficineAdmin` mette IN_ATTESA per prime, poi `created_at` decrescente. Attivazione e sospensione
passano solo da `rpc('attiva_officina' | 'sospendi_officina')`, che controllano il ruolo nel database: la
pagina controlla `profilo.ruolo` solo per non mostrare una pagina inutilizzabile. L'errore dell'azione resta
nel dialogo di `chiediConferma`; quello della ricarica dell'elenco va a `gestisciErroreCaricamento`.
Nel Profilo dell'ADMIN la sezione "Amministrazione" mostra "Officine da attivare (n)": il conteggio usa
`count: 'exact', head: true`; se la richiesta fallisce il link compare senza numero.

### Come si diventa ADMIN in produzione (voce D9)
Dall'editor SQL di Supabase: `update public.profiles set ruolo = 'ADMIN' where id = '<uuid dell'utente>';`
(eseguito senza utente, il trigger dei campi riservati lo permette). Non c'è una schermata per farlo.

## Home officina: filtri Cambio di stagione e Da ricontrollare (T065)

**File coinvolti:** `packages/shared/src/stagioni.ts`, `apps/web/src/lib/officina.ts`,
`apps/web/src/pagine/home-officina.ts`.
**Come funziona:** `caricaVeicoli` legge anche `montati:pneumatici (stagione, posizione)`, filtrato con
`.is('montati.smontato_il', null)`: il filtro agisce sulle righe incorporate, non sui veicoli. Il campo
`stagioni` esclude la SCORTA, come il promemoria. In `home-officina.ts` `corrisponde(v, filtro, oggi)` combina
il filtro scelto con la ricerca; `nessunRisultato(testo, filtro)` sceglie il messaggio del vuoto (anche nel
caso "solo filtro"). L'aria-label del gruppo resta "Filtra i veicoli per stato" perché lo usa un e2e.

### Codice complesso
`packages/shared/src/stagioni.ts` — `gommeFuoriStagione(stagioni, oggi)` confronta `oggi.slice(5)` (MM-DD):
dal 15/10 al 14/03 sono fuori stagione le ESTIVO, dal 15/03 al 14/10 le INVERNALE, le QUATTRO_STAGIONI mai.
La finestra è più larga di quella del promemoria (che finisce al 31/05): all'officina serve tutto l'anno.
`daRicontrollare` è vero oltre 365 giorni dall'ultimo controllo (`Date.UTC` su date pure); mai controllato
vale falso.

## Pagina Abbonamento (T068)

**File coinvolti:** `packages/shared/src/abbonamenti.ts`, `apps/web/src/lib/abbonamento.ts`,
`apps/web/src/pagine/abbonamento.ts`, `apps/web/src/pagine/dati-officina.ts`.
**Come funziona:** piani e prezzi stanno solo in `PIANI`. La pagina carica il contesto e legge `abbonamenti`
solo se l'utente è titolare: l'operatore vede "Solo il titolare vede l'abbonamento." (l'RLS gliela nasconde
comunque). Il piano PILOTA mostra "Officina pilota: gratuito" prima dello stato; se la riga manca, rimanda a
«Invia un commento». La data di oggi viene da `oggiInItalia()`. Il pulsante "Attiva l'abbonamento" ora apre
il pagamento (T192, voce sotto). Dalla pagina "Dati dell'officina" c'è il link.

### Codice complesso
`packages/shared/src/abbonamenti.ts` — `giorniDiProva(provaFinoAl, oggi)` tratta `prova_fino_al` come ultimo
giorno incluso: (fine - oggi) + 1, minimo 0, con `Date.UTC`. Con il default della migrazione
(`current_date + 30`) il primo giorno mostra 31 giorni (da decidere: default +29 o "31 giorni").

## e2e: il percorso del pilota (T057)

**File coinvolti:** `e2e/tests/percorso-pilota.spec.ts`.
**Come funziona:** un test unico (timeout 180 s) copre il flusso di LA SANTI GOMME: import di clienti e
veicoli, import dei controlli, invito, registrazione del cliente, garage con lo stato rosso e storico delle
misure dello pneumatico. Il cliente usa un contesto nuovo: registrazione con i termini, conferma da Mailpit,
"Collega i miei veicoli". Le misure si contano con `.tc-misure__riga`.

### Codice complesso
- L'import non restituisce l'id del cliente: lo si cerca in `/clienti` e si legge `?id=` dalla scheda.
- Nel CSV dei controlli stagione esplicita e date passate; stessa misura/marca/modello/dot per posizione,
  così le 2 misure finiscono sullo stesso pneumatico.
- 1,5 mm su ANT_SX dà lo stato "Da sostituire" (sotto 1,6 di legge; 2,5 mm su estivo è giallo).

## Guida all'uso per le officine (T053)

**File coinvolti:** `DOCS/pilota/guida-officina.md`, `DOCS/PLAN.md` (indice).
**Come funziona:** documento unico per le officine, con una sezione per funzione. In fondo "In arrivo":
il pagamento dell'abbonamento; quando esce, la voce diventa una sezione ("Primi passi" è già un paragrafo
della §1).

### Codice complesso
- Ogni nome tra virgolette esiste tale e quale nel codice: si controlla con
  `grep -rn "<testo>" apps/web/src`.
- I testi con numeri o `plurale()` sono scritti come "Importa N righe".
- Quando cambia una voce in `pagine/` o `ui/`, la guida va aggiornata.

## Pagina pubblica per le officine (T062)

**File coinvolti:** `apps/web/src/pagine/per-le-officine.ts`, `apps/web/src/main.ts`,
`apps/web/src/lib/auth.ts`, `apps/web/src/pagine/accedi.ts`, `e2e/tests/per-le-officine.spec.ts`.
**Come funziona:** `/per-le-officine` presenta TyreCare alle officine: 4 vantaggi, 3 passi e un pulsante
verso `/registrati?dopo=/officina/registra`. Dal piede di `/accedi` c'è il link. Niente prezzi: arrivano
con l'abbonamento.

### Codice complesso
`pagine/per-le-officine.ts` — usa `paginaAuth` (h1 = titolo, corpo `.tc-officine`, piede con privacy e
termini); vantaggi e passi sono le costanti `VANTAGGI` e `PASSI`, icone lucide con `icona()`.
`lib/auth.ts` — pulsante e "Accedi" portano `?dopo=/officina/registra`; `destinazioneDopoAccesso()` manda
al modulo di registrazione, anche dopo la conferma email (`emailRedirectTo`). In `main.ts` la pagina è un
chunk separato con `pigra`.

## Bozze legali allineate al codice (T058)

**File coinvolti:** `DOCS/legale/README.md`, `DOCS/legale/informativa-privacy.md`,
`DOCS/legale/dpa-officine.md`, `DOCS/legale/registro-trattamenti.md` (A1, A2, B).
**Come funziona:** nelle bozze si scrive come fatto solo ciò che è su main. Ogni funzione nuova di
esportazione, cancellazione o pulizia va riportata in README "Da fare prima del lancio", informativa §4
e §6, DPA §13 e registro. La pulizia automatica riguarda solo `notifiche` (180/365 giorni, R6).

### Codice complesso
Il file «Scarica i tuoi dati» esclude gli inviti e i link dei report (R13): sono dati di altri o
segreti di accesso, non dati dell'interessato.

## Piano del pilota e lista di controllo del lancio (T102)

**File coinvolti:** `DOCS/pilota/piano-pilota.md`, `DOCS/pilota/lista-lancio.md`, `DOCS/PLAN.md` (indice).
**Come funziona:** due bozze per Davide. Il piano copre 8 settimane, 4 misure, avvio, cadenza, criteri per
la Fase 7 e problemi; la lista di controllo copre D3, D5, D7, decisioni, DPA, D9, violazioni, registro
accessi, copie, officina, import, primo cliente e D8.

### Codice complesso
Soglie e decisioni R1–R15 sono `[DA COMPLETARE]`. I commenti partono dalla console Supabase finché T103
non è su main: quando entra, aggiornare le due bozze.

## Guida per i clienti dell'officina (T104)

**File coinvolti:** `DOCS/pilota/guida-cliente.md`, `DOCS/PLAN.md` (indice).
**Come funziona:** guida di una pagina per i clienti, con i nomi copiati dal codice. Va riletta quando cambiano i
testi di `invito.ts`, `registrati.ts`, `profilo.ts`, `ui/stato.ts`, `ui/avvisi-push.ts`, `ui/prenotazione.ts`.

## Bozze legali: aiuto su strada e termini rinumerati (T151)

**File coinvolti:** `DOCS/legale/` (termini, informativa, registro, DPA, README).
**Come funziona:** la numerazione dei termini è cambiata (nuova §7 «Aiuto su strada», le altre §8–§16): chi cita
«termini §N» usa i numeri nuovi. L'informativa dice che la posizione si usa solo per l'aiuto su strada.

### Codice complesso
La sezione descrive una funzione solo in parte su main (T139): va riletta quando T140–T144 sono completi.

## Primi passi nella home officina (T101)

**File coinvolti:** `apps/web/src/lib/primi-passi.ts`, la home dell'officina in `apps/web/src/pagine/`,
`e2e/tests/` (spec `primi-passi`).
**Come funziona:** nella home del titolare una carta elenca 5 passi che si spuntano dallo stato reale
dell'officina, ciascuno con testo e link. Compare se almeno un passo è da fare e la carta non è nascosta;
"Nascondi" toglie la carta dal DOM e ricorda la scelta nel browser.

### Codice complesso
`lib/primi-passi.ts` — `passiPrimiPassi(stato)` è pura: dallo stato produce i 5 passi con testo, link e
`fatto`. `leggiStatoPrimiPassi(officinaId)` fa 4 query leggere: `officine` (latitudine e orari) e i
conteggi `head: true` di `servizi_officina`, `clienti_officina` e dei clienti con `profile_id` non nullo.
Posizione fatta = latitudine non nulla; orari fatti = `jsonb` non vuoto. La home legge lo stato in
parallelo solo per il titolare; se la lettura fallisce la carta non compare. "Nascondi" salva
`tc-primi-passi-nascosti-<officinaId>` in `localStorage` (con try/catch). Il focus dopo `remove()` è
descritto sotto (T181).

## Primi passi: focus dopo Nascondi (T181)

**File coinvolti:** `apps/web/src/pagine/home-officina.ts`, `apps/web/src/pagine/home-officina.test.ts`,
`e2e/tests/` (spec `primi-passi`).
**Come funziona:** "Nascondi" rimuove la carta dal DOM e il pulsante che aveva il focus sparisce, quindi il
browser tornerebbe in cima alla pagina. L'handler in `home-officina.ts` mette a fuoco l'h1 della home
(`tabindex="-1"`), senza scorrere se il titolo è già visibile. L'e2e verifica il focus con `toBeFocused`.

### Codice complesso
`home-officina.ts` — `titoloVisibile(rect, altezza)` è pura: vero se `top >= 0` e `bottom <= altezza`.
Se il titolo è visibile si usa `focus({ preventScroll: true })`, altrimenti `focus()` che lo porta in vista.

## CSV delle righe con errori: celle in più (T075)

**File coinvolti:** `packages/shared/src/importa.ts` (`csvRigheConErrori`, `scriviCsv`).
**Come funziona:** il CSV delle righe con errori non perde più le celle oltre l'intestazione: finiscono in
fondo alla colonna `errore` come "(celle in più: «a», «b»)", senza colonne nuove. Vale anche per il CSV dei
controlli (stessa funzione).

### Codice complesso
`importa.ts` — `csvRigheConErrori` taglia ancora le celle alla lunghezza dell'intestazione (modello del
file invariato); le celle oltre, se non vuote (`trim() !== ''`), vanno tra «» unite da ", " nel suffisso
` (celle in più: …)` di `errore`. Il suffisso dipende solo dalla riga. L'escape di `;` e `"` lo fa
`scriviCsv` sull'intera cella.

## Commenti degli utenti (admin, T103)

**File coinvolti:** `apps/web/src/pagine/admin-commenti.ts` (`mostraAdminCommenti`),
`apps/web/src/lib/admin.ts` (`caricaCommentiAdmin`, `nomeAutore`, `formattaDataOra`),
`apps/web/src/lib/admin.test.ts`,
`apps/web/src/pagine/profilo.ts` (link), `e2e/tests/admin-commenti.spec.ts`.
**Come funziona:** `/admin/commenti` mostra in sola lettura tutti i commenti dal più recente, con data e ora
di Roma, autore e pagina di provenienza. Il link "Commenti degli utenti" compare nel Profilo solo per
l'ADMIN. Nessuna migrazione: la sicurezza è la RLS di `commenti` ("lettura propria o admin").

### Codice complesso
`pagine/admin-commenti.ts` — `mostraAdminCommenti` controlla `ruolo === 'ADMIN'` solo per non mostrare una
pagina vuota; chi non è admin vedrebbe comunque zero righe per la RLS.
`lib/admin.ts` — `caricaCommentiAdmin()` usa `leggiTutte` ordinando per `created_at` decrescente e poi
`id`, con embed `profiles(nome, cognome)`;
`nomeAutore` restituisce '' se il profilo manca e la pagina scrive "Autore non disponibile";
`formattaDataOra` usa `Intl.DateTimeFormat` it-IT con fuso Europe/Rome. Il testo passa da `esc()` e ha
`white-space: pre-wrap`; il percorso vuoto non viene mostrato.

## Piano dell'abbonamento dall'amministratore (T106)

**File coinvolti:** `apps/web/src/lib/admin.ts` (`caricaOfficineAdmin`, `leggiAbbonamentoEmbed`,
`cambiaPianoOfficina`), `apps/web/src/lib/admin.test.ts`, `apps/web/src/pagine/admin-officine.ts`,
`e2e/tests/admin-officine.spec.ts`.
**Come funziona:** in `/admin/officine` ogni riga mostra piano e stato dell'abbonamento e un modulo "Piano" +
"Salva" che aggiorna `abbonamenti.piano`: l'officina pilota si mette su "Officina pilota" senza SQL. Lo stato
di pagamento non viene mai toccato.

### Codice complesso
`lib/admin.ts` — `caricaOfficineAdmin` fa l'embed `abbonamenti(piano, stato)`: la relazione è 1-a-1
(oggetto), ma se arriva un array lo gestisce. `leggiAbbonamentoEmbed` valida con `PianoSchema` e
`StatoAbbonamentoSchema`
e dà null se i valori sono sconosciuti. `cambiaPianoOfficina` =
`update().eq('officina_id').select().single()`: l'errore PGRST116 (0 righe: RLS o riga assente) diventa
un `ErroreModulo` chiaro. Il permesso viene solo dalla
policy "abbonamenti: modifica admin". Nella pagina select e pulsante sono disabilitati durante il salvataggio,
poi la lista si ridisegna.

## Abbonamenti: scadenza automatica della prova (T138)

**File coinvolti:** `supabase/migrations/20261031000100_abbonamenti_scadenza.sql`,
`supabase/tests/database/abbonamenti-scadenza.test.sql`, `supabase/tests/database/abbonamenti.test.sql`,
`packages/shared/src/database.types.ts`.
**Come funziona:** `prova_fino_al` è l'ultimo giorno incluso (R16). Il default è `current_date + 29`, quindi il
primo giorno si legge "mancano 30 giorni"; le officine già esistenti tengono la loro data. Ogni notte alle 0:25
UTC il job `scadenza-prove` mette SCADUTO le prove finite (R19). SCADUTO si mostra soltanto: nessun blocco.

### Codice complesso
`public.scadi_prove_abbonamento(p_oggi)` — `security definer`, eseguibile solo dal job (dal client dà 42501).
Aggiorna le righe con stato `PROVA`, piano diverso da `PILOTA` e `prova_fino_al < p_oggi`, e restituisce quante.
`p_oggi` di default è la data italiana (`now() at time zone 'Europe/Rome'`); i test la passano esplicita.
Per toglierlo: `select cron.unschedule('scadenza-prove')`.

## Pagina Abbonamento: quando mostrare il pagamento (T145)

**File coinvolti:** `apps/web/src/pagine/abbonamento.ts`, `apps/web/src/pagine/abbonamento.test.ts`,
`apps/web/src/pagine/dati-officina.ts`, `e2e/tests/abbonamento.spec.ts`.
**Come funziona:** `mostraPagamento(abbonamento)` è una funzione pura: vera solo per i piani a pagamento (non
PILOTA) con stato PROVA, SCADUTO o ANNULLATO; allora la pagina mostra il pulsante "Attiva l'abbonamento" e la
nota del pagamento. Per ATTIVO e PILOTA compare "Il tuo abbonamento è a posto: non devi fare nulla."; senza
abbonamento non compare né l'uno né l'altro. Il nome del piano è già sopra (`PIANI[piano].nome`), quindi
`testoStato` per PILOTA ("Gratuito per tutta la durata del pilota") non lo ripete.

### Codice complesso
ANNULLATO è trattato come SCADUTO (chi ha annullato deve poter riattivare): si cambia solo in
`mostraPagamento`. In `dati-officina.ts` il link Abbonamento sta in una sezione fuori dal `<form>`, per non
perdere modifiche non salvate. L'e2e verifica un'assenza (nessun link nel form): prima aspetta "Salva dati",
altrimenti conterebbe durante il caricamento e passerebbe anche senza la modifica.

## Date italiane nel database (T175)

**File coinvolti:** `supabase/migrations/20261101000240_date_italiane.sql`,
`supabase/tests/database/date-italiane.test.sql`.
**Come funziona:** `current_date` in Postgres è la data UTC: tra mezzanotte e le 2 in Italia è ancora ieri. La
migrazione usa `(now() at time zone 'Europe/Rome')::date` nei default di `abbonamenti.prova_fino_al` (+29),
`controlli.eseguito_il`, `pneumatici.montato_il` e nel controllo "data nel futuro" (e nel default del
parametro data) di `registra_controllo`, `monta_pneumatici`, `modifica_controllo`. L'app passa già la data del
dispositivo (`oggiISO()`).

### Codice complesso
I corpi delle funzioni sono quelli di 20261008130000 e 20261008150000; `create or replace` cambia il valore
di un default ma non può toglierlo. Il test controlla le definizioni (`pg_attrdef`, `pg_get_functiondef`),
così fallisce senza la migrazione a qualsiasi ora.

## Pagamento dell'abbonamento (pagina Abbonamento, T192)

**File coinvolti:** `apps/web/src/lib/abbonamento.ts`, `apps/web/src/pagine/abbonamento.ts`,
`e2e/tests/abbonamento.spec.ts`.
**Come funziona:** radio del piano (Starter/Pro) e pulsante "Attiva l'abbonamento" compaiono solo dove
`mostraPagamento` è vero (PROVA, SCADUTO, ANNULLATO; R21). `avviaPagamento` chiama la funzione
`stripe-checkout` con `{ officina_id, piano }`; se riesce, `location.assign(url)` e il pulsante resta
disattivato. L'errore diventa un `ErroreModulo` mostrato con `mostraErroreInBox`. Al ritorno da Stripe
`avvisoPagamento` (pura) legge `?pagamento=ok|annullato` e mostra l'avviso verde. Nella CI le Edge Functions
non girano: l'e2e verifica il messaggio generico.

### Codice complesso
`apps/web/src/lib/abbonamento.ts` — un errore HTTP di supabase-js è un `FunctionsHttpError` con `context` =
Response: `codiceDaErrore` ne legge il JSON `{ errore }` (se la lettura fallisce restituisce `null`).
`messaggioPagamento` mappa sei codici (PAGAMENTI_NON_ATTIVI, SOLO_TITOLARE, OFFICINA_NON_ATTIVA, PILOTA,
GIA_ATTIVO, ABBONAMENTO_DA_SISTEMARE); ogni altro codice dà "Non riusciamo ad aprire il pagamento. Riprova
tra poco." I testi stanno in `MESSAGGI_PAGAMENTO` (apostrofi dritti, come il resto dell'app).

## Intervento su strada — database (T139, R18)

**File coinvolti:** `supabase/migrations/20261031000200_intervento_strada.sql`,
`supabase/tests/database/strada.test.sql`, `packages/shared/src/database.types.ts`,
`apps/web/src/pagine/notifiche.ts` (`ICONE`).
**Come funziona:** il cliente fermo manda una richiesta con posizione, descrizione, telefono e targa facoltativa
alle officine ATTIVE con `intervento_strada` entro il loro `raggio_strada_km`. Ogni persona di quelle officine
riceve una notifica STRADA_RICHIESTA. Nessuna policy di scrittura: si passa solo dalle funzioni. I membri
leggono la riga solo quando `officina_id` è la loro, cioè dopo l'accettazione (T140): prima nessuna officina
vede posizione e telefono (R18).

### Codice complesso
`crea_richiesta_strada(lat, lon, descrizione, telefono, targa?)` — valida i dati, chiude le richieste del
cliente già scadute e rifiuta se ne ha una in corso (`RICHIESTA_GIA_APERTA`, garantito anche da un indice unico
parziale). Calcola la distanza con `distanza_km` (stessa formula di `distanzaKm`); se nessuna officina rientra
dà `NESSUNA_OFFICINA` senza salvare. `annulla_richiesta_strada` è solo del cliente e avvisa l'officina
(STRADA_ANNULLATA) se era accettata. `manutenzione_richieste_strada(p_adesso)` (job `richieste-strada`, ogni 10
minuti) prima cancella le finite da 90 giorni, poi scade le APERTE (2 ore) e chiude le ACCETTATE (24 ore).

## Intervento su strada: elenco, accettazione e chiusura (T140)

**File coinvolti:** `supabase/migrations/20261031000300_intervento_strada_accetta.sql`,
`supabase/tests/database/strada-accetta.test.sql`, `packages/shared/src/database.types.ts`.
**Come funziona:** i membri di un'officina ATTIVA, con "Offro l'aiuto su strada" e la posizione, chiamano
`richieste_strada_vicine(officina)` e ricevono le richieste APERTE non scadute entro il raggio (descrizione,
targa, distanza a 1 decimale, creazione, scadenza; dalla più recente), senza posizione, telefono né cliente.
`accetta_richiesta_strada` porta la richiesta a ACCETTATA con `officina_id` e `accettata_il`: da lì i membri
leggono la riga intera (policy T139) e il cliente riceve STRADA_ACCETTATA (link `/strada`; senza telefono:
"Resta dove sei: ti chiamerà al numero che hai indicato."). `chiudi_richiesta_strada` la porta a CHIUSA.
Errori: 42501 (non membro, requisiti mancanti, fuori raggio); RICHIESTA_NON_DISPONIBILE (assente, non aperta,
scaduta, non tua).

### Codice complesso
`accetta_richiesta_strada` — `for update` sulla riga mette in fila due accettazioni contemporanee: vince la
prima, la seconda trova la richiesta non più aperta. Il raggio si controlla dopo il blocco, sulla riga
aggiornata. Le colonne di `returns table` sono variabili plpgsql: per questo ogni colonna ha un alias in tutte
le query. La condizione "l'officina può rispondere" (ATTIVA, aiuto offerto, posizione) è ripetuta in
crea/elenco/accetta: se cambia, va cambiata in tutte e tre.

## Intervento su strada: rotte e segnaposto (T141)

**File coinvolti:** `apps/web/src/main.ts`, `apps/web/src/pagine/strada.ts`,
`apps/web/src/pagine/strada-officina.ts`.
**Come funziona:** `/strada` ("Aiuto su strada", cliente) e `/officina/strada` ("Richieste su strada",
officina) sono rotte pigre con `pigra()` in `main.ts`, come admin-commenti (T099). Le pagine sono segnaposto:
T143 e T144 riscrivono solo il proprio file. Nessun link dal resto dell'app finché non arrivano T143 e T144.

## Riaccettazione dei termini aggiornati (T142)

**File coinvolti:** `packages/shared/src/auth.ts`, `apps/web/src/lib/profilo.ts`,
`apps/web/src/pagine/home.ts`, `e2e/tests/termini-nuovi.spec.ts`.
**Come funziona:** `devonoRiaccettare(versione)` è vera solo se la versione del profilo è non nulla e
diversa da `VERSIONE_TERMINI`. `mostraHome` la controlla dopo `caricaDatiUtente` e prima del ramo officina
(vale per tutti i ruoli); `mostraRiaccetta` sostituisce la home con titolo, casella (testo e link della
registrazione), pulsante "Accetto e continuo" disattivato finché la casella non è spuntata, e "Esci". Chi ha
`termini_versione` nullo (seed, account creati dall'admin) non vede la richiesta (R20).

### Codice complesso
`accettaTerminiAttuali()` (`lib/profilo.ts`) chiama l'RPC `accetta_termini` con `VERSIONE_TERMINI`, poi si
richiama `mostraHome`: la colonna è protetta dal trigger, quindi la prova sta nel database. Gli errori
compaiono in un avviso sopra il pulsante. Costante e funzione stanno in `shared` per restare nel file
iniziale (dritta T056). Nell'e2e `nuovoAccountCliente(nome, metadati)` crea l'account con i metadati voluti.

## Partita IVA con prefisso IT (T148)

**File coinvolti:** `packages/shared/src/affiliazione.ts`,
`apps/web/src/pagine/registra-officina.ts`.
**Come funziona:** `RichiestaAffiliazioneSchema.partita_iva` normalizza con un `transform` prima del `refine`:
toglie spazi e punti e un `IT`/`it` iniziale. Alla funzione SQL `richiedi_affiliazione` arrivano solo le 11
cifre. Il campo ha `maxlength="20"`, niente `inputmode="numeric"` e l'aiuto "11 cifre, anche con IT davanti".

### Codice complesso
`partitaIvaValida` resta rigida (11 cifre e cifra di controllo): la tolleranza sta solo nello schema. "IT" in
mezzo, "FR…" o "IT" + 10 cifre danno "Partita IVA non valida". Nei test si usa `VALIDA`, perché l'esempio
"01234567890" non supera la cifra di controllo.

## Aiuto su strada (cliente, T143)

**File coinvolti:** `apps/web/src/lib/strada.ts`, `apps/web/src/lib/strada.test.ts`,
`apps/web/src/pagine/strada.ts`, `apps/web/src/pagine/home.ts`, `e2e/tests/strada.spec.ts`.
**Come funziona:** `lib/strada.ts` valida il modulo con Zod e traduce le chiavi d'errore di
`crea_richiesta_strada` e `annulla_richiesta_strada` in messaggi italiani (`MESSAGGI`, `traduci`); gli errori
di campo vanno sotto il campo. Al clic su "Usa la mia posizione e invia" `collegaModulo` valida,
`posizioneAttuale()` legge il GPS (maximumAge 60 s) e parte la RPC; la creazione non si ripete su errore di
rete (darebbe RICHIESTA_GIA_APERTA). La home ha il link "Gomma a terra? Chiedi aiuto su strada".

### Codice complesso
`richiestaInCorso()` legge la `APERTA` o `ACCETTATA` più recente filtrando per `cliente_id` dell'utente (la
RLS di `richieste_strada` fa leggere anche ai membri dell'officina che ha accettato e all'admin) e scarta lato
client quelle già scadute (`ancoraInCorso`: 2 ore per le aperte, 24 ore dall'accettazione; il job SQL
passa ogni 10 minuti). Un `setInterval` da 15 s rilegge e ridisegna solo se `id` o `stato` cambiano (un
dialogo aperto non sparisce); si ferma con `clearInterval` quando `ancoraAttuale(n)` è falso; se la
richiesta sparisce torna il modulo con la nota "La richiesta non è più in corso.". `TelefonoSchema` dà null
se vuoto: qui è reso obbligatorio con un refine.

### Sessione agenti — 2026-11-05 — ciclo 20261105-15 — T183 T158

**Fatto**

- T183: aiuto su strada del cliente: messaggio `TROPPE_RICHIESTE` per il limite orario (T173); contatore di
  generazione (`creaGenerazione()` in `lib/strada.ts`), così dopo "Annulla" una lettura già in volo non
  mostra più "La richiesta non è più in corso."; apostrofi dritti in `pagine/strada.ts` e `lib/strada.ts`.
  Un'attesa di `e2e/tests/strada-officina.spec.ts` (r.70) è stata cambiata fuori dal campo del compito.
- T158: e2e admin-officine: il badge di stato si controlla con `riga.locator('.tc-stato')` e `toHaveText` del
  testo esatto, per non confonderlo con il pulsante omonimo; tolta `contaInAttesa` (la usava solo il suo test).
- Revisione a coppia: T183 2 giri (l'annullo con `ferma()` lasciava il timer spento se falliva: ora
  `nuova()` prima e dopo l'annullo), T158 1 giro; gate del supervisore approvato 2/2.
- Prova d'insieme verde: 534 unit test, JS iniziale 63,1 kB; gli e2e si vedono in CI.
- Idea: T220 (annullo fallito durante un ridisegno + e2e della corsa), accodata in ai-org: caso raro del
  supervisore, annullo fallito mentre la lettura che chiude la richiesta è in volo.

## Aiuto su strada: limiti (T173, R23)

**File coinvolti:** `supabase/migrations/20261101000100_strada_limiti.sql`,
`supabase/tests/database/strada-limiti.test.sql`.
**Come funziona:** `crea_richiesta_strada` conta le richieste del cliente con `created_at` nell'ultima ora, in
qualsiasi stato (anche annullate o scadute): da 3 in su risponde `TROPPE_RICHIESTE`, così chi annulla e ricrea
non riempie di notifiche le officine vicine. `richieste_strada_vicine` esclude le richieste di chi chiama
(`r.cliente_id <> v_uid`): gli altri membri della stessa officina le vedono. `accetta_richiesta_strada`
risponde `RICHIESTA_NON_DISPONIBILE` sulla propria richiesta (stesso errore di una già presa).

### Codice complesso
Il controllo dei 3 all'ora viene dopo le chiusure automatiche, "una in corso" e `NESSUNA_OFFICINA`, subito
prima dell'insert; due chiamate parallele le ferma l'indice unico "una in corso". Per cambiare il limite:
migrazione nuova, messaggio in `apps/web/src/lib/strada.ts` (T183) e guida del cliente.

## Aiuto su strada, lato officina (T144)

**File coinvolti:** `apps/web/src/pagine/strada-officina.ts`, `apps/web/src/lib/strada-officina.ts`,
`apps/web/src/lib/strada-officina.test.ts`, `apps/web/src/lib/dati-officina.ts`,
`e2e/tests/strada-officina.spec.ts`.
**Come funziona:** il titolare attiva il servizio e il raggio (5–100 km) in "Dati dell'officina"; la pagina
`/officina/strada` legge `richieste_strada_vicine(officina)` e mostra le richieste con "Accetta"; le
"Accettate" (telefono, mappa, "Chiudi") vengono dalla tabella con `.eq('officina_id', …)` e passano da
`soloAccettateDi`, perché la RLS apre la lettura anche ad altri ruoli (dritta T143). Il link in home compare
solo se `officinaOffreStrada` è vero. La casella del servizio si disattiva senza posizione leggibile (regola
solo di interfaccia: le funzioni SQL richiedono comunque la posizione).

### Codice complesso
`pagine/strada-officina.ts` rilegge ogni 15 s e ridisegna solo se l'impronta JSON dell'elenco cambia (un
dialogo aperto non sparisce); il timer si ferma con `ancoraAttuale(n)` o se il contenitore esce dal DOM.
`DatiEStradaSchema` (`lib/strada-officina.ts`) valida `DatiOfficinaSchema` (ha un `transform`, non si può
estendere) e `ImpostazioniStradaSchema` sugli stessi dati, unendo gli errori col percorso del campo.
`officinaOffreStrada` sta in `lib/dati-officina.ts` e non in `strada-officina.ts`: la home è nel file
iniziale e quel modulo trascina zod e schemi (+3 kB). `salvaDatiOfficina` traduce `PGRST116` in
`ErroreModulo`; `RICHIESTA_NON_DISPONIBILE` e `42501` sono tradotti da `traduci`.

## Aiuto su strada: la casella ricorda la scelta (T209)

**File coinvolti:** `apps/web/src/lib/dati-officina.ts`, `apps/web/src/pagine/dati-officina.ts`,
`apps/web/src/pagine/strada-officina.ts`, `apps/web/src/pagine/cliente.ts`.
**Come funziona:** in `/officina/dati` la casella "Offro l'aiuto su strada" dipende dalla posizione: senza
coordinate leggibili è disattivata e non spuntata; quando tornano leggibili si riattiva con l'ultima scelta
reale. Dopo un'accettazione su strada un errore della sola rilettura non arriva più al dialogo. L'errore
dell'annullo invito usa `mostraErroreInBox` (riquadro con `tabindex="-1"`).

### Codice complesso
`apps/web/src/lib/dati-officina.ts` — `statoCasella(posizioneLeggibile, sceltaUtente)` è pura. `sceltaUtente`
parte dal valore salvato e cambia solo con l'evento `change`: impostare `checked` da codice non lo lancia.
L'e2e non salva, perché le impostazioni di Gomme Rossi sono condivise.

## Router: ricarica e home dal riquadro d'errore (T157)

**File coinvolti:** `apps/web/src/lib/router.ts`, `apps/web/src/lib/router.test.ts`.
**Come funziona:** `riquadroPaginaNonDisponibile(url)` mostra, oltre a "Riprova" (link all'URL attuale, che
non ricarica davvero), il pulsante `data-ricarica` "Ricarica l'app" e il link "Torna alla home" verso "/".

### Codice complesso
`collegaRicarica(el, ricarica)` aggancia il clic a `location.reload()` (o a una funzione finta nei test);
`mostraPagina` la chiama dopo aver inserito il riquadro, solo se la navigazione è ancora quella attuale.
Resta fuori la seconda parte dell'idea T116 (errori delle pagine lanciati con `void`).

## Uscita senza rete (T149)

**File coinvolti:** `apps/web/src/lib/supabase.ts`, `apps/web/src/lib/supabase.test.ts`,
`apps/web/src/lib/auth.ts`.
**Come funziona:** supabase-js salva la sessione in `localStorage` con chiave `sb-<primo pezzo del
dominio>-auth-token` (`chiaveSessione(url)`, l'URL viene da `VITE_SUPABASE_URL`). Se
`signOut({scope:'local'})` dà errore, `esci()` toglie la chiave a mano (try/catch: lo storage può non
essere disponibile) e rilancia l'errore (dal T174 non più: vedi "Uscita senza rete (`esci`, `lib/auth.ts`)"); vale anche per
l'eliminazione dell'account, che chiama `esci()`.

### Codice complesso
Limite: la sessione in memoria resta fino al ricaricamento (nessun SIGNED_OUT), ma al ricaricamento l'utente
non è più collegato. Nei test (ambiente node) `localStorage` e l'env sono finti con `vi.stubGlobal` /
`vi.stubEnv`, e si usano `vi.doMock` + `resetModules` perché `auth.ts` ha stato di modulo.

## Accessibilità e2e, pagine pubbliche (T154)

**File coinvolti:** `e2e/tests/accessibilita.spec.ts`, `e2e/tests/per-le-officine.spec.ts`.
**Come funziona:** `PAGINE` in `accessibilita.spec.ts` elenca le pagine da ospite, compresi
`/per-le-officine` e un percorso inesistente ("Pagina non trovata", rotta `NON_TROVATA` pubblica). Il blocco
`avvisi "Controlla la posta"` arriva allo stato di conferma del recupero password (email del seed
`cliente@tyrecare.test`, non cambia la password) e della registrazione (`emailNuova()` e casella dei
termini); entrambi usano `controllaAccessibilita` (attesa animazioni, nessuna regola esclusa).

## Soglia dimensioni: file JS più grandi (T156)

**File coinvolti:** `apps/web/scripts/dimensioni.mjs`.
**Come funziona:** se il JS iniziale supera la soglia, lo script elenca i 3 file JS più grandi (nome e kB
gzip) prima di uscire con 1; con la soglia rispettata l'output non cambia.

### Codice complesso
`gzipKbFile(p)` misura un file (controllo di esistenza ed `esci`); `gzipKb(percorsi, perFile)` somma e, se
riceve una Map, registra percorso→kB. Nel ramo errore, solo se `jsKb > SOGLIA_JS_KB`, la Map si ordina per
kB decrescente e si taglia a 3, righe con `fmt` (virgola). Se supera solo il CSS il messaggio non cambia.

## Nome mostrato di un cliente (`nominativo`, T080)

**File coinvolti:** `packages/shared/src/clienti.ts`, `packages/shared/src/index.ts`,
`packages/shared/src/importa.ts`, `apps/web/src/lib/officina.ts`.
**Come funziona:** `nominativo(c)` dà la ragione sociale se c'è, altrimenti "Cognome Nome" senza spazi in
fondo, `''` per null. La usano `csvClientiVeicoli` (export CSV) e le pagine dell'officina tramite
`apps/web/src/lib/officina.ts`, che la riesporta (gli import `from '../lib/officina'` non cambiano): così
export e app mostrano sempre lo stesso nome.

### Codice complesso
`ConNominativo` — parametro strutturale (ragione sociale, cognome, nome): accetta sia le righe di
`clienti_officina` sia `ClienteDaEsportare`, senza conversioni.

## Clienti: invito dalla lista e riga con azione (T090)

**File coinvolti:** `apps/web/src/pagine/clienti.ts`, `apps/web/src/pagine/clienti.test.ts`,
`apps/web/src/styles/_componenti.scss`.
**Come funziona:** ogni cliente è un `.tc-lista__voce` (flex) con il link della riga (`.tc-lista__riga`) e, se
`profile_id` è nullo (non usa l'app), il link "Invita" (`/cliente/invito?id=…`) come fratello: niente link
dentro link. Il nome accessibile è fisso, "Invita nell'app"; il nominativo (`<span id="tc-cliente-<id>">`) arriva
da `aria-describedby`, così il link non è omonimo di quello della riga (gli e2e cercano la riga per nome). Il
link si vede da tutti i membri, come la RPC `crea_invito_cliente`. Pattern riusabile per liste
riga+azione (CSS `__voce`, `__invita`).

### Codice complesso
`pagine/clienti.ts` — `rigaCliente()` disegna la riga; `htmlElenco(trovati, cercaGrezza, soloSenzaApp)` è la
parte pura di `disegna()` e mostra la ricerca come scritta (trim, non in minuscolo) nello stato vuoto. Nei test
di `clienti.test.ts` `ui/icone` è simulato (`vi.mock`) perché l'ambiente è node.

## Riepilogo della home officina su telefono (T147)

**File coinvolti:** `apps/web/src/pagine/home-officina.ts`, `apps/web/src/styles/_officina.scss`,
`e2e/tests/computer.spec.ts`.
**Come funziona:** il riepilogo della home officina è un `role="group"` con `aria-label="Filtra i veicoli"` e
5 pulsanti-filtro `tc-riepilogo__voce`. Il modificatore `tc-riepilogo--cinque` vale solo sotto 35.98rem:
2 colonne e `grid-column: 1 / -1` sulla quinta voce, che occupa tutta la riga. Da 36rem le colonne sono 3 e
su desktop `_desktop.scss` (non toccato) mette le voci una sotto l'altra. Il riepilogo dell'import
(`tc-riepilogo--import`) non usa il modificatore. L'e2e cerca il gruppo con
`{ name: 'Filtra i veicoli', exact: true }`.

### Codice complesso
`_officina.scss` — il limite 35.98rem (e non 36rem) evita che a 36rem esatti valgano insieme la regola da
telefono e quella da tablet.

## Pagine legali: Torna indietro che resta nel sito (T152)

**File coinvolti:** `apps/web/src/pagine/legale.ts`, `apps/web/src/pagine/legale.test.ts`,
`e2e/tests/legale.spec.ts`.
**Come funziona:** il link "Torna indietro" delle pagine legali ha `href="/"`. Al click, se
`tornaIndietroNelSito(document.referrer, location.origin, history.length)` è vera, si fa `preventDefault` e
`history.back()`; altrimenti vale l'`href` e si va a `/` (per un ospite rimanda a `/accedi`). Le pagine
legali usano `MARCHIO` esportato da `ui/layout.ts`.

### Codice complesso
`legale.ts` `referrerStessoSito(referrer, origine)` — confronta `new URL(referrer).origin` con
`location.origin` (schema, host, porta); referrer vuoto o non valido → `false` (il `try/catch` copre
l'errore di `new URL`).
`legale.ts` `tornaIndietroNelSito` — aggiunge `lunghezzaStoria > 1`: le schede nuove aperte da
`registrati.ts` e `home.ts` (`target="_blank" rel="noopener"`) hanno referrer del sito ma storia di 1 voce,
e `history.back()` non porterebbe da nessuna parte. Con il solo `history.length > 1` chi arrivava da un
link esterno usciva dal sito. In una SPA `document.referrer` resta quello del primo caricamento: in quel caso
si va a `/` (si resta nel sito).

## Controlli di base del sito: robots.txt e Lighthouse (T153)

**File coinvolti:** `apps/web/public/robots.txt`, `apps/web/src/sito.test.ts`.
**Come funziona:** `robots.txt` contiene `User-agent: *` e `Allow: /`; la riga `Sitemap:` si aggiunge quando
il dominio è scelto (R3). `sito.test.ts` (10 test) legge `robots.txt`, `index.html` e `vite.config.ts` come
testo (`node:fs`) e controlla: lang, titolo, descrizione, theme-color, viewport, apple-touch-icon, icone del
manifest (almeno 3) e che i file di `includeAssets` esistano in `public/`.

### Codice complesso
`apps/web/vercel.json` — la riscrittura `/(.*)` vale solo per i file che non esistono: senza
`public/robots.txt`, `/robots.txt` rispondeva con la pagina dell'app e il punteggio SEO calava.
`sito.test.ts` — le icone del manifest si trovano con la regex `src: '…png'` su `vite.config.ts`: se
cambia la forma del file, il test fallisce in modo chiaro. `Disallow: /` da solo è vietato,
`Disallow: /percorso` è ammesso.

## Abbonamenti: il database per Stripe (T180, R22)

**File coinvolti:** `supabase/migrations/20261102000100_abbonamenti_stripe.sql`,
`supabase/tests/database/abbonamenti-stripe.test.sql`, `packages/shared/src/database.types.ts`.
**Come funziona:** le Edge Functions di Stripe (T185, T189) girano con il service role e sono le sole a poter
chiamare tre funzioni `security definer`. `collega_cliente_stripe` collega il cliente una volta sola (diverso
→ `CLIENTE_STRIPE_DIVERSO`, senza abbonamento → `ABBONAMENTO_NON_TROVATO`). `aggiorna_abbonamento_stripe`
cerca per officina, poi per subscription, poi per customer (solo se su una riga); accetta
ATTIVO/SCADUTO/ANNULLATO e piani STARTER/PRO o nullo (PILOTA solo ADMIN); riferimenti Stripe con `coalesce`.
`registra_evento_stripe` dà `true` solo la prima volta.

### Codice complesso
`stripe_eventi` ha RLS senza policy e nessun permesso per gli utenti dell'app. `pulisci_eventi_stripe()` gira
dal job `pulizia-eventi-stripe` (0:35 UTC, eventi oltre 30 giorni); si toglie con
`cron.unschedule('pulizia-eventi-stripe')`.

## Webhook di Stripe (`supabase/functions/stripe-webhook`, T185)

**File coinvolti:** `supabase/functions/stripe-webhook/index.ts`, `firma.ts`, `eventi.ts` e i test
`firma.test.ts`, `eventi.test.ts`.
**Come funziona:** `index.ts` accetta solo POST (405), risponde 503 senza segreto e 400 per firma o JSON non
validi; un evento già in `stripe_eventi` dà 200 duplicato, altrimenti chiama la rpc e poi registra l'evento.
Errore DB → 500 senza registrare, così Stripe ritenta. Deploy:
`supabase functions deploy stripe-webhook --no-verify-jwt`.

### Codice complesso
`firma.ts` legge `t` e tutti i `v1` di `Stripe-Signature`, calcola HMAC-SHA256 di `${t}.${corpo grezzo}` con
`whsec_…`, confronta a tempo costante, tolleranza 300 s. `eventi.ts` traduce `checkout.session.completed`
(mode subscription, officina da `client_reference_id`, ATTIVO) e `customer.subscription.created|updated|deleted`
(officina da `metadata.officina_id`, stato da `status`, deleted = ANNULLATO, piano dal primo prezzo). Id
officina non uuid → null; status da ignorare (`incomplete`) → nessun aggiornamento.

## Webhook di Stripe: errori permanenti ed eventi ignorati (T212)

**File coinvolti:** `supabase/functions/stripe-webhook/eventi.ts`, `index.ts` e i loro test.
**Come funziona:** se il database rifiuta un evento con un errore che non cambierà mai, il webhook
lo scarta: scrive nel log, registra l'evento in `stripe_eventi` e risponde 200
`{ ricevuto: true, scartato: '<chiave>' }`. Gli altri errori restano 500, così Stripe ritenta.
Dopo un aggiornamento riuscito rilegge `stripe_subscription_id` dell'officina: se è diverso da quello
dell'evento (evento ignorato da T224), `console.warn` con le due subscription. È solo diagnostica.

### Codice complesso
`errorePermanente` (`eventi.ts`) confronta in modo esatto, non per sottostringa, con
`ABBONAMENTO_NON_TROVATO`, `STATO_NON_VALIDO`, `PIANO_NON_VALIDO`, `CLIENTE_STRIPE_DIVERSO` e
`SUBSCRIPTION_DI_ALTRA_OFFICINA`. Con un 500 Stripe ritenta per tre giorni e poi disattiva l'endpoint: per
questi errori non serve. `subscriptionIgnorata` decide se loggare l'evento ignorato.

## Uscita senza rete (`esci`, `lib/auth.ts`, T174)

**File coinvolti:** `apps/web/src/lib/auth.ts`, `apps/web/src/lib/auth.test.ts`.
**Come funziona:** con `scope: 'local'` e senza rete `signOut` dà errore, non cancella la sessione salvata e
non emette `SIGNED_OUT`. `esci()` allora rimuove `sb-<ref>-auth-token` (`chiaveSessione`), azzera la variabile
`sessione` e fa `location.assign('/accedi')` (ricarica completa, nessuno stato vecchio). Con rete resta il
flusso `SIGNED_OUT` → `vaiA('/accedi')` di `main.ts`.

### Codice complesso
L'errore non si rilancia: i `catch` dei chiamanti valgono solo per altri errori, e un messaggio di
`impostaConferma()` messo prima di `esci()` si perde senza rete.

## Box d'errore comune (`pagine/comune.ts`, T178)

**File coinvolti:** `apps/web/src/pagine/comune.ts`, `apps/web/src/pagine/comune.test.ts`,
`apps/web/src/pagine/home.ts`, `apps/web/src/pagine/profilo.ts`.
**Come funziona:** `htmlErrore(msg)` costruisce `<p class="mb-0">` con `esc`; `mostraErroreInBox(box, msg)`
scrive l'HTML, toglie `hidden` e dà `focus()` (il riquadro ha `tabindex="-1"` e `role="alert"`);
`nascondiBox(box)` rimette `hidden`; entrambe accettano `null`. Il chiamante passa `messaggioErrore(errore)`.

### Codice complesso
Test solo sulla parte pura (vitest web in node).

## e2e: aiuti per invito e CSV dei controlli (T155, T177)

**File coinvolti:** `e2e/tests/aiuti.ts`, gli spec di inviti, percorso del pilota e import dei controlli.
**Come funziona:** `registratiDalLinkInvito(page, link, { nome, cognome, email })` fa il percorso del
cliente: link, "Crea account", modulo con termini, "Controlla la posta", conferma da Mailpit, "Collega i
miei veicoli", home; un cambio di testo del flusso si corregge lì. `csvControlli(righe)` aggiunge
l'intestazione `COLONNE_CONTROLLI` (15 colonne), unisce i campi con `;` e le righe con `\r\n`; ogni riga è
un array di 15 stringhe (ultimo `''` per `note`); gli spec ne fanno `Buffer.from(csv, 'utf8')`.

### Codice complesso
Targhe di test con un prefisso proprio (`UC` + ultimi 6 di `id` in "unisci clienti") e
`getByText(targa, { exact: true })`: una targa non in formato italiano resta com'è nella scheda e, senza
`exact`, può coincidere con un pezzo del cognome `Primo${id}` (T177).

## e2e: partita IVA scritta come in fattura (T182)

**File coinvolti:** `e2e/tests/registra-officina.spec.ts`.
**Come funziona:** `partitaIvaUnica()` genera una partita IVA con la cifra di controllo calcolata; il test la
digita come `IT ` + gruppi di 3 cifre. `RichiestaAffiliazioneSchema` toglie spazi, punti e `IT` iniziale, e in
`/admin/officine` l'amministratore la vede a 11 cifre.

### Codice complesso
La riga in `/admin/officine` deve contenere `P. IVA <11 cifre> · Torino` e non `P. IVA IT`; il controllo
va fatto dopo l'attesa della riga, altrimenti passa su una lista ancora vuota.

## Test delle funzioni pure di lib/ (html, officina, dati-officina, T187)

**File coinvolti:** tre file `*.test.ts` nuovi in `apps/web/src/lib/` (per `html`, `officina`,
`dati-officina`).
**Come funziona:** i test importano `./officina` e `./dati-officina` simulando `./supabase` con
`getSupabase: () => ({})`. Coprono `esc`, `officinaAttiva`/`eTitolare`/`giaSalvato` e `testoPosizione`.

### Codice complesso
Ambiente vitest `node`: `localStorage` è simulato con `vi.stubGlobal` (una `Map` in memoria o funzioni che
lanciano). `OfficinaUtente` arriva dall'helper `officina(id, ruolo)`. Gli errori Supabase sono oggetti
`{ code, message }` perché `codiceErrore` legge `code`.

## Checkout di Stripe (T189, R22)

**File coinvolti:** `supabase/functions/stripe-checkout/index.ts`, `checkout.ts` (stessa cartella),
`supabase/functions/_shared/stripe.ts`.
**Come funziona:** il titolare sceglie STARTER o PRO e l'Edge Function risponde con l'URL del pagamento
Stripe (solo carta). `index.ts` cabla Deno e il service role; il flusso sta in `checkout.ts`
(`gestisciCheckout(richiesta, { env, fetchFn, db })`), così Vitest lo prova senza Deno. Nessun SDK: gli aiuti
comuni (per T195) sono in `_shared/stripe.ts` e usano `fetch`.

### Codice complesso
Ordine dei controlli: OPTIONS 204 → 503 PAGAMENTI_NON_ATTIVI (senza chiavi) → 401 (`auth.getUser`) →
400 → 403 SOLO_TITOLARE → 409 OFFICINA_NON_ATTIVA → 404 → 409 PILOTA/GIA_ATTIVO (T189b). Senza
`stripe_customer_id` crea il cliente e chiama
`collega_cliente_stripe` prima della sessione; se fallisce per una richiesta contemporanea usa il cliente già
collegato. La sessione porta `client_reference_id`, `subscription_data[metadata][officina_id]` e
`payment_method_types[0]=card`. Il messaggio di Stripe va solo nel log (risposta 502 STRIPE). Una sola
subscription per officina: vedi la voce seguente (T189b).

## Checkout di Stripe: una sola subscription per officina (T189b)

**File coinvolti:** `supabase/functions/stripe-checkout/checkout.ts`, `supabase/functions/_shared/stripe.ts`
e i loro test.
**Come funziona:** dopo SOLO_TITOLARE, `gestisciCheckout` legge l'officina con `db.officina()`: assente o non
ATTIVA → 409 `OFFICINA_NON_ATTIVA`; poi ABBONAMENTO_NON_TROVATO, PILOTA, GIA_ATTIVO. Con abbonamento SCADUTO
e `stripe_subscription_id` pieno (pagamento fallito, subscription ancora viva) risponde 409
`ABBONAMENTO_DA_SISTEMARE`: si sistema dal portale. SCADUTO senza subscription apre il checkout. I codici
nuovi li mostra la pagina «Abbonamento» (T192).

### Codice complesso
`chiamaStripe` (`_shared/stripe.ts`) accetta `{ chiaveIdempotenza }` come quinto argomento e lo manda come
intestazione `Idempotency-Key`. Il cliente si crea con `cliente-<officina_id>`: Stripe la ricorda 24 ore e
restituisce lo stesso cliente, così due richieste insieme non lasciano clienti doppi (T218). Con parametri
diversi, o con la prima richiesta ancora in corso, Stripe dà errore → 502 STRIPE (limite accettato).

## Stripe: una sola subscription per officina (T224, R30)

**File coinvolti:** migrazione `20261106000100`, pgTAP
`supabase/tests/database/stripe-una-subscription.test.sql` (31 asserzioni, verificate dalla CI).
**Come funziona:** con abbonamento ATTIVO e subscription collegata, `aggiorna_abbonamento_stripe` ignora senza
errore gli eventi di un'altra subscription (es. una vecchia annullata dopo un nuovo checkout): il webhook
registra l'evento, risponde 200 e Stripe non lo rimanda. Con SCADUTO o ANNULLATO la subscription nuova si
salva. `rifiuta_affiliazione` non cancella un'officina con `stripe_subscription_id` non nullo
(`ABBONAMENTO_STRIPE_PRESENTE`): prima si annulla la subscription.

### Codice complesso
La riga si legge con `for update`: due eventi contemporanei passano uno alla volta. Il vincolo `unique` su
`stripe_subscription_id` diventa `SUBSCRIPTION_DI_ALTRA_OFFICINA` (`exception when unique_violation`, con
`if not found` dopo il blocco). L'evento ignorato lo logga il webhook, che tratta anche le chiavi nuove
(T212).

## Avvisi e rifiuto dell'affiliazione (T191, R24)

**File coinvolti:** migrazione `20261105000100_affiliazione_avvisi.sql`, pgTAP
`supabase/tests/database/affiliazione-avvisi.test.sql` (32 asserzioni).
**Come funziona:** `richiedi_affiliazione` avvisa ogni ADMIN (`AFFILIAZIONE_RICHIESTA`, link
`/admin/officine`); `attiva_officina` avvisa i titolari (`AFFILIAZIONE_ATTIVATA`); la nuova
`rifiuta_affiliazione(p_officina_id, p_motivo)` avvisa i membri (`AFFILIAZIONE_RIFIUTATA`, link
`/officina/registra`) e cancella l'officina IN_ATTESA, liberando la partita IVA.

### Codice complesso
`attiva_officina` avvisa solo se l'update ha cambiato lo stato (`get diagnostics row_count`); il
link è `/clienti/importa` perché `notifiche.link` non accetta `/`. `rifiuta_affiliazione` è per admin o senza utente
(42501), usa `for update` e dà MOTIVO_TROPPO_LUNGO, OFFICINA_NON_TROVATA, OFFICINA_NON_IN_ATTESA; gli avvisi
partono prima del delete. Il cascade cancella il resto; commenti e richieste su strada vanno a `set null`.
Il ruolo OFFICINA resta (R14).

## Scheda veicolo dell'officina: età delle gomme (T186)

**File coinvolti:** `apps/web/src/pagine/veicolo.ts` (con il suo test); usa `lib/salute.ts`.
**Come funziona:** ogni pneumatico montato mostra l'età dal DOT ("DOT 3820 · 6 anni e 1 mese"). Sopra
l'elenco compare una sola volta l'avviso giallo `tc-avviso--giallo` "Gomme con più di 5 anni: consiglia la
sostituzione", se almeno una gomma supera la soglia `MESI_GOMMA_VECCHIA`. Report e garage del cliente usano
ancora `descrizionePneumatico`, che non cambia.

### Codice complesso
`descrizioneConEta(p, oggi)` compone `descrizionePneumatico` con l'età (`mesiDalDot` e `formattaEta`); senza
DOT valido non aggiunge nulla. `avvisoGommeVecchie(pneumatici, oggi)` restituisce l'avviso se `gommeVecchie`
è maggiore di 0; conta anche la scorta, come `home.ts`. Sono funzioni pure con `oggi` come argomento: la
pagina passa `oggi()`.

## Prezzi sulla pagina per le officine (T188, R29)

**File coinvolti:** `apps/web/src/pagine/per-le-officine.ts`, e2e della pagina.
**Come funziona:** la pagina pubblica mostra le carte di Starter e Pro con prezzo e funzioni letti da `PIANI`
(`@tyrecare/shared`), allineati con "Abbonamento". Sotto c'è la frase "30 giorni di prova gratuita: non serve
la carta per iniziare." e tra i vantaggi "Aiuto su strada". La decisione R29 supera R5.

### Codice complesso
`cartaPrezzo` è una copia locale della forma di `cartaPiano` di `abbonamento.ts`: non si importa perché
dipende da Supabase e gonfierebbe la pagina pubblica pigra. Gli h3 hanno id `tc-prezzo-<PIANO>`. La griglia
è `auto-fit` con `minmax(min(100%, 14rem), 1fr)`, così sul telefono va a capo. L'e2e legge nome e prezzo da
`PIANI`.

## Bozze legali: abbonamento e pagamenti con Stripe (T190)

**File coinvolti:** `DOCS/legale/` (termini §10, informativa, registro dei trattamenti scheda A7, README
domanda 16).
**Come funziona:** le bozze descrivono il pagamento come non ancora attivo (R22) e non danno cifre: i prezzi
stanno solo in `PIANI`. Il ruolo privacy di Stripe è aperto nel registro (A7) e non è affermato né
nell'informativa né nei termini, che rimandano alla domanda 16 per il consulente. Informativa e A7 elencano
cosa TyreCare conserva (piano, stato, fine prova, id cliente e abbonamento Stripe) e cosa manda a Stripe
(email del titolare, ragione sociale, id dell'officina). Con il portale (T195/T200) va completata la regola
di annullamento.

## Avviso di aggiornamento dell'app (`ui/aggiornamento.ts`, T193)

**File coinvolti:** `apps/web/src/ui/aggiornamento.ts` (con il suo test), `apps/web/src/main.ts`, stili
`.tc-aggiornamento`.
**Come funziona:** `main.ts` chiama `mostraAvvisoAggiornamento(() => void updateSW(true))` quando il service
worker segnala una nuova versione (`onNeedRefresh`), al posto di `confirm()` che bloccava la pagina. Il
riquadro `tc-avviso--info` con `role="status"` è fisso sopra la barra di navigazione (`$tc-bottomnav-h` +
safe-area + .75rem), con sfondo opaco e ombra; su desktop nessuna media query (centrato sul viewport).
"Aggiorna" si disattiva dopo il clic, "Più tardi" rimuove il riquadro (ricompare alla prossima
segnalazione). Il testo è statico; il modulo non ha dipendenze e sta nel file iniziale. Il test unitario
copre solo l'HTML (vitest web gira in ambiente node).

### Codice complesso
`apps/web/src/ui/aggiornamento.ts:19` — `aggiornaCorrente` è una variabile di modulo: tiene il callback
dell'avviso aperto, così una seconda chiamata ne sostituisce solo il callback invece di creare un'altra copia.
`apps/web/src/ui/aggiornamento.ts:24` — `document.querySelector('[data-aggiornamento]')` fa uscire subito
se il riquadro c'è già: l'unicità si controlla nel DOM, non con un flag.

## Accessibilità e2e: pagine dell'aiuto su strada e dell'abbonamento (T194)

**File coinvolti:** `e2e/tests/accessibilita.spec.ts`.
**Come funziona:** `/strada` (cliente), `/officina/strada` e `/officina/abbonamento` (titolare) sono negli
array `PAGINE_CLIENTE` e `PAGINE_TITOLARE` e passano da `controllaAccessibilita` (attesa delle animazioni,
WCAG 2 A/AA, nessuna regola esclusa). `/strada` si analizza nello stato "modulo di richiesta", prima
dell'invio e senza permesso di posizione; le altre due come titolare di Gomme Rossi. Non sono coperti gli
stati "richiesta in corso" di `/strada` e "servizio non attivo". `/officina/strada` si ridisegna ogni 15 s
(`INTERVALLO_AGGIORNAMENTO_MS`): un errore axe saltuario in CI su quel caso nasce da lì.

## e2e: ingresso di un'officina nuova (T202)

**File coinvolti:** `e2e/tests/ingresso-officina.spec.ts`.
**Come funziona:** percorso completo di un'officina nuova: richiesta, avviso all'admin, attivazione, avviso
al titolare, home attiva. L'utente nuovo e l'admin lavorano in due contesti del browser. I testi degli avvisi
vengono dalla migrazione `20261105000100_affiliazione_avvisi.sql` (T191). A fine test l'admin sospende
l'officina, per non lasciarla visibile agli altri test nel database condiviso.

### Codice complesso
`e2e/tests/ingresso-officina.spec.ts` — le notifiche si trovano con `.tc-notifica` filtrata per la ragione
sociale unica: l'admin ne riceve una per ogni officina registrata dagli e2e.
`e2e/tests/ingresso-officina.spec.ts` — la home attiva si riconosce da "Area officina · <ragione>";
l'assenza di "Officina in attesa" si asserisce solo dopo, per non dare un falso positivo durante il
caricamento.
`e2e/tests/ingresso-officina.spec.ts` — aprire `/notifiche` con l'admin segna le sue notifiche come lette
(nessun e2e le conta).
`e2e/tests/aiuti.ts` — le partite IVA valide degli e2e vengono da `partitaIvaUnica()`: non ridefinirla negli
spec (T223).

## Aiuto su strada: annullo fallito (T220)

**File coinvolti:** `apps/web/src/pagine/strada.ts`, `e2e/tests/` (e2e dell'annullo su strada).
**Come funziona:** se l'annullo di una richiesta su strada fallisce, la pagina sotto il dialogo si ridisegna
e il dialogo mostra l'errore. Se l'annullo riesce, il ramo è invariato. L'e2e usa una richiesta finta,
perché nessuna officina del seed offre il servizio: mock di GET `richieste_strada` (oggetto o array secondo
`accept`) e POST `rpc/annulla_richiesta_strada` (400 `RICHIESTA_NON_DISPONIBILE`).

### Codice complesso
`apps/web/src/pagine/strada.ts` — l'`azione` dell'annullo fa `generazione.nuova()` prima dell'annullo, per
scartare le letture in volo; se fallisce chiama `nuova()` di nuovo e `void disegna()` senza await
(`disegna()` chiama `ferma()`, rilegge lo stato e riaccende il timer), poi rilancia l'errore.
`apps/web/src/pagine/strada.ts` — l'errore lo mostra il dialogo (`chiediConferma`), che sta in
`document.body` e non viene toccato dal ridisegno. Dopo la chiusura il focus finisce sul body, perché il
pulsante d'origine è stato ridisegnato (T228).

## `esci()` non lancia: niente try/catch attorno (T227)

**File coinvolti:** `apps/web/src/lib/auth.ts` (`esci()`, invariato), `apps/web/src/pagine/comune.ts`,
`home.ts`, `profilo.ts`, `elimina-account.ts`, `invito.ts`, `appuntamenti.ts`.
**Come funziona:** `esci()` assorbe l'errore di signOut: senza rete toglie la sessione da storage e memoria
e ricarica `/accedi`. Le pagine fanno `await esci()` senza try/catch; un catch ha senso solo se copre altre
chiamate (come `mostraPagina()` in `invito.ts`). `getSupabase()` lancia solo con la configurazione mancante.
Gli errori d'azione si mostrano con `mostraErroreInBox(box, testo)` di `comune.ts`, e `nascondiBox` va
chiamato prima di una nuova azione.

### Codice complesso
`apps/web/src/pagine/comune.ts` — `mostraErroreInBox` dà il focus al riquadro: il riquadro deve avere già
`tabindex="-1"` nel markup (T227 lo ha aggiunto al riquadro "email diversa" dell'invito), altrimenti
`focus()` non ha effetto e lo screen reader non legge l'errore.
`apps/web/src/pagine/elimina-account.ts` — il ramo `if (sessioneCorrente())` è quasi irraggiungibile: resta
(idea T214).

## Portale clienti di Stripe (`supabase/functions/stripe-portale/`, T195)

**File coinvolti:** `supabase/functions/stripe-portale/index.ts`,
`supabase/functions/stripe-portale/portale.ts`, `supabase/functions/stripe-portale/portale.test.ts`.
**Come funziona:** `index.ts` (Deno, service role) passa variabili, `fetch` e 3 letture (utente del JWT,
ruolo in `officina_utenti`, `abbonamenti.stripe_customer_id`) a `gestisciPortale` di `portale.ts`, provato
con vitest (project `funzioni`). Il titolare chiama la funzione con `{ officina_id }` e riceve `{ url }`:
nel portale cambia carta o annulla, poi torna su `/officina/abbonamento`. Le modifiche fatte nel portale
tornano all'app dal webhook (T185). Il portale va attivato nella dashboard di Stripe (T204), altrimenti la
risposta è 502.

### Codice complesso
`portale.ts` — i controlli sono quelli del checkout e nello stesso ordine (CORS, 405, 503
`PAGAMENTI_NON_ATTIVI` senza `STRIPE_SECRET_KEY` o `SITO_URL`, 401, 400, 403 `SOLO_TITOLARE`), poi 404
`ABBONAMENTO_NON_TROVATO` e 409 `NESSUN_PAGAMENTO` senza cliente Stripe. `chiamaStripe(…,
'billing_portal/sessions', …)` riceve customer e `return_url` (`SITO_URL` senza `/` finale +
`/officina/abbonamento`) e dà 200 `{ url }`; errore di Stripe o sessione senza url → 502 `STRIPE`; errore
del database → 500 `DATABASE`; i messaggi restano nel log. Di proposito non si controllano stato
dell'officina né piano: chi ha un cliente Stripe deve poter annullare o sistemare la carta anche da
SOSPESA, PILOTA o SCADUTO (un `past_due` resta vivo).

## Pulizia automatica delle prenotazioni (T197)

**File coinvolti:** `supabase/migrations/20261106000200_pulizia_prenotazioni.sql`,
`supabase/tests/database/pulizia-prenotazioni.test.sql` (pgTAP, in CI).
**Come funziona:** `public.pulisci_prenotazioni(p_oggi date)` cancella le prenotazioni con
`giorno < p_oggi - 24 mesi`, in qualsiasi stato, e restituisce quante; il giorno esattamente 24 mesi prima
resta (R25). La lancia solo il job pg_cron `pulizia-prenotazioni`, ogni giorno alle 00:45 UTC.

### Codice complesso
`p_oggi` di default è il giorno italiano (`(now() at time zone 'Europe/Rome')::date`); i test passano la
data. La funzione è `security definer`: utenti e anon ricevono `42501`. Le notifiche collegate
(`notifiche.prenotazione_id`, `on delete cascade`) si cancellano con la prenotazione. Per cambiare i tempi
(R25): nuova migrazione con `create or replace function`; per l'orario `cron.schedule` con lo stesso nome.

## Ripetizione del salvataggio: `giaSalvato` con vincolo esatto (T217)

**File coinvolti:** `apps/web/src/lib/officina.ts` (`giaSalvato`) e il suo test.
**Come funziona:** `giaSalvato(error, tabella)` dice se, dopo una ripetizione per errore di rete, il primo
tentativo era già arrivato al database. L'id lo sceglie il client, quindi `23505` sulla chiave primaria vuol
dire "record già presente" e l'errore non va mostrato.

### Codice complesso
`apps/web/src/lib/officina.ts` — il nome del vincolo si cerca tra virgolette doppie (`"<tabella>_pkey"`),
come lo scrive Postgres, e non come sottostringa: altrimenti `x_veicoli_pkey` con tabella `veicoli`
risultava già salvato e l'errore spariva. Se Postgres cambiasse il formato del messaggio, i test con il
messaggio reale lo rivelano.

## Rifiuto delle richieste di affiliazione dall'app (T196)

**File coinvolti:** `apps/web/src/pagine/admin-officine.ts`, `apps/web/src/lib/admin.ts`
(`rifiutaAffiliazione`, `ERRORI_RIFIUTO`), `e2e/tests/admin-rifiuta.spec.ts`.
**Come funziona:** le officine IN_ATTESA hanno «Rifiuta la richiesta» (stile `tc-pulsante-elimina` con
`mt-0`) accanto ad «Attiva». `chiediConferma` → `rifiutaAffiliazione(id)` →
`rpc('rifiuta_affiliazione', { p_officina_id })`, senza motivo dalla pagina. La funzione SQL avvisa i membri
(«Richiesta non accettata») e cancella l'officina: la partita IVA torna libera.

### Codice complesso
`apps/web/src/lib/admin.ts` — `ERRORI_RIFIUTO` traduce `OFFICINA_NON_TROVATA`, `OFFICINA_NON_IN_ATTESA`,
`ABBONAMENTO_STRIPE_PRESENTE` (prima si annulla la subscription su Stripe) e `MOTIVO_TROPPO_LUNGO`; `42501`
→ «Solo l'amministratore può farlo.»; gli altri errori si rilanciano (`Object.hasOwn`, non `in`).
`admin-officine.ts` — dopo il ridisegno il focus va all'`h1` alla chiusura del dialogo (evento `close`,
una volta sola): con il dialogo modale aperto la pagina è inerte e il focus non si può spostare prima.

## Email di riserva: preferenza dell'utente (T199)

**File coinvolti:** `supabase/migrations/20261107000200_email_notifiche.sql`,
`supabase/functions/invia-notifica/index.ts` (`inviaEmailDiRiserva`), `supabase/functions/invia-notifica/email.ts` (`PIEDE`),
`supabase/tests/database/email-notifiche.test.sql`.
**Come funziona:** `profiles.email_notifiche` (boolean, not null, default true) dice se l'utente vuole le
email di riserva. La modifica solo il proprietario o l'admin (policy «profiles: modifica propria o admin»);
non c'è un trigger di protezione, perché è una scelta e non una prova. `EMAIL_NOTIFICHE` resta spenta (R9);
il raggruppamento delle email (R26) non è fatto. «Scarica i tuoi dati» usa `select('*')`: la colonna entra da
sola.

### Codice complesso
`invia-notifica/index.ts` — `inviaEmailDiRiserva` legge la colonna con la service role prima di chiamare
Resend: con `false`, profilo assente o errore di lettura non parte nessuna email e la risposta è
`email: false`. `email.ts` — `PIEDE` è unico per «nessun dispositivo» e «push fallite» e dice dove spegnere le
email (pagina Notifiche: l'interruttore arriva con T198).

## Import dei controlli: completamento della stessa gomma (T203, R27)

**File coinvolti:** `supabase/migrations/20261107000300_import_controlli_completa.sql` (`importa_controlli`),
`supabase/tests/database/import-controlli-completa.test.sql`.
**Come funziona:** dopo la ricerca «1) stessa gomma» c'è il passo «1b»: ognuno tra `misura`, `marca` e `dot`
vuoto o nullo nel database prende il valore del file (`btrim`, senza minuscole, come l'insert). I campi
pieni non si sovrascrivono: se sono diversi è un'altra gomma (R15) e si smonta e si monta. `modello` non si
completa. In simulazione l'update si annulla. La risposta e `import_log` non hanno contatori nuovi.

### Codice complesso
`importa_controlli`, passo 1b — l'update parte solo se almeno un campo cambia, così un reimport non tocca
`updated_at`. Una gomma con i tre campi vuoti corrisponde a qualunque riga della sua posizione: la completa
la prima riga in ordine di data (poi codice documento). Si completa anche una gomma già smontata, se copre
la data della riga. Il reimport salta i documenti già presenti prima del passo 1b: per provare il passo
serve un documento nuovo.

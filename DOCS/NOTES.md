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
- **Condivisione con link pubblico: rimandata** (vedi `IMPLEMENTAZIONI.md`): oggi il report si apre solo
  con l'accesso. Il PDF si può già mandare via WhatsApp o email.

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

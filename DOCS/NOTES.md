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

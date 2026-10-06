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

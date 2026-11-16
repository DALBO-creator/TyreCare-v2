# TyreCare v2 — Piano di progetto

> Documento di riferimento del progetto. La **Parte A** riporta la struttura ideata dal titolare del progetto
> (fonte originale: [`first-prompt.md`](first-prompt.md)). La **Parte B** contiene considerazioni e proposte di
> modifica: quelle accettate vanno riportate nella Parte A, quelle scartate si eliminano.

## Indice dei documenti (`DOCS/`)

| File | Contenuto | Aggiornamento |
|------|-----------|---------------|
| [`PLAN.md`](PLAN.md) | Visione, funzionalità, ruoli, stack, roadmap | Quando cambia una decisione |
| [`NEXT.md`](NEXT.md) | Cosa fare nella prossima sessione e promemoria permanenti | **Ogni sessione (obbligatorio)** |
| [`STORICO.md`](STORICO.md) | Resoconto di ogni sessione, la più recente in cima | **Ogni sessione (obbligatorio)** |
| [`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md) | Colori, tipografia, componenti e regole di accessibilità | Quando cambia l'aspetto |
| [`NOTES.md`](NOTES.md) | Spiegazione del codice più complesso e del funzionamento delle funzionalità | Ad ogni funzionalità implementata |
| [`STRUCT.md`](STRUCT.md) | Linguaggi, framework e librerie con spiegazione d'uso | Ad ogni nuova dipendenza |
| [`PRODUZIONE-MARKETING.md`](PRODUZIONE-MARKETING.md) | Costi, modello di ricavo, BEP, go-to-market, valutazione in caso di cessione | Quando cambiano costi/prezzi |
| [`IMPLEMENTAZIONI.md`](IMPLEMENTAZIONI.md) | Idee e implementazioni future | Man mano che emergono |
| [`legale/`](legale/README.md) | Bozze di informativa privacy, termini di servizio, DPA per le officine e registro dei trattamenti; domande per il consulente | Dopo la revisione del consulente |
| [`pilota/guida-avvio.md`](pilota/guida-avvio.md) | Guida di una pagina per l'officina pilota (LA SANTI GOMME): dall'accesso alle notifiche | Pilota (Fase 6) |
| [`pilota/guida-officina.md`](pilota/guida-officina.md) | Guida completa per le officine: ogni funzione con i nomi esatti di pulsanti e voci | Pilota (Fase 6) |
| [`pilota/guida-cliente.md`](pilota/guida-cliente.md) | Guida di una pagina per i clienti dell'officina: invito, garage, appuntamento, notifiche, dati | Pilota (Fase 6) |
| [`pilota/crea-officina.md`](pilota/crea-officina.md) | Passi per Davide: creare l'account e l'officina del titolare, attivarla dopo il DPA, password dimenticata | Pilota (Fase 6) |
| [`pilota/demo-la-santi.md`](pilota/demo-la-santi.md) | Passi per Davide: allineare il cloud, caricare la demo per il titolare di LA SANTI GOMME, cosa mostrare, pulizia | Prima di ogni demo |
| [`legale/registro-accessi.md`](legale/registro-accessi.md) | Bozza: chi del personale accede ai dati delle officine, quando, cosa annotare | Dopo la revisione del consulente |
| [`pilota/copie-di-sicurezza.md`](pilota/copie-di-sicurezza.md) | Bozza: copia a mano con la CLI, conservazione, prova di ripristino in locale | Pilota (Fase 6) |
| [`pilota/piano-pilota.md`](pilota/piano-pilota.md) | Bozza: piano del pilota con LA SANTI GOMME (8 settimane), cosa misurare, criteri per passare alla Fase 7 | Pilota (Fase 6) |
| [`pilota/lista-lancio.md`](pilota/lista-lancio.md) | Bozza: lista di controllo del lancio in ordine (D3, D5, D7, D9, DPA, copie, officina, import, abbonamenti) | Pilota (Fase 6) |
| [`LICENSE.md`](LICENSE.md) | Licenza proprietaria | Raramente |
| [`first-prompt.md`](first-prompt.md) | Prompt originale del progetto | Mai (archivio) |

---

# PARTE A — Struttura ideata

## 1. Cos'è TyreCare

TyreCare è una **PWA** gestita da **gommisti/officine**.

- **Fase iniziale:** i dati arrivano dal **gestionale già in uso** dall'officina, tramite **export** dei dati
  necessari alle funzionalità dell'app.
- **Fase successiva (produzione):** possibile sviluppo di un **gestionale TyreCare** completo, da
  commercializzare e diffondere sul mercato.

## 2. Obiettivi dell'app

1. Tenere il cliente **sempre al corrente dello stato dei suoi pneumatici**.
2. Inviare **reminder** per i controlli di routine tramite **notifiche push**.
3. Fornire al cliente lo **storico dei controlli**, con **report dettagliato** del singolo controllo.
4. Mostrare nel dettaglio lo **stato di salute del singolo pneumatico**.

## 3. Funzionalità

### 3.1 Prenotazione (funzione chiave)

- Prenotazione di **controlli mirati in base all'esigenza del cliente**, ad esempio:
  - pneumatici usurati → cambio gomme;
  - **richiesta di intervento su strada**;
  - tutti i **servizi offerti dalla specifica officina**.
- **Scelta dell'officina** in cui prenotare da una **lista di officine affiliate** a TyreCare.

### 3.2 Garage

- Mostra l'**elenco dei veicoli registrati** in una determinata officina.

### 3.3 Notifiche e reminder

- Notifiche push per controlli di routine.

### 3.4 Storico e report

- Storico controlli con report dettagliato.
- Stato di salute del singolo pneumatico.

## 4. Ruoli

| Ruolo | Descrizione |
|-------|-------------|
| `ADMIN` | Gestore della piattaforma TyreCare |
| `OFFICINA` | Gommista/officina affiliata |
| `CLIENTE` | Proprietario del veicolo |

## 5. Stack tecnologico

### Frontend

- **Bootstrap 5** — layout, componenti, design responsive
- **Vite** + **vite-plugin-pwa** — build; generazione di manifest, service worker e cache offline
- **Supabase JS client** — autenticazione, query al database senza SQL scritto a mano, storage, realtime,
  chiamata alle funzioni
- **HTML5 + CSS3**
- **TypeScript** (accettata P1: non più opzionale)

### Backend

- **TypeScript** — maggiore rigidità, stabilità e ripetibilità del codice
- **Node.js (LTS)** — runtime
- **Fastify** — framework per le API HTTPS: rotte, richieste, risposte e autenticazione prima di ogni operazione
- **Zod** — validazione dei dati in arrivo dal frontend, coerente con i tipi TypeScript
- **Web Push** + **Supabase scheduled functions** — notifiche e reminder programmati

### Database e deploy

- **Supabase** (PostgreSQL)
- **Supabase CLI**
- **Vercel** — deploy e produzione

### Qualità e sviluppo

- **Git + GitHub**
- **ESLint + Prettier** — qualità e formattazione del codice
- **Vitest** — test automatici
- **Lighthouse** (Chrome DevTools) — PWA, performance, accessibilità, best practices, SEO

### Opzionali

- PowerSync per sincronizzazione offline avanzata
- ~~Stripe per i pagamenti~~ (tolto il 2026-11-13: nessun pagamento nell'app, vedi P25)

---

# PARTE B — Considerazioni e proposte di modifica

Ogni proposta ha un codice (`P1`, `P2`, …). Stato: 🟡 da decidere · ✅ accettata · ❌ scartata.

> **2026-10-06:** tutte le proposte P1–P19 sono state accettate.

## B1. Architettura e stack

### P1 — TypeScript anche nel frontend, da subito ✅

Consiglio di non lasciarlo opzionale. Gli schemi **Zod** possono essere scritti **una sola volta** in un pacchetto
condiviso e usati sia dal backend (validazione delle richieste) sia dal frontend (validazione dei form e tipi).
Inoltre la Supabase CLI genera automaticamente i **tipi TypeScript del database** (`supabase gen types`), che
danno autocompletamento e controllo errori su ogni query. Migrare a TS più avanti costa molto di più che
partire con TS. Vite supporta TypeScript senza configurazione aggiuntiva.

### P2 — Dividere chiaramente i compiti tra Supabase e Fastify ✅

Con Supabase client nel frontend **e** un backend Fastify si rischia di fare la stessa cosa in due posti.
Proposta di regola:

| Operazione | Dove | Perché |
|------------|------|--------|
| Login, registrazione, sessione | Supabase Auth (frontend) | Già pronto, sicuro |
| Letture semplici (storico, garage, pneumatici) | Supabase client + **RLS** | Nessun backend necessario, realtime gratis |
| Upload foto/PDF report | Supabase Storage + policy | Idem |
| Import export del gestionale | **Fastify** | Parsing, mappatura, validazione Zod, upsert in blocco |
| Prenotazioni (creazione/conferma) | **Fastify** | Regole di business: disponibilità, sovrapposizioni |
| Invio notifiche push | **Fastify** / funzione schedulata | Chiavi VAPID solo lato server |
| ~~Pagamenti (Stripe), webhook~~ | — | Tolti il 2026-11-13 (P25): nessun pagamento nell'app |

**Aggiornamento 2026-10-08:** le scritture dell'officina che toccano più tabelle insieme (nuovo controllo
con le misure, montaggio di pneumatici con smontaggio dei precedenti) sono **funzioni SQL** chiamate con
`supabase.rpc` (`registra_controllo`, `monta_pneumatici`): una chiamata è una transazione e valgono le RLS
di chi chiama (`security invoker`). Fastify resta per import, prenotazioni, push e pagamenti.
Stessa regola per le correzioni: `modifica_controllo` (controllo + misure); cliente, veicolo e
pneumatici si correggono con un `update` diretto (una tabella sola).

La sicurezza vera sta nelle **Row Level Security (RLS)** di Postgres: anche se il frontend interroga direttamente
il database, ogni utente vede solo i dati che gli spettano. Fastify usa la `service_role` key solo dove serve e
verifica sempre il JWT Supabase dell'utente prima di agire.

### P3 — Fastify su Vercel ✅

Vercel supporta Fastify come **funzione serverless**: va bene, ma ogni richiesta può subire un "cold start" e non
ci sono processi sempre attivi (niente cron interni a Fastify). I job programmati (reminder) vanno quindi su
**Supabase Cron (`pg_cron`) + Edge Functions**, oppure su **Vercel Cron Jobs** che chiamano una rotta Fastify
protetta. Nota: le Supabase Edge Functions girano su **Deno**, non su Node; codice condiviso con Fastify va
tenuto in TypeScript "puro", senza dipendenze specifiche di Node.

### P4 — Struttura del repository a monorepo ✅

```
TyreCare-v2/
├── apps/
│   ├── web/          # PWA: Vite + Bootstrap 5 + TypeScript
│   └── api/          # Fastify + TypeScript
├── packages/
│   └── shared/       # schemi Zod, tipi, costanti (soglie usura, ruoli…)
├── supabase/
│   ├── migrations/   # schema DB versionato (Supabase CLI)
│   ├── functions/    # Edge Functions (reminder schedulati)
│   └── seed.sql      # dati di prova
├── DOCS/
└── package.json      # npm workspaces
```

Un solo repo, un solo `npm install`, tipi condivisi, CI unica.

### P5 — Notifiche push: limite iOS ✅

Su **iPhone/iPad** le Web Push funzionano **solo se la PWA è installata nella schermata Home** (iOS 16.4+) e
l'utente concede il permesso. Una parte dei clienti non lo farà. Proposta:

- schermata guidata "Aggiungi a Home" per utenti iOS;
- **canale di riserva**: email (es. Resend) e, in futuro, SMS/WhatsApp per i reminder importanti;
- preferenze notifiche per cliente.

### P6 — Offline: partire semplice ✅

Per l'MVP basta la cache del service worker (vite-plugin-pwa / Workbox): app shell + ultimi dati consultati in
sola lettura. **PowerSync** ha senso solo se l'officina deve **scrivere** dati offline (es. controlli in
piazzale senza rete). Lo spostiamo in `IMPLEMENTAZIONI.md`.

### P7 — Strumenti di qualità aggiuntivi ✅

- **GitHub Actions**: lint + test + build ad ogni push/PR.
- **Playwright** per test end-to-end dei flussi critici: **in uso dal 2026-10-12** (workspace `e2e/`, job CI `e2e`),
  primo flusso gli inviti del cliente; da estendere alla prenotazione in Fase 4.
- Lighthouse anche in CI (`@lhci/cli`) per non regredire su punteggi PWA/performance.
- **Sentry** (piano gratuito) per errori in produzione.

## B2. Dati e import dal gestionale

### P8 — L'import è il rischio principale del progetto ✅

Ogni gestionale esporta in formati diversi (CSV, Excel, nomi colonne diversi, date e decimali all'italiana).
Proposta:

1. definire un **formato TyreCare standard** (CSV con colonne fisse e documentate);
2. per ogni gestionale supportato, un **adattatore** che converte il suo export nel formato standard;
3. import **idempotente**: reimportare lo stesso file non deve creare duplicati (chiavi: targa/telaio per i
   veicoli, codice cliente del gestionale per i clienti, ID documento per i controlli);
4. **anteprima e report errori** prima di confermare l'import;
5. log di ogni import (chi, quando, quante righe, errori).

Va chiarito con 2–3 gommisti reali **quale gestionale usano** e **cosa riescono a esportare** (e con che
frequenza). Senza questo dato non sappiamo quanto sarà "aggiornato" lo stato degli pneumatici visto dal cliente.

#### Primo partner: LA SANTI GOMME — gestionale GESTITYRE (aggiornamento 2026-10-06)

- **Prima officina partner:** **LA SANTI GOMME** (gommista/officina) — sarà l'officina del pilota (Fase 6)
  e il riferimento reale per import, schermate officina e test con clienti veri.
- **Gestionale:** **GESTITYRE**, che esporta in **Excel `.xls`** (formato binario "vecchio" di Excel 97–2003,
  non `.xlsx`).
- **Conseguenze sul piano:**
  - il **primo adattatore** di import (punto 2) sarà **GESTITYRE `.xls` → formato TyreCare**; il formato
    standard resta, così altri gestionali si aggiungeranno con un nuovo adattatore;
  - serve una libreria che legga il `.xls` binario (non tutte lo fanno: vedi `STRUCT.md`);
  - il parsing avviene in **Fastify** (come da P2): il file non va mai elaborato nel browser con dati di
    clienti in chiaro più del necessario;
  - **prima di scrivere l'adattatore** serve un **file di esempio reale** dell'export (meglio se con dati
    anonimizzati) e la lista delle esportazioni disponibili in GESTITYRE (clienti, veicoli, pneumatici,
    deposito gomme, interventi?) — vedi `NEXT.md`;
  - prima di caricare dati reali di clienti di LA SANTI GOMME serve l'**accordo di nomina (DPA)** di P17.

**Decisioni del titolare (2026-10-16, fatto lo stesso giorno):** senza aspettare il file di GESTITYRE si
parte dal **formato CSV standard** di clienti e veicoli (`packages/shared/src/importa.ts`, pagina
`/clienti/importa`, solo TITOLARE). Il file si legge e si controlla **nel browser** e una funzione SQL
(`importa_clienti_veicoli`) scrive in una transazione, con anteprima simulata e registro `import_log`:
**niente Fastify** per ora (non è pubblicato; il file è dell'officina, che quei dati li vede già). Chiavi:
codice cliente e targa; le celle vuote non cancellano i dati presenti; le righe con errori si saltano.
I **controlli** con le misure arriveranno in un secondo passo. Dettagli in `NOTES.md`.

**Aggiornamento 2026-10-20:** l'adattatore specifico GESTITYRE (punto 2 e "primo adattatore" sopra) è
sostituito da **P22** (import con mappatura delle colonne): non serve più aspettare il file di esempio.

### P9 — Inserimento controlli direttamente da TyreCare ✅

Oltre all'import, una **schermata "Nuovo controllo"** per l'officina (da tablet/telefono in officina):
profondità battistrada per posizione, pressione, DOT, danni, foto. Così TyreCare è utile anche se l'export
del gestionale è scarso, ed è il primo passo verso il futuro gestionale TyreCare.

### P10 — Modello "stato di salute" del pneumatico ✅

Dati per singolo pneumatico (per posizione: AS, AD, PS, PD, scorta):

- **profondità battistrada** (mm) — limite legale 1,6 mm; consigliati ≥ 3 mm estivi, ≥ 4 mm invernali;
- **pressione** misurata vs consigliata;
- **età** da codice **DOT** (settimana/anno) — attenzione oltre i 5–6 anni;
- **usura irregolare** (bordi interni/esterni, centrale) → suggerimento convergenza/equilibratura;
- **danni** (tagli, bolle, riparazioni);
- **stagione** (estivo/invernale/4 stagioni) e marca/modello/misura.

Da questi si calcola un **indicatore semplice** (verde / giallo / rosso) con motivazione leggibile dal cliente.
Le soglie stanno in `packages/shared` così frontend e backend usano le stesse regole.

### P11 — Reminder intelligenti ✅

Oltre ai controlli di routine:

- **cambio stagionale** (in Italia obbligo invernale indicativamente 15 novembre – 15 aprile, variabile per tratta);
- pneumatico in stato giallo/rosso al controllo;
- età DOT elevata;
- scadenza tagliando/revisione (se il dato è disponibile dal gestionale).

Il motore reminder gira come job schedulato giornaliero.

**Decisione del titolare (2026-10-14, fatto lo stesso giorno):** per ora **esito del controllo** (notifica
subito dopo un controllo con gomme gialle/rosse) e **cambio stagionale** (dal 15 ottobre con le estive
montate, dal 15 marzo con le invernali; una volta per stagione e per targa, alle 10). Solo al cliente con il
veicolo nel garage. Età DOT e stima del consumo restano idee (`IMPLEMENTAZIONI.md`).

### P12 — Modello dati iniziale (bozza) ✅

```
profiles        (id = auth.users.id, ruolo, nome, telefono, …)
officine        (id, ragione sociale, P.IVA, indirizzo, coordinate, orari, stato affiliazione)
officina_utenti (officina_id, profile_id)                   -- più dipendenti per officina
clienti_officina(officina_id, profile_id?, codice_gestionale, dati anagrafici, consensi)
veicoli         (id, targa, telaio?, marca, modello, …)
veicoli_officina(veicolo_id, officina_id, cliente_officina_id)
pneumatici      (id, veicolo_id, posizione, misura, marca, modello, DOT, stagione, montato_il, smontato_il)
controlli       (id, veicolo_id, officina_id, data, km, note, origine: import|app)
misure_pneumatico(controllo_id, pneumatico_id, battistrada_mm, pressione_bar, danni, foto[])
servizi         (id, officina_id, nome, durata_min, prezzo_indicativo, prenotabile)
prenotazioni    (id, cliente, veicolo, officina, servizio, slot, stato, note)
interventi_strada(id, cliente, veicolo, posizione GPS, descrizione, stato, officina assegnata)
push_subscriptions(profile_id, endpoint, chiavi, user_agent)
reminder        (id, veicolo_id, tipo, data_prevista, inviato_il, canale)
import_log      (id, officina_id, file, righe_ok, righe_errore, eseguito_da, data)
```

**Decisioni del 2026-10-07 (migrazione `20261007120000_dati.sql`):**

- **Veicoli per officina** (scelta del titolare): niente `veicoli_officina`; ogni officina ha la sua scheda
  del veicolo (`veicoli.officina_id`, targa unica per officina) e il suo storico. La stessa targa in due
  officine sono due schede: il **garage del cliente le unisce per targa**. Motivi: nessuna officina vede i
  dati delle altre, import più semplice, i dati restano dell'officina (GDPR).
- `veicoli_officina` → sostituita da `veicoli.officina_id` + `veicoli.cliente_officina_id`.
- Ogni tabella dei dati porta `officina_id`; chiavi esterne composte garantiscono che controllo, pneumatico
  e misura siano dello stesso veicolo e della stessa officina.
- Il **collegamento cliente ↔ account** (`clienti_officina.profile_id`) lo fanno solo ADMIN o il backend
  (futuro flusso di "rivendicazione"): un'officina non può far comparire un veicolo nel garage di altri.
  → **Decisione del 2026-10-10:** rivendicazione con **invito via email dall'officina** (migrazione
  `20261010120000_inviti_cliente.sql`). L'officina crea l'invito per l'email del cliente; il cliente lo
  accetta solo con un account che ha **la stessa email, confermata**. Scartati il codice stampato (si
  inoltra facilmente) e "targa + telefono" (chiunque li conosca vedrebbe i dati). L'email per ora parte
  dal programma di posta dell'officina (`mailto:`), finché non c'è l'SMTP definitivo.
- L'**ADMIN non vede** i dati dei clienti delle officine (TyreCare è responsabile del trattamento, P17);
  per l'assistenza si usa il backend con la service role.
- `misure_pneumatico`: `battistrada_mm` è la profondità **minima** misurata (decide lo stato), più
  `pressione_bar`, `usura` (REGOLARE/INTERNA/ESTERNA/CENTRALE/BORDI) e `danni`. Le foto arriveranno con
  Supabase Storage.

Punto importante: **lo stesso cliente può essere cliente di più officine**. L'anagrafica che arriva dal gestionale
(`clienti_officina`) è dell'officina; l'account TyreCare (`profiles`) è della persona. Il collegamento avviene
quando il cliente si registra e "rivendica" i suoi veicoli (es. codice invito generato dall'officina, oppure
verifica targa + telefono).

### P22 — Import con mappatura delle colonne ✅

**Decisione del titolare (2026-10-20):** invece di un adattatore per ogni gestionale (P8, punto 2), l'officina
carica **qualsiasi file Excel/CSV** esportato dal suo gestionale e **associa le colonne** del file a quelle di
TyreCare (codice cliente, nome, targa, …). Il risultato passa poi per lo stesso import del formato standard
(anteprima, righe con errori saltate, registro `import_log`). Sostituisce l'**adattatore specifico GESTITYRE**
`.xls`: non serve più aspettare il file di esempio di LA SANTI GOMME (resta utile per provare la mappatura su
un file vero).

## B3. Funzionalità

### P13 — "Garage": due viste distinte ✅

Così com'è descritto, il garage è una vista **dell'officina** ("veicoli registrati in una determinata officina").
Propongo:

- **Garage cliente**: "i miei veicoli", con stato pneumatici a colpo d'occhio, indipendentemente dall'officina;
- **Garage officina**: elenco veicoli dei propri clienti, con filtri (stato rosso, cambio stagionale da fare,
  nessun controllo da X mesi) → diventa anche uno **strumento commerciale** per l'officina.

### P14 — Prenotazioni: cosa serve davvero ✅

- **catalogo servizi per officina** (durata, prezzo indicativo, prenotabile sì/no);
- **disponibilità**: orari di apertura + capienza (ponti/operatori) + chiusure → slot liberi;
- **stati**: `richiesta → confermata / rifiutata / proposta_altro_orario → completata / annullata / no_show`;
- notifica realtime all'officina e push al cliente ad ogni cambio di stato;
- **MVP**: prenotazione come *richiesta* che l'officina conferma (più semplice e realistica per un gommista);
  calendario con slot automatici in una fase successiva.
- **Lista officine affiliate**: filtri per distanza (geolocalizzazione), servizi offerti, orari.
- **Decisioni del titolare (2026-10-12):** il cliente può prenotare da **tutte le officine attive**;
  sceglie **giorno e fascia** (mattina/pomeriggio) e l'officina conferma con l'**ora precisa**, propone un
  altro orario o rifiuta; nel catalogo il **prezzo indicativo è facoltativo** ("da 40 €", vuoto = su
  preventivo). Stati usati: `RICHIESTA`, `PROPOSTA`, `CONFERMATA`, `RIFIUTATA`, `ANNULLATA`,
  `COMPLETATA`, `NON_PRESENTATO`. Implementazione in `NOTES.md`.
- **Capienza per fascia (2026-10-23, T020):** restano le richieste che l'officina conferma; l'officina può
  fissare quante richieste accetta al massimo per mattina o pomeriggio (`officine.capienza_fascia`, vuoto =
  nessun limite). Oltre quel numero la fascia è piena e il cliente non la può chiedere (`FASCIA_PIENA`);
  l'officina può sempre confermare o spostare. Niente prenotazione diretta né slot orari. In `NOTES.md`.
- **Cliente e veicolo dalla richiesta (2026-10-13, sessione 15):** dal dettaglio della richiesta chi
  lavora in officina registra il veicolo con un tocco; se chi ha prenotato non è ancora cliente, il
  cliente nasce **già collegato al suo account, senza invito**. È sicuro perché cliente e veicolo nascono
  dai dati della richiesta (nessuno storico altrui da mostrare); se la targa è già registrata in officina
  si apre la sua scheda e per collegarla resta l'invito via email. **Confermata dal titolare il 2026-10-14.**

### P15 — Intervento su strada è un flusso diverso ✅

Non è una prenotazione con slot: è una **richiesta urgente** con posizione GPS, foto, descrizione e telefono.
Serve: invio alle officine vicine che offrono il servizio, **accettazione da parte di una sola**, stato in
realtime per il cliente. Valutare responsabilità e assicurazione (TyreCare fa da intermediario, il servizio è
dell'officina) e la gestione degli orari notturni/festivi. Suggerisco di farlo **dopo** l'MVP.

### P16 — Ruoli: un livello in più per le officine ✅

`OFFICINA` probabilmente va diviso in **titolare** (gestisce servizi, utenti, abbonamento, import) e
**operatore** (inserisce controlli, gestisce prenotazioni). Si implementa con un campo in `officina_utenti`,
senza aggiungere un quarto ruolo globale. I ruoli si leggono nelle policy RLS tramite una funzione SQL o un
custom claim nel JWT.

### P20 — Le officine lavorano al computer: impaginazione da desktop ✅

**Decisione del titolare (2026-10-13):** le officine accedono di solito dal PC, quindi la versione da
computer va curata quanto quella da telefono (che resta quella del cliente e del piazzale). Da 992 px:
barra laterale al posto delle barre del telefono, schede su due colonne (cruscotto del veicolo sempre in
vista, elenco dei veicoli accanto al riepilogo, risposte all'appuntamento accanto ai dettagli), moduli
stretti, scorciatoie da tastiera ("/" per cercare). Resta **una sola app** (stesse pagine, stesso codice):
cambia solo l'impaginazione in CSS, guidata da `data-pagina`. Dettagli in `NOTES.md`.

### P21 — Notifiche: una tabella, più canali ✅

**Decisione del titolare (2026-10-14):** si parte dalla Fase 5 con le notifiche delle prenotazioni.

- **Le notifiche nascono nel database**: un trigger su `prenotazioni` scrive in `notifiche` titolo, testo e
  link già pronti, per ogni destinatario. Così nessun cambio di stato si dimentica di avvisare, chiunque lo
  faccia (app, funzioni future, correzioni dell'ADMIN), e tutti i canali usano lo stesso testo.
- **Canali, in quest'ordine:** 1) nell'app, con contatore in tempo reale (fatto il 2026-10-14); 2) **Web
  Push**; 3) **email** di riserva (P5), quando ci sarà l'email dal dominio di TyreCare (P23; oggi Resend in prova
  consegna solo all'indirizzo del titolare).
- **Invio push/email (confermato dal titolare il 2026-10-14, push fatte lo stesso giorno):** una **Supabase Edge Function** chiamata dal database
  a ogni nuova notifica (Database Webhook / `pg_net`), con le chiavi VAPID nei segreti di Supabase. Rispetto a
  P2 ("push da Fastify") evita di pubblicare `apps/api` solo per questo: oggi l'API non è online.
- Promemoria schedulati (P11, giorno prima dell'appuntamento, cambio stagionale) = un job **Supabase Cron**
  che inserisce righe nella stessa tabella. **Giorno prima fatto il 2026-10-14:** solo al cliente, dalle 18
  del giorno prima, un solo promemoria per orario (di nuovo se l'appuntamento viene spostato).

### P23 — Email dal dominio di TyreCare ✅

**Decisione del titolare (2026-10-20):** tutte le email (conferme, inviti, notifiche di riserva) partono da un
**mittente unico** `noreply@<dominio TyreCare>`, invece che dal dominio di ogni officina. I record DNS del
dominio (SPF/DKIM su Resend) li configura **una volta** il titolare; poi si aggiornano le *SMTP Settings* di
Supabase. Non serve più chiedere a ogni officina chi gestisce il suo dominio. Sostituisce l'"SMTP definitivo con
il dominio di LA SANTI GOMME".

### P24 — Area amministratore protetta dalla 2FA ✅

**Decisione (2026-11-12, richiesta del titolare):** l'area `/admin` è del solo titolare di TyreCare. L'account
ADMIN funziona da amministratore **solo dopo la verifica in due passaggi** (TOTP, `aal2` controllato da
`is_admin()` nel database); il ruolo ADMIN si assegna solo dall'editor SQL; ogni azione dell'admin finisce
in un registro che nessuno può modificare dall'app. Strumenti: riepilogo della piattaforma, ricerca e
correzione degli account (dati, ruolo, conferma email, nuova password, sessioni, blocco), officine,
commenti, registro. Dettagli in `NOTES.md` → "Pannello amministratore e 2FA".

## B4. Aspetti legali e privacy

### P17 — GDPR ✅

I dati dei clienti caricati dall'officina sono **dell'officina** (titolare del trattamento); TyreCare è
**responsabile del trattamento** → serve un **accordo di nomina (DPA, art. 28 GDPR)** con ogni officina affiliata.
Inoltre: informativa privacy e cookie, consenso esplicito per notifiche marketing (distinte da quelle di servizio),
diritto alla cancellazione/esportazione, dati su server UE (scegliere la **regione UE** su Supabase e Vercel),
registro dei trattamenti. Da verificare con un consulente privacy prima del lancio.

- **Bozze (2026-10-21, T013):** informativa privacy (con cookie e archiviazione locale) e termini di servizio
  in [`legale/`](legale/README.md), con i dati mancanti e le domande per il consulente.
- **Bozze (2026-10-22, T014):** accordo di nomina a responsabile (DPA, art. 28) da firmare con ogni officina
  e registro dei trattamenti (art. 30, parte titolare e parte responsabile). Le misure di sicurezza descritte
  sono solo quelle presenti nel codice; quelle mancanti sono in `legale/README.md` → "Da fare prima del
  lancio".

### P18 — Licenza ✅

Il repo è **privato**: bene. `LICENSE.md` contiene una licenza proprietaria "tutti i diritti riservati". Prima di
distribuire l'app alle officine servono anche **termini di servizio** (contratto di abbonamento) e una revisione
da parte di un avvocato. Valutare deposito del marchio "TyreCare" (verificare prima che non sia già registrato).

## B5. Modello di business (dettaglio in `PRODUZIONE-MARKETING.md`)

### P19 — Abbonamento come base, commissione da rivedere ✅

Il **1% sui preventivi** è difficile da applicare: un preventivo non è una vendita, la transazione avviene in
officina fuori dall'app e non è verificabile. Proposta: **abbonamento** come ricavo principale, eventualmente
con una **piccola fee fissa per prenotazione completata tramite TyreCare** (misurabile). Calcoli e scenari nel
documento dedicato.

### P25 — Nessun pagamento nell'app: abbonamento gestito a mano ✅ (2026-11-13, nel codice dal 2026-11-16)

Decisione del titolare prima del lancio. I clienti delle officine pagano **sul posto**; TyreCare incassa
**fuori dall'app** (bonifico su fattura) due sole cose:

- **installazione**: 149 € una tantum;
- **abbonamento dell'officina**: 100 €/mese oppure 1000 €/anno (2 mesi gratis), IVA esclusa, dopo 30
  giorni di prova.

Conseguenze: **Stripe è stato tolto del tutto** (Edge Functions, tabelle, colonne, pagina di pagamento); i
piani Starter/Pro/Pilota non esistono più. L'abbonamento (`abbonamenti`: piano MENSILE/ANNUALE, stato
PROVA/ATTIVO/SCADUTO/SOSPESO, scadenza, installazione pagata, importo concordato, note interne) lo aggiorna
l'amministratore dal pannello `/admin` quando riceve il bonifico; l'officina lo vede in sola lettura e scrive
a `CONTATTO_EMAIL` per rinnovare. Alla scadenza partono gli avvisi ma non c'è nessun blocco automatico: se
sospendere lo decide l'amministratore. Pagina dell'admin: `/admin/abbonamento?id=…` (da «Officine»).
Dettagli in `NOTES.md` → "Abbonamento gestito a mano, senza Stripe".

### P26 — Verifica in due passaggi per tutti e password più robuste ✅ (2026-11-16)

Supera R39 (2FA rimandata dopo il pilota). Ogni account può attivare la 2FA dal Profilo; chi l'ha attiva
con la sola password non legge né scrive nulla (policy restrittiva su ogni tabella e `db_pre_request`);
per l'amministratore resta obbligatoria (P24). Password di almeno 10 caratteri con maiuscola, minuscola e
numero, uguali nell'app, in `config.toml` e (a mano) nel pannello di produzione. Permessi minimi per `anon`
e funzioni dei trigger chiuse. Riepilogo e cose da fare sul cloud in `DOCS/SICUREZZA.md`.

---

## 6. Roadmap proposta

| Fase | Contenuto | Stato |
|------|-----------|-------|
| 0 — Setup | Monorepo, TS, ESLint/Prettier, Vitest, Supabase locale, CI, deploy Vercel vuoto | ✅ (resta solo il deploy di `apps/api`, rimandato) |
| 1 — Fondamenta | Auth, ruoli, RLS, anagrafica officine, design system (ui-ux-pro-max) | ✅ chiusa il 2026-10-07 (design system v3, ruoli/RLS, auth web + API, profilo, email in italiano, logo). Rimandati: email dal dominio di TyreCare (P23), rifinitura dell'auto |
| 2 — Dati | Modello veicoli/pneumatici/controlli, import CSV standard, inserimento controllo da app | 🟨 iniziata il 2026-10-07; il 2026-10-08 fatte le schermate officina (elenco, cliente, veicolo, pneumatici, nuovo controllo). Il 2026-10-08 (sessione 8) anche correzione ed eliminazione. Il 2026-10-09 elenco e scheda clienti e smontaggio senza sostituzione. Il 2026-10-16 (sessione 19) **import CSV standard di clienti e veicoli**. Il 2026-10-21 fatto anche l'**import con mappatura delle colonne** (P22, T008–T012, al posto dell'adattatore GESTITYRE). Resta l'import dei controlli |
| 3 — Cliente | Garage cliente, stato salute pneumatico, storico e report controllo | 🟨 iniziata il 2026-10-09: garage con i veicoli uniti per targa tra le officine, scheda in sola lettura con cruscotto, avviso, storico e officine; il cliente vede anche le officine non attive di cui è cliente. Il 2026-10-09 (sessione 11) report del singolo controllo con stampa/PDF (link pubblico rimandato) e stato di salute del singolo pneumatico (grafico, consumo, stima, età dal DOT). Il 2026-10-10 (sessione 12) **rivendicazione dei veicoli con l'invito via email dall'officina** (decisione del titolare). Resta il link pubblico del report, rimandato |
| 4 — Prenotazioni | Lista officine, catalogo servizi, richiesta prenotazione, gestione lato officina | 🟨 iniziata il 2026-10-12 (sessione 14): catalogo dei servizi (titolare), elenco e scheda delle officine attive, richiesta con giorno e fascia, conferma con l'ora / proposta di un altro orario / rifiuto, annullamento del cliente, completato / non presentato; poi calendario dell'officina, editor degli orari con chiusure straordinarie; "Prenota" dal garage con il veicolo già scelto e cliente/veicolo creati dalla richiesta (sessione 15). Il 2026-10-23 dati e posizione dell'officina, «Vicino a me» (distanza), capienza per fascia (T018–T021). Restano: slot automatici |
| 5 — Notifiche | Web Push, reminder schedulati, fallback email | 🟨 iniziata il 2026-10-14 (sessione 16): **notifiche nell'app** per i cambi di stato delle prenotazioni (tabella scritta da un trigger, badge in tempo reale, pagina `/notifiche`). Lo stesso giorno **Web Push** (Edge Function `invia-notifica`, pg_net). Il 2026-10-14 (sessione 17) **promemoria del giorno prima** e **promemoria degli pneumatici** (esito del controllo, cambio stagionale; pg_cron). Il 2026-10-28 (T066) **email di riserva** nella Edge Function, spenta (`EMAIL_NOTIFICHE`): resta accenderla con il dominio di TyreCare (P23) |
| 6 — Pilota | 2–3 gommisti reali, feedback, Lighthouse, privacy/legale | 🟨 preparazione: kit del pilota (commenti dall'app, guida di avvio, 2026-10-22), bozze legali da rivedere; funzione per creare l'officina del pilota (T027) e guida per Davide (T028), cancellazione dell'account nel database (T038), intestazioni di sicurezza del sito (T036), bozze del registro accessi e delle copie di sicurezza (T048), pagina `/admin/officine` per attivare e sospendere le officine (T061) e per cambiare il piano (T106), pagina `/admin/commenti` per leggere i commenti degli utenti (T103) |
| 7 — Commerciale | Abbonamenti (a mano, senza pagamenti nell'app), onboarding officine, intervento su strada | 🟨 iniziata il 2026-10-28 (T067): tabella `abbonamenti` (piano, stato, prova di 30 giorni) creata per ogni officina; scadenza automatica della prova (T138, R19) database dell'intervento su strada (T139, R18), accettazione e chiusura (T140), rotte (T141) e pagina del cliente (T143, 2026-11-01) fatti; database Stripe (T180) e webhook (T185) fatti (2026-11-02), checkout (T189) e avvisi e rifiuto dell'affiliazione (T191) fatti (2026-11-05); pagina con pulsante di pagamento (T192) e portale clienti (T195, 2026-11-06); guida Stripe in prova (T204) e guide pilota della strada (T159) fatte (2026-11-08). **2026-11-13: Stripe tolto del tutto (P25)**: abbonamento gestito a mano dall'amministratore, pannello `/admin` |

## 7. Domande aperte

- Quale gestionale usano i gommisti target e quali export permette? (formato, frequenza, campi)
  → **in parte risolta:** il primo partner LA SANTI GOMME usa **GESTITYRE**, export **Excel `.xls`** (vedi
  P8). Con **P22** (2026-10-20) i **campi** li associa l'officina con la mappatura delle colonne: il file
  di esempio non è più necessario. Resta da capire la **frequenza** dell'export (manuale? ogni quanto?)
- ~~Il cliente si registra da solo o solo su invito dell'officina?~~ → si registra da solo, ma vede i
  veicoli solo dopo aver accettato l'invito dell'officina (2026-10-10)
- Le officine devono poter vedere i veicoli dei clienti di altre officine? (proposta: **no**)
- ~~Prezzi mostrati nell'app (indicativi) o solo su preventivo?~~ → prezzo indicativo facoltativo per
  ogni servizio, vuoto = su preventivo (2026-10-12)
- Lingue: solo italiano all'inizio?
- Nome/marchio: "TyreCare" è libero?

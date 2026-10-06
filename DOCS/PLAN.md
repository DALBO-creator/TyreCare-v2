# TyreCare v2 — Piano di progetto

> Documento di riferimento del progetto. La **Parte A** riporta la struttura ideata dal titolare del progetto
> (fonte originale: [`first-prompt.md`](first-prompt.md)). La **Parte B** contiene considerazioni e proposte di
> modifica: quelle accettate vanno riportate nella Parte A, quelle scartate si eliminano.

## Indice dei documenti (`DOCS/`)

| File | Contenuto | Aggiornamento |
|------|-----------|---------------|
| [`PLAN.md`](PLAN.md) | Visione, funzionalità, ruoli, stack, roadmap | Quando cambia una decisione |
| [`NEXT.md`](NEXT.md) | Cosa è stato fatto nella sessione e cosa fare nella prossima | **Ogni sessione (obbligatorio)** |
| [`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md) | Colori, tipografia, componenti e regole di accessibilità | Quando cambia l'aspetto |
| [`NOTES.md`](NOTES.md) | Spiegazione del codice più complesso e del funzionamento delle funzionalità | Ad ogni funzionalità implementata |
| [`STRUCT.md`](STRUCT.md) | Linguaggi, framework e librerie con spiegazione d'uso | Ad ogni nuova dipendenza |
| [`PRODUZIONE-MARKETING.md`](PRODUZIONE-MARKETING.md) | Costi, modello di ricavo, BEP, go-to-market | Quando cambiano costi/prezzi |
| [`IMPLEMENTAZIONI.md`](IMPLEMENTAZIONI.md) | Idee e implementazioni future | Man mano che emergono |
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
- Stripe per i pagamenti

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
| Pagamenti (Stripe), webhook | **Fastify** | Segreti e firme lato server |

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
- **Playwright** (in futuro) per test end-to-end dei flussi critici (prenotazione).
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

Punto importante: **lo stesso cliente può essere cliente di più officine**. L'anagrafica che arriva dal gestionale
(`clienti_officina`) è dell'officina; l'account TyreCare (`profiles`) è della persona. Il collegamento avviene
quando il cliente si registra e "rivendica" i suoi veicoli (es. codice invito generato dall'officina, oppure
verifica targa + telefono).

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

## B4. Aspetti legali e privacy

### P17 — GDPR ✅

I dati dei clienti caricati dall'officina sono **dell'officina** (titolare del trattamento); TyreCare è
**responsabile del trattamento** → serve un **accordo di nomina (DPA, art. 28 GDPR)** con ogni officina affiliata.
Inoltre: informativa privacy e cookie, consenso esplicito per notifiche marketing (distinte da quelle di servizio),
diritto alla cancellazione/esportazione, dati su server UE (scegliere la **regione UE** su Supabase e Vercel),
registro dei trattamenti. Da verificare con un consulente privacy prima del lancio.

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

---

## 6. Roadmap proposta

| Fase | Contenuto | Stato |
|------|-----------|-------|
| 0 — Setup | Monorepo, TS, ESLint/Prettier, Vitest, Supabase locale, CI, deploy Vercel vuoto | ✅ (resta solo il deploy di `apps/api`, rimandato) |
| 1 — Fondamenta | Auth, ruoli, RLS, anagrafica officine, design system (ui-ux-pro-max) | 🟨 design system fatto |
| 2 — Dati | Modello veicoli/pneumatici/controlli, import CSV standard, inserimento controllo da app | ⬜ |
| 3 — Cliente | Garage cliente, stato salute pneumatico, storico e report controllo | ⬜ |
| 4 — Prenotazioni | Lista officine, catalogo servizi, richiesta prenotazione, gestione lato officina | ⬜ |
| 5 — Notifiche | Web Push, reminder schedulati, fallback email | ⬜ |
| 6 — Pilota | 2–3 gommisti reali, feedback, Lighthouse, privacy/legale | ⬜ |
| 7 — Commerciale | Stripe abbonamenti, onboarding officine, intervento su strada | ⬜ |

## 7. Domande aperte

- Quale gestionale usano i gommisti target e quali export permette? (formato, frequenza, campi)
- Il cliente si registra da solo o solo su invito dell'officina?
- Le officine devono poter vedere i veicoli dei clienti di altre officine? (proposta: **no**)
- Prezzi mostrati nell'app (indicativi) o solo su preventivo?
- Lingue: solo italiano all'inizio?
- Nome/marchio: "TyreCare" è libero?

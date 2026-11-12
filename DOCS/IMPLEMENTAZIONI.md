# IMPLEMENTAZIONI — Idee e sviluppi futuri

> Elenco di implementazioni possibili, aggiornato man mano che il progetto avanza.
> Priorità: 🔴 alta · 🟠 media · 🟢 bassa / esplorativa.

## Prodotto

| Idea | Priorità | Note |
|------|----------|------|
| **Gestionale TyreCare** completo (fatturazione, magazzino gomme, deposito stagionale) | 🟠 | Obiettivo di lungo periodo: sostituisce l'import dagli altri gestionali. |
| **Deposito pneumatici stagionale** (gomme custodite dall'officina, etichetta/posizione) | 🔴 | Molto usato dai gommisti; ottimo motivo per il cliente di aprire l'app. |
| **Intervento su strada** con dispatch alle officine vicine | 🟠 | Vedi PLAN P15. |
| **Calendario con slot automatici** | 🟠 | Dopo la prenotazione "su richiesta" dell'MVP. |
| **Preventivi in app** (l'officina invia, il cliente accetta) | 🟠 | Base per un eventuale modello a commissione. |
| **Foto pneumatico + stima usura** (analisi immagine) | 🟢 | Da valutare l'affidabilità. |
| **Lettura DOT / misura da foto** (OCR) | 🟢 | Velocizza l'inserimento in officina. |
| **Integrazione diretta con i gestionali** (API invece di export) | 🟠 | Dipende dai gestionali supportati. |
| **Promemoria revisione / tagliando** | 🟠 | Se il dato è disponibile. |
| **Recensioni officine** | 🟢 | Solo da clienti con prenotazione completata. |
| **Multilingua** | 🟢 | |
| ~~**Modifica ed eliminazione** di clienti, veicoli, pneumatici e controlli (lato officina)~~ | ✅ | Fatto in sessione 8 (2026-10-08). Vedi `NOTES.md`. |
| ~~**Elenco e scheda clienti** dell'officina (con i loro veicoli)~~ | ✅ | Fatto in sessione 9 (2026-10-09). Vedi `NOTES.md`. |
| **Unire due anagrafiche** dello stesso cliente (doppioni) | 🟢 | Sposta i veicoli sull'anagrafica giusta ed elimina l'altra. Utile dopo l'import. |
| **Import dei controlli** dal CSV (una riga per pneumatico misurato: documento, targa, data, km, posizione, battistrada, pressione, misura/marca/DOT/stagione) | 🔴 | Secondo passo di P8. Da decidere come montare gli pneumatici storici quando la misura/marca cambia e con file in ordine non cronologico. |
| **Annullare un import** (eliminare i record creati da quell'import) | 🟢 | Servirebbe l'id dell'import su clienti e veicoli. |
| **Scaricare gli errori dell'anteprima** come CSV, per correggerli in Excel | 🟢 | Oggi si vedono i primi 100 nella pagina. |
| **Annullare uno smontaggio** fatto per errore | 🟢 | Oggi si rimonta con "Cambia pneumatici" (nuovo record) oppure lo corregge un ADMIN. |
| **Pressione consigliata** per veicolo/misura e confronto con quella misurata | 🟠 | PLAN P10: "misurata vs consigliata". |
| **DOT diverso per ruota** nel montaggio di un treno | 🟢 | Oggi un DOT per tutto il treno: se differiscono si monta una ruota alla volta. |
| **Garage anche per chi lavora in officina** (titolare con la sua auto cliente di un'altra officina) | 🟢 | Oggi la home di un membro di officina è sempre l'elenco dell'officina: servirebbe una voce "Il mio garage". `caricaGarage()` è già pronto (filtra per account). |
| ~~**Prenota dalla scheda del garage**~~ quando un pneumatico è da sostituire | ✅ | Fatto il 2026-10-13 (sessione 15): "Prenota la sostituzione" / "Prenota un controllo" sotto l'avviso. |
| **Età degli pneumatici dal DOT** anche nella carta del garage e nella scheda officina | 🟢 | Già nella pagina dello pneumatico (sessione 11), con avviso oltre i 5 anni. |
| **Seed con più controlli** per la Panda (per vedere il grafico in locale) | 🟢 | Oggi il seed ha un solo controllo; aggiungerne uno cambia i conteggi di `dati.test.sql`. |
| **Promemoria dalla stima del consumo** ("tra circa 2 mesi arrivi a 3 mm") | 🟠 | Fase 5: la stima c'è già in `lib/salute.ts` (andrebbe portata in SQL, es. `regr_slope`). Non scelto il 2026-10-14. |
| **Link pubblico del report** di un controllo (da mandare a chi non ha l'app, es. un familiare) | 🟠 | Oggi c'è "Stampa o salva in PDF". Servirebbe un token casuale e revocabile per controllo, letto da una rotta Fastify o da una funzione `security definer` (mai una policy RLS aperta), con scadenza. |
| **Invio del report al cliente** (email/WhatsApp) quando l'officina salva il controllo | 🟠 | Dopo il link pubblico; per i clienti senza account. |
| **Invio automatico dell'invito** da TyreCare (oggi parte dal programma di posta dell'officina) | 🟠 | Con l'SMTP definitivo: Edge Function o rotta Fastify che manda l'email con il template in italiano; stessa tabella `inviti_cliente`. |
| **Scollegare un cliente** dall'account (officina o cliente stesso) | 🟢 | Oggi solo ADMIN/service role. Utile se l'invito è finito all'email sbagliata ed è stato accettato. |
| **Invito anche da "Nuovo cliente"** (casella "Invita nell'app" al salvataggio) | 🟢 | Un passaggio in meno per l'officina. |
| **Clienti senza app** nell'elenco clienti (filtro "da invitare") | 🟢 | Per far crescere l'uso dell'app; i dati ci sono (`profile_id`, inviti in corso). |
| **Logo dell'officina** nel report stampato | 🟢 | Serve il caricamento del logo (Storage). |
| **Filtri commerciali nel garage officina** (cambio stagionale da fare, nessun controllo da X mesi) | 🟠 | PLAN P13; per ora filtri per stato e ricerca. |
| ~~**Editor degli orari dell'officina**~~ (titolare) | ✅ | Fatto nella sessione 14, con le chiusure straordinarie e il formato validato nel database. |
| **Notifiche delle prenotazioni** (nuova richiesta all'officina, conferma/proposta/rifiuto al cliente) | 🔴 | **Nell'app fatte il 2026-10-14** (sessione 16): voce "Notifiche" con badge in tempo reale. Web Push fatte lo stesso giorno; resta l'email (dopo l'SMTP definitivo). |
| ~~**Promemoria del giorno prima**~~ ("Domani hai un appuntamento") | ✅ | Fatto nella sessione 17 (2026-10-14): job orario di Supabase Cron, dalle 18 del giorno prima, tipo `PROMEMORIA` (anche push). |
| ~~**Esito del controllo** e **cambio stagionale**~~ | ✅ | Fatti nella sessione 17 (2026-10-14): notifica al cliente dopo un controllo con gomme gialle/rosse; promemoria stagionale dal 15 ottobre e dal 15 marzo. |
| **Promemoria gomme vecchie** (DOT oltre i 5 anni) | 🟠 | Scartato per ora dal titolare (2026-10-14). Stesso schema di `crea_promemoria_pneumatici()`, chiave per pneumatico. |
| ~~Pulizia delle notifiche vecchie~~ | ✅ | Fatta il 2026-10-24 (T049): job notturno `pulizia-notifiche`. |
| **Preferenze delle notifiche** (quali ricevere, su quali canali) | 🟢 | PLAN P5; utile quando arrivano push ed email. |
| ~~**Prenota dal garage**~~: pulsante "Prenota" nella carta dell'officina del veicolo, con targa già scelta | ✅ | Fatto il 2026-10-13 (sessione 15); nel report la carta resta senza "Prenota". |
| ~~**Officine vicine** (distanza dalla posizione del telefono)~~ | ✅ | Fatto il 2026-10-23 (T019): «Vicino a me» ordina per distanza; PLAN P14. |
| **Invito dalla richiesta** quando la targa è già di un cliente non collegato | 🟢 | Oggi la richiesta apre la scheda del veicolo; si potrebbe proporre l'invito già scritto con l'email dell'account di chi ha prenotato (sessione 15). |
| **Capienza e slot automatici** (ponti/operatori, appuntamenti già presi) | 🟠 | P14 fase successiva; oggi l'officina decide l'ora a mano. Dal 2026-10-23 (T020) c'è la capienza per fascia nel database (interfaccia: T021); restano gli slot orari. |
| **Collegare la prenotazione al cliente dell'officina** (crea il cliente e il veicolo dalla richiesta, o invita) | 🟢 | Oggi il dettaglio apre la scheda del veicolo se la targa è già registrata. |
| **Chi lavora in officina prenota altrove** | 🟢 | Per lui "Appuntamenti" mostra quelli dell'officina e "Officine" non è nella barra (la pagina `/officine` funziona comunque). |
| ~~**Calendario dell'officina**~~ | ✅ | Fatto nella sessione 14 (settimana + agenda del giorno). Da valutare: vista di più giorni affiancati sul tablet, trascinare un appuntamento per spostarlo. |
| **Settimana a colonne al computer** (gli appuntamenti di ogni giorno dentro la sua colonna, ore in verticale) | 🟠 | Oggi al computer il calendario ha giorni più alti e mattina/pomeriggio affiancati (2026-10-13); la vista vera da agenda richiede di cambiare `pagine/calendario.ts`. |
| **Elenco veicoli a tabella** al computer (colonne targa, veicolo, cliente, ultimo controllo, stato; ordinabile) | 🟠 | Più denso dell'elenco a righe per officine con molti veicoli; insieme alla ricerca lato server. |
| **Altre scorciatoie da tastiera** (es. `N` nuovo veicolo, `G` poi `C` clienti) con un pannello `?` che le elenca | 🟢 | Oggi c'è solo `/` per cercare (`attivaScorciatoie` in `ui/layout.ts`). |
| **Barra laterale più ricca** al computer: nome dell'officina, numero di richieste da confermare accanto ad "Appuntamenti" | 🟢 | Il numero oggi è solo nell'avviso della home; servirebbe caricarlo una volta per sessione. |

## Tecnica

| Idea | Priorità | Note |
|------|----------|------|
| **PowerSync** per scrittura offline | 🟢 | Vedi PLAN P6. |
| **Stripe Billing** per abbonamenti | 🔴 | Necessario in fase commerciale. |
| **Email/SMS/WhatsApp** come canali reminder | 🔴 | Fallback per iOS senza PWA installata (PLAN P5). |
| ~~**Playwright** test end-to-end~~ | ✅ | Fatto nella sessione 14 (inviti e prenotazioni, job CI `e2e`). |
| **Lighthouse CI** in GitHub Actions | 🟠 | |
| **Sentry** monitoraggio errori | 🟠 | |
| ~~**Dashboard ADMIN** con metriche~~ | ✅ | Fatto il 2026-11-12 (`/admin`, branch `claude/pannello-admin`); restano andamenti nel tempo e churn. |
| **Admin: modifica dei dati di un'officina** (indirizzo, orari, titolare) dal pannello | 🟠 | Oggi l'admin attiva/sospende e cambia il piano; il resto lo fa il titolare o l'editor SQL. |
| **Admin: blocco immediato** anche del token già emesso | 🟢 | Oggi blocco e «Chiudi le sessioni» valgono al massimo dopo 1 ora: servirebbe un controllo di `banned_until` nelle policy o un `jwt_expiry` più breve. |
| **2FA per i titolari delle officine** (facoltativa, poi obbligatoria) | 🟠 | Il flusso di `admin-comune.ts` si può riusare nel Profilo. |
| **Codici di recupero o seconda app per la 2FA dell'admin** | 🟢 | Oggi il recupero è dall'editor SQL. |
| **Password più robuste e protezione dalle password trapelate** | 🟠 | `password_requirements`, *Leaked password protection* e `secure_password_change` in Supabase (dashboard e `config.toml`). |
| **Ambiente DOM (happy-dom/jsdom) per i test unitari delle pagine ospite** | 🟢 | Oggi `accedi`, `registrati` e `password-dimenticata` (T092) e la pagina `/r` (T064) si provano solo con l'e2e; un ambiente DOM nei test unitari li renderebbe veloci. Aggiunge una dipendenza (voce in `STRUCT.md`). |
| **Ricerca veicoli lato server** (paginazione, indice trigram) | 🟢 | Oggi l'elenco si carica tutto e si filtra nel browser: va bene fino a qualche migliaio di veicoli. |
| **Controllo offline in piazzale** (bozza salvata nel browser, invio alla riconnessione) | 🟠 | Alternativa leggera a PowerSync per il modulo "Nuovo controllo". |
| **Avviso di database cloud non allineato** (migrazioni di `main` non ancora pubblicate con `db push`) | 🟠 | Il 2026-11-08 il cloud era fermo a metà ottobre mentre Vercel pubblicava il codice nuovo: commenti e *Appuntamenti* in errore. Possibile: una riga nel Quadro di ai-org dopo ogni treno con migrazioni, o un job CI che confronta `supabase_migrations.schema_migrations` (serve un token in sola lettura). |

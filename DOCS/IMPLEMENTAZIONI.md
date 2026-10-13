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
| **Annullare uno smontaggio** fatto per errore | 🟢 | Oggi si rimonta con "Cambia pneumatici" (nuovo record) oppure lo corregge un ADMIN. |
| **Pressione consigliata** per veicolo/misura e confronto con quella misurata | 🟠 | PLAN P10: "misurata vs consigliata". |
| **DOT diverso per ruota** nel montaggio di un treno | 🟢 | Oggi un DOT per tutto il treno: se differiscono si monta una ruota alla volta. |
| **Garage anche per chi lavora in officina** (titolare con la sua auto cliente di un'altra officina) | 🟢 | Oggi la home di un membro di officina è sempre l'elenco dell'officina: servirebbe una voce "Il mio garage". `caricaGarage()` è già pronto (filtra per account). |
| ~~**Prenota dalla scheda del garage**~~ quando un pneumatico è da sostituire | ✅ | Fatto il 2026-10-13 (sessione 15): "Prenota la sostituzione" / "Prenota un controllo" sotto l'avviso. |
| **Età degli pneumatici dal DOT** anche nella carta del garage e nella scheda officina | 🟢 | Già nella pagina dello pneumatico (sessione 11), con avviso oltre i 5 anni. |
| **Seed con più controlli** per la Panda (per vedere il grafico in locale) | 🟢 | Oggi il seed ha un solo controllo; aggiungerne uno cambia i conteggi di `dati.test.sql`. |
| **Promemoria dalla stima del consumo** ("tra circa 2 mesi arrivi a 3 mm") | 🟠 | Fase 5: la stima c'è già in `lib/salute.ts`. |
| **Link pubblico del report** di un controllo (da mandare a chi non ha l'app, es. un familiare) | 🟠 | Oggi c'è "Stampa o salva in PDF". Servirebbe un token casuale e revocabile per controllo, letto da una rotta Fastify o da una funzione `security definer` (mai una policy RLS aperta), con scadenza. |
| **Invio del report al cliente** (email/WhatsApp) quando l'officina salva il controllo | 🟠 | Dopo il link pubblico; per i clienti senza account. |
| **Invio automatico dell'invito** da TyreCare (oggi parte dal programma di posta dell'officina) | 🟠 | Con l'SMTP definitivo: Edge Function o rotta Fastify che manda l'email con il template in italiano; stessa tabella `inviti_cliente`. |
| **Scollegare un cliente** dall'account (officina o cliente stesso) | 🟢 | Oggi solo ADMIN/service role. Utile se l'invito è finito all'email sbagliata ed è stato accettato. |
| **Invito anche da "Nuovo cliente"** (casella "Invita nell'app" al salvataggio) | 🟢 | Un passaggio in meno per l'officina. |
| **Clienti senza app** nell'elenco clienti (filtro "da invitare") | 🟢 | Per far crescere l'uso dell'app; i dati ci sono (`profile_id`, inviti in corso). |
| **Logo dell'officina** nel report stampato | 🟢 | Serve il caricamento del logo (Storage). |
| **Filtri commerciali nel garage officina** (cambio stagionale da fare, nessun controllo da X mesi) | 🟠 | PLAN P13; per ora filtri per stato e ricerca. |
| ~~**Editor degli orari dell'officina**~~ (titolare) | ✅ | Fatto nella sessione 14, con le chiusure straordinarie e il formato validato nel database. |
| **Notifiche delle prenotazioni** (nuova richiesta all'officina, conferma/proposta/rifiuto al cliente) | 🔴 | Fase 5 (Web Push + email). Per ora le novità si vedono aprendo l'app; l'officina ha l'avviso in home. |
| ~~**Prenota dal garage**~~: pulsante "Prenota" nella carta dell'officina del veicolo, con targa già scelta | ✅ | Fatto il 2026-10-13 (sessione 15); nel report la carta resta senza "Prenota". |
| **Officine vicine** (distanza dalla posizione del telefono) | 🟠 | Le officine hanno già latitudine e longitudine; PLAN P14. |
| **Capienza e slot automatici** (ponti/operatori, appuntamenti già presi) | 🟠 | P14 fase successiva; oggi l'officina decide l'ora a mano. |
| **Collegare la prenotazione al cliente dell'officina** (crea il cliente e il veicolo dalla richiesta, o invita) | 🟢 | Oggi il dettaglio apre la scheda del veicolo se la targa è già registrata. |
| **Chi lavora in officina prenota altrove** | 🟢 | Per lui "Appuntamenti" mostra quelli dell'officina e "Officine" non è nella barra (la pagina `/officine` funziona comunque). |
| ~~**Calendario dell'officina**~~ | ✅ | Fatto nella sessione 14 (settimana + agenda del giorno). Da valutare: vista di più giorni affiancati sul tablet, trascinare un appuntamento per spostarlo. |

## Tecnica

| Idea | Priorità | Note |
|------|----------|------|
| **PowerSync** per scrittura offline | 🟢 | Vedi PLAN P6. |
| **Stripe Billing** per abbonamenti | 🔴 | Necessario in fase commerciale. |
| **Email/SMS/WhatsApp** come canali reminder | 🔴 | Fallback per iOS senza PWA installata (PLAN P5). |
| ~~**Playwright** test end-to-end~~ | ✅ | Fatto nella sessione 14 (inviti e prenotazioni, job CI `e2e`). |
| **Lighthouse CI** in GitHub Actions | 🟠 | |
| **Sentry** monitoraggio errori | 🟠 | |
| **Dashboard ADMIN** con metriche (officine attive, prenotazioni, churn) | 🟠 | |
| **Ricerca veicoli lato server** (paginazione, indice trigram) | 🟢 | Oggi l'elenco si carica tutto e si filtra nel browser: va bene fino a qualche migliaio di veicoli. |
| **Controllo offline in piazzale** (bozza salvata nel browser, invio alla riconnessione) | 🟠 | Alternativa leggera a PowerSync per il modulo "Nuovo controllo". |

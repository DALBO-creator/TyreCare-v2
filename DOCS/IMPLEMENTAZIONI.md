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
| **Modifica ed eliminazione** di clienti, veicoli, pneumatici e controlli (lato officina) | 🔴 | Emerso in sessione 7: oggi si può solo inserire. Eliminare clienti/veicoli è del TITOLARE (RLS già pronta). |
| **Elenco e scheda clienti** dell'officina (con i loro veicoli) | 🟠 | Oggi un cliente si vede solo dal veicolo. |
| **Pressione consigliata** per veicolo/misura e confronto con quella misurata | 🟠 | PLAN P10: "misurata vs consigliata". |
| **DOT diverso per ruota** nel montaggio di un treno | 🟢 | Oggi un DOT per tutto il treno: se differiscono si monta una ruota alla volta. |
| **Filtri commerciali nel garage officina** (cambio stagionale da fare, nessun controllo da X mesi) | 🟠 | PLAN P13; per ora filtri per stato e ricerca. |

## Tecnica

| Idea | Priorità | Note |
|------|----------|------|
| **PowerSync** per scrittura offline | 🟢 | Vedi PLAN P6. |
| **Stripe Billing** per abbonamenti | 🔴 | Necessario in fase commerciale. |
| **Email/SMS/WhatsApp** come canali reminder | 🔴 | Fallback per iOS senza PWA installata (PLAN P5). |
| **Playwright** test end-to-end | 🟠 | |
| **Lighthouse CI** in GitHub Actions | 🟠 | |
| **Sentry** monitoraggio errori | 🟠 | |
| **Dashboard ADMIN** con metriche (officine attive, prenotazioni, churn) | 🟠 | |
| **Ricerca veicoli lato server** (paginazione, indice trigram) | 🟢 | Oggi l'elenco si carica tutto e si filtra nel browser: va bene fino a qualche migliaio di veicoli. |
| **Controllo offline in piazzale** (bozza salvata nel browser, invio alla riconnessione) | 🟠 | Alternativa leggera a PowerSync per il modulo "Nuovo controllo". |

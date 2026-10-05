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

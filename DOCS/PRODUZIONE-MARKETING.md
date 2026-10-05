# PRODUZIONE e MARKETING — Piano economico

> **Stime indicative** (ottobre 2026), da verificare prima di ogni decisione. Prezzi dei servizi cloud in dollari
> convertiti in modo approssimativo. Tutti i prezzi di vendita si intendono **IVA esclusa** (clienti B2B).
> Imposte e contributi sul reddito non inclusi: dipendono dal regime fiscale (da verificare con il commercialista).

## 1. Riferimento di mercato

- Un gommista paga circa **1.000 €/anno** per il proprio gestionale.
- Nella fase iniziale TyreCare **non sostituisce** il gestionale ma si **aggiunge**: il prezzo deve restare
  chiaramente sotto quella cifra e va giustificato da un ritorno concreto per l'officina (più clienti che tornano
  per il cambio stagionale, agenda piena, meno telefonate).

## 2. Costi

### 2.1 Costi di avvio (una tantum)

| Voce | Scenario A — sviluppo in proprio | Scenario B — sviluppo con supporto esterno |
|------|---------------------------------:|-------------------------------------------:|
| Sviluppo MVP (~400 ore) | 0 € (tempo proprio) | 14.000 € (400 h × 35 €/h) |
| Consulenza legale (licenza, termini di servizio, privacy, DPA) | 1.500 € | 1.500 € |
| Deposito marchio "TyreCare" (dopo verifica disponibilità) | 300 € | 300 € |
| Logo e materiale grafico | 300 € | 300 € |
| Apertura partita IVA / pratiche | 200 € | 200 € |
| **Totale** | **2.300 €** | **16.300 €** |

### 2.2 Costi fissi annui

| Voce | €/anno |
|------|-------:|
| Supabase Pro (~25 $/mese) | 280 |
| Vercel Pro (~20 $/mese) | 225 |
| Dominio + email professionale | 100 |
| Servizio email transazionali (reminder di riserva) | 200 |
| Commercialista | 1.200 |
| Assicurazione RC professionale | 400 |
| Marketing (materiale, fiere di settore, pubblicità locale) | 2.000 |
| Imprevisti | 300 |
| **Totale** | **≈ 4.700** |

### 2.3 Costi variabili per officina (annui)

| Voce | €/anno |
|------|-------:|
| Commissioni Stripe (~1,5% + 0,25 € a pagamento mensile) | ≈ 10 |
| Quota infrastruttura aggiuntiva (storage foto, traffico) | ≈ 10 |
| Assistenza e manutenzione (~0,5 h/mese valorizzate 25 €/h) | 150 |
| **Totale** | **≈ 170** |

## 3. Modelli di ricavo

### Modello 1 — Abbonamento (consigliato come base)

| Piano | Prezzo | Contenuto |
|-------|-------:|-----------|
| **Starter** | 29 €/mese (348 €/anno) | Import dati, garage officina, storico e report, stato pneumatici, reminder |
| **Pro** | 49 €/mese (588 €/anno) | Starter + prenotazioni, catalogo servizi, notifiche illimitate, statistiche |
| **Attivazione** (una tantum) | 149 € | Installazione, configurazione, primo import, formazione |

Sconto suggerito: 2 mesi gratis con pagamento annuale. Manutenzione e aggiornamenti sono **inclusi**
nell'abbonamento.

### Modello 2 — Commissione 1% sui preventivi (sconsigliato come unico modello)

Esempio: preventivo medio per 4 pneumatici ≈ 400 € → 4 € a preventivo. Con 20 preventivi/mese = 80 €/mese.

Problemi:

- un **preventivo non è una vendita**: non è chiaro su cosa calcolare l'1%;
- il pagamento avviene **in officina**, fuori dall'app: TyreCare **non può verificare** l'importo reale;
- l'officina ha interesse a far passare i lavori fuori dall'app;
- ricavi imprevedibili, difficili da pianificare.

### Modello 3 — Ibrido (alternativa al Modello 2)

**Canone ridotto + fee fissa per prenotazione completata tramite TyreCare.** Esempio: 19 €/mese + 1 € per
prenotazione completata. È **misurabile** (la prenotazione è nell'app) e lega il costo al valore portato.

| Prenotazioni completate/mese | Ricavo annuo per officina |
|-----------------------------:|--------------------------:|
| 10 | 228 + 120 = 348 € |
| 30 | 228 + 360 = 588 € |
| 60 | 228 + 720 = 948 € |

## 4. Break Even Point (BEP)

Ipotesi: ricavo medio per officina **468 €/anno** (metà Starter, metà Pro), costo variabile **170 €/anno**
→ **margine di contribuzione ≈ 298 € per officina/anno**. I costi di avvio sono ammortizzati in **3 anni**.
Le attivazioni da 149 € non sono conteggiate (stima prudente).

| | Scenario A | Scenario B |
|-|-----------:|-----------:|
| Costi fissi annui | 4.700 € | 4.700 € |
| Quota avvio (÷ 3 anni) | 767 € | 5.433 € |
| **Costi fissi totali annui** | **5.467 €** | **10.133 €** |
| **BEP = costi fissi / margine unitario** | 5.467 / 298 ≈ **19 officine** | 10.133 / 298 ≈ **34 officine** |

### Proiezione — Scenario A

| Officine abbonate | Ricavi | Costi (fissi + variabili) | Risultato |
|------------------:|-------:|--------------------------:|----------:|
| 10 | 4.680 € | 7.167 € | **−2.487 €** |
| 20 | 9.360 € | 8.867 € | **+493 €** |
| 30 | 14.040 € | 10.567 € | **+3.473 €** |
| 50 | 23.400 € | 13.967 € | **+9.433 €** |

Formula: `Risultato = n × 468 − (5.467 + n × 170)`.

## 5. Go-to-market

1. **Pilota gratuito (3 mesi)** con 2–3 gommisti della zona: dati reali, feedback, testimonianze.
2. **Argomento di vendita** per l'officina: reminder automatici del cambio stagionale = clienti che tornano;
   prenotazioni senza telefonate; immagine moderna verso il cliente.
3. **Canali**: visita diretta, passaparola tra gommisti, associazioni di categoria, distributori di pneumatici,
   fiere di settore.
4. **Indicatori da monitorare**: officine attive, clienti finali registrati per officina, % PWA installate,
   prenotazioni/mese, disdette (churn), tempo medio di onboarding.

## 6. Fase successiva — Gestionale TyreCare

Quando TyreCare diventerà un gestionale completo potrà essere proposto **in sostituzione** del gestionale attuale,
con un prezzo vicino al riferimento di mercato (es. 69–89 €/mese, cioè 828–1.068 €/anno) e margini più alti.
Richiede però funzioni obbligatorie (es. fatturazione elettronica) e molto più sviluppo e assistenza: da
pianificare dopo aver validato il prodotto con le prime officine.

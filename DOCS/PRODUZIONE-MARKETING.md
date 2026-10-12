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
   **Primo partner confermato: LA SANTI GOMME** (gestionale GESTITYRE, export `.xls`). Altri gommisti che
   usano GESTITYRE sono i candidati più facili per il pilota: l'adattatore di import sarà già pronto.
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

## 7. Valutazione dell'app in caso di cessione

> **Stima indicativa** (ottobre 2026), non una perizia. La vendita **non è in programma**: la sezione serve a
> capire quanto vale il progetto e quali scelte lo fanno crescere. Per una cessione reale servono un
> commercialista e un contratto di cessione dei diritti scritto da un legale.

Regola di fondo: **il valore non dipende dal codice ma da quante officine pagano.** Un'app finita ma senza
clienti vale poco; la stessa app con 50 officine abbonate vale circa dieci volte tanto.

### 7.1 Metodo del costo di rifacimento

Stato al 2026-10-12: circa 15.600 righe di TypeScript/SQL, monorepo, RLS, test unitari ed end-to-end, CI,
documentazione completa; roadmap alla Fase 4 di 7.

- Ore per arrivare all'app finita (Fasi 0–7): circa **600–900 h**.
- A 35–50 €/h (sviluppatore italiano) → **20.000–45.000 €**.

È il **tetto massimo**, non il prezzo di vendita: chi compra non paga quello che è costato costruirla, e con
l'AI rifarla costa sempre meno. Il solo codice, senza clienti, si vende in genere a **5.000–25.000 €**.

### 7.2 Metodo del multiplo dei ricavi (quello usato davvero)

Le piccole app SaaS si vendono di solito a **2–4 volte i ricavi ricorrenti annui (ARR)**. Con il ricavo medio
del § 4 (468 €/anno per officina):

| Officine paganti | Ricavi annui | Valore indicativo |
|-----------------:|-------------:|------------------:|
| 0 (app finita, nessun cliente) | 0 € | 5–25k € |
| 20 (circa il BEP) | 9.400 € | 20–40k € |
| 50 | 23.400 € | 50–95k € |
| 100 | 46.800 € | 100–190k € |
| 300 | 140.000 € | 350–600k € |

Il multiplo sale verso 4x e oltre con **poche disdette**, clienti in crescita e un'app che **funziona senza il
fondatore**; scende verso 1–2x se tutto dipende da una sola persona.

### 7.3 Acquirente strategico

I compratori più interessanti non sono investitori generici:

- **produttori di gestionali per gommisti** (es. il fornitore di GESTITYRE): TyreCare darebbe loro l'app per
  i clienti finali che a loro manca;
- **reti di distributori e franchising di pneumatici**, interessati a fidelizzare i clienti delle officine.

Per loro contano i **clienti finali registrati** e i **dati sui pneumatici**, non le righe di codice: possono
pagare sopra il multiplo dei ricavi. Alternativa alla vendita: **licenza white-label** con canone annuo, che a
volte rende più della cessione.

### 7.4 Cosa aumenta e cosa abbassa il valore

**A favore:**

- abbonamento ricorrente;
- mercato specifico (gommisti) non ancora presidiato;
- documentazione in `DOCS/` che rende facile la due diligence;
- test, CI e uno stack moderno e diffuso;
- licenza proprietaria già scritta ([`LICENSE.md`](LICENSE.md)).

**Contro:**

- **dipendenza dall'export dei gestionali**: se il produttore cambia il formato o fa un'app simile, il prodotto
  è a rischio;
- tutto dipende da una sola persona;
- notifiche push su iPhone solo con l'app installata nella schermata Home (PLAN P5);
- niente fatturazione elettronica, quindi non sostituisce un gestionale (§ 6);
- funzionalità facili da copiare.

**Da sistemare prima di qualsiasi trattativa:**

- **marchio "TyreCare"**: verificare che sia libero e registrarlo (§ 2.1); un nome contestato pesa molto sul
  prezzo;
- **proprietà del codice**: parte del lavoro è fatta sul PC della scuola. Di solito non crea problemi, ma va
  accertato che la scuola non abbia diritti su quanto sviluppato.

### 7.5 Sintesi

| Situazione | Valore realistico |
|------------|------------------:|
| Oggi (Fase 4, nessun ricavo) | 2–10k € |
| App finita, nessun cliente | 5–25k € |
| Pilota fatto + 10–20 officine paganti | 15–45k € |
| 50 officine | ~50–100k € |
| 100+ officine con poche disdette | 100–200k €+ |

Il passaggio che fa crescere di più il valore è il **pilota con LA SANTI GOMME e le prime 20 officine
paganti**: lì l'app smette di essere "codice" e diventa "un'attività che funziona".

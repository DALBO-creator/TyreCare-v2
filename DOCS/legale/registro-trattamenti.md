**BOZZA — da rivedere con un consulente prima dell'uso**

# Registro delle attività di trattamento (art. 30 GDPR) — TyreCare

Ultimo aggiornamento: 2026-10-22 (bozza) · [DA COMPLETARE: data di adozione]

Il registro ha due parti:

- **Parte A — TyreCare titolare** (art. 30.1): i trattamenti che TyreCare decide per sé;
- **Parte B — TyreCare responsabile** (art. 30.2): i trattamenti svolti per conto delle officine
  affiliate, secondo l'accordo `dpa-officine.md`.

I dati e le misure descritti corrispondono al codice al 2026-10-22 (tabelle e regole di accesso in
`supabase/migrations/`). Le misure che ancora mancano sono nel `README.md`, sezione "Da fare prima del
lancio": non vanno considerate attive finché non sono realizzate.

## Dati di chi tiene il registro

- Titolare / responsabile: [DA COMPLETARE: nome e cognome o ragione sociale di chi offre TyreCare]
- Sede: [DA COMPLETARE: indirizzo / sede legale] · [DA COMPLETARE: partita IVA o codice fiscale]
- Contatto privacy: [DA COMPLETARE: email per le richieste privacy]
- [DA COMPLETARE: eventuale responsabile della protezione dei dati (DPO), se nominato]
- [DA COMPLETARE: eventuale rappresentante nell'UE — non serve se il titolare è stabilito in Italia]

## Misure di sicurezza comuni (art. 32)

Valgono per tutti i trattamenti; ogni scheda indica solo le particolarità.

- **M1 — Regole di accesso per riga (RLS).** Tutte le 22 tabelle in `public` hanno
  `enable row level security`: ogni utente legge e modifica solo le righe che gli spettano (il proprio
  account, la propria officina, i veicoli collegati al proprio account). Verificate con test pgTAP in
  `supabase/tests/database/`, anche per gli accessi negati (es. un'altra officina non vede i controlli).
- **M2 — Accessi per ruolo.** Ruoli: cliente, membro dell'officina (titolare o operatore),
  amministratore di TyreCare. Operazioni delicate solo al titolare dell'officina (eliminare clienti e
  veicoli, import, catalogo dei servizi); l'amministratore nell'app non vede i dati dei clienti delle
  officine.
- **M3 — Cifratura in transito.** L'app usa solo connessioni HTTPS/TLS verso Vercel e verso le interfacce
  di Supabase (database e autenticazione). [DA COMPLETARE: SSL obbligatorio sulle connessioni dirette al
  database, vedi README]
- **M4 — Database nell'UE.** Supabase, regione eu-west-1 (Irlanda).
- **M5 — Credenziali.** Password solo in forma cifrata non reversibile (servizio di autenticazione di
  Supabase); codici degli inviti salvati solo come impronta SHA-256; sessioni con token a scadenza
  (1 ora) e rotazione del token di rinnovo; conferma dell'email obbligatoria (impostazioni in
  `supabase/config.toml`; [DA COMPLETARE: verificare che il progetto cloud abbia le stesse]).
- **M6 — Chiave di servizio solo sul server.** La chiave che salta le regole di accesso è usata solo dalla
  funzione sul server che invia le notifiche push, mai nell'app.

[DA COMPLETARE: cifratura a riposo, copie di sicurezza, registro degli accessi del personale — vedi
README, "Da fare prima del lancio"]

---

# Parte A — TyreCare titolare del trattamento

## A1. Account e profili degli utenti

| Voce | Contenuto |
|------|-----------|
| Finalità | Registrazione, accesso, recupero della password, gestione del profilo e del ruolo; collegamento dei membri alle officine |
| Base giuridica | Esecuzione del contratto (art. 6.1.b) — termini di servizio |
| Interessati | Clienti con account, titolari e operatori delle officine, amministratori di TyreCare |
| Dati | Email, password (cifrata), nome, cognome, telefono (facoltativo), ruolo nell'app, ruolo nell'officina (titolare/operatore), date di creazione e modifica (tabelle `auth.users`, `profiles`, `officina_utenti`) |
| Destinatari | L'utente stesso; i colleghi della stessa officina (nome e ruolo); l'amministratore di TyreCare (profili); sub-responsabili: Supabase (database, autenticazione), Resend (email di conferma e recupero), Vercel (hosting dell'app) |
| Trasferimenti extra UE | Database nell'UE; Vercel e Resend sono società USA [DA COMPLETARE: regione e garanzie — README, domanda 5] |
| Conservazione | Finché l'account è attivo; dopo la richiesta di cancellazione [DA COMPLETARE: entro quanti giorni]. L'utente elimina l'account dal Profilo («Elimina il tuo account») |
| Misure | M1–M6; il ruolo nell'app e lo stato delle officine li cambia solo l'amministratore |

## A2. Notifiche nell'app

| Voce | Contenuto |
|------|-----------|
| Finalità | Avvisare gli utenti dei cambi di stato delle prenotazioni, dei promemoria del giorno prima, dell'esito dei controlli e del cambio stagionale degli pneumatici. Se l'app non riesce a mandare la push a nessun dispositivo dell'utente (per esempio perché non ha attivato le push), la stessa notifica va per email all'indirizzo dell'account (email di riserva, via Resend; l'utente la spegne con l'interruttore «Email» della pagina Notifiche; spente in tutta l'app dal [DA COMPLETARE: data di attivazione delle email di riserva]) |
| Base giuridica | Esecuzione del contratto (art. 6.1.b) per le prenotazioni; promemoria: [DA COMPLETARE: contratto, legittimo interesse o consenso — README, domanda 1] |
| Interessati | Utenti con account (clienti e membri delle officine) |
| Dati | Destinatario, tipo, titolo, testo, collegamento, data di lettura (tabella `notifiche`); i testi possono citare targa, officina, data dell'appuntamento |
| Destinatari | Solo il destinatario (M1); sub-responsabile Supabase (database, job pianificati `pg_cron`); Resend, solo per le email di riserva |
| Trasferimenti extra UE | Nessuno per il database (UE); Resend è una società USA [DA COMPLETARE: regione e garanzie — README, domanda 5] |
| Conservazione | Il job notturno `pulizia-notifiche` cancella le lette dopo 180 giorni e tutte dopo 365 [DA COMPLETARE: confermare i tempi] |
| Misure | M1–M4; l'utente può solo leggere e segnare come lette le proprie notifiche, non crearle |

## A3. Iscrizioni alle notifiche push

| Voce | Contenuto |
|------|-----------|
| Finalità | Recapitare le notifiche sul dispositivo dell'utente, solo se le attiva |
| Base giuridica | Esecuzione del contratto (art. 6.1.b) su richiesta dell'utente [DA COMPLETARE: confermare con il consulente] |
| Interessati | Utenti che attivano le notifiche push |
| Dati | Indirizzo dell'iscrizione generato dal browser e chiavi tecniche (tabella `iscrizioni_push`) |
| Destinatari | Supabase (funzione sul server `invia-notifica`); servizi push del browser (Google, Apple, Mozilla o altri, scelti dal browser) |
| Trasferimenti extra UE | Possibili verso i servizi push dei browser [DA COMPLETARE: garanzie — README, domanda 4] |
| Conservazione | Finché l'utente non disattiva le push (l'iscrizione viene eliminata) |
| Misure | M1, M3, M4, M6; ogni utente vede e cancella solo le proprie iscrizioni |

## A4. Anagrafica delle officine affiliate

| Voce | Contenuto |
|------|-----------|
| Finalità | Mostrare le officine ai clienti, gestire l'affiliazione, gli orari, le chiusure e il catalogo dei servizi (l'abbonamento è nella scheda A7) |
| Base giuridica | Esecuzione del contratto (art. 6.1.b) |
| Interessati | Titolari di ditte individuali e referenti delle officine (i dati delle società non sono dati personali) |
| Dati | Ragione sociale, partita IVA, indirizzo, posizione sulla mappa, telefono, email, orari, chiusure, servizi con durata e prezzo, stato dell'affiliazione (tabelle `officine`, `chiusure_officina`, `servizi_officina`) |
| Destinatari | Chiunque apra l'app, anche senza account (solo le officine attive); membri dell'officina; amministratore di TyreCare; Supabase, Vercel |
| Trasferimenti extra UE | Come A1 |
| Conservazione | Per la durata dell'affiliazione; dati fiscali [DA COMPLETARE: es. 10 anni] |
| Misure | M1–M5; modifiche al titolare dell'officina o all'amministratore; creazione, eliminazione e stato dell'affiliazione solo all'amministratore |

## A5. Dati tecnici delle connessioni

| Voce | Contenuto |
|------|-----------|
| Finalità | Funzionamento e sicurezza del servizio, prevenzione degli abusi |
| Base giuridica | Legittimo interesse (art. 6.1.f) |
| Interessati | Tutti gli utenti e i visitatori |
| Dati | Indirizzo IP, browser, orari delle richieste, registrati dai fornitori |
| Destinatari | Supabase, Vercel, Resend |
| Trasferimenti extra UE | [DA COMPLETARE: secondo le regioni dei fornitori] |
| Conservazione | [DA COMPLETARE: tempi dei fornitori] |
| Misure | Gestite dai fornitori; TyreCare non aggiunge strumenti di analisi né cookie |

## A6. Aiuto su strada

| Voce | Contenuto |
|------|-----------|
| Finalità | Inoltrare la richiesta di aiuto del cliente alle officine vicine che offrono il servizio e metterlo in contatto con quella che accetta |
| Base giuridica | Richiesta dell'interessato (art. 6.1.b) |
| Interessati | Clienti che inviano una richiesta |
| Dati | Posizione precisa del telefono (presa solo all'invio, con il permesso del browser), telefono, descrizione (≤ 500 caratteri), targa (facoltativa), stato, officina che accetta, date |
| Destinatari | Prima dell'accettazione, le officine attive entro il raggio: solo distanza, descrizione e targa; dopo l'accettazione, solo l'officina che accetta: posizione esatta e telefono; Supabase |
| Ruolo dell'officina che accetta | [DA COMPLETARE: ruolo dell'officina che esegue l'intervento — titolare autonomo? da confermare con il consulente] |
| Trasferimenti extra UE | Come A1 |
| Conservazione | Non accettata: scade dopo 2 ore; accettata: si chiude da sola dopo 24 ore; chiusa, annullata o scaduta: cancellata dopo 90 giorni; cancellata subito con l'account del cliente |
| Misure | M1–M5; ogni officina vede solo le richieste del proprio raggio e quelle che ha accettato; la posizione esatta e il telefono solo a chi accetta |

## A7. Abbonamenti delle officine

Nell'app non c'è nessun pagamento (decisione del titolare del 2026-11-13): installazione e abbonamento
si pagano con bonifico su fattura e l'amministratore di TyreCare registra a mano l'abbonamento.

| Voce | Contenuto |
|------|-----------|
| Finalità | Gestire la prova, il piano e le scadenze dell'abbonamento dell'officina; registrare i pagamenti ricevuti fuori dall'app; adempiere agli obblighi fiscali |
| Base giuridica | Esecuzione del contratto (art. 6.1.b); obblighi fiscali (art. 6.1.c) |
| Interessati | Titolari delle officine (ditte individuali) e referenti; i dati delle società non sono dati personali |
| Dati | Piano (mensile o annuale), stato (prova, attivo, scaduto, sospeso), fine della prova, inizio e scadenza, installazione pagata e data, importo concordato, note interne dell'amministratore (tabella `abbonamenti`). Nessun dato di pagamento passa dall'app |
| Destinatari | Il titolare dell'officina (legge la propria riga, senza le note interne); amministratore di TyreCare; Supabase |
| Trasferimenti extra UE | Come A1 |
| Conservazione | Per la durata dell'abbonamento; dati fiscali per il tempo di legge [DA COMPLETARE: es. 10 anni, come nell'informativa §4] |
| Misure | M1–M5; la riga dell'abbonamento la leggono il titolare (senza le note interne) e l'amministratore (gli operatori no) e la scrivono solo le funzioni riservate all'amministratore |

## A8. Errori dell'app

| Voce | Contenuto |
|------|-----------|
| Finalità | Correggere i malfunzionamenti dell'app: gli errori non gestiti e quelli di caricamento delle pagine (non gli errori di rete né dei moduli) di chi ha un account arrivano a TyreCare invece che a un servizio esterno |
| Base giuridica | [DA COMPLETARE: base giuridica, proposta legittimo interesse (art. 6.1.f) — README, domanda 17] |
| Interessati | Utenti con account che incontrano un errore |
| Dati | Indirizzo della pagina senza query e frammento, cioè senza la parte dopo `?` e `#` (≤ 200 caratteri), messaggio (≤ 500), dettaglio tecnico (≤ 2000), versione dell'app, browser (≤ 300), account (autore), data (tabella `errori_app`) |
| Destinatari | Solo l'amministratore di TyreCare (pagina di amministrazione degli errori); sub-responsabile Supabase (database, job `pg_cron`); nessun servizio esterno di raccolta degli errori |
| Trasferimenti extra UE | Nessuno (database nell'UE) |
| Conservazione | Il job notturno `pulizia-errori-app` (ogni notte all'1:50 UTC) cancella gli errori più vecchi di 30 giorni; cancellati subito con l'account dell'utente |
| Misure | M1–M4; ognuno scrive solo a proprio nome, non può leggere né modificare né eliminare; l'app ne invia al massimo 5 per caricamento e il database ne accetta 30 al giorno per utente; non entrano in «Scarica i tuoi dati» |

---

# Parte B — TyreCare responsabile per conto delle officine

**Titolari:** ogni officina affiliata, con cui è firmato l'accordo `dpa-officine.md`.
[DA COMPLETARE: elenco delle officine titolari con i loro contatti (al pilota: LA SANTI GOMME) e data
dell'accordo firmato]

**Categorie di trattamenti svolti per conto di ogni officina:** quelli elencati qui sotto. Per tutti:

- **base giuridica:** la sceglie l'officina titolare; TyreCare agisce sulle sue istruzioni (art. 28);
- **destinatari:** i membri dell'officina; i clienti collegati per i propri veicoli; sub-responsabili
  Supabase (database, UE) e Vercel (hosting dell'app; i dati passano dal browser al database);
- **trasferimenti extra UE:** nessuno per i dati conservati (database nell'UE); [DA COMPLETARE: Vercel e,
  per i promemoria push, i servizi push dei browser — README, domande 4 e 5];
- **conservazione:** quella decisa dall'officina; alla fine del contratto restituzione o cancellazione
  entro [DA COMPLETARE: N giorni] (DPA §13), con la copia scaricabile dall'officina. Cancellazione
  automatica solo per le notifiche (A2) e per le prenotazioni (B6: 24 mesi dopo il giorno dell'appuntamento);
- **misure:** M1–M6. L'amministratore di TyreCare nell'app non vede questi dati.

## B1. Anagrafica dei clienti dell'officina

| Voce | Contenuto |
|------|-----------|
| Finalità | Tenere la scheda dei clienti dell'officina e collegarla all'account del cliente |
| Interessati | Clienti dell'officina (persone fisiche, ditte, referenti) |
| Dati | Nome, cognome o ragione sociale, telefono, email, codice del gestionale, note, consenso promozionale registrato dall'officina, collegamento all'account, origine del dato (tabella `clienti_officina`) |
| Destinatari | Membri dell'officina; il cliente stesso, se collegato |
| Misure particolari | Eliminazione solo al titolare dell'officina |

## B2. Veicoli

| Voce | Contenuto |
|------|-----------|
| Finalità | Registrare i veicoli dei clienti dell'officina e mostrarli nel garage del cliente collegato |
| Interessati | Clienti dell'officina |
| Dati | Targa, telaio (facoltativo), marca, modello, anno (tabella `veicoli`) |
| Destinatari | Membri dell'officina; il cliente collegato |
| Misure particolari | Eliminazione solo al titolare dell'officina |

## B3. Pneumatici

| Voce | Contenuto |
|------|-----------|
| Finalità | Registrare gli pneumatici montati e calcolarne lo stato di salute |
| Interessati | Clienti dell'officina |
| Dati | Posizione, stagione, misura, marca, modello, DOT, date di montaggio e smontaggio (tabella `pneumatici`) |
| Destinatari | Membri dell'officina; il cliente collegato |

## B4. Controlli e misure

| Voce | Contenuto |
|------|-----------|
| Finalità | Registrare i controlli con le misure, produrre il report del controllo, generare i promemoria sull'esito e sul cambio stagionale |
| Interessati | Clienti dell'officina; membri dell'officina che registrano il controllo |
| Dati | Data, chilometri, note, codice del documento, autore; battistrada, pressione, usura, danni (tabelle `controlli`, `misure_pneumatico`) |
| Destinatari | Membri dell'officina; il cliente collegato; servizi push dei browser per i promemoria (se il cliente ha attivato le push) |

## B5. Inviti ai clienti

| Voce | Contenuto |
|------|-----------|
| Finalità | Permettere al cliente di collegare i propri veicoli al suo account |
| Interessati | Clienti dell'officina; membri che creano l'invito |
| Dati | Email di destinazione, autore, scadenza, data di utilizzo o annullamento, chi l'ha usato; codice solo come impronta SHA-256 (tabella `inviti_cliente`) |
| Destinatari | Membri dell'officina. L'email dell'invito parte dal programma di posta dell'officina, non da TyreCare |

## B6. Prenotazioni

| Voce | Contenuto |
|------|-----------|
| Finalità | Gestire le richieste di appuntamento: proposta, conferma, rifiuto, calendario dell'officina; collegarle alla scheda del cliente |
| Interessati | Clienti che prenotano; membri dell'officina che le gestiscono |
| Dati | Officina, servizio, nome e telefono di chi prenota, targa e descrizione del veicolo, giorno e fascia, note, stato, orario proposto o confermato, messaggio dell'officina, chi l'ha gestita (tabella `prenotazioni`) |
| Destinatari | Il cliente che ha prenotato; i membri dell'officina scelta |
| Conservazione | Il job notturno `pulizia-prenotazioni` cancella le prenotazioni 24 mesi dopo il giorno dell'appuntamento, in qualsiasi stato; con loro spariscono le notifiche collegate. Cancellate subito con l'account del cliente che le ha fatte |
| Nota | [DA COMPLETARE: la richiesta la crea il cliente (TyreCare titolare, informativa §1.a) e la gestisce l'officina: confermare con il consulente se va in Parte A, in Parte B o se è contitolarità — README, domanda 6] |

## B7. Import dal gestionale

| Voce | Contenuto |
|------|-----------|
| Finalità | Caricare in blocco clienti e veicoli dal gestionale dell'officina, con anteprima e registro |
| Interessati | Clienti dell'officina; titolare che esegue l'import |
| Dati | Contenuto del file (letto nel browser, **non conservato**); registro dell'import: nome del file, righe importate e scartate, clienti e veicoli nuovi o aggiornati, autore e data (tabella `import_log`); associazioni di colonne salvate (tabella `import_mappature`) |
| Destinatari | Membri dell'officina (registro); solo il titolare (associazioni di colonne) |
| Misure particolari | Import ed associazioni solo al titolare dell'officina; scrittura in un'unica transazione |

**BOZZA — da rivedere con un consulente prima dell'uso**

# Procedura per le violazioni dei dati personali (data breach) — TyreCare

Versione: [DA COMPLETARE: data e numero di versione] · Responsabile della procedura: [DA COMPLETARE: nome e
contatto di chi gestisce TyreCare] · Sostituto: [DA COMPLETARE: nome e contatto]

Questa procedura dice cosa fare se i dati gestiti da TyreCare vengono esposti, alterati o persi. Attua il
§12 del DPA ([`dpa-officine.md`](dpa-officine.md)) e gli artt. 33–34 GDPR. Le misure tecniche citate sono
quelle che esistono nel codice o nelle console dei fornitori; ciò che oggi manca (registro degli accessi,
copie di sicurezza verificate, 2FA) è elencato in [`README.md`](README.md) e non è dato per fatto.

## 1. Cos'è una violazione

È una violazione di sicurezza che porta, anche per errore, alla distruzione, perdita, modifica,
divulgazione o accesso non autorizzato a dati personali (art. 4.12). Nel dubbio, si tratta come violazione
e si apre una riga nel registro (§5): decidere poi che non lo era costa poco.

Quattro esempi concreti di TyreCare:

1. **Chiave di servizio di Supabase pubblicata per errore** (nel repository, in un messaggio, in un
   log): chi la ha legge e scrive tutto il database aggirando la RLS.
2. **Regola RLS sbagliata** che mostra a un'officina, o a un cliente, i dati di un'altra officina (clienti,
   veicoli, controlli, prenotazioni).
3. **Account di un titolare rubato** (password indovinata o riusata): chi lo ha vede i dati dei clienti
   dell'officina e può modificarli. Oggi l'autenticazione a due fattori non è attiva.
4. **Copia del database persa o esposta** (esportazione, file CSV di un import, copia locale su un
   computer smarrito): dati persi o in mano a terzi.

## 2. Primi passi tecnici (nell'ordine, entro poche ore dalla scoperta)

1. **Annota subito** data e ora della scoperta e chi se n'è accorto (serve per le 72 ore del §3).
2. **Conserva le prove prima di cambiare tutto:** esporta i log dalla console di Supabase (Auth, API,
   Postgres, Edge Functions) e di Vercel; non cancellare nulla; salva schermate e messaggi ricevuti.
3. **Rigenera le chiavi coinvolte** (se il dubbio è se coinvolte, rigenerale tutte):
   - chiave di servizio (`service_role`) e chiave JWT del progetto Supabase, poi aggiorna le variabili
     d'ambiente dove sono usate (API su Vercel, segreti delle Edge Functions);
   - chiavi VAPID delle notifiche push (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`) e `PUSH_SEGRETO`, con
     `supabase secrets set`; le iscrizioni push esistenti vanno rifatte dagli utenti;
   - chiave di Resend usata come SMTP di Supabase (*SMTP Settings*): revocala dalla console di Resend e
     inseriscine una nuova.
4. **Chiudi le sessioni** degli utenti coinvolti (o di tutti) dalla console di Supabase (Auth → Users) e,
   per un account rubato, imposta una nuova password tramite il link di recupero e avvisa il titolare.
5. **Correggi la causa** (togli la chiave dal repository e dalla cronologia, correggi la regola RLS con
   una nuova migrazione e il suo test pgTAP del caso negato, chiudi l'accesso) e verifica che non si ripeta.
6. **Valuta l'estensione:** quali officine, quali persone, quali categorie di dati (DPA §6), da quando a
   quando, se i dati sono stati solo letti o anche modificati. Se i log non bastano, scrivilo nel registro.

## 3. Chi avvisa chi e quando

| Situazione | Chi | Verso chi | Quando |
|------------|-----|-----------|--------|
| Violazione sui **dati caricati dalle officine** (TyreCare responsabile, DPA) | TyreCare | Ogni officina titolare coinvolta, all'indirizzo del DPA §1 | **Senza ingiustificato ritardo** (art. 33.2) e comunque entro [DA COMPLETARE: N ore, DPA §12.1 — termine ancora aperto] dalla scoperta |
| Stessa violazione, notifica al Garante | L'**officina** (titolare) | Garante per la protezione dei dati personali | Entro **72 ore** da quando l'officina ne è venuta a conoscenza (art. 33.1); TyreCare la aiuta (DPA §11) e non notifica a suo nome senza accordo (DPA §12.3) |
| Violazione sui **dati di cui TyreCare è titolare** (account, accessi, notifiche push) | TyreCare | Garante | Entro **72 ore** dalla scoperta, salvo che sia improbabile un rischio per le persone (art. 33.1); oltre le 72 ore, con i motivi del ritardo |
| Rischio **elevato** per le persone (es. password o dati di contatto esposti, uso illecito probabile) | Il titolare (officina o TyreCare) | Gli interessati, con parole semplici | Senza ingiustificato ritardo (art. 34) |

- L'avviso all'officina contiene quanto richiesto dal DPA §12.2: natura della violazione, categorie e
  numero approssimativo di interessati e di registrazioni, probabili conseguenze, misure adottate o
  proposte, un contatto. Le informazioni non ancora note si mandano appena disponibili, a tappe.
- Contatti per le notifiche: Garante [DA COMPLETARE: modalità e indirizzo del servizio online di notifica
  del Garante, da verificare sul suo sito]; officine [DA COMPLETARE: elenco dei contatti per le violazioni
  di ogni officina]; DPO [DA COMPLETARE: se nominato].
- Non si contattano persone esterne (clienti, stampa, fornitori) senza aver prima seguito questa tabella.
- Se un fornitore (Supabase, Vercel, Resend) segnala una violazione sui suoi sistemi, la scoperta per
  TyreCare è il giorno in cui riceve la segnalazione: il termine parte da lì.

## 4. Dopo la violazione

1. Scrivi nel registro (§5) cosa è successo, le misure prese e le notifiche fatte, anche se non hai
   notificato nessuno (art. 33.5: va documentata anche la scelta di non notificare, con il motivo).
2. Entro [DA COMPLETARE: N giorni] fai una revisione: causa, cosa ha funzionato, cosa cambiare (nuovo test,
   nuova regola, misura da aggiungere all'elenco "Da fare prima del lancio" del `README.md`).
3. Se le misure descritte nel DPA §9 non erano più vere, aggiorna il DPA e il registro dei trattamenti.

## 5. Registro delle violazioni (art. 33.5)

Una riga per ogni violazione, anche sospetta o non notificata. Conservare con [DA COMPLETARE: tempo di
conservazione del registro] e senza inserire nel registro i dati personali delle persone coinvolte (solo
quanti e quali tipi).

| Data e ora | Scoperta da | Descrizione | Dati e persone coinvolte | Conseguenze | Misure adottate | Notifiche fatte (a chi, quando, esito) |
|------------|-------------|-------------|--------------------------|-------------|-----------------|----------------------------------------|
|            |             |             |                          |             |                 |                                        |
|            |             |             |                          |             |                 |                                        |

# Guida all'uso — TyreCare per le officine

Tutte le funzioni dell'app, una sezione per funzione. I nomi tra virgolette sono quelli che vedi sullo
schermo; i percorsi in grassetto (es. **Profilo → "Orari e chiusure"**) dicono dove trovarli. Gli esempi
usano l'officina d'esempio "Gomme Rossi". Per i primi passi in breve c'è anche `guida-avvio.md`.

Chi può fare cosa: il **titolare** fa tutto; gli **operatori** lavorano su clienti, veicoli, controlli e
appuntamenti, ma non vedono orari, dati dell'officina, import, unione dei clienti e abbonamento.

## 1. Primo accesso e profilo

Apri l'app dal telefono ed entra con l'email e la password provvisoria. Per aggiungere l'app alla
schermata Home (serve per le notifiche su iPhone) segui il passo 1 di `guida-avvio.md`.

- Cambia la password da **Profilo → "Cambia password"**.
- Scrivi nome e cognome in **Profilo → "Modifica i tuoi dati"**.
- **Profilo → "Scarica i tuoi dati"** salva una copia dei tuoi dati personali.
- **Profilo → "Elimina il tuo account"** cancella l'account (chiede conferma).
- "Esci" chiude la sessione.

## 2. Dati dell'officina e posizione

**Profilo → "Dati dell'officina"** (solo titolare). Ragione sociale e partita IVA le cambia
l'amministratore. Tu compili "Indirizzo", "CAP", "Provincia", "Città", "Telefono" ed "Email" (la email la
vedono i clienti).

- "Posizione sulla mappa" serve ai clienti per trovarti vicino. Premi "Usa la posizione attuale" mentre sei
  in officina, oppure incolla la posizione dalle mappe.
- Premi "Salva dati". Da qui si apre anche la pagina "Abbonamento" (vedi "In arrivo").

## 3. Orari, chiusure e capienza per fascia

**Profilo → "Orari e chiusure"** (solo titolare).

- Per ogni giorno scrivi "Apre" e "Chiude" del primo turno; "Riapre" e "Chiude" del secondo, se chiudi
  per pranzo. Lascia vuoti i giorni di chiusura.
- "Copia il lunedì da martedì a venerdì" ripete gli orari del lunedì.
- "Richieste al massimo per fascia": il numero massimo di richieste per la mattina e, separato, per il
  pomeriggio. Vuoto = nessun limite. Le richieste che confermi tu a mano non hanno limite.
- Premi "Salva orari".
- Ferie e festivi: "Aggiungi una chiusura", scegli "Dal" e "Al (compreso)" (per un giorno solo, la
  stessa data), scrivi il "Motivo (facoltativo)" e premi "Salva chiusura". Il cestino accanto alla
  chiusura la elimina ("Elimina chiusura").

I clienti possono chiedere un appuntamento solo nei giorni e nelle fasce aperte e non piene.

## 4. Servizi

**Profilo → "Servizi e prezzi"**. Premi "Nuovo servizio" e compila:

- "Nome del servizio" (es. Cambio gomme), "Descrizione (facoltativa)".
- "Durata in minuti (facoltativa)" e "Prezzo da (facoltativo)": vuoto vuol dire "su preventivo".
- "Prenotabile dall'app": se togli la spunta il servizio resta nel catalogo ma i clienti non lo vedono.

Premi "Salva servizio". Per cambiarlo, aprilo: "Salva modifiche" oppure "Elimina servizio". Solo il titolare
modifica i servizi.

## 5. Import di clienti e veicoli

Dalla scheda **Clienti** premi "Importa dal gestionale" (solo titolare).

1. "Scarica il modello CSV" per vedere le colonne: codice_cliente, nome, cognome, ragione_sociale,
   telefono, email, targa, marca, modello, anno, telaio. Serve almeno la targa o il codice cliente.
2. Scegli il file, CSV o Excel (.xls, .xlsx): una riga per veicolo, con il suo cliente.
3. Se le colonne non sono riconosciute, compare "Associa le colonne": per ogni dato di TyreCare scegli la
   colonna del tuo file. Scrivi un nome in "Salva queste scelte come (facoltativo)" per riusarle al
   prossimo file, poi "Mostra l'anteprima". Per ripartire dalle colonne: "Cambia le colonne".
4. L'anteprima conta clienti e veicoli nuovi e aggiornati.
5. Premi "Importa N righe" (N è il numero di righe). A fine import vedi il riepilogo; sotto trovi
   "Import precedenti".

**Righe con errori.** Sono elencate con il numero di riga e il motivo, e **non vengono importate**. Puoi
importare le altre subito. Poi premi "Scarica le righe con errori": è il file da correggere. Correggi gli
errori, e carica di nuovo quel file (o il file completo).

Reimportare lo stesso file è sicuro: i dati già presenti sono aggiornati, non duplicati, e le celle vuote
non cancellano nulla. Se non c'è niente di nuovo vedi "Nessuna modifica".

## 6. Import dei controlli

Serve lo storico delle misure del vecchio gestionale. Prima importa clienti e veicoli. Poi, nella stessa
pagina, premi "Importa i controlli" (da **Clienti → "Importa dal gestionale"**).

1. "Scarica il modello" e rinomina le colonne del tuo file come nel modello: Codice documento, Targa, Data,
   Chilometri, Posizione, Battistrada (mm), Pressione (bar), Usura, Danni, Stagione, Misura, Marca, Modello,
   DOT, Note. Una riga per pneumatico misurato; le righe con lo stesso "Codice documento" sono lo stesso
   controllo.
2. Scegli il file. L'anteprima conta i "controlli nuovi", quelli "già presenti", i pneumatici nuovi e le
   misure.
3. **Documenti già presenti:** un controllo con un "Codice documento" già importato non viene duplicato.
4. **Targhe non trovate:** l'avviso giallo "Questi veicoli non ci sono ancora" elenca le targhe del file
   senza veicolo. Importa prima clienti e veicoli, poi ricarica il file dei controlli.
5. Le righe con errori non vengono importate e non si aggiungono reimportando il file: correggi il file
   prima ("Scarica le righe con errori"). Poi premi "Importa i controlli".

## 7. Esportazione di clienti, veicoli e controlli

Nella pagina "Importa dal gestionale", sezione "Esporta i dati":

- "Scarica clienti e veicoli": un file nel formato del modello, si apre con Excel e si può reimportare.
- "Scarica i controlli": le misure di tutti i controlli.

I controlli inseriti dall'app non hanno un "Codice documento": se reimporti quel file, le loro righe
risultano con errori. Va bene: servono per archivio o per passare ad altro.

## 8. Clienti

Scheda **Clienti**: l'elenco con la ricerca "Cerca per nome, telefono, email o targa".

- **Nuovo cliente:** premi "Nuovo cliente". Compila "Nome", "Cognome" (o "Ragione sociale (facoltativa)"
  per le aziende), telefono, email e note. Spunta "Invitalo nell'app dopo il salvataggio" per passare
  subito all'invito. Premi "Salva cliente"; poi puoi aggiungere il veicolo.
- **Invito nell'app:** nella scheda del cliente, sezione "App TyreCare", premi "Invita nell'app", scrivi
  "Email del cliente" e premi "Prepara invito". Poi "Scrivi l'email", "Condividi il link" o
  "Copia il link": vale 14 giorni e si vede solo in quel momento. Con un invito in corso trovi
  "Nuovo invito" e "Annulla invito". Quando il cliente crea l'account con quell'email, vede i suoi
  veicoli nel garage.
- **Filtro "Senza app":** sopra l'elenco, "Tutti" e "Senza app (N)" mostrano chi non usa ancora l'app:
  sono i clienti da invitare.
- **Unisci due clienti:** nella scheda del cliente che vuoi tenere, "Unisci con un altro cliente" (solo
  titolare). Cerca l'altro, scegli e conferma con "Unisci": i veicoli passano a questa scheda e l'altra
  scheda è eliminata.
- **Scheda:** contatti con "Chiama" e "Scrivi", i veicoli, "Nuovo veicolo", "Modifica dati del cliente".

## 9. Veicoli e pneumatici

Apri un veicolo dalla Home o dalla scheda del cliente. Per uno nuovo premi "Nuovo veicolo" (Home o scheda
del cliente): "Targa", "Marca", "Modello", e facoltativi "Anno" e "Telaio"; poi "Salva veicolo".

- **Monta:** se il veicolo non ha pneumatici, "Monta gli pneumatici". Scegli le "Posizioni", poi
  "Stagione", "Misura" (come sul fianco, es. 205/55 R16 91V), "Marca", "Modello", "DOT (facoltativo)" e
  "Data di montaggio". Premi "Monta pneumatici".
- **Cambia:** per montare pneumatici diversi premi "Cambia pneumatici": quelli vecchi restano nello
  storico.
- **Smonta:** nella sezione "Pneumatici montati", "Smonta" toglie gli pneumatici senza metterne altri
  (scegli "Posizioni da smontare" e "Data di smontaggio", poi "Smonta pneumatici").
- **Correggi:** per un errore di battitura tocca la riga dello pneumatico: si apre "Correggi pneumatici"; poi
  "Salva modifiche".
- "Modifica dati del veicolo" cambia targa, marca e gli altri dati.

Il veicolo si colora in base allo stato: rosso da sostituire, giallo da controllare, verde a posto.

## 10. Nuovo controllo, correzione e report

- **Nuovo controllo:** dal veicolo, "Nuovo controllo". Scrivi "Data" e "Km (facoltativi)"; per ogni ruota
  "Battistrada mm" e "Pressione bar", e se vuoi "Usura" e "Danni (facoltativo)". Le "Note (facoltative)"
  le vede anche il cliente. Premi "Salva controllo".
- **Correzione:** nella sezione dei controlli del veicolo apri quello giusto e premi "Correggi o elimina":
  "Salva modifiche", oppure "Elimina controllo" (si eliminano anche le sue misure, senza ritorno).
- **Report da stampare:** apri il controllo con "Apri il report" e premi "Stampa o salva in PDF".
- **Condividere il report:** "Condividi il report" crea un link. Poi "Copia il link" o
  "Invia con WhatsApp". Chi apre il link vede solo quel controllo e le note, senza i dati del cliente;
  il link vale 30 giorni. "Disattiva i link" li spegne tutti.

## 11. Appuntamenti e calendario

I clienti chiedono un giorno e una fascia. Le richieste sono in **Appuntamenti**, sezione
"Da confermare", e con un avviso giallo nella Home. Apri la richiesta:

- **Conferma:** scrivi l'ora precisa, e se vuoi un "Messaggio per il cliente (facoltativo)", poi
  "Conferma appuntamento".
- **Altro orario:** "Proponi un altro orario", scegli giorno e ora, "Invia la proposta". Il cliente deve
  accettare. Su un appuntamento già confermato lo stesso pulsante è "Sposta (proponi un altro orario)".
- **Rifiuto:** "Rifiuta la richiesta", con un "Motivo per il cliente (facoltativo)". Su un appuntamento
  confermato è "Annulla l'appuntamento".
- **Dopo la data:** nella sezione "Passati: com'è andata?" premi "Completato" se il cliente è venuto,
  "Non presentato" se no.

Il **Calendario** (in Appuntamenti, accanto a "Elenco") mostra la settimana: tocca un giorno per vedere
mattina e pomeriggio. Con la capienza impostata ogni fascia riporta "n su c richieste" e "piena" quando
è al massimo. "Torna a oggi" riporta alla data corrente.

## 12. Notifiche e push

Apri **Notifiche** (la campanella): ci sono le richieste, le conferme e i cambi di orario. Per averle
anche con l'app chiusa, nella sezione "Avvisi sul telefono" premi "Avvisami su questo dispositivo" e
accetta il permesso. Per spegnerle: "Disattiva gli avvisi". Su iPhone funzionano solo con l'app aperta
dall'icona sulla Home. Se sono bloccate, riattivale dalle impostazioni del browser.

## 13. Invia un commento

Qualcosa non va o manca? **Profilo → "Invia un commento su TyreCare"**: scrivi in "Cosa vuoi dirci?" e premi
"Invia". Leggiamo tutto.

## 14. Domande frequenti

**Ho sbagliato un controllo: come lo correggo?** Apri il veicolo, trova il controllo e premi
"Correggi o elimina".

**Un cliente non vede i suoi veicoli.** Deve accedere con la stessa email dell'invito. Se l'invito è
scaduto, dalla scheda del cliente premi "Nuovo invito".

**Il file non si importa.** Apri l'elenco delle righe con errori: ogni riga ha il motivo.
Premi "Scarica le righe con errori", correggi e carica di nuovo il file. Le righe già importate non si
duplicano.

**Un cliente chiede un giorno in cui sono chiuso.** Non può: controlla "Orari e chiusure" e la
"Richieste al massimo per fascia". Se il giorno non compare, è chiuso o la fascia è piena.

**Non arrivano le notifiche.** Controlla "Avvisi sul telefono" in **Notifiche**. Su iPhone apri l'app
dall'icona sulla Home, non da Safari.

## In arrivo

Non ancora disponibili: non ci sono istruzioni.

- Pagamento online dell'abbonamento: la pagina "Abbonamento" mostra il piano, ma "Attiva l'abbonamento"
  non è ancora attivo.
- Pagina pubblica "TyreCare per le officine" (per ora "Pagina in preparazione").
- "Primi passi": percorso guidato per le nuove officine.

---

**Prima di caricare i dati veri dei clienti serve l'accordo sul trattamento dei dati
(`DOCS/legale/dpa-officine.md`).**

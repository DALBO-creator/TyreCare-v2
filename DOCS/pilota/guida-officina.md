# Guida all'uso — TyreCare per le officine

Tutte le funzioni dell'app, una sezione per funzione. I nomi tra virgolette sono quelli che vedi sullo
schermo; i percorsi in grassetto (es. **Profilo → "Orari e chiusure"**) dicono dove trovarli. Gli esempi
usano l'officina d'esempio "Gomme Rossi". Per i primi passi in breve c'è anche `guida-avvio.md`.

Chi può fare cosa: il **titolare** fa tutto; gli **operatori** lavorano su clienti, veicoli, controlli e
appuntamenti, ma non vedono orari, dati dell'officina, import, unione dei clienti e abbonamento.

## 1. Primo accesso e profilo

Apri l'app dal telefono ed entra con l'email e la password provvisoria. Per aggiungere l'app alla
schermata Home (serve per le notifiche su iPhone) segui il passo 1 di `guida-avvio.md`: su iPhone (Safari)
Condividi → "Aggiungi alla schermata Home"; su Android (Chrome) menu ⋮ → "Installa app" (o "Aggiungi a
schermata Home").

- Cambia la password da **Profilo → "Cambia password"**.
- Scrivi nome e cognome in **Profilo → "Modifica i tuoi dati"**.
- **Profilo → "Scarica i tuoi dati"** salva una copia dei tuoi dati personali.
- **Profilo → "Elimina il tuo account"** cancella l'account (chiede conferma).
- "Esci" chiude la sessione.

### "Primi passi" nella home

Finché la tua officina è nuova, nella **Home** (solo per il titolare) compare la carta "Primi passi", con il
contatore "N di 5 fatti". Ogni passo è un link che apre la pagina giusta e si spunta da solo:

1. "Completa i dati dell'officina e la posizione": fatto quando la posizione è salvata.
2. "Imposta orari e capienza": fatto quando hai salvato gli orari.
3. "Aggiungi i servizi": fatto quando c'è almeno un servizio.
4. "Importa clienti e veicoli": fatto quando c'è almeno un cliente.
5. "Invita i clienti nell'app": fatto quando almeno un cliente è collegato all'app.

La carta sparisce da sola quando i cinque passi sono fatti. Se non la vuoi vedere prima, premi "Nascondi":
vale solo su quel telefono (o computer), perché la scelta resta nel browser. Su un altro telefono la carta
ricompare finché i passi non sono fatti.

Se offri l'aiuto su strada (sezione 13) e c'è una richiesta aperta entro il tuo raggio, nella **Home**
compare l'avviso giallo "1 richiesta di aiuto su strada vicina" (o "N richieste di aiuto su strada
vicine"). Toccalo per aprire "Richieste su strada". Se il servizio è spento l'avviso non compare.

## 2. Dati dell'officina e posizione

**Profilo → "Dati dell'officina"** (solo titolare). Ragione sociale e partita IVA le cambia
l'amministratore. Tu compili "Indirizzo", "CAP", "Provincia", "Città", "Telefono" ed "Email" (la email la
vedono i clienti).

- "Posizione sulla mappa" serve ai clienti per trovarti vicino. Premi "Usa la posizione attuale" mentre sei
  in officina, oppure incolla la posizione dalle mappe.
- Premi "Salva dati". Da qui si apre anche la pagina "Abbonamento" (vedi sezione 14).

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

**Annullare un import.** Se hai importato con le colonne associate male, in "Import precedenti" premi
"Annulla questo import" accanto all'ultimo import e conferma ("Annullare l'import?"). Poi correggi
l'associazione e importa di nuovo. L'avviso finale dice quanti clienti e veicoli sono stati tolti e,
se ce ne sono, quanti tenuti "perché già usati". Cosa devi sapere:
- Il pulsante c'è solo per l'ultimo import di clienti e veicoli, entro 7 giorni, e solo per il titolare.
  Un import annullato resta nell'elenco con "annullato il …". Gli import dei controlli non si annullano.
- Si tolgono solo i clienti e i veicoli che quell'import ha **creato**. Quelli che ha solo **aggiornato**
  non tornano com'erano prima.
- Restano i veicoli già usati: con pneumatici, controlli, misure, appuntamenti o richieste di aiuto su
  strada con la stessa targa. Restano i clienti con un veicolo, con un invito o con l'account collegato.

## 6. Import dei controlli

Serve lo storico delle misure del vecchio gestionale. Prima importa clienti e veicoli. Poi, nella stessa
pagina, premi "Importa i controlli" (da **Clienti → "Importa dal gestionale"**).

1. "Scarica il modello" e rinomina le colonne del tuo file come nel modello: Codice documento, Targa, Data,
   Chilometri, Posizione, Battistrada (mm), Pressione (bar), Usura, Danni, Stagione, Misura, Marca, Modello,
   DOT, Note. Una riga per pneumatico misurato; le righe con lo stesso "Codice documento" sono lo stesso
   controllo.
2. Scegli il file. L'anteprima conta i "controlli nuovi", quelli "già presenti", i pneumatici nuovi e le
   misure.
   Se il file completa gomme già registrate (hanno preso DOT, marca o misura dal file), l'anteprima scrive
   "N gomme già registrate saranno completate con i dati del file" e a fine import "N gomme già registrate
   sono state completate con i dati del file" (con N = 1: "1 gomma già registrata"). Senza gomme da
   completare la riga non compare.
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
- **Scollegare l'account** (solo titolare): se l'invito è stato accettato dalla persona sbagliata, nella
  scheda del cliente, sezione "App TyreCare", premi "Scollega l'account" e conferma ("Scollegare
  l'account?"). Il cliente non vede più i veicoli di questa officina nell'app. Scheda, veicoli,
  appuntamenti e notifiche restano; la sezione torna a "Invita nell'app" e puoi invitarlo di nuovo.
  Il cliente non riceve nessun avviso.
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
  Se i DOT delle ruote sono diversi, spunta "DOT diverso per ogni ruota": il campo "DOT (facoltativo)" si
  spegne e compare un campo per ogni posizione scelta (es. "DOT Anteriore sinistro"; "Ultime 4 cifre:
  settimana e anno (es. 3823)."). Quello che hai scritto resta per le ruote che lasci scelte; se togli una
  posizione il suo campo sparisce e, se la rimetti, riparte vuoto. Lo stesso vale in
  "Cambia pneumatici", che apre la stessa pagina; in "Correggi pneumatici" il DOT è uno solo.
  Se togli la spunta, i campi per ruota spariscono, il campo "DOT (facoltativo)" si riaccende e vale il DOT
  unico: i valori scritti per ruota non vengono inviati.
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
  Se esci prima di salvare, le misure scritte restano solo su questo telefono o computer per 7 giorni: alla
  riapertura compare "Abbiamo ripreso le misure che non avevi salvato." e, con "Scarta la bozza", riparti
  da zero. La bozza sparisce dopo "Salva controllo"; se il salvataggio non riesce, resta.
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

Due avvisi riguardano l'officina in sé:
- **"Richiesta non accettata":** arriva a chi aveva chiesto di registrare l'officina se TyreCare non la
  accetta. Se TyreCare ha scritto un motivo, l'avviso finisce con "Motivo: …". Toccandolo si apre la
  pagina per registrare l'officina.
- **"La tua officina è sospesa":** lo ricevono i titolari quando TyreCare sospende l'officina, che da quel
  momento non è più visibile ai clienti. Toccalo per aprire "Invia un commento" e chiedere perché.
  Gli operatori non lo ricevono.

## 13. Aiuto su strada

Un automobilista fermo con una gomma a terra può chiedere aiuto dall'app: la richiesta arriva alle officine
vicine che offrono il servizio, e la prima che accetta la prende.

**Attivarlo** (solo titolare). **Profilo → "Dati dell'officina"**, riquadro "Aiuto su strada":
- Prima imposta la "Posizione sulla mappa" (vedi sezione 2): senza posizione la casella è spenta e
  compare "Imposta prima la posizione".
- Spunta "Offro l'aiuto su strada" e scrivi in "Fino a quanti km" un numero intero da 5 a 100 (di
  partenza è 30): è la distanza dalla posizione dell'officina entro cui ricevi le richieste.
- Premi "Salva dati". Per spegnerlo togli la spunta e salva.

**Ricevere la richiesta.** Titolare e operatori ricevono la notifica "Richiesta di aiuto su strada" (nel testo
la distanza dall'officina). Toccandola si apre la pagina "Richieste su strada"; la raggiungi anche dal
pulsante "Richieste su strada" nella **Home**, che compare solo con il servizio attivo; lì, con richieste
aperte nel tuo raggio, vedi anche l'avviso giallo "N richieste di aiuto su strada vicine". La pagina si
aggiorna da sola ogni 15 secondi. Chi lavora in più officine vicine riceve una sola notifica. Chi ha fatto
la richiesta non la vede, neanche se è membro di un'officina.

**Prima di accettare**, in "Richieste vicine" ogni richiesta mostra solo: la distanza ("A … da te"),
la descrizione, la targa (se il cliente l'ha messa) e l'ora di scadenza. Non vedi il telefono né la posizione
precisa del cliente.

**Accettare.** Premi "Accetta", poi "Sì, accetta" (il cliente riceverà il nome e il telefono dell'officina,
con la notifica "Un'officina sta arrivando"). Se un'altra officina è stata più veloce, la pagina dice che la
richiesta non è più disponibile.

**Dopo aver accettato**, la richiesta passa in "Accettate" e solo tu (cioè i membri della tua officina) vedi:
- "Chiama" seguito dal telefono del cliente;
- "Vedi la posizione", che apre la posizione esatta sulla mappa;
- il pulsante "Chiudi".
Chiama il cliente, vai da lui e, a lavoro finito, premi "Chiudi". Se non la chiudi, si chiude da sola dopo
24 ore. Se il cliente annulla, ricevi la notifica "Aiuto su strada annullato".

**Quando scade.** Una richiesta che nessuno accetta sparisce dopo 2 ore. Le richieste chiuse, annullate o
scadute si cancellano dopo 90 giorni.

TyreCare inoltra soltanto la richiesta: l'intervento e il prezzo li concordi tu con il cliente.

## 14. Abbonamento

La pagina "Abbonamento" la vede solo il titolare: si apre da **Profilo → "Dati dell'officina"**, con il
pulsante "Abbonamento" (gli operatori trovano scritto "Solo il titolare vede l'abbonamento.").

**Il tuo abbonamento.** In alto trovi lo stato in una frase e, sotto, i dati:
- Un'officina nuova ha 30 giorni di prova gratuita, contando il giorno in cui viene attivata. Finché dura
  la prova la pagina scrive "Prova gratuita: mancano N giorni"; all'ultimo giorno "manca 1 giorno".
- Con l'abbonamento pagato scrive "Abbonamento attivo fino al …"; negli ultimi 30 giorni ricorda di
  rinnovare. Gli altri stati sono "Abbonamento scaduto il …" e "Abbonamento sospeso".
- Nell'elenco: stato, piano (mensile o annuale, con il prezzo), prossima scadenza e se l'installazione è
  stata pagata.

**Prezzi e cosa è incluso.** Sotto ci sono i due piani (mensile e annuale, IVA esclusa), il costo
dell'installazione una tantum e l'elenco di quello che l'abbonamento comprende: è uguale per i due piani.

**Rinnovare o cambiare piano.** Nell'app non si paga nulla: il pagamento avviene con bonifico, su fattura.
Premi "Scrivi a TyreCare": si apre un'email già indirizzata, con il nome della tua officina. Appena
riceviamo il pagamento aggiorniamo la scadenza, e ti arriva una notifica "Abbonamento rinnovato".
Sette giorni prima della scadenza l'app ti manda un avviso.

## 15. Invia un commento

Qualcosa non va o manca? **Profilo → "Invia un commento su TyreCare"**: scrivi in "Cosa vuoi dirci?" e premi
"Invia". Leggiamo tutto.

## 16. Domande frequenti

**Ho sbagliato un controllo: come lo correggo?** Apri il veicolo, trova il controllo e premi
"Correggi o elimina".

**Un cliente non vede i suoi veicoli.** Deve accedere con la stessa email dell'invito. Se l'invito è
scaduto, dalla scheda del cliente premi "Nuovo invito".

**Il file non si importa.** Apri l'elenco delle righe con errori: ogni riga ha il motivo.
Premi "Scarica le righe con errori", correggi e carica di nuovo il file. Le righe già importate non si
duplicano.

**Un cliente chiede un giorno in cui sono chiuso.** Non può: controlla "Orari e chiusure" e il
campo «Richieste al massimo per fascia». Se il giorno non compare, è chiuso o la fascia è piena.

**Non arrivano le notifiche.** Controlla "Avvisi sul telefono" in **Notifiche**. Su iPhone apri l'app
dall'icona sulla Home, non da Safari.

---

**Prima di caricare i dati veri dei clienti serve l'accordo sul trattamento dei dati
(`DOCS/legale/dpa-officine.md`).**

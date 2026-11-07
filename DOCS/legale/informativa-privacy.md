**BOZZA — da rivedere con un consulente prima dell'uso**

# Informativa sul trattamento dei dati personali — TyreCare

Ultimo aggiornamento: [DA COMPLETARE: data di pubblicazione]

Questa informativa spiega quali dati personali tratta TyreCare, perché, per quanto tempo e quali diritti
hai, ai sensi del Regolamento (UE) 2016/679 ("GDPR") e del D.Lgs. 196/2003. TyreCare è un'applicazione web
(installabile sul telefono come app) che permette ai gommisti e alle officine affiliate di gestire i
veicoli e gli pneumatici dei loro clienti, e ai clienti di consultare lo stato dei propri pneumatici e di
chiedere un appuntamento.

## 1. Chi tratta i tuoi dati

In TyreCare i dati possono avere due "proprietari" diversi, a seconda di chi li inserisce.

**a) Dati del tuo account — titolare: TyreCare.** Per i dati con cui ti registri e usi l'app (email,
password, nome, telefono, notifiche, iscrizioni alle notifiche push, richieste di appuntamento che invii)
il titolare del trattamento è:

- [DA COMPLETARE: nome e cognome o ragione sociale di chi offre TyreCare]
- [DA COMPLETARE: indirizzo / sede legale]
- [DA COMPLETARE: partita IVA o codice fiscale]
- Email per le richieste privacy: [DA COMPLETARE: email per le richieste privacy]
- [DA COMPLETARE: eventuale responsabile della protezione dei dati (DPO) e suoi contatti, se nominato]

[DA COMPLETARE: confermare con il consulente la titolarità delle richieste di appuntamento, vedi
README, domanda 6]

**b) Dati caricati dall'officina — titolare: l'officina.** I dati che un'officina inserisce o importa dal
proprio gestionale (la sua anagrafica clienti, i veicoli, gli pneumatici montati, i controlli e le misure)
sono dell'officina, che ne è **titolare del trattamento**. TyreCare li tratta per conto dell'officina come
**responsabile del trattamento** (art. 28 GDPR), sulla base di un accordo scritto con ogni officina, e
solo per far funzionare il servizio. Per questi dati il tuo riferimento è l'officina: i suoi contatti sono
nella scheda dell'officina nell'app. Se scrivi a TyreCare per questi dati, inoltreremo la tua richiesta
all'officina interessata.

## 2. Quali dati trattiamo

L'elenco corrisponde ai dati effettivamente registrati dall'app.

**Account e profilo** (tutti gli utenti)

- email e password (la password è conservata solo in forma cifrata, non leggibile);
- nome, cognome, telefono (facoltativo);
- ruolo nell'app (cliente, officina, amministratore di TyreCare) e, per chi lavora in officina, il ruolo
  nell'officina (titolare o operatore);
- date di creazione e di modifica.

**Dati delle officine affiliate**

- ragione sociale, partita IVA, indirizzo, CAP, città, provincia, posizione sulla mappa (latitudine e
  longitudine), telefono, email, orari di apertura, chiusure straordinarie, catalogo dei servizi con
  durata e prezzo indicativo, stato dell'affiliazione.

**Abbonamento delle officine** (titolari)

- i **dati della carta** (numero, scadenza, codice) li inserisci nella pagina di pagamento di Stripe e li
  tratta Stripe: TyreCare non li vede e non li conserva;
- TyreCare conserva solo il piano scelto (Starter, Pro oppure Officina pilota), lo stato
  dell'abbonamento (prova, attivo, scaduto, annullato), la fine della prova, l'identificativo del
  cliente su Stripe e l'identificativo dell'abbonamento su Stripe (tabella `abbonamenti`);
- per creare il cliente su Stripe, TyreCare gli manda l'email del titolare, la ragione sociale
  dell'officina e l'identificativo dell'officina nell'app (un codice che l'app assegna a ogni officina);
- il pagamento online non è ancora attivo: finché non lo è, questi dati non sono scambiati con Stripe.

**Clienti e veicoli dell'officina** (inseriti o importati dall'officina)

- per ogni cliente: nome, cognome o ragione sociale, telefono, email, codice nel gestionale
  dell'officina, note dell'officina, indicazione del consenso a comunicazioni promozionali registrata
  dall'officina, collegamento all'account TyreCare del cliente (se presente), origine del dato (inserito
  nell'app o importato);
- per ogni veicolo: targa, numero di telaio (facoltativo), marca, modello, anno.

**Pneumatici e controlli** (inseriti dall'officina)

- pneumatici montati: posizione sul veicolo, stagione (estivi, invernali, quattro stagioni), misura,
  marca, modello, DOT (settimana e anno di produzione), date di montaggio e smontaggio;
- controlli: data, chilometri, note, codice del documento, chi in officina lo ha registrato;
- misure di ogni pneumatico: battistrada in millimetri, pressione, tipo di usura, danni rilevati.

**Inviti** (quando l'officina invita un cliente a collegare i suoi veicoli)

- email a cui è stato inviato l'invito, chi lo ha creato, scadenza, data di utilizzo o di annullamento,
  chi lo ha usato. Il codice dell'invito è conservato solo in forma cifrata.

**Prenotazioni** (richieste di appuntamento)

- officina scelta, servizio richiesto, nome e telefono di chi prenota, targa e descrizione del veicolo,
  giorno e fascia (mattina o pomeriggio), note, stato della richiesta, orario proposto o confermato,
  messaggio dell'officina, chi in officina l'ha gestita, date di creazione e di modifica.

**Aiuto su strada** (richieste di aiuto con la posizione)

- posizione precisa del telefono (latitudine e longitudine), presa dal telefono **solo nel momento in cui
  invii la richiesta** e solo con il permesso che dai al browser; non viene seguita né registrata in altri
  momenti;
- telefono, descrizione del problema (fino a 500 caratteri), targa (facoltativa), data, stato della
  richiesta (in attesa, accettata, chiusa, annullata, scaduta), officina che l'ha accettata.

**Notifiche**

- notifiche ricevute nell'app: tipo (es. cambio di stato di una prenotazione, promemoria
  dell'appuntamento, esito di un controllo, cambio stagionale degli pneumatici), titolo, testo,
  collegamento, data di lettura.

**Iscrizioni alle notifiche push** (solo se attivi le notifiche push)

- indirizzo dell'iscrizione generato dal tuo browser e le relative chiavi tecniche, necessari per
  recapitare le notifiche sul tuo dispositivo.

**Import dal gestionale** (solo officine)

- registro di ogni importazione: nome del file, numero di righe importate e scartate, clienti e veicoli
  nuovi o aggiornati, chi l'ha eseguita e quando. Il file caricato viene letto nel browser e **non viene
  conservato**: restano solo i dati importati e questo registro;
- associazioni di colonne salvate dall'officina per i suoi file (nomi delle colonne, chi le ha create).

**Dati tecnici**

- i fornitori che ospitano l'app e il database (vedi §5) registrano dati tecnici delle connessioni, come
  l'indirizzo IP e il tipo di browser, per far funzionare il servizio e per sicurezza.
  [DA COMPLETARE: verificare con il consulente e nelle impostazioni dei fornitori cosa registrano e per
  quanto]

TyreCare **non** chiede dati particolari (ad esempio sulla salute) e usa la posizione del tuo
dispositivo **solo** se invii una richiesta di aiuto su strada (vedi sopra).

## 3. Perché trattiamo i dati e su quale base giuridica

| Finalità | Dati | Base giuridica |
|----------|------|----------------|
| Creare e gestire il tuo account, farti accedere | Account e profilo | Esecuzione del contratto (art. 6.1.b): i termini di servizio |
| Mostrare al cliente i suoi veicoli, pneumatici, controlli e report | Veicoli, pneumatici, controlli | Esecuzione del contratto con il cliente; per l'officina, le istruzioni dell'officina titolare |
| Gestire le richieste di appuntamento tra cliente e officina | Prenotazioni | Esecuzione del contratto (art. 6.1.b) |
| Inoltrare la tua richiesta di aiuto su strada alle officine vicine e metterti in contatto con quella che accetta | Aiuto su strada | Richiesta dell'interessato, esecuzione di misure precontrattuali (art. 6.1.b); la posizione è presa solo con il permesso del browser |
| Avvisarti nell'app e con le push dei cambi di stato delle prenotazioni | Notifiche, iscrizioni push | Esecuzione del contratto (art. 6.1.b); le push solo se le attivi nel browser |
| Promemoria del giorno prima, esito del controllo, cambio stagionale degli pneumatici | Notifiche, iscrizioni push, veicoli e pneumatici | [DA COMPLETARE: esecuzione del contratto, legittimo interesse o consenso — vedi README, domanda 1] |
| Gestione dell'officina: clienti, veicoli, controlli, import dal gestionale | Dati caricati dall'officina | Trattamento per conto dell'officina (art. 28); la base giuridica è quella scelta dall'officina titolare |
| Sicurezza del servizio, prevenzione di abusi, difesa in giudizio | Dati tecnici, account | Legittimo interesse (art. 6.1.f) |
| Gestire l'abbonamento dell'officina e il suo pagamento con carta tramite Stripe | Dati delle officine, abbonamento | Esecuzione del contratto (art. 6.1.b) |
| Obblighi di legge (es. fiscali, per gli abbonamenti delle officine) | Dati delle officine | Obbligo legale (art. 6.1.c) |

TyreCare **non** invia comunicazioni promozionali e **non** profila gli utenti. Se in futuro lo farà, ti
chiederà prima un consenso separato e facoltativo.

Fornire email e password è necessario per creare l'account; senza non è possibile usare l'app. Il
telefono è facoltativo nel profilo, ma è richiesto per inviare una richiesta di appuntamento, perché
l'officina possa contattarti.

## 4. Per quanto tempo conserviamo i dati

L'app cancella da sola **le notifiche e le richieste di aiuto su strada** (vedi sotto): gli altri
dati restano finché non vengono eliminati dall'officina, dall'interessato o alla chiusura dell'account.
I tempi previsti sono:

- **account e profilo**: finché l'account è attivo; dopo la richiesta di cancellazione
  [DA COMPLETARE: entro quanti giorni];
- **notifiche nell'app**: un job notturno cancella quelle lette da più di 180 giorni e tutte quelle più
  vecchie di un anno (365 giorni) [DA COMPLETARE: confermare i tempi con il consulente];
- **richieste di aiuto su strada**: una richiesta non accettata scade dopo 2 ore e una accettata si chiude
  da sola dopo 24 ore se l'officina non la chiude; le richieste chiuse, annullate o scadute (con posizione,
  telefono, descrizione e targa) vengono cancellate dopo **90 giorni**; se elimini il tuo account, le tue
  richieste di aiuto su strada vengono cancellate subito con l'account;
- **prenotazioni**: non si cancellano da sole [DA COMPLETARE: periodo, es. N mesi dopo l'appuntamento];
- **iscrizioni push**: finché non disattivi le notifiche push nell'app o dal browser (in quel caso
  l'iscrizione viene eliminata);
- **dati caricati dall'officina** (clienti, veicoli, pneumatici, controlli, inviti, registro import): per
  il tempo deciso dall'officina titolare e, quando l'officina smette di usare TyreCare,
  [DA COMPLETARE: restituzione e cancellazione entro … — vedi README, domanda 2];
- **dati delle officine per gli abbonamenti** (anche piano, stato e identificativi Stripe): per il tempo
  previsto dalla legge (es. 10 anni per i documenti fiscali) [DA COMPLETARE: confermare];
- **dati tecnici dei fornitori**: per i tempi indicati dai fornitori [DA COMPLETARE].

Se elimini il tuo account vengono eliminati anche il tuo profilo, le tue prenotazioni (anche quelle
passate), le tue notifiche, le tue iscrizioni push e i tuoi commenti. Le schede cliente, i veicoli, i
controlli, gli inviti e i registri di importazione caricati da un'officina restano all'officina (titolare),
che li gestisce secondo le sue regole: il collegamento con il tuo account viene tolto.

## 5. A chi comunichiamo i dati

I dati non vengono venduti né ceduti a terzi per scopi propri. Possono vederli:

- **l'officina** con cui hai a che fare: chi lavora in un'officina vede solo i clienti, i veicoli e le
  prenotazioni **di quell'officina**, mai quelli di altre officine;
- per l'**aiuto su strada**: prima che un'officina accetti, le officine vicine che offrono il servizio
  vedono solo la distanza, la descrizione e la targa; la posizione esatta e il telefono li vede solo
  l'officina che accetta [DA COMPLETARE: ruolo dell'officina che accetta — da confermare con il
  consulente, come nel registro A6];
- **tu**, se sei cliente: vedi i veicoli collegati al tuo account e le tue prenotazioni, non i dati di
  altri clienti;
- il **personale autorizzato di TyreCare**: l'account amministratore dell'app non vede i dati dei clienti
  delle officine; vi accede solo chi gestisce il sistema, quando serve per assistenza, sicurezza o
  manutenzione [DA COMPLETARE: definire con il consulente, vedi README, domanda 9].

TyreCare si serve di questi **fornitori**, nominati responsabili del trattamento (per Stripe il ruolo è
ancora da definire, vedi la tabella):

| Fornitore | Cosa fa | Dove |
|-----------|---------|------|
| Supabase Inc. | Database, autenticazione, invio delle notifiche push (funzioni sul server) | Server nell'Unione europea (regione eu-west-1, Irlanda) |
| Vercel Inc. | Ospita l'applicazione web (i file dell'app) | [DA COMPLETARE: regione; società con sede negli USA] |
| Resend (Plus Five Five, Inc.) | Invio delle email automatiche (es. conferma dell'indirizzo email, recupero della password) | [DA COMPLETARE: regione; società con sede negli USA] |
| Stripe | Pagamento degli abbonamenti delle officine con carta (quando il pagamento sarà attivo) | [DA COMPLETARE: ruolo di Stripe e sede, da confermare con il consulente — README, domanda 16] |
| Servizi push del browser (Google per Chrome e Android, Apple per Safari e iPhone, Mozilla per Firefox, o altri a seconda del browser) | Recapitano le notifiche push sul tuo dispositivo; il servizio lo sceglie il tuo browser | Possono trovarsi fuori dall'UE |

[DA COMPLETARE: verificare con il consulente la denominazione esatta dei fornitori e le garanzie per i
trasferimenti fuori dall'UE (clausole contrattuali tipo, Data Privacy Framework) — vedi README, domande 4
e 5]

Gli inviti che un'officina manda ai suoi clienti partono dal programma di posta dell'officina, non da
TyreCare.

I dati possono inoltre essere comunicati alle autorità quando la legge lo richiede.

## 6. I tuoi diritti e come esercitarli

Hai diritto di:

- **accedere** ai tuoi dati e averne copia;
- **correggerli** (nome, cognome e telefono li puoi modificare anche dal tuo profilo nell'app);
- **cancellarli** (diritto all'oblio), nei limiti di legge;
- **limitarne** il trattamento;
- **riceverli** in un formato strutturato e leggibile da computer (portabilità);
- **opporti** ai trattamenti basati sul legittimo interesse;
- **revocare il consenso**, quando il trattamento si basa sul consenso, senza conseguenze sui trattamenti
  già fatti (ad esempio: puoi disattivare le notifiche push dall'app o dalle impostazioni del browser).

**Come fare:** dal tuo **Profilo** nell'app.

- **«Scarica i tuoi dati»**: un file (JSON) con il tuo profilo, la tua email, le tue schede nelle officine,
  il garage, le prenotazioni, le notifiche, i commenti, le officine in cui lavori e il numero di
  dispositivi con le notifiche push attive. **Non** contiene gli inviti dell'officina che hai usato né i
  link dei report che hai creato: sono registri dell'officina, non dati che hai fornito tu
  [DA COMPLETARE: confermare con il consulente]. Non contiene nemmeno i dati tecnici delle iscrizioni push.
- **«Elimina il tuo account»**: cancella l'account, con quanto indicato nella sezione 4. Non si può
  eliminare se sei un amministratore, se sei titolare di un'officina, se hai prenotazioni in corso
  (richieste, proposte o confermate) o se hai una richiesta di aiuto su strada in corso (aperta, o
  accettata da meno di 24 ore): prima vanno concluse o annullate.

Per ciò che non puoi fare dall'app, o se non riesci ad accedere, scrivi a
[DA COMPLETARE: email per le richieste privacy] indicando l'email del tuo account. Rispondiamo entro un
mese (art. 12 GDPR). Potremmo chiederti di confermare la richiesta dall'email del tuo account per
verificare che sia tu.

Per i dati caricati da un'officina (sezione 1.b) rivolgiti all'officina; se scrivi a noi, giriamo la
richiesta all'officina e la aiutiamo a rispondere.

Hai anche il diritto di presentare reclamo al **Garante per la protezione dei dati personali**
(www.garanteprivacy.it).

## 7. Cookie e archiviazione locale

TyreCare **non usa cookie** e **non usa strumenti di analisi, di pubblicità o di profilazione**, né propri
né di terzi. Non carica script o caratteri da siti esterni.

Per funzionare l'app salva alcune informazioni **solo sul tuo dispositivo**, nella memoria del browser:

| Cosa | Dove | Perché | Quanto dura |
|------|------|--------|-------------|
| Sessione di accesso (codici che ti tengono collegato) | `localStorage` del browser | Per non doverti chiedere la password a ogni apertura | Finché non esci dall'account o cancelli i dati del sito |
| Officina scelta (solo per chi lavora in più officine) | `localStorage` del browser | Per riaprire l'app sull'ultima officina usata | Finché non cancelli i dati del sito |
| File dell'app (pagine, stili, icone, caratteri) | Cache del **service worker** (la parte che rende TyreCare installabile come app) | Per aprire l'app più in fretta e anche con poca rete | Finché l'app è installata o non cancelli i dati del sito; si aggiorna con le nuove versioni |
| Iscrizione alle notifiche push | Browser e servizio push del browser | Per ricevere le notifiche push, solo se le attivi | Finché non le disattivi |

Sono strumenti **tecnici, necessari** per il servizio che hai chiesto: per questo non serve il tuo
consenso (art. 122 Codice privacy) [DA COMPLETARE: confermare con il consulente, vedi README, domanda 11].
Il service worker conserva solo i file dell'app, non i tuoi dati: quelli si leggono dal server ogni volta.

Puoi cancellare questi dati in qualsiasi momento dalle impostazioni del browser ("Cancella dati dei
siti"); dopo dovrai accedere di nuovo.

## 8. Sicurezza

I dati sono protetti con connessioni cifrate (HTTPS) e con regole di accesso nel database che permettono a
ogni utente di vedere solo ciò che gli spetta (ad esempio, un'officina non vede i clienti di un'altra).
Nessun sistema è sicuro al 100%: in caso di violazione dei dati seguiremo gli obblighi di notifica previsti
dal GDPR.

## 9. Minori

[DA COMPLETARE: età minima per creare un account — vedi README, domanda 3]. L'app non chiede la data di
nascita.

## 10. Modifiche a questa informativa

Se l'informativa cambia in modo importante ti avviseremo nell'app o via email. La data dell'ultimo
aggiornamento è in cima alla pagina.

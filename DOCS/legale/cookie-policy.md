# Cookie policy — TyreCare

Ultimo aggiornamento: 14 novembre 2026

Questa pagina spiega quali informazioni l'app TyreCare salva sul tuo dispositivo e perché. Completa
l'[informativa privacy](informativa-privacy.md). Il titolare del trattamento è {{fornitore.nome}},
{{fornitore.indirizzo}}, partita IVA {{fornitore.partitaIva}} (email: {{fornitore.emailPrivacy}}).

## 1. In breve

- TyreCare **non usa cookie di profilazione**, né propri né di altri.
- TyreCare **non usa strumenti di statistica** (analytics), pubblicità, pixel o social network.
- TyreCare **non carica nulla da altri siti**: caratteri, icone e programmi sono tutti dentro l'app.
- L'app salva sul tuo dispositivo **solo ciò che serve per funzionare** (strumenti tecnici): tenerti
  collegato, ricordare l'officina su cui lavori, aprirsi in fretta anche con poca rete.

## 2. Perché non vedi un banner dei cookie

La legge (art. 122 del Codice privacy, D.Lgs. 196/2003, e Linee guida del Garante per la protezione dei
dati personali su cookie e altri strumenti di tracciamento del 10 giugno 2021) chiede il consenso, e
quindi il banner, solo per i cookie e gli strumenti **non tecnici**: profilazione, pubblicità, statistiche
non anonime. Per gli strumenti **tecnici**, cioè necessari a fornire il servizio che hai chiesto, il
consenso non serve: basta spiegare con chiarezza cosa viene salvato. È quello che fa questa pagina,
raggiungibile da ogni pagina pubblica dell'app e dal Profilo.

Le stesse regole valgono per gli strumenti simili ai cookie, come la memoria del browser
(`localStorage`, `sessionStorage`) e il service worker: per questo li elenchiamo qui sotto anche se non
sono cookie in senso stretto.

Se in futuro TyreCare userà strumenti non tecnici, prima ti chiederà il consenso con un banner e
aggiornerà questa pagina.

## 3. Cosa salviamo sul tuo dispositivo

| Cosa | Dove | A cosa serve | Quanto dura |
|------|------|--------------|-------------|
| Sessione di accesso (codici che ti tengono collegato) | `localStorage`, chiave `sb-…-auth-token` | Non chiederti email e password a ogni apertura | Finché non esci dall'account; i codici si rinnovano da soli ogni ora |
| Officina scelta (solo per chi lavora in più officine) | `localStorage`, chiave `tc-officina` | Riaprire l'app sull'ultima officina usata | Finché non cancelli i dati del sito |
| Carta «Primi passi» chiusa (solo titolari di officina) | `localStorage`, chiave `tc-primi-passi-nascosti-…` | Non mostrarti di nuovo una guida che hai chiuso | Finché non cancelli i dati del sito |
| Segnale di ricaricamento dopo un aggiornamento | `sessionStorage`, chiave `tc-ricarica-pagina` | Evitare che la pagina si ricarichi all'infinito se un file dell'app è cambiato | Finché chiudi la scheda |
| File dell'app (pagine, stili, icone, caratteri) | Cache del **service worker**, con un piccolo indice tecnico in IndexedDB | Aprire l'app più in fretta e anche con poca rete; installarla sul telefono | Finché non disinstalli l'app o cancelli i dati del sito; si aggiorna a ogni nuova versione |
| Iscrizione alle notifiche push (solo se le attivi) | Browser e servizio push del browser | Recapitarti le notifiche sul dispositivo | Finché non le disattivi dall'app o dal browser |

Il service worker conserva **solo i file dell'app**, non i tuoi dati: veicoli, pneumatici e appuntamenti
vengono letti dal server ogni volta.

Nessuna di queste informazioni viene usata per riconoscerti su altri siti, per mostrarti pubblicità o per
costruire un tuo profilo.

## 4. Permessi del browser

L'app chiede due permessi, solo quando servono e solo se li usi:

- **Notifiche**: quando tocchi «Attiva le notifiche». Puoi toglierlo dalla pagina «Notifiche» dell'app
  o dalle impostazioni del browser.
- **Posizione**: quando cerchi le officine vicine o invii una richiesta di aiuto su strada. La posizione
  viene letta in quel momento; l'app non ti segue.

## 5. Servizi di altri

- **Servizi push.** Se attivi le notifiche push, il tuo browser crea un'iscrizione presso il servizio push
  del suo produttore (Google per Chrome e Android, Apple per Safari e iPhone, Mozilla per Firefox). Il
  contenuto delle notifiche viaggia cifrato: il servizio push lo recapita ma non può leggerlo.
- **Link esterni.** Alcuni pulsanti aprono altri servizi solo se li tocchi: la mappa (Google Maps) per
  raggiungere un'officina, WhatsApp per condividere un report, il programma di posta per un invito. Da
  quel momento valgono le regole di quei servizi.
- **Fornitori tecnici.** Chi ospita l'app e il database (Vercel e Supabase) riceve, come per ogni sito, i
  dati tecnici della connessione (indirizzo IP, tipo di browser). I dettagli sono nell'informativa
  privacy, sezione 5.

## 6. Come cancellare o bloccare questi dati

- **Esci dall'account** dal Profilo: la sessione di accesso viene cancellata.
- **Cancella i dati del sito** dalle impostazioni del browser («Cancella dati di navigazione» o «Dati dei
  siti»): spariscono tutte le voci della tabella. Dovrai accedere di nuovo.
- **Disinstalla l'app** dal telefono: vengono tolti anche i file salvati dal service worker.
- Se blocchi del tutto la memoria del browser per TyreCare, l'app non può tenerti collegato e non
  funziona correttamente.

## 7. Il sito di presentazione

Il sito di presentazione di TyreCare ([{{sito.url}}]({{sito.url}})) ha una sua cookie policy: anche lì non
ci sono cookie né strumenti di tracciamento.

## 8. Contatti e diritti

Per domande scrivi a {{fornitore.emailPrivacy}}. I tuoi diritti sui dati personali (accesso, rettifica,
cancellazione, opposizione e gli altri) e il modo di esercitarli sono spiegati
nell'[informativa privacy](informativa-privacy.md#6-i-tuoi-diritti-e-come-esercitarli). Puoi anche
presentare reclamo al Garante per la protezione dei dati personali
([www.garanteprivacy.it](https://www.garanteprivacy.it)).

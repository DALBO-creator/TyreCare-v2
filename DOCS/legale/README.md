**BOZZA — da rivedere con un consulente prima dell'uso**

# Documenti legali di TyreCare — bozze

> Bozze scritte il 2026-10-21 (compito T013) per preparare la revisione di un consulente privacy/legale
> prima del pilota con LA SANTI GOMME (PLAN §P17, §P18). **Non vanno pubblicate né mostrate agli utenti
> così come sono**: le pagine nell'app si faranno dopo la revisione.

## Documenti

| File | Contenuto | A chi si rivolge |
|------|-----------|------------------|
| [`informativa-privacy.md`](informativa-privacy.md) | Informativa sul trattamento dei dati (art. 13–14 GDPR), con la parte su cookie e archiviazione locale | Clienti, titolari e operatori delle officine |
| [`termini-di-servizio.md`](termini-di-servizio.md) | Condizioni d'uso del servizio, account e ruoli, prenotazioni, responsabilità, abbonamento | Tutti gli utenti |
| [`dpa-officine.md`](dpa-officine.md) | Accordo di nomina a responsabile del trattamento (art. 28 GDPR): istruzioni, misure di sicurezza, sub-responsabili, data breach, fine del contratto, audit | Ogni officina affiliata (da firmare prima di caricare dati veri) |
| [`registro-trattamenti.md`](registro-trattamenti.md) | Registro dei trattamenti (art. 30): parte A TyreCare titolare, parte B TyreCare responsabile per le officine | Uso interno; da mostrare al Garante se lo chiede |
| [`registro-accessi.md`](registro-accessi.md) | Registro degli accessi del personale di TyreCare ai dati delle officine (DPA §8–§9): chi può accedere, cosa si annota, controlli periodici | Uso interno; da mostrare alle officine se lo chiedono |
| [`procedura-violazioni.md`](procedura-violazioni.md) | Procedura per le violazioni dei dati: esempi, primi passi tecnici, chi avvisa chi e quando (artt. 33–34), registro delle violazioni (art. 33.5) | Uso interno; l'avviso alle officine segue il DPA §12 |

Le bozze di DPA e registro sono state aggiunte il 2026-10-22 (compito T014), quella della procedura per le
violazioni il 2026-10-24 (compito T037), quella del registro degli accessi con le istruzioni sulle copie di
sicurezza ([`../pilota/copie-di-sicurezza.md`](../pilota/copie-di-sicurezza.md)) con T048. Il contratto di
abbonamento per le officine non è più "da fare": le condizioni di abbonamento e pagamento con Stripe sono in
bozza nei termini (§10), nell'informativa e nel registro (A7) con T190, e il DPA rimanda ai termini §10.
Restano da completare recesso, fatturazione e IVA.

## Come sono state scritte

- I dati elencati nell'informativa sono quelli **realmente presenti** nel database (tabelle delle migrazioni
  in `supabase/migrations/`) al 2026-10-21. Se si aggiungono tabelle o campi con dati personali,
  l'informativa va aggiornata.
- L'archiviazione locale è stata verificata nel codice (`apps/web/src`): nessun cookie, nessuno strumento
  di analisi o di profilazione, nessun font o script caricato da siti terzi.
- Non si promettono funzioni che l'app non ha: si scrive come fatto solo ciò che è sul ramo `main`
  (aggiornato con T058: «Scarica i tuoi dati» ed «Elimina il tuo account» nel Profilo, esportazione per
  l'officina, pulizia delle notifiche). Le prenotazioni si cancellano da sole 24 mesi dopo il giorno
  dell'appuntamento (T197).
  Eccezione: la sezione «Aiuto su strada» (termini §7, informativa, registro A6) descrive la funzione
  decisa con R18 (T139–T144): sul ramo `main` ci sono il database e le pagine, quella del cliente
  (`/strada`) e quella dell'officina (`/officina/strada`). Va riletta se la funzione cambia, ma si può
  dare al consulente come funzione presente.

## Cosa manca (da completare prima di darle al consulente)

Nei documenti sono segnati con `[DA COMPLETARE: …]`. Si possono compilare nella voce D5 di
`ai-org/progetti/tyrecare/in-attesa-di-davide.md`.

- [DA COMPLETARE: nome e cognome o ragione sociale di chi offre TyreCare]
- [DA COMPLETARE: indirizzo / sede legale]
- [DA COMPLETARE: partita IVA o codice fiscale]
- [DA COMPLETARE: email per le richieste privacy]
- [DA COMPLETARE: eventuale PEC e responsabile della protezione dei dati (DPO), se nominato]
- [DA COMPLETARE: dominio e indirizzo web di TyreCare (P23)]
- Scelte da fare (meglio con il consulente): tempi di conservazione, età minima, regione dei server di
  Vercel e di Resend, ruolo di Stripe, recesso, fatturazione e IVA dell'abbonamento, foro competente.
  Piani, prezzi e prova sono decisi (R5, R19, R29) e stanno nell'app, non nei termini.

## Da fare prima del lancio (misure di sicurezza che oggi mancano)

Il DPA (§9) e il registro descrivono **solo** le misure verificate nel codice il 2026-10-22: RLS attiva su
tutte le 21 tabelle in `public` (`enable row level security` nelle migrazioni, con test pgTAP anche per gli
accessi negati), accessi per ruolo, HTTPS, database Supabase in eu-west-1, password cifrate, codici degli
inviti come impronta SHA-256, chiave di servizio solo nella funzione sul server. Queste invece **mancano**
o non si possono verificare dal repository, e non vanno scritte come già fatte finché non lo sono:

- [~] **Registro degli accessi del personale di TyreCare** ai dati delle officine: chi usa la chiave di
  servizio o la console di Supabase legge tutto senza traccia nell'app (DPA §8; domanda 9). Bozza pronta
  (T048, [registro accessi](registro-accessi.md), procedura in bozza): finché non è in uso, il DPA non dice che gli
  accessi sono registrati.
- [~] **Cifratura a riposo, copie di sicurezza e ripristino:** dipendono dal piano Supabase. Bozza pronta
  (T048, [copie di sicurezza](../pilota/copie-di-sicurezza.md), procedura in bozza): resta da verificare cosa
  offre il piano scelto e da provare il ripristino, poi scriverlo nel DPA §9.
- [x] **Esportazione dei dati** in formato leggibile da computer: fatto. Per l'officina (restituzione a fine
  contratto, DPA §13): «Scarica clienti e veicoli» (T030, stesso formato dell'import) e «Scarica i
  controlli» (T041) in `/clienti/importa`. Per l'utente (portabilità): «Scarica i tuoi dati» nel Profilo
  (T040, file JSON; senza inviti e link dei report, scelta R13).
- [x] **Cancellazione dell'account** dall'app: fatto. Funzione SQL `elimina_account()` (T038) e pulsante
  «Elimina il tuo account» nel Profilo (T039); domanda 14 ancora aperta.
- [x] **Cancellazione automatica** dei dati scaduti secondo i tempi di conservazione: fatto. Notifiche
  (T049, job notturno `pulizia-notifiche`: le lette dopo 180 giorni, tutte dopo 365; scelta R6), aiuto su
  strada (job `richieste-strada`, ogni 10 minuti: 90 giorni dopo la chiusura) e prenotazioni (T197, job
  notturno `pulizia-prenotazioni`: 24 mesi dopo il giorno dell'appuntamento; scelta R25). I tempi
  restano da confermare con il consulente.
- [ ] **Procedura scritta per le violazioni dei dati** (chi se ne accorge, chi avvisa le officine e entro
  quanto, registro delle violazioni — art. 33.5): bozza pronta (T037, `procedura-violazioni.md`), da
  rivedere; restano da completare i contatti e il termine del DPA §12.1.
- [ ] **Autenticazione a due fattori** per titolari delle officine e amministratori: disattivata
  (`[auth.mfa.totp]` con `enroll_enabled = false` in `supabase/config.toml`).
- [ ] **Regole sulle password più robuste:** oggi solo lunghezza minima 8 (`password_requirements = ""`) e
  `secure_password_change = false` (cambio password senza riautenticazione recente).
- [~] **Intestazioni di sicurezza del sito:** in parte fatto (T036): intestazioni attive (nosniff,
  X-Frame-Options, Referrer-Policy, Permissions-Policy, HSTS senza `includeSubDomains`); la CSP è in sola
  osservazione (`Content-Security-Policy-Report-Only`) e va resa obbligatoria dopo aver controllato la
  console del sito pubblicato (`apps/web/vercel.json`).
- [ ] **Protezione dagli abusi** su registrazione e accesso (captcha): non configurata; oggi ci sono solo i
  limiti di frequenza di Supabase.
- [ ] **Regioni dei fornitori:** Vercel (nessuna regione impostata in `vercel.json`), Resend e la funzione
  sul server `invia-notifica` (Supabase Edge Function): verificare dove trattano i dati e le garanzie per
  gli USA (domande 4 e 5).
- [ ] **SSL obbligatorio sulle connessioni dirette al database** (quelle di manutenzione, non dell'app):
  attivare "Enforce SSL" nel progetto Supabase e verificarlo.
- [ ] **Impostazioni del progetto cloud:** `supabase/config.toml` vale per l'ambiente locale; controllare
  che nel progetto Supabase in produzione ci siano le stesse (conferma email, rotazione dei token, ecc.).
- [ ] **DPA firmati con i sub-responsabili** (Supabase, Vercel, Resend): accettarli dalle loro console e
  conservarne copia.

## Domande per il consulente

1. **Base giuridica dei promemoria.** I clienti con il veicolo collegato al loro account ricevono, senza
   un consenso separato nell'app, notifiche nell'app e push (se le hanno attivate nel browser): promemoria
   del giorno prima dell'appuntamento, esito del controllo con gomme gialle o rosse, cambio stagionale
   estive/invernali. Bastano l'esecuzione del contratto e il legittimo interesse, o serve un consenso
   esplicito? Il cambio stagionale è "di servizio" o rischia di essere considerato promozionale?
2. **Conservazione dopo l'uscita di un'officina.** Quando un'officina smette di usare TyreCare, cosa
   succede ai dati che ha caricato (clienti, veicoli, pneumatici, controlli, prenotazioni)? Restituzione,
   cancellazione entro quanto tempo, e i clienti che li vedono nel loro garage? Va scritto nel DPA.
3. **Età minima** per creare un account cliente (14 anni per il consenso ai servizi online in Italia, 18
   per i contratti, o altro?). Oggi l'app non chiede la data di nascita.
4. **Trasferimenti extra UE dei servizi push.** Le notifiche push passano dal servizio del produttore del
   browser (Google per Chrome/Android, Apple per Safari/iPhone, Mozilla per Firefox), che può trovarsi
   fuori dall'UE; l'indirizzo dell'iscrizione lo genera il browser. Come va descritto? Servono garanzie
   (clausole contrattuali tipo, Data Privacy Framework) o un'informazione specifica?
5. **Altri trasferimenti:** Vercel (hosting) e Resend (email) sono società statunitensi. Quali regioni e
   quali garanzie indicare?
6. **Ruoli privacy.** È corretto che l'officina sia titolare dei dati che carica e TyreCare responsabile
   (P17), mentre TyreCare è titolare dei dati dell'account? Le **prenotazioni** create dal cliente verso
   un'officina: di chi è la titolarità (dell'officina, di TyreCare, contitolarità)?
7. **Clienti importati dal gestionale** che non hanno un account TyreCare: chi deve dar loro l'informativa
   (art. 14) e come? Basta l'informativa dell'officina?
8. **Campo `consenso_marketing`** nella scheda cliente dell'officina: oggi viene solo memorizzato (anche
   dall'import), TyreCare non invia comunicazioni promozionali. Va spiegato nell'informativa o tolto?
9. **Accesso del personale di TyreCare** ai dati delle officine per assistenza: il ruolo `ADMIN` nell'app
   non vede i dati dei clienti delle officine (PLAN §P12), ma chi gestisce il sistema può accedervi dal
   server con le chiavi di servizio. Come va regolato nel DPA (persone autorizzate, registro degli
   accessi)?
10. **Cancellazione dell'account:** ora si fa dal Profilo («Elimina il tuo account», T038–T039): la
    funzione rifiuta gli amministratori, i titolari di un'officina e chi ha prenotazioni in corso. Basta
    questa funzione, o serve anche una procedura per chi non riesce ad accedere (richiesta via
    email)? Proposta: email di contatto, come informativa §6 e termini §11.
11. **Archiviazione locale:** il salvataggio della sessione nel `localStorage` e il service worker sono
    "strettamente necessari" e quindi senza banner dei cookie? Va bene un'informativa breve senza banner?
12. **Termini di servizio:** limitazioni di responsabilità sulle misure degli pneumatici e sulle
    prenotazioni non confermate, clausole vessatorie (artt. 1341–1342 c.c.) e diritti del consumatore
    (Codice del consumo) per i clienti privati.
13. **Procedura per le violazioni** (`procedura-violazioni.md`): i passi tecnici e i tempi di avviso
    (officine senza ingiustificato ritardo e entro il termine del DPA; Garante entro 72 ore per i dati di cui
    TyreCare è titolare) sono adeguati? Il registro delle violazioni ha i campi giusti?
14. **Prenotazioni passate e cancellazione dell'account** (T038): chi elimina il proprio account dall'app
    perde anche le prenotazioni passate fatte come cliente (cancellazione a cascata), mentre clienti,
    veicoli e controlli restano all'officina, scollegati dall'account. La sparizione delle prenotazioni
    passate è compatibile con gli obblighi di conservazione (dell'officina e di TyreCare)?
15. **Aiuto su strada (termini §7, informativa e registro A6).** La sezione nuova dice che TyreCare
    inoltra la richiesta, che l'intervento, il prezzo e le modalità sono dell'officina che accetta, che non
    c'è garanzia di risposta (nessun filtro sugli orari) e che in pericolo si chiama il 112; il pagamento
    avviene fuori dall'app. Basta questa formula per escludere la responsabilità di TyreCare (Codice del
    consumo, artt. 1341–1342 c.c.)? E l'officina che accetta è **titolare autonomo** del trattamento di
    posizione e telefono (registro A6, ruolo ancora da confermare), o agisce per conto di TyreCare?
    Chi elimina l'account cancella con esso anche le proprie richieste di aiuto su strada (a cascata).
16. **Abbonamenti e pagamenti con Stripe (termini §10, informativa, registro A7).** Le officine pagheranno
    l'abbonamento mensile con carta su una pagina di Stripe; TyreCare conserva solo gli identificativi
    del cliente e dell'abbonamento Stripe, il piano e lo stato, e manda a Stripe email del titolare,
    ragione sociale e codice dell'officina. Che **ruolo** ha Stripe (titolare autonomo, responsabile o
    altro)? Come si regola il **trasferimento extra UE** (Stripe ha società negli USA)? Servono
    clausole nel contratto con le officine? Mancano anche recesso, fatturazione e IVA, e da quando vale
    l'annullamento (subito o a fine periodo). Il pagamento online vale dalla data di attivazione ancora da
    fissare: finché non c'è, le bozze non vanno date come funzione già in uso.
17. **Errori dell'app (informativa §2, §3, §4 e §6, registro A8, R33).** Gli errori non gestiti e quelli
    di caricamento delle pagine di chi ha un account (indirizzo della pagina senza la parte dopo `?` e
    `#`, messaggio, dettaglio tecnico, versione, browser, account) vanno in una tabella che legge solo
    l'amministratore e si cancella dopo 30 giorni e con l'account; nessun servizio esterno.
    Quale è la **base giuridica** (proposta:
    legittimo interesse, art. 6.1.f, per correggere i malfunzionamenti)? Va bene **escluderli** dal file
    «Scarica i tuoi dati» (sono resoconti tecnici, non dati forniti dall'utente) e dire nell'informativa
    che non ci sono?

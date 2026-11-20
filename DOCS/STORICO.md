# STORICO — Sessioni passate

> Resoconto di ogni sessione, **dalla più recente alla più vecchia**: la nuova sessione si aggiunge **in
> cima**. Non serve leggerlo all'avvio: cosa fare dopo è in [`NEXT.md`](NEXT.md) → "Prossima sessione".
> Le sessioni fino alla 19 sono state spostate qui da `NEXT.md` il 2026-10-20 senza modifiche.

### Sessione agenti — 2026-11-20 — ciclo 20261120-18 — T270 T271

**Fatto**

- T270: il test axe di `/admin/commenti` ora gira con un commento reale in elenco, scritto da un cliente
  nuovo; aggiunto il test axe di `/admin/andamento`.
- T271: nuovo e2e in `strada.spec.ts` che prova il focus sull'h1 dopo un annullo riuscito dell'aiuto su
  strada (T228), con richiesta e annullo finti via `page.route`.

**Verifica**

- e2e non eseguiti in sandbox, verificati dalla CI del treno. Gate del supervisore: 2/2 approvati al primo
  giro.

### Sessione agenti — 2026-11-20 — ciclo 20261120-15 — T307 T309

**Fatto**

- T307: nuovo `DOCS/pilota/testo-per-i-clienti.md` con il cartello A5 per il banco e il messaggio WhatsApp
  per far entrare i clienti di LA SANTI GOMME; rimando in `guida-avvio.md` punto 6. L'indirizzo del sito è
  `[DA COMPLETARE]` fino alla scelta del dominio.
- T309: `guida-officina.md` spiega la bozza del controllo (misure riprese, «Scarta la bozza», 7 giorni, solo
  su quel dispositivo) e «DOT diverso per ogni ruota» nel montaggio e in «Cambia pneumatici».

**Verifica**

- Corsia C4 coordinata dal direttore, 2 esecutori sonnet. Prova d'insieme verde: 795 test, JS iniziale
  68,1 kB; e2e non eseguiti (li fa la CI).
- Gate del supervisore: 2/2 approvati al primo giro. Rilievo `nota`: `guida-officina.md` riga 172, frase
  imprecisa sul DOT che resta cambiando posizioni (da sistemare col prossimo compito sul file).

**Note**

- Idee: passo Android (menu ⋮ → «Installa app») anche in `guida-cliente.md`; il commento «Solo nel
  montaggio» di `collegaDotPerRuota` è impreciso (vale anche in «Cambia pneumatici»); guida-officina §9:
  scrivere «resta per le ruote che lasci scelte» invece di «resta se cambi le posizioni».
- T307: il passo 2 dice «apri il link che ti abbiamo mandato» e non «link dell'email», perché l'invito non
  parte da solo; aggiunta la riga per chi ha già un account («Accedi», poi «Collega i miei veicoli»).

### Sessione agenti — 2026-11-20 — ciclo 20261120-03 — T302 T278

**Fatto**

- T302: aggiunto `pagine/strada.test.ts` (6 test DOM) per «Aiuto su strada» del cliente: modulo, richiesta
  aperta, accettata con e senza «Chiama», limite orario, annullo con focus sull'h1.
- T278: in `lib/prenotazioni.ts` il commento di `contaRichiesteDaConfermare` stava sopra
  `registraClienteDaPrenotazione`; spostato sopra la funzione giusta (diff di soli commenti).

**Verifica**

- Corsia C3 coordinata dal direttore, 2 esecutori sonnet. Prova d'insieme verde: 81 file, 795 test, JS
  iniziale 68,1 kB, CSS 32,0 kB; e2e non eseguiti (li fa la CI).
- Gate del supervisore: 2/2 approvati al primo giro. Rilievi `nota`: `vi.clearAllTimers()` inutile in
  `strada.test.ts` e commento che promette il falso (idea T337).

### Sessione agenti — 2026-11-20 — ciclo 20261120-00 — T295 T296

**Fatto**

- T295: aggiunto `pagine/nuovo-controllo.test.ts` (12 test happy-dom): colore del battistrada in diretta per
  stagione, virgola e valori non validi; bozza: ripristino, «Scarta la bozza», salvataggio riuscito e fallito.
- T296: test unitari di `periodoChiusura` (orari, 5) e `dettagliServizio` (servizi, 7) con testi esatti;
  rilevato che `periodoChiusura` non mostra mai l'anno, contro il suo commento.

**Verifica**

- Prova d'insieme verde: 789 test, JS iniziale 68,1 kB, CSS 32,0 kB; e2e non eseguiti (li fa la CI).
- Gate del supervisore: 2/2 approvati al primo giro. Rilievi `nota`: salvataggio ritardato della bozza non
  provato (idea T335); commento di `periodoChiusura` errato (idea T336).

### Sessione agenti — 2026-11-19 — ciclo 20261119-21 — T305 T306

**Fatto**

- T305: bozze legali allineate alle migrazioni: errori dell'app (30 giorni, job `pulizia-errori-app`,
  cascade con l'account) nella «Cancellazione automatica» del README; «21 tabelle» diventa 22
  (`stripe_eventi` eliminata il 2026-11-14) in README e registro M1.
- T306: la pagina «Per le officine» ha la sezione «Domande frequenti» (6 domande con `details`/`summary`)
  ricavata da codice, decisioni P22/P25 e termini in bozza, più un e2e.

**Verifica**

- Prova d'insieme verde: 765 test, JS iniziale 68,1 kB, CSS 32,0 kB; e2e non eseguiti (li fa la CI).
- Gate del supervisore: 2/2 approvati al primo giro. Rilievi `nota`: data in `DOCS/legale/README.md` r.62
  da aggiornare; la FAQ sulla disdetta tace mancato rimborso dell'installazione e preavviso di TyreCare
  (rimanda ai Termini); `CONTATTO_EMAIL` è ancora un segnaposto.

### Sessione agenti — 2026-11-19 — ciclo 20261119-18 — T263 T279

**Fatto**

- T263: in `IMPLEMENTAZIONI.md` segnate come fatte 11 idee già realizzate (strada, unisci anagrafiche,
  annulla import, CSV errori, età DOT, scollega cliente, invito da Nuovo cliente, clienti senza app,
  prenotazione→cliente, ambiente DOM, avviso cloud); nota di Dashboard ADMIN col pilota; Sentry segnato come
  sostituito da `errori_app` e `/admin/errori` anche in `PLAN.md` r.212.
- T279: il Supabase finto a catena di `prenotazioni.test.ts` passa in `apps/web/src/test/supabase-finto.ts`
  (con `limit` e `maybeSingle`); 11 test nuovi per `caricaPrenotazioniOfficina`, `caricaPrenotazione`,
  `caricaClienteDellaPrenotazione` (2 `eq`, dritta T143) e `caricaServizi`; test da 754 a 765.

**Verifica**

- Prova d'insieme verde: 765 test, JS iniziale 68,1 kB.
- Gate del supervisore: 2/2 approvati al primo giro.

### Sessione — 2026-11-17 — link al sito vetrina

**Fatto**

- `SITO_URL` (`packages/shared/src/fornitore.ts`) ora punta al sito vetrina di prova su Vercel,
  `https://tyrecare-v2-website.vercel.app`, invece di `https://tyrecare.it` (dominio non ancora attivo). Lo
  usano il Profilo («Il sito di TyreCare»), il piede legale, `/per-le-officine` e i testi legali (`sito.url`).
  Test di `fornitore` e `piede-legale` verdi.

### Sessione agenti — 2026-11-16 — ciclo 20261116-21 — T256 T257 T300 T301

**Fatto**

- T256: pagina admin `/admin/andamento` «Andamento del pilota»: per officina i numeri della rpc
  `andamento_officine` (T255) per «Questa settimana», «Settimana scorsa» e «Ultimi 30 giorni», con «Copia i
  numeri» (una riga per officina). Link nel Profilo sotto «Errori dell'app».
- T257: nel piano del pilota (§3 e §5) i numeri della telefonata settimanale si leggono da *Profilo →
  Andamento del pilota*; tabella con colonne "Dove si legge" e "Alternativa", riga sul pulsante «Copia i
  numeri».
- T300: `pagine/notifiche.test.ts` (7 test DOM): icona per ogni tipo di `tipo_notifica`, stato vuoto, non
  lette con link, `segnaLette` all'apertura, sezione Email. Nell'app non esiste un pulsante «Segna tutte come
  lette»: le notifiche si segnano lette all'apertura.
- T301: `pagine/home.test.ts` (7 test DOM): stato vuoto, carte con href/targa/stato, gomme vecchie, link
  strada e registra officina, delega alla home officina.

**Verifica**

- Corsie C3 e C4 coordinate dal direttore. Prova d'insieme verde: 755 test, JS iniziale 68,1 kB.
- Gate del supervisore: 4/4 approvati al primo giro.

### Sessione agenti — 2026-11-16 — ciclo 20261116-18 — T255 T288 T293 T294

**Fatto**

- T255: nuova funzione SQL `andamento_officine(p_da, p_a)`, solo admin con 2FA: per ogni officina i numeri
  del pilota (piano-pilota §3): clienti, collegati e con push di adesso; inviti, controlli app e importati,
  richieste di appuntamento e su strada nel periodo, in giorni italiani. Migrazione 20261116000200, pgTAP
  `andamento-officine.test.sql`, tipi aggiornati.
- T288: il pgTAP `annulla-import` controlla subito dopo l'import le FK rimandate di clienti e veicoli verso
  `import_log` (`set constraints all immediate` + is(), plan 25).
- T293: nel montaggio di pneumatici si può scrivere un DOT diverso per ogni ruota (casella «DOT diverso per
  ogni ruota», campi `dot_<POSIZIONE>` nello schema, nessuna migrazione, `modifica-pneumatici` invariato).
- T294: `importAnnullabile` e `testoAnnullo` esportate (`adesso` facoltativo) e provate da 12 unit test in
  `pagine/importa.test.ts` (regola dei 7 giorni, solo l'ultimo import di clienti e veicoli non annullato,
  testi dopo l'annullo).

**Verifica**

- Prova d'insieme: 74 file / 729 test verdi, build ok, file iniziale invariato. I pgTAP di T255 e T288 non
  sono stati eseguiti qui: li prova la CI.
- Gate del supervisore: 4/4 approvati al primo giro.

### Sessione agenti — 2026-11-16 — ciclo 20261116-15 — T298 T299 T268 T310

**Fatto**

- T298 e T299: unit test nuovi, senza toccare il codice dell'app: 12 test DOM (happy-dom) degli stati della
  pagina dell'invito (`pagine/invito.test.ts`) e 11 test di `lib/push.ts` (`chiaveInByte` e i 5 stati di
  `statoPush`, `lib/push.test.ts`).
- T268 e T310: unit test DOM nuovi: 15 del dialogo di conferma `chiediConferma` (focus, Annulla/Esc/sfondo,
  conferma, errori, campo di testo) e 12 di `ui/modulo.ts` (campi, errori, pulsante in corso, doppio invio).
- Solo test: 50 test nuovi, 711 in totale; il codice dell'app è invariato. Corsie C3 (T298, T299) e C5
  (T268, T310).

**Verifica**

- Format, lint, typecheck, 711 test e build verdi; gate del supervisore approvato al primo giro.

### Sessione 2026-11-16 — integrazione dei rami di lancio (branch `claude/integrazione-lancio`)

**Fatto**

- Controllati i rami non uniti: le PR degli agenti ai-org erano già tutte su main (fino alla #98). Restavano
  `claude/pannello-admin` (2026-11-12) e i rami della sessione notturna del 2026-11-14 (`lancio/legale`,
  `lancio/sicurezza`, `lancio/admin`, scritti in parte da Fable 5.2 e salvati a metà). `lancio/desktop` era
  vuoto (il layout da computer era già su main); `chore/db-stop` già assorbito da main.
- **Pannello admin** unito su main aggiornato; i pgTAP aggiunti dopo il 2026-11-12 simulano ora `aal2`.
- **Legale:** testi definitivi, cookie policy `/cookie`, `DATI_FORNITORE`/`SITO_URL`, età minima 14 anni.
  Nei conflitti con `lancio/admin` tenuti i testi definitivi; l'informativa elenca i campi del nuovo
  abbonamento.
- **Sicurezza, completata:** permessi minimi (`anon`, funzioni dei trigger, membri dell'officina, endpoint
  push) e 2FA per tutti (`due_fattori`). Aggiunti ciò che mancava: richiesta del codice nel router per chi
  ha la 2FA con sessione `aal1`, rotta `/profilo/sicurezza` con link nel Profilo, messaggi d'errore TOTP,
  `config.toml` allineato alle nuove password (10 caratteri, maiuscola, minuscola, numero), e2e dell'admin
  sulla nuova schermata, test unitari delle password, `DOCS/SICUREZZA.md` (citato dalla migrazione ma mai
  scritto).
- **Admin / abbonamento manuale, completato:** Stripe tolto (funzioni, tabelle, test), abbonamento
  MENSILE/ANNUALE gestito a mano. Mancava la schermata per l'admin: nuova pagina `/admin/abbonamento?id=…`
  (rinnovo di un mese/anno, installazione pagata, modulo completo con note interne) e migrazione
  `20261116000100_admin_leggi_abbonamento.sql` (le note interne non erano leggibili nemmeno dall'admin);
  unit test, pgTAP `admin-leggi-abbonamento`, e2e `admin-abbonamento`.
- Documenti: `NOTES.md` (abbonamento manuale, 2FA per tutti), `PLAN.md` (P24 doppio → P25 abbonamento
  manuale, nuova P26 2FA e password), README legale, `pilota/sicurezza-account.md`,
  `pilota/pubblicazione.md` (`--include-all`), `PRODUZIONE-MARKETING.md` (valutazione in caso di cessione
  dal vecchio ramo `claude/valutazione-app`, con nota sui prezzi nuovi).
- Verifiche: `npm run check` verde, pgTAP tutti verdi su database pulito, e2e (vedi sotto).
- Merge su main e `db push --include-all` sul cloud (vedi NEXT).

**Non fatto / limiti**

- Le impostazioni del pannello Supabase (password, MFA) e la pulizia di Stripe sul cloud restano a Davide
  (`DOCS/SICUREZZA.md`).
- La coda di ai-org può contenere compiti su Stripe ormai superati: da ripulire.

### Sessione agenti — 2026-11-16 — ciclo 20261116-03 — T277 T290 T292 T272

**Fatto**

- T277: `scollega_cliente` annulla anche gli inviti ancora aperti del cliente (R42): chi riapre un vecchio
  link riceve `INVITO_ANNULLATO` (migrazione `20261108001200_scollega_annulla_inviti.sql`; pgTAP
  `scollega-cliente-inviti`, 18 test, li verifica la CI).
- T290: `sospendi_officina` avvisa i titolari solo se l'officina era ATTIVA (R43): da IN_ATTESA o già
  SOSPESA niente avviso (migrazione `20261108001300_sospendi_solo_attiva.sql`; pgTAP
  `sospendi-officina-attiva`, 18 test; l'attesa IN_ATTESA del test T242 passa da 1 a 0).
- T292: il «Nuovo controllo» salva sul dispositivo una bozza delle misure (R44), valida 7 giorni e legata a
  utente e veicolo: si riprende all'apertura con «Scarta la bozza» e si cancella dopo il salvataggio
  riuscito (`lib/bozza-controllo.ts`, unit test).
- T272: per PILOTA con subscription Stripe viva la pagina Abbonamento mostra una frase sola al posto di
  «è a posto» più la nota (`testoPilotaConSubscription`, unit test).
- Corsie C1 (T277, T290) e C2 (T292, T272); i pgTAP nuovi non sono stati eseguiti in locale.

### Sessione agenti — 2026-11-16 — ciclo 20261116-00 — T286 T269 T260 T264

**Fatto**

- T286: `import_id` di clienti e veicoli ora lo scrive solo l'import: il trigger `proteggi_import_id` blocca
  con 42501 insert e update diretti degli utenti non ADMIN; `importa_clienti_veicoli` apre il permesso con
  `set_config('tyrecare.import_id', …)` per il proprio id e lo richiude prima del return (migrazione
  `20261108001000_proteggi_import_id.sql`; pgTAP `import-id-protetto`, 31 test, li verifica la CI).
- T269: `limita_errori_app` non conta più gli errori quando l'`autore_id` è di un altro: decide la RLS
  (42501) e non TROPPI_ERRORI, che rivelava quanti errori aveva l'altro; tolto INSERT su `errori_app` ad
  anon (migrazione `20261108001100_errori_app_autore.sql`; pgTAP `errori-app-autore`, 8 test, li verifica
  la CI).
- T260: guide del pilota aggiornate con le funzioni di T208, T234, T235, T242, T259 e T266 (avviso richieste
  su strada vicine, motivo del rifiuto, gomme completate dall'import, avviso di sospensione, «Scollega
  l'account», «Annulla questo import»); la guida cliente spiega cosa succede se l'officina scollega
  l'account.
- T264: nuova guida `DOCS/pilota/sicurezza-account.md` sulle regole delle password da impostare nel pannello
  di produzione e sul perché la 2FA resta per dopo (R39); allineate le due voci del README legale e la voce
  nella lista di lancio.
- Corsie C1 (T286, T269) e C4 (T260, T264); i pgTAP nuovi non sono stati eseguiti in locale.

### Sessione agenti — 2026-11-15 — ciclo 20261115-17 — T206 T254 T266 T261

**Fatto**

- T206: nuovo indice `richieste_strada (cliente_id, created_at)` (migrazione
  `20261108000900_strada_indice_cliente.sql`): il limite di 3 richieste all'ora di `crea_richiesta_strada`
  resta veloce; `has_index` in pgTAP `strada-limiti` (plan 23, lo verifica la CI).
- T254: `invia-notifica` risponde 400 `notifica_id mancante` (invece di un errore non gestito) se il corpo
  non è JSON, è `null`, non è un oggetto o `notifica_id` non è una stringa; il 401 resta prima; 8 vitest
  nuovi.
- T266: l'elenco «Import precedenti» ha «Annulla questo import» sull'ultimo import clienti e veicoli non
  annullato di meno di 7 giorni (solo titolare): dialogo con cosa si toglie e cosa resta, avviso con i
  quattro numeri, riga «annullato il …»; `annullaImport` in `lib/importa.ts`; 11 unit test, 1 test sul CSV
  dell'e2e in `packages/shared`, e2e nuovo (lo verifica la CI). Chiude R40 (T265 + T266).
- T261: `accessibilita.spec.ts` controlla anche 5 pagine cliente (/appuntamenti, /notifiche, /profilo,
  /commento, /prenota), /privacy tra le pubbliche e 6 pagine titolare (/profilo, /servizi, /officina/orari,
  /officina/dati, /cliente, /clienti/importa-controlli); titoli h1 letti dal codice, nessuna regola axe
  esclusa (e2e da verificare con la CI).
- Corsie C1 (T206, T254) e C2 (T266, T261); pgTAP ed e2e li verifica la CI.

### Sessione agenti — 2026-11-14 — ciclo 20261114-00 — T265 T259

**Fatto**

- T265: `annulla_import(p_import_id)` toglie i clienti e i veicoli creati dall'ultimo import
  CLIENTI_VEICOLI (meno di 7 giorni, solo il titolare) e mai usati. Colonne nuove `import_id` (FK
  `deferrable initially deferred`) su `clienti_officina` e `veicoli`, più `import_log.annullato_il`
  (migrazione `20261108000800_annulla_import.sql`); pgTAP `annulla-import.test.sql` (24 test, li verifica la
  CI). La pagina arriva con T266.
- T259: nella scheda di un cliente collegato il titolare può scollegarlo dall'app con una conferma
  (`scollegaCliente` su `scollega_cliente`, T258); la sezione si ridisegna con «Invita nell'app» e il focus
  sul titolo; unit test ed e2e `scollega-cliente.spec.ts`.
- Verifiche: prova d'insieme con format, lint e typecheck verdi, 742 test vitest, JS iniziale 64,3 kB su 70;
  pgTAP ed e2e da verificare con la CI.
- Corsia C1: T265 all'esecutore-senior, T259 (fuori area C2) all'esecutore; gate del supervisore approvati
  (T259 al 2° giro: il focus).
- Idea emersa: trigger di protezione su `import_id` (le policy di update lasciano ai membri scriverlo a mano).

### Sessione agenti — 2026-11-13 — ciclo 20261113-21 — T231 T250

**Fatto**

- T231: gli eventi di Stripe scartati per un errore permanente salvano la chiave d'errore in
  `stripe_eventi.motivo` (migrazione `20261108000700_stripe_eventi_motivo.sql`, funzione
  `annota_evento_stripe` solo service role, troncata a 200 caratteri); si legge dalla console di Supabase
  anche dopo che i log della funzione sono spariti; risposta del webhook invariata; 10 casi pgTAP nuovi.
- T250: bozze legali aggiornate con gli errori dell'app (R33): voce nell'informativa §2/§3/§4/§6 (base
  giuridica `[DA COMPLETARE]`, proposta legittimo interesse), trattamento A8 nel registro, domanda 17 nel
  README per il consulente; «Scarica i tuoi dati» ora cita anche le richieste di aiuto su strada e dice che
  gli errori dell'app non ci sono.
- Verifiche: prova d'insieme 738 test vitest (67 file), JS iniziale 64,2 kB su 70; pgTAP di T231 da
  verificare con la CI `database`.
- Corsia C1 coordinata dal direttore (create_session assente): esecutore-senior Opus (T231) ed esecutore
  Sonnet (T250, fuori area) in parallelo; revisione 1 giro per T231, 2 per T250 (un esempio di percorso
  sbagliato corretto: l'indirizzo salvato contiene gli id, si tolgono solo `?` e `#`); gate del
  supervisore approvati.
- Idee emerse: conteggio degli eventi Stripe scartati nel pannello admin; frasi superate fuori campo:
  «21 tabelle» nel README legale e nel registro (M1), voci «Sentry» in `PLAN.md` e `IMPLEMENTAZIONI.md`
  (R33 ha scelto la tabella interna).

### Sessione agenti — 2026-11-13 — ciclo 20261113-18 — T240 T249

**Fatto**

- T240: la guida cliente dice quando compare «Chiama» nell'aiuto su strada (solo con il telefono
  dell'officina; altrimenti la notifica «Resta dove sei: ti chiamerà al numero che hai indicato») e che gli
  appuntamenti si cancellano dopo 24 mesi; il README legale nomina i job `pulizia-notifiche`,
  `pulizia-prenotazioni` e `richieste-strada`.
- T249: nuova pagina amministratore `/admin/errori` («Errori dell'app», dal Profilo): errori degli ultimi
  30 giorni raggruppati per messaggio, con le ultime 10 occorrenze per gruppo; unit test ed e2e.
- Verifiche: prova d'insieme 738 test vitest (67 file), JS iniziale 64,2 kB su 70, CSS 31,7 kB.
- Corsia C4 coordinata dal direttore, 2 esecutori Sonnet in parallelo; revisione in 2 giri per entrambi,
  gate del supervisore approvati al 1o giro.
- Idee emerse: README legale, «Cancellazione automatica»: aggiungere gli errori dell'app (30 giorni, job
  `pulizia-errori-app`); filtro per versione o percorso; «Elimina gruppo» per l'admin (serve la policy
  delete su `errori_app`). Nota: l'e2e di T249 usa `cliente@tyrecare.test` (limite 30 errori in 24 ore per
  autore): in locale, dopo molte esecuzioni, conviene un utente apposta.

### Sessione agenti — 2026-11-13 — ciclo 20261113-15 — T258 T267

**Fatto**

- T258: nuova funzione `scollega_cliente`: il titolare dell'officina (o l'admin) toglie l'account collegato
  a un cliente, utile quando l'invito l'ha accettato la persona sbagliata (R38); pgTAP con i casi negati.
  L'interfaccia resta a T259.
- T267: `apps/web/src/lib/prenotazioni.test.ts` con 25 unit test delle funzioni di prenotazione (richiesta,
  risposta di officina e cliente, annullamento, conteggio richieste, registrazione cliente): argomenti
  esatti di rpc e filtri, errori di Supabase sempre rilanciati; nessun cambio al codice.
- Verifiche: 730 test vitest sul treno, build ok; pgTAP affidato alla CI.
- Corsia C1 coordinata dal direttore: esecutore-senior Opus su T258, esecutore Sonnet su T267; gate del
  supervisore approvato al 1o giro.

### Sessione agenti — 2026-11-12 — ciclo 20261112-03 — T242 T235

**Fatto**

- T242: i titolari di un'officina sospesa ricevono un avviso nell'app («La tua officina è sospesa», link
  `/commento`); nuovo valore `AFFILIAZIONE_SOSPESA` di `tipo_notifica` (migrazione 20261108000500), icona
  `CirclePause`; nuovo pgTAP `sospendi-officina-avviso.test.sql` (18 asserzioni, verifica in CI).
- T235: l'anteprima e l'esito dell'import dei controlli dicono quante gomme già registrate vengono completate
  con DOT, marca o misura del file (`pneumatici_completati` di T243); chiave facoltativa nello schema
  (assente = 0); unit test e un e2e nuovo (verifica in CI).
- Verifiche: prova d'insieme: 705 test vitest sul treno (65 file), JS iniziale 26,78 kB come main.
- Corsia C1 coordinata dal direttore; gate del supervisore approvati al 1o giro.
- Nota: il treno precedente #90 ha avuto l'e2e rosso per una porta occupata sul runner (`supabase start`),
  rilanciato senza commit e unito.

### Sessione agenti — 2026-11-12 — ciclo 20261112-00 — T248 T262

**Fatto**

- T248: gli errori non gestiti (`error`, `unhandledrejection`) e le pagine che non si caricano finiscono in
  `errori_app` con `segnalaErrore`; filtri: sessione, online, rete, `ErroreModulo`, doppioni, 5 invii per
  caricamento; JS iniziale +0,08 kB.
- T262: test DOM happy-dom delle pagine accedi, registrati e password dimenticata (8 test: errori con
  `aria-invalid`, credenziali errate, `termini_versione` in `signUp`, schermata «Controlla la posta»).
- Verifiche: prova d'insieme verde (65 file, 700 test vitest, build ok); JS iniziale `index-*.js` 26,78 kB
  contro 26,70 kB di main (+0,08 kB).
- Corsia coordinata dal direttore; gate del supervisore: T248 approvato al 2o giro (1o giro: il filtro
  `erroreDiRete` scartava ogni `TypeError`, corretto con un filtro locale), T262 al 1o.

### Sessione agenti — 2026-11-11 — ciclo 20261111-21 — T246 T234

**Fatto**

- T246: nuova guida `DOCS/pilota/email-dominio.md` per la voce D3 (dominio verificato su Resend, SMTP di
  Supabase, segreti `EMAIL_NOTIFICHE`/`RESEND_API_KEY`/`EMAIL_MITTENTE`/`SITO_URL`, prove finali); la voce D3
  di `lista-lancio.md` rimanda alla guida; il passo finale porta alle idee T076 e T210.
- T234: `chiediConferma` accetta un campo di testo facoltativo (`campo`) e passa il testo ad `azione`; nel
  rifiuto dell'affiliazione l'admin può scrivere un motivo (max 300) che arriva nell'avviso a chi aveva
  chiesto; e2e aggiunto.

### Sessione agenti — 2026-11-11 — ciclo 20261111-18 — T243 T211

**Fatto**

- T243: la risposta di `importa_controlli` e `import_log` hanno il contatore `pneumatici_completati`
  (migrazione 20261108000300): le gomme già presenti che il passo 1b (T203) completa con DOT, marca o
  misura, anche in simulazione; 10 casi pgTAP nuovi.
- T211: un evento Stripe in ritardo non riporta indietro l'abbonamento (`stripe_evento_il`, funzione nuova
  `aggiorna_abbonamento_stripe_evento`, `created` dell'evento); un cliente Stripe per officina (indice
  unico), altrimenti `CLIENTE_STRIPE_DI_ALTRA_OFFICINA`, errore permanente.
- Verifiche: 678 test vitest verdi, build ok; pgTAP non eseguiti in locale: li verifica la CI.
- Corsia coordinata dal direttore; gate del supervisore approvato al 1o giro per entrambi i compiti.

### Sessione agenti — 2026-11-09 — ciclo 20261109-21 — T241 T247 T238 T236

**Fatto**

- T241: le bozze legali valgono prima e dopo l'accensione di Stripe («dal [DA COMPLETARE: data di
  attivazione dei pagamenti online]»; prima, le condizioni di oggi, anche a prova scaduta). Informativa,
  registro A2 e termini §9 descrivono le email di riserva (partono se la push non parte verso nessun
  dispositivo), con Resend tra i fornitori.
- T247: la pagina admin «Officine» ha un riquadro «Database» che confronta l'ultima migrazione dell'app
  (costante di build di Vite) con `versione_database()`; avviso giallo se il database è indietro.
  `statoDatabase`, `leggiVersioneDatabase`, unit test ed e2e `admin-versione.spec.ts`.
- T238: «Gestisci il pagamento» compare anche per l'officina PILOTA con una subscription Stripe ancora viva,
  così può annullare il vecchio abbonamento dall'app; `caricaAbbonamento` legge `stripe_subscription_id`;
  3 test nuovi su `mostraPortale`.
- T236: pagina Notifiche: la sezione Email non lascia più spazio in cima (via `mt-3`, gap del contenitore a
  1rem) e gli errori di push ed email usano `--tc-rosso-chiaro`.

### Sessione agenti — 2026-11-09 — ciclo 20261109-18 — T228 T233

**Fatto**

- T228: aiuto su strada, dopo un annullo (riuscito o fallito) il focus va sul nuovo `[data-annulla]` o
  sull'`h1`, aspettando il `close` del dialogo (`focusDopoRidisegno()`); l'e2e dell'annullo fallito conta le
  GET di `richieste_strada` e verifica il focus.
- T233: axe controlla anche `/admin/officine` (con un'officina in attesa creata dal test, quindi con
  «Attiva» e «Rifiuta la richiesta») e `/admin/commenti`, come amministratore.
- Corsia coordinata dal direttore; gate supervisore 2/2 al 1o giro; prova d'insieme verde: 664 test, JS
  iniziale 63,6 kB; e2e da vedere in CI (niente Docker). Da vedere in CI: possibile `color-contrast` di
  `tc-pulsante-elimina` (`_officina.scss` ~377); focus dopo annullo riuscito non coperto da test.

### Sessione agenti — 2026-11-09 — ciclo 20261109-15 — T245 T208

**Fatto**

- T245: nuova guida `DOCS/pilota/pubblicazione.md` (D10) per portare migrazioni e funzioni in produzione
  dopo ogni treno (migration list, `db push --dry-run` e `db push`, deploy di `invia-notifica` e delle
  funzioni Stripe, controllo, errori, mai `db reset`); la demo rimanda alla guida; la lista di lancio ha la
  voce D10 e indica dove sono R1-R41.
- T208: la home dell'officina mostra un avviso giallo «N richieste di aiuto su strada vicine» con link a
  `/officina/strada`, solo a servizio attivo e conteggio > 0; nuovo modulo leggero `lib/strada-conta.ts`;
  JS iniziale 63,5 -> 63,6 kB.
- Corsia coordinata dal direttore (revisione a coppia non indipendente); gate supervisore 2/2 al 2o giro
  (rilievi del 1o giro risolti: tabella «Pubblicazioni fatte» e prerequisiti in T245, e2e fragile al retry
  in T208); controlli veloci verdi: 664 test, JS iniziale 63,6 kB; e2e (anche strada-officina) e pgTAP in CI.

### Sessione agenti — 2026-11-09 — ciclo 20261109-03 — T251 T252

**Fatto**

- T251: «Scarica i tuoi dati» include anche le richieste di aiuto su strada (`richieste_strada`, filtrate
  per `cliente_id`), completando la portabilità (art. 20) dopo T139–T143; unit test del filtro ed e2e;
  `versione: 1` invariata. La frase dell'informativa sul contenuto del file la aggiorna T250.
- T252: nuovo `apps/web/src/demo-la-santi.test.ts`: gli `insert into public.*` dello script della demo (14
  insert, 12 tabelle) devono usare solo colonne di `Insert` in `database.types.ts` e coprire quelle
  obbligatorie; una migrazione che rompe lo script fa fallire i controlli veloci.
- Corsia coordinata dal direttore (revisione a coppia non indipendente); gate 2/2 al primo giro; prova
  d'insieme verde: 660 test, JS iniziale 63,5 kB.

### Sessione agenti — 2026-11-09 — ciclo 20261109-00 — T244 T113

**Fatto**

- T244: migrazione del monitoraggio del pilota (`versione_database()` solo ADMIN; `errori_app` con RLS,
  limite 30 in 24 ore, pulizia dopo 30 giorni con il job delle 01:50 UTC), tipi a mano, pgTAP 31
  asserzioni (non eseguito nel cloud, lo verifica la CI).
- T113: la logica di `invia-notifica` passa in `invio.ts` (`gestisciNotifica(richiesta, dipendenze)`),
  `index.ts` resta solo cablaggio; 12 test vitest; contatto VAPID da `VAPID_CONTATTO` (facoltativa);
  nessun cambio di comportamento.
### Sessione 2026-11-12 — pannello amministratore e sicurezza (branch `claude/pannello-admin`)

**Fatto**

- Richiesta di Davide: un'area amministratore accessibile solo a lui, con strumenti di amministrazione e
  correzione rapida, e l'app più robusta lato sicurezza. Da ora si lavora in branch.
- Migrazione `20261112000100_pannello_admin.sql`:
  - `is_admin()` vale solo con la **verifica in due passaggi** (claim `aal` = `aal2`): con la sola
    password l'account ADMIN è un utente normale per RLS e funzioni;
  - il ruolo **ADMIN si dà e si toglie solo dal database** (trigger `proteggi_ruolo_admin`);
  - **registro delle azioni** `admin_registro` (solo lettura per l'admin, scritto da trigger su profiles,
    officine, officina_utenti, abbonamenti e dalle funzioni nuove);
  - funzioni `admin_riepilogo`, `admin_cerca_utenti`, `admin_correggi_profilo`, `admin_cambia_ruolo`,
    `admin_conferma_email`, `admin_blocca_utente`, `admin_disconnetti_utente`.
- Pagine nuove: `/admin` (numeri, «Da guardare», strumenti), `/admin/utenti` (ricerca e azioni rapide:
  correggi dati e ruolo, conferma email, email per nuova password, chiudi sessioni, blocca/sblocca),
  `/admin/registro`. Ingresso comune `pagine/admin-comune.ts` con la schermata della 2FA (registrazione
  dell'app con QR la prima volta, poi codice); la usano anche `/admin/officine` e `/admin/commenti`.
  Link «Pannello amministratore» nel Profilo.
- Sicurezza del sito: CSP **applicata** (non più Report-Only) con `object-src 'none'` e
  `upgrade-insecure-requests`, più `Cross-Origin-Opener-Policy: same-origin` (`vercel.json`).
- TOTP acceso in `supabase/config.toml`; nel seed l'admin di prova ha una 2FA con chiave nota (solo
  locale); gli e2e calcolano il codice (`codiceTotp` in `e2e/tests/aiuti.ts`).
- Test: pgTAP `pannello-admin.test.sql` (24) e `aal2` nelle sessioni simulate di tutti gli altri file
  (44 file, 951 test verdi); unitari `admin-pannello.test.ts` (651 in tutto verdi); e2e
  `admin-pannello.spec.ts` (2) più i 7 e2e admin esistenti verdi.

**Non fatto / limiti**

- Il blocco e «Chiudi le sessioni» tolgono i refresh token: il token già emesso resta valido fino alla
  scadenza (al massimo 1 ora, `jwt_expiry`).
- Nessun codice di recupero della 2FA: se si perde il telefono si toglie il fattore dall'editor SQL (vedi
  `NOTES.md`).
- Il typecheck di `e2e` fallisce per `@axe-core/playwright` mancante in locale (non toccato).

**Scoperto dopo il push (stesso giorno)**

- **I deploy di produzione su Vercel fallivano da almeno 4 giorni**: `scripts/dimensioni.mjs` (soglia 70 kB)
  misurato su una build senza `VITE_SUPABASE_*`, dove supabase-js sparisce dal bundle; con le variabili vere il
  codice iniziale è ~118 kB. Soglia portata a 137 kB (118,4 + 15%), motivo nel commento dello script. Il sito
  pubblicato era fermo a una versione vecchia.
- **Le anteprime Vercel erano nere**: `VITE_SUPABASE_ANON_KEY` è impostata solo per *Production* (la URL anche
  per *Preview*); senza chiave `getSupabase()` lancia all'avvio. Da aggiungere da Davide nella dashboard.

### Sessione 2026-11-08 — demo per il titolare di LA SANTI GOMME

**Fatto**

- Richiesta di Davide: preparare l'app per mostrarla al titolare di LA SANTI GOMME (officina di prova →
  «La Santi Gomme», Via della Scienza 6, Travagliato BS, orari del sito, 6 servizi), svuotare e riempire i
  due account (`albodavide1@gmail.com` officina, `albodavidexd@gmail.com` cliente) con dati realistici.
- Script `supabase/demo/la-santi-gomme.sql` (una transazione, rieseguibile, date relative al giorno di
  esecuzione nelle fasce aperte): 6 servizi, 11 clienti, 12 veicoli in stati diversi, 15 controlli (2
  mesi di storico per i 2 veicoli del cliente), 18 appuntamenti in tutti gli stati, aiuto su strada, 2
  import, notifiche lette e da leggere scritte a mano con trigger spenti (niente push vere). 7 clienti
  finti dell'app (`*@demo.tyrecare.invalid`, `raw_app_meta_data.demo`) perché ogni appuntamento ha un
  account. Guida per Davide: `DOCS/pilota/demo-la-santi.md`.
- Provato su un Postgres 16 locale con uno strato minimo che imita Supabase (`auth`, `cron`, `net`,
  `vault`) e tutte le 47 migrazioni: script eseguito due volte di fila, letture con la RLS come titolare e
  come cliente, invio di un commento come utente dell'app.
- I due errori segnalati dal telefono (commento «Qualcosa è andato storto», *Appuntamenti* «Non riusciamo
  a caricare i tuoi dati»): causa più probabile il database cloud **senza le migrazioni dopo metà
  ottobre** (ultimo `db push` registrato nello storico; da allora ~35 migrazioni, tra cui `commenti`),
  mentre Vercel pubblica il codice nuovo. Con lo schema completo le due operazioni funzionano. Da fare
  da Davide: `npx supabase db push` (sezione 1 della guida). Niente codice dell'app cambiato.

**Non fatto / limiti**

- Niente accesso al cloud da questa sessione (né Supabase né il sito): lo script non è stato eseguito in
  produzione e la causa degli errori non è verificata sul cloud.
- Coordinate dell'officina approssimative (geocodifica non raggiungibile): da correggere in *Dati
  dell'officina*. Partita IVA lasciata quella di prova.

**Idee**

- Avviso quando il database cloud resta indietro rispetto alle migrazioni di `main` (in
  `IMPLEMENTAZIONI.md`).

### Sessione agenti — 2026-11-08 — ciclo 20261108-09 — T219

**Fatto**

- T219: `attiva_officina` legge lo stato precedente (`for update`): un'officina riattivata da SOSPESA
  riceve «La tua officina è di nuovo attiva» (link `/clienti`) invece del benvenuto con l'invito a
  importare. Migrazione 20261108000100 e pgTAP `attiva-officina-riattivazione.test.sql` (20 asserzioni).
- Gate del supervisore approvato al 1o giro. Controlli veloci verdi (641 test); pgTAP non eseguito nel
  cloud, lo verifica la CI.

**Idee**

- `sospendi_officina` non avvisa i titolari della sospensione («La tua officina è stata sospesa»).

### Sessione agenti — 2026-11-08 — ciclo 20261108-03 — T222 T205

**Fatto**

- T222: l'avviso «nuova versione» entra con il paragrafo vuoto e scrive il testo al giro successivo
  (`setTimeout` 0), così il `role="status"` viene annunciato; 6 test DOM con happy-dom 21.0.4.
- T205: guida officine, nuova sezione 14 «Abbonamento» (prova di 30 giorni, piani, «Attiva l'abbonamento»,
  ritorno dal pagamento, «Gestisci il pagamento»); rinumerate 15–16, tolta «In arrivo».
- Gate del supervisore approvati 2/2 al 1o giro. Controlli veloci verdi (641 test).

**Idee**

- T241: le bozze legali (termini 133/142/151, informativa 65, registro trattamenti 136) dicono ancora
  «pagamento online non ancora attivo»: da rivedere quando i pagamenti si attivano (vicina a T229).

### Sessione agenti — 2026-11-08 — ciclo 20261108-00 — T204 T159

**Fatto**

- T204: guida `DOCS/pilota/stripe-prova.md` per Davide (D8): prodotti, segreti, deploy, webhook, portale
  clienti e prova con la carta 4242; `lista-lancio.md` D8 rimanda alla guida. Nessun codice toccato.
- T159: guide pilota per l'aiuto su strada: guida officina sezione 13 (attivazione, notifica, accetta,
  chiama, chiudi; cosa si vede prima e dopo), le sezioni seguenti diventano 14–15; guida cliente passo 7
  (posizione, 2 ore, 3 richieste all'ora, 112) e frase R31 sull'eliminazione dell'account.
- Gate del supervisore approvati 2/2 al 1o giro. Controlli veloci verdi (635 test).

**Idee**

- T240: guida cliente, passo 7: «Chiama» compare solo se l'officina ha un telefono, altrimenti la notifica
  dice «ti chiamerà al numero che hai indicato».

### Sessione agenti — 2026-11-07 — ciclo 20261107-21 — T200 T201

**Fatto**

- T200: nella pagina Abbonamento il pulsante «Gestisci il pagamento» (portale Stripe) compare per chi ha
  `stripe_customer_id` e non è PILOTA; errori `NESSUN_PAGAMENTO` e `STRIPE`; il testo di
  `ABBONAMENTO_DA_SISTEMARE` rimanda al portale. Nessun e2e nuovo (il seed non ha `stripe_customer_id`).
  Ramo `agenti/T200-gestisci-pagamento` (89e1dcd).
- T201 (area C4, presa da C2): bozze legali allineate al database sulla conservazione delle prenotazioni
  (informativa §4, registro B6 con la riga Conservazione, README); «Cancellazione automatica» da `[~]` a
  `[x]`, con «i tempi restano da confermare con il consulente». Ramo
  `agenti/T201-conservazione-prenotazioni` (94f08ba).
- Gate del supervisore approvati 2/2 al 1o giro. Prova d'insieme verde: 635 test in 58 file, Node 24, JS
  iniziale 63,5 kB su 70.
- Decisione al posto di Davide (R32): testo dell'errore `STRIPE` (502 di checkout e portale) «Il servizio di
  pagamento non è disponibile in questo momento: riprova più tardi o scrivici con «Invia un commento».»

**Idee**

- T238: portale Stripe anche per PILOTA con `stripe_customer_id` (la funzione lo accetta per poter annullare).
- T239: allineare `NOTES.md` (righe ~1703–1705) e `DOCS/pilota/guida-cliente.md` (riga ~33) alla pulizia
  delle prenotazioni a 24 mesi; nel README legale nominare i job (`pulizia-notifiche`,
  `pulizia-prenotazioni`) invece delle funzioni.

### Sessione agenti — 2026-11-07 — ciclo 20261107-18 — T198 T226

**Fatto**

- T198: nella pagina Notifiche il cliente sceglie se ricevere le notifiche anche per email quando l'avviso
  sul telefono non arriva (interruttore legato a `profiles.email_notifiche`, salvataggio immediato); il testo
  della pagina vuota cita appuntamenti, controlli delle gomme e aiuto su strada. E2e `notifiche.spec.ts`.
- T226: l'eliminazione dell'account con una richiesta di aiuto su strada in corso mostra «Hai una richiesta
  di aiuto su strada in corso: annullala da «Aiuto su strada» e riprova.» (chiave di T225).
- Il treno è in arrivo (PR). Gate del supervisore approvati 2/2 (revisione a coppia: 1 giro ciascuno).
- Controlli veloci verdi: 628 unit test, build ok, JS iniziale 63,5 kB; l'e2e nuovo di T198 non è stato
  eseguito in locale (niente Docker): lo verifica la CI.

**Idee**

- Pagina Notifiche: spazio `mt-3` sopra la sezione Email anche quando «Avvisi sul telefono» è nascosta
  (usare `gap` sul contenitore).
- `.tc-push__errore` usa `--tc-brand`: controllare il contrasto del testo rosso piccolo sul nero
  (`--tc-rosso-chiaro`).
- L'interruttore Email è visibile anche a officina e admin: coerente (colonna di ogni profilo), da
  confermare.
- Se `leggiEmailNotifiche` fallisce va in errore l'intera pagina Notifiche (lettura nel `Promise.all`).

### Sessione agenti — 2026-11-07 — ciclo 20261107-15 — T199 T203

**Fatto**

- T199: email di riserva con preferenza dell'utente: nuova colonna `profiles.email_notifiche` (default true,
  la cambia l'utente sul proprio profilo); `invia-notifica` la rispetta prima di chiamare Resend; piede
  dell'email riscritto. Migrazione 20261107000200, pgTAP `email-notifiche.test.sql` (13 asserzioni, con i
  casi negati cliente→titolare e titolare→cliente).
- T203: l'import dei controlli completa la «stessa gomma» (R15) con DOT, marca e misura del file quando nel
  database sono vuoti; i campi pieni non cambiano mai (R27). Migrazione 20261107000300, pgTAP
  `import-controlli-completa.test.sql` (30 asserzioni).
- Il treno è in arrivo (PR). Gate del supervisore approvati 2/2 (revisione a coppia: 1 giro ciascuno).
- Controlli veloci verdi: 622 unit test, JS iniziale 63,3 kB; pgTAP non eseguiti in locale (niente Docker):
  li verifica la CI.

**Decisioni**

- T199: profilo assente o errore di lettura della preferenza → niente email (scelta tecnica prudente).

**Idee**

- Test automatico di `invia-notifica` per «preferenza false → niente email», da fare quando si accendono le
  email di riserva (R9).
- L'anteprima dell'import potrebbe dire quante gomme verrebbero completate (contatore nuovo in risposta e
  in `import_log`).

### Sessione agenti — 2026-11-07 — ciclo 20261107-09 — T196 T221

**Fatto**

- T196: l'amministratore rifiuta dall'app una richiesta di affiliazione IN_ATTESA (pulsante «Rifiuta la
  richiesta» con conferma; l'utente riceve «Richiesta non accettata»). `rifiutaAffiliazione` con la mappa
  `ERRORI_RIFIUTO`, 8 unit test, e2e `admin-rifiuta.spec.ts`.
- T221: bozze legali allineate all'app di oggi: il DPA rimanda ai Termini §10 (restano recesso, fatturazione
  e IVA), tolte le sigle interne dalle bozze per il consulente, README aggiornato (aiuto su strada presente,
  contratto nei Termini §10); piani nominati (Starter, Pro, Officina pilota); 21 tabelle in `public`.
- Il treno è in arrivo (PR). Gate del supervisore approvati 2/2 (revisione a coppia: 2 giri ciascuno).
- Controlli veloci verdi: 621 unit test, JS iniziale 26,6 kB; e2e `admin-rifiuta.spec.ts` non eseguito in
  locale (niente Docker): lo verifica la CI.

### Sessione agenti — 2026-11-07 — ciclo 20261107-03 — T225 T212

**Fatto**

- T225: `elimina_account()` ora rifiuta con `RICHIESTA_STRADA_IN_CORSO` chi ha un aiuto su strada in corso
  (APERTA non scaduta o ACCETTATA da meno di 24 ore). Migrazione 20261107000100, pgTAP
  `elimina-account-strada.test.sql` (8 asserzioni): lo esegue la CI.
- T212: il webhook di Stripe non fa più ritentare per tre giorni gli eventi che il database non potrà mai
  applicare: un errore con chiave permanente si registra e risponde 200 con `scartato`; gli altri errori
  danno ancora 500. Gli eventi ignorati da T224 finiscono nel log con le due subscription.
- Il treno è in arrivo (PR). Gate del supervisore approvati 2/2 al primo giro.
- Controlli veloci verdi: 613 test, JS iniziale 63,3 kB; pgTAP di T225 da vedere in CI.

### Sessione agenti — 2026-11-07 — ciclo 20261107-00 — T223 T217

**Fatto**

- T223: `partitaIvaUnica()` sta in `e2e/tests/aiuti.ts` e la importano registra-officina, admin-officine,
  primi-passi e ingresso-officina (prima erano quattro copie identiche); sistemate in `NOTES.md` la riga
  lunga della voce T202 e i "File coinvolti" della voce T083.
- T217: `giaSalvato` confronta il nome del vincolo tra virgolette doppie, come lo scrive Postgres:
  `x_veicoli_pkey` non vale più come `veicoli_pkey`; due test nuovi, il primo rosso con il codice vecchio.
- Gate del supervisore approvati 2/2 al primo giro.
- Prova d'insieme verde: 599 unit test; e2e di T223 da vedere in CI.

### Sessione agenti — 2026-11-06 — ciclo 20261106-21 — T195 T197

**Fatto**

- T195: nuova Edge Function `stripe-portale`: il titolare apre il portale clienti di Stripe (cambio carta,
  annullamento) con `{ officina_id }`, risposta `{ url }`, ritorno su `/officina/abbonamento`; 29 test
  vitest con `fetch` finto; il portale va attivato da Davide nella dashboard di Stripe (T204).
- T197: cancellazione automatica delle prenotazioni vecchie (R25): `pulisci_prenotazioni`, riservata al job
  pg_cron `pulizia-prenotazioni` (00:45 UTC), cancella le prenotazioni con giorno di oltre 24 mesi prima, in
  qualsiasi stato; le notifiche collegate spariscono in cascata. Test pgTAP aggiunto: lo esegue la CI.
- Gate del supervisore approvati 2/2 al primo giro.
- Prova d'insieme verde: 597 unit test; pgTAP di T197 da vedere in CI (database ed e2e girano solo lì).

### Sessione agenti — 2026-11-06 — ciclo 20261106-18 — T209 T192

**Fatto**

- T209: dopo un'accettazione su strada un errore della sola rilettura non arriva più al dialogo; la casella
  "Offro l'aiuto su strada" ricorda la scelta quando la posizione diventa illeggibile e poi torna valida
  (`statoCasella`); l'errore dell'annullo invito usa `mostraErroreInBox`.
- T192: la pagina "Abbonamento" ha la scelta del piano (Starter/Pro) e il pulsante "Attiva l'abbonamento"
  che apre il pagamento Stripe con `stripe-checkout`; errori con messaggi chiari (R22); avviso verde al
  ritorno con `?pagamento=ok|annullato`.
- Revisione a coppia: 1 giro ciascuno; gate del supervisore approvato 2/2 al primo giro (nota: apostrofi
  tipografici in `MESSAGGI_PAGAMENTO` corretti sul ramo in apostrofi dritti).
- Prova d'insieme verde: 568 unit test, JS iniziale invariato (26,54 kB); e2e solo in CI.
- Decisione: testi brevi per SOLO_TITOLARE, GIA_ATTIVO e PILOTA (cambiabili in `MESSAGGI_PAGAMENTO`);
  ABBONAMENTO_NON_TROVATO e RICHIESTA_NON_VALIDA danno il messaggio generico.

### Sessione agenti — 2026-11-06 — ciclo 20261106-15 — T220 T227

**Fatto**

- T220: se l'annullo di una richiesta su strada fallisce, la pagina sotto il dialogo si ridisegna
  (`disegna()` rilegge lo stato e riaccende il timer) e il dialogo mostra l'errore; e2e nuovo con
  `page.route` che finge la richiesta aperta e l'annullo 400 `RICHIESTA_NON_DISPONIBILE`.
- T227: tolti i try/catch irraggiungibili attorno a `esci()` in home, profilo, comune ed elimina-account e il
  riquadro morto `[data-errore-esci]` del profilo; `invito.ts` e `appuntamenti.ts` mostrano gli errori con
  `mostraErroreInBox` (riquadro "email diversa" dell'invito con `tabindex="-1"`). Nessun testo cambia.
- Revisione a coppia: 1 giro ciascuno; gate del supervisore approvato 2/2 al primo giro.
- Prova d'insieme verde: 555 unit test, JS iniziale invariato (26,54 kB); e2e solo in CI.
- Note del supervisore: l'e2e di T220 passerebbe anche senza la modifica e il focus finisce sul body dopo la
  chiusura del dialogo (idea T228); in T227 il ramo `if (sessioneCorrente())` di elimina-account è quasi
  irraggiungibile (resta, idea T214). Dritta: un e2e che chiude una corsa o un ridisegno deve fallire senza
  la modifica (contare le richieste con `page.route` ed `expect.poll` sotto l'intervallo del timer).

### Sessione agenti — 2026-11-06 — ciclo 20261106-03 — T189b T224

**Fatto**

- T189b: il checkout di Stripe risponde 409 `OFFICINA_NON_ATTIVA` se l'officina non è ATTIVA e 409
  `ABBONAMENTO_DA_SISTEMARE` se l'abbonamento è SCADUTO con la subscription ancora collegata (R30); la
  creazione del cliente usa `Idempotency-Key: cliente-<officina_id>`, così due richieste insieme non
  lasciano clienti doppi (T218).
- T224: `aggiorna_abbonamento_stripe` ignora gli eventi di una subscription diversa da quella di un
  abbonamento ATTIVO e dà `SUBSCRIPTION_DI_ALTRA_OFFICINA` sulla subscription di un'altra officina;
  `rifiuta_affiliazione` dà `ABBONAMENTO_STRIPE_PRESENTE` se l'officina ha una subscription (R30).
  Migrazione 20261106000100 e pgTAP `stripe-una-subscription` (31 asserzioni): da vedere in CI.
- Revisione a coppia: 1 giro ciascuno; gate del supervisore approvato 2/2 al primo giro.
- Prova d'insieme verde: 555 unit test, JS iniziale 63,2 kB; pgTAP solo in CI (niente Docker).
- Nota del supervisore: con abbonamento ATTIVO un evento con la subscription di un'altra officina viene
  ignorato senza errore: da loggare nel webhook con T212.

### Sessione agenti — 2026-11-06 — ciclo 20261106-00 — T194 T202

**Fatto**

- T194: analisi axe aggiunta a `/strada` (cliente), `/officina/strada` e `/officina/abbonamento` (titolare)
  in `e2e/tests/accessibilita.spec.ts`; nessuna correzione all'app.
- T202: nuovo e2e `e2e/tests/ingresso-officina.spec.ts` sul percorso completo di un'officina nuova
  (richiesta, avviso all'admin, attivazione, avviso al titolare, home attiva, poi sospensione).
- Revisione a coppia: T194 1 giro, T202 2 giri (l'officina del test restava attiva nel database condiviso:
  ora l'admin la sospende a fine percorso); gate del supervisore approvato 2/2 al primo giro.
- Prova d'insieme verde: 543 unit test, JS iniziale 63,2 kB; e2e e axe si vedono in CI.
- Idea accodata: `partitaIvaUnica()` è duplicata in 3 spec (registra-officina, admin-officine,
  ingresso-officina): spostarla in `e2e/tests/aiuti.ts`.
- Nota del supervisore: `/officina/strada` si ridisegna ogni 15 s (`INTERVALLO_AGGIORNAMENTO_MS`): un errore
  axe saltuario in CI su quel caso nasce da lì. Aprire `/notifiche` con l'admin segna le sue notifiche come
  lette (nessun e2e le conta).

### Sessione agenti — 2026-11-05 — ciclo 20261105-21 — T190 T193

**Fatto**

- T190: bozze legali sull'abbonamento delle officine con pagamento Stripe, non ancora attivo (termini §10,
  dati della carta nell'informativa, scheda A7 del registro con il ruolo di Stripe aperto); nel README la
  domanda 16 per il consulente su ruolo di Stripe e trasferimento extra UE.
- T193: al posto di `confirm()`, `onNeedRefresh` mostra un avviso non bloccante in basso
  (`ui/aggiornamento.ts`) con "Aggiorna" e "Più tardi", sopra la barra di navigazione.
- Decisione su T193: su desktop nessuna media query (riquadro centrato sul viewport, sopra la posizione
  della barra in basso); reversibile in `.tc-aggiornamento`.
- Revisione a coppia: T190 1 giro, T193 2 giri (lo sfondo semitrasparente dell'avviso fisso è diventato
  opaco, con ombra); gate del supervisore approvato 2/2 al primo giro.
- Prova d'insieme verde: 543 unit test, JS iniziale 63,2 kB; e2e e axe si vedono in CI.
- Idee accodate in ai-org: T221 (bozze legali: righe 8-9 di `dpa-officine.md` su P19, "21 tabelle" nel
  registro, sigle R.. interne) e T222 (avviso di aggiornamento: test DOM/e2e, annuncio di `role="status"`
  inserito già pieno, colore del bordo info).

### Sessione agenti — 2026-11-05 — ciclo 20261105-18 — T186 T188

**Fatto**

- T186: scheda veicolo dell'officina: ogni pneumatico montato mostra l'età dal DOT ("DOT 3820 · 6 anni e 1
  mese"); sopra l'elenco un avviso giallo "Gomme con più di 5 anni: consiglia la sostituzione" se almeno una
  gomma supera la soglia. Conta anche la scorta, come la home.
- T188: la pagina pubblica "Per le officine" mostra i prezzi di Starter e Pro letti da `PIANI`, la frase
  "30 giorni di prova gratuita: non serve la carta per iniziare." e il vantaggio "Aiuto su strada".
- Decisione R29 (supera R5): prezzi pubblici sulla pagina per le officine. L'età usa il formato di
  `formattaEta` ("6 anni e 1 mese"), non "6 anni" come nell'esempio del compito.
- Revisione a coppia: 1 giro per ciascun compito; gate del supervisore approvato 2/2. T188 è di area C4,
  preso da C2 perché T192 attende T189b.
- Prova d'insieme verde: 540 unit test, JS iniziale 63,1 kB; e2e e axe si vedono in CI.
- Idea non accodata: escludere la scorta da `gommeVecchie` per home e officina (oggi coerenti tra loro).

### Sessione agenti — 2026-11-05 — ciclo 20261105-15 — T183 T158

**Fatto**

- T183: aiuto su strada del cliente: messaggio `TROPPE_RICHIESTE` per il limite orario (T173); contatore di
  generazione (`creaGenerazione()` in `lib/strada.ts`), così dopo "Annulla" una lettura già in volo non
  mostra più "La richiesta non è più in corso."; apostrofi dritti in `pagine/strada.ts` e `lib/strada.ts`.
  Un'attesa di `e2e/tests/strada-officina.spec.ts` (r.70) è stata cambiata fuori dal campo del compito.
- T158: e2e admin-officine: il badge di stato si controlla con `riga.locator('.tc-stato')` e `toHaveText` del
  testo esatto, per non confonderlo con il pulsante omonimo; tolta `contaInAttesa` (la usava solo il suo test).
- Revisione a coppia: T183 2 giri (l'annullo con `ferma()` lasciava il timer spento se falliva: ora
  `nuova()` prima e dopo l'annullo), T158 1 giro; gate del supervisore approvato 2/2.
- Prova d'insieme verde: 534 unit test, JS iniziale 63,1 kB; gli e2e si vedono in CI.
- Idea: T220 (annullo fallito durante un ridisegno + e2e della corsa), accodata in ai-org: caso raro del
  supervisore, annullo fallito mentre la lettura che chiude la richiesta è in volo.

### Sessione agenti — 2026-11-05 — ciclo 20261105-03 — T189 T191

**Fatto**

- T189: Edge Function `stripe-checkout`: il titolare sceglie STARTER o PRO e riceve l'URL del pagamento
  Stripe (solo carta); senza chiavi risponde 503 PAGAMENTI_NON_ATTIVI. Nessun SDK: `_shared/stripe.ts` con
  `fetch`, flusso in `checkout.ts` con 41 test Vitest.
- T191: avvisi dell'affiliazione (admin alla richiesta, titolari all'attivazione, membri al rifiuto) e nuova
  `rifiuta_affiliazione`, che cancella l'officina IN_ATTESA e libera la partita IVA (R24); migrazione
  20261105000100, pgTAP `affiliazione-avvisi` (32 asserzioni).
- Revisione a coppia: 1 giro per ciascun compito; gate del supervisore approvato 2/2 al primo giro.
- Prova d'insieme verde (532 test, 54 file; JS iniziale 63,1 kB); il pgTAP di T191 non è stato eseguito
  in locale: lo verifica la CI.
- Idee: T189b (una sola subscription Stripe per officina, prima di T192 e delle chiavi); `Idempotency-Key`
  per la creazione del cliente Stripe; `/` valido in `notifiche.link`; pulsante "Rifiuta" dell'admin con
  avviso che i dati caricati si cancellano (già T196).
- Note del supervisore: con abbonamento SCADUTO e subscription viva è possibile un secondo checkout, e
  un'officina IN_ATTESA che paga e poi viene rifiutata lascia la subscription attiva (entrambe T189b);
  `attiva_officina` avvisa anche nel passaggio SOSPESA → ATTIVA con il testo della prima attivazione.

### Sessione agenti — 2026-11-05 — ciclo 20261105-00 — T182 T187

**Fatto**

- T182: test e2e in `registra-officina.spec.ts`: la partita IVA scritta "IT 123 456 789 01" è accettata e
  l'amministratore la vede a 11 cifre in `/admin/officine`.
- T187: unit test di `esc`, `officinaAttiva`/`eTitolare`/`giaSalvato` e `testoPosizione` (3 file nuovi in
  `apps/web/src/lib/`); nessun codice di produzione cambiato; 491 test web verdi.
- Revisione a coppia: 2 giri per ciascun compito; gate del supervisore approvato.
- Documentazione: NOTES (due voci) e NEXT allineati.

### Sessione agenti — 2026-11-04 — ciclo 20261104-21 — T179 T184

**Fatto**

- T179: la guida delle officine descrive la carta "Primi passi" della home (5 passi, quando risultano fatti,
  "Nascondi" solo sul dispositivo) e non la elenca più in "In arrivo"; il piano del pilota dice che i
  commenti si leggono dall'app (Profilo → "Commenti degli utenti", solo admin), non dalla console di Supabase.
- T184: informativa (§4 e §5), registro A6 e pagina "Elimina il tuo account" (paragrafo e dialogo) dicono che
  le richieste di aiuto su strada si cancellano con l'account (`on delete cascade`); tabelle con RLS ricontate
  dalle migrazioni: 21 in `public`, tutte con RLS (registro M1, README legale); «soggetto autonomo»
  dell'informativa §6 tornato `[DA COMPLETARE]` come nel registro A6.
- Documentazione: NOTES (guida officina), guida cliente e NEXT allineati.

### Sessione agenti — 2026-11-04 — ciclo 20261104-18 — T181 T176

**Fatto**

- T181: dopo "Nascondi" sulla carta "Primi passi" il focus passa all'h1 della home officina (senza scorrere
  se è già visibile); e2e `primi-passi` con `toBeFocused`, unit test di `titoloVisibile`
  (`home-officina.test.ts`).
- T176: anteprima dell'import dei controlli (`importa-controlli.ts`, `elencoErrori`): una sola frase con il
  numero, "N documenti con righe sbagliate verranno saltati per intero" (singolare con `plurale()`), solo se
  ce ne sono; il primo paragrafo finisce con "Correggi il file e reimportalo.".

### Sessione agenti — 2026-11-02 — ciclo 20261102-21 — T155 T177

**Fatto**

- T155: in `e2e/tests/aiuti.ts` due aiuti nuovi, `registratiDalLinkInvito` (registrazione del cliente dal
  link d'invito fino alla home) e `csvControlli` (CSV dei controlli a 15 colonne); inviti, percorso-pilota e
  import-controlli li usano al posto delle copie, CSV identico byte per byte e asserzioni invariate.
- T177: l'e2e "unisci clienti" falliva a caso perché la targa `U`+ultimi 7 di `id` poteva essere un pezzo del
  cognome `Primo${id}` (h1 della scheda) e `getByText` senza `exact` trovava due elementi; ora targa
  `UC`+ultimi 6 e `getByText(targa, { exact: true })`.

### Sessione agenti — 2026-11-02 — ciclo 20261102-18 — T180 T185 T174 T178

**Fatto**

- T180: tabella `stripe_eventi` (solo service role) e funzioni `collega_cliente_stripe`,
  `aggiorna_abbonamento_stripe`, `registra_evento_stripe` riservate al service role; job notturno
  `pulizia-eventi-stripe` (0:35 UTC, eventi oltre 30 giorni). Test pgTAP `abbonamenti-stripe` (39) da vedere in CI.
- T185: Edge Function `stripe-webhook`: firma Stripe verificata con Web Crypto, stato e piano
  dell'abbonamento dagli eventi checkout/subscription, duplicati ignorati, 500 su errore DB perché Stripe
  ritenti. 49 test Vitest; la funzione non gira in CI, deploy con `--no-verify-jwt`.
- T174: `esci()` senza rete toglie la sessione dallo storage e dalla memoria e ricarica `/accedi` invece di
  rilanciare l'errore; test aggiornati (T094) e test nuovo sulla sessione in memoria.
- T178: il riquadro rosso d'errore con focus è in `comune.ts` (`htmlErrore`, `mostraErroreInBox`,
  `nascondiBox`), usato da `home.ts` e `profilo.ts`; HTML identico; nuovo `comune.test.ts`.

**Decisioni prese al posto di Davide**

- SCADUTO da Stripe vale anche per un'officina in PROVA (come da compito); registrata in
  `decisioni-rimandate` (R28).

**Verifica**

- Controlli veloci sulla prova d'insieme: verdi (48 file, 463 test; Node 24; JS iniziale 63,0 kB gzip su 70).
- Gate del supervisore: 4/4 approvati al 1° giro.
- pgTAP `abbonamenti-stripe` e `stripe-webhook/index.ts`: non eseguiti nel cloud (niente Docker né Deno),
  da vedere in CI; firma ed eventi verificati con Vitest.
- Idee emerse: T211 (`aggiorna_abbonamento_stripe`: subscription diversa, 23505 tradotto, ordine degli
  eventi); T212 (`ABBONAMENTO_NON_TROVATO` permanente → 200 e avviso admin); T213 (indice unico parziale su
  `stripe_customer_id`); T214 (togliere i `catch` di `esci()` ormai irraggiungibili); T215
  (`mostraErroreInBox` anche in appuntamenti, cliente, invito).

### Sessione agenti — 2026-11-02 — ciclo 20261102-15 — T152 T153

**Fatto**

- T152: le pagine legali usano `MARCHIO` esportato da `ui/layout.ts`; "Torna indietro" fa `history.back()`
  solo se il referrer è del sito e la storia ha più di una voce, altrimenti porta a `/`. Al 1° giro la
  revisione del coordinatore ha notato che le schede nuove (`target="_blank"`) da registrati/home hanno
  il referrer del sito: corretto con `tornaIndietroNelSito`. Unit test `legale.test.ts` ed e2e
  `legale.spec.ts`.
- T153: aggiunto `apps/web/public/robots.txt` (Allow tutto, niente `Sitemap` finché il dominio non è
  scelto), perché Vercel serviva la pagina dell'app al suo posto; `apps/web/src/sito.test.ts` (10 test)
  tiene sotto controllo i requisiti di base Lighthouse/PWA.

**Decisioni prese al posto di Davide**

- Nessuna.

**Verifica**

- Controlli veloci sulla prova d'insieme: verdi (45 file, 419 test; Node 24; JS iniziale 62,9 kB gzip su 70).
- Gate del supervisore: 2/2 approvati al 1° giro; T152 revisione del coordinatore al 2° giro.
- E2e `legale.spec.ts`: non eseguito nel cloud, da vedere in CI.
- Idea emersa: scelto il dominio (R3), riga `Sitemap:` in `robots.txt` e test che la verifichi.

### Sessione agenti — 2026-11-02 — ciclo 20261102-03 — T144 T157

**Fatto**

- T144: aiuto su strada lato officina (R18). Il titolare attiva il servizio e il raggio 5–100 km in "Dati
  dell'officina"; `/officina/strada` mostra le richieste vicine con "Accetta" e le "Accettate" con telefono,
  mappa e "Chiudi", aggiornandosi ogni 15 s; il link in home c'è solo se il servizio è attivo. Unit test
  `lib/strada-officina.test.ts` ed e2e `strada-officina.spec.ts`.
- T157: il riquadro "Pagina non disponibile" del router ha il pulsante "Ricarica l'app" (ricarica completa)
  e il link "Torna alla home"; 4 unit test del router.

**Decisioni prese al posto di Davide**

- Nessuna.

**Verifica**

- Controlli veloci sulla prova d'insieme: verdi (43 file, 402 test; JS iniziale 63,1 kB, `main` 62,2).
- E2e `strada-officina.spec.ts`: non eseguito nel cloud, da vedere in CI.

### Sessione agenti — 2026-11-02 — ciclo 20261102-00 — T173 T175

**Fatto**

- T173: aiuto su strada, chi lavora in un'officina non vede né accetta più la propria richiesta e un cliente
  crea al massimo 3 richieste all'ora (`TROPPE_RICHIESTE`). Migrazione `20261101000100_strada_limiti`, pgTAP
  `strada-limiti.test.sql` (22 asserzioni).
- T175: le date "di oggi" nel database sono quelle italiane (`(now() at time zone 'Europe/Rome')::date`):
  default di `prova_fino_al`, `eseguito_il`, `montato_il` e controllo "data nel futuro" di
  `registra_controllo`, `monta_pneumatici`, `modifica_controllo`. Migrazione `20261101000240_date_italiane`,
  pgTAP `date-italiane.test.sql` (20 asserzioni); allineate 6 attese di test esistenti (dritta T094):
  `abbonamenti` 83 e 216, `abbonamenti-scadenza` 48, `operazioni` 80 e 129, `modifiche` 57.

**Decisioni prese al posto di Davide**

- Nessuna.

**Verifica**

- Test pgTAP dei due compiti: da vedere in CI.

### Sessione agenti — 2026-11-01 — ciclo 20261101-18 — T147 T150

**Fatto**

- T147: il riepilogo della home officina su telefono ha il modificatore `tc-riepilogo--cinque` (sotto 36rem
  2 colonne, quinta voce a tutta riga); il gruppo dei filtri si chiama "Filtra i veicoli" e
  `e2e/tests/computer.spec.ts` usa `{ name: 'Filtra i veicoli', exact: true }`.
- T150: nelle guide `guida-avvio.md` e `guida-officina.md` corretti i nomi di 3 pulsanti ("Monta gli
  pneumatici"; "Rifiuta la richiesta" / "Annulla l'appuntamento"; campo «Richieste al massimo per fascia»);
  controllate con grep tutte le 203 citazioni, restano solo segnaposto e voci dei menu del browser.

**Decisioni prese al posto di Davide**

- Nessuna.

**Verifica**

- Gate del supervisore: 2/2 approvati al primo giro.
- Prova d'insieme: 386 test verdi e build.
- e2e `computer.spec.ts` (T147): da vedere in CI.

### Sessione agenti — 2026-11-01 — ciclo 20261101-15 — T145 T146

**Fatto**

- T145: la pagina Abbonamento non ripete più "Officina pilota" (PILOTA: "Gratuito per tutta la durata del
  pilota"); pulsante e nota del pagamento solo per PROVA, SCADUTO e ANNULLATO, per ATTIVO e PILOTA "Il tuo
  abbonamento è a posto: non devi fare nulla."; in "Dati dell'officina" il link Abbonamento sta in una
  sezione sotto il modulo.
- T146: l'anteprima dell'import dei controlli dice quanti documenti saltano per intero, ha un solo invito a
  correggere il file e mostra un avviso giallo se il controllo più vecchio ha più di 15 anni.

**Decisioni prese al posto di Davide**

- T145: lo stato ANNULLATO mostra il pulsante "Attiva l'abbonamento" e la nota del pagamento come SCADUTO
  (chi ha annullato deve poter riattivare); si cambia in `mostraPagamento` (`pagine/abbonamento.ts`).

**Verifica**

- Gate del supervisore: 2/2 approvati (T145 al secondo giro: l'e2e contava i link durante il caricamento).
- Prova d'insieme: 386 test verdi (42 file), Node 24.
- e2e `abbonamento.spec.ts` (T145): da vedere in CI.

### Sessione agenti — 2026-11-01 — ciclo 20261101-09 — T154 T156

**Fatto**

- T154: l'analisi axe (e2e) copre anche `/per-le-officine`, la pagina non trovata e gli avvisi "Controlla
  la posta" (recupero password e registrazione); in `per-le-officine.spec.ts` attesa sul campo "Ragione
  sociale".
- T156: `apps/web/scripts/dimensioni.mjs`, quando il JS iniziale supera la soglia, elenca i 3 file JS più
  grandi (nome e kB gzip) prima di uscire con 1; soglia rispettata: output invariato.

**Decisioni prese al posto di Davide**

- Nessuna. Corsia C5.

**Verifica**

- Gate del supervisore: 2/2 approvati al primo giro.
- Prova d'insieme: 373 test verdi.
- e2e `accessibilita.spec.ts` e `per-le-officine.spec.ts` (T154) non eseguiti qui: da vedere in CI.

### Sessione agenti — 2026-11-01 — ciclo 20261101-03 — T143 T149

**Fatto**

- T143: pagina cliente "Aiuto su strada" (`/strada`): modulo con la posizione del telefono, stato della
  richiesta (in cerca / accettata con il telefono dell'officina), annulla con conferma, aggiornamento ogni
  15 s. Nuovi `lib/strada.ts` (schema, mappa degli errori, RPC) e `strada.test.ts`; link "Gomma a terra?
  Chiedi aiuto su strada" dalla home; e2e `strada.spec.ts`.
- T149: `esci()` cancella da `localStorage` la chiave di sessione di supabase-js se `signOut` locale fallisce
  (es. senza rete), poi rilancia l'errore; vale anche per l'eliminazione dell'account. Nuova
  `chiaveSessione(url)` in `lib/supabase.ts` con unit test (`supabase.test.ts`).

**Decisioni prese al posto di Davide**

- Nessuna.

**Verifica**

- Gate del supervisore: 2/2 approvati (T143 al secondo giro di revisione, per il filtro `cliente_id` in
  `richiestaInCorso`).
- Prova d'insieme: 373 test verdi, Node 24.
- e2e `strada.spec.ts` (T143) non eseguito qui: da vedere in CI.

### Sessione agenti — 2026-11-01 — ciclo 20261101-00 — T142 T148

**Fatto**

- T142: quando informativa e termini cambiano versione, chi aveva accettato la precedente li riaccetta al
  primo accesso, prima della home (tutti i ruoli); l'accettazione si scrive con `accetta_termini`. Chi ha
  `termini_versione` nullo (seed, account creati dall'admin) non vede la richiesta (R20). e2e
  `termini-nuovi.spec.ts`.
- T148: la partita IVA di "Registra la tua officina" accetta la scrittura da fattura ("IT", spazi, punti):
  lo schema restituisce le 11 cifre; il campo ha `maxlength` 20, tastiera normale e aiuto aggiornato.

**Decisioni prese al posto di Davide**

- Nessuna. Decisione del coordinatore: in T148 toccata anche `apps/web/src/pagine/registra-officina.ts`
  (fuori dal campo `file`): `maxlength="20"`, niente `inputmode="numeric"`, aiuto "11 cifre, anche con IT
  davanti" (altrimenti "IT 012 345 678 90" non entrava). L'esempio "01234567890" del compito non supera la
  cifra di controllo: i test usano `VALIDA`.

**Verifica**

- Prova d'insieme: 351 test verdi; format, lint, typecheck e build verdi; JS iniziale 62,1/70 kB.
- e2e `termini-nuovi.spec.ts` (T142) non eseguiti qui (niente Docker): da vedere in CI.

### Sessione agenti — 2026-10-31 — ciclo 20261031-21 — T140 T141

**Fatto**

- T140: tre funzioni per l'intervento su strada: `richieste_strada_vicine` (richieste aperte nel raggio, senza
  posizione, telefono né cliente), `accetta_richiesta_strada` (la prima officina che accetta la prende; notifica
  STRADA_ACCETTATA al cliente con nome e telefono) e `chiudi_richiesta_strada`. Migrazione `20261031000300`,
  pgTAP `strada-accetta.test.sql` (52 test con i negati), `database.types.ts` aggiornato.
- T141: rotte `/strada` ("Aiuto su strada") e `/officina/strada` ("Richieste su strada"), pigre, con
  segnaposto in `pagine/strada.ts` e `pagine/strada-officina.ts`; T143 e T144 riscrivono solo il loro file.

**Decisioni prese al posto di Davide**

- Nessuna. Interpretazione del caso titolare2 (documentata): con Gomme Rossi l'esito è 42501; con Pneus
  Express l'elenco è vuoto e l'accettazione dà 42501.

**Verifica**

- Prova d'insieme: 346 test verdi; format, lint, typecheck e build verdi.
- pgTAP T140 eseguito solo su Postgres 16 locale con imitazioni di Supabase (52/52): da vedere col job
  `database` della CI del treno.

### Sessione agenti — 2026-10-31 — ciclo 20261031-18 — T104 T151

**Fatto**

- T104: nuova `DOCS/pilota/guida-cliente.md`, guida di una pagina (35 righe) per i clienti dell'officina pilota:
  invito (14 giorni), account, garage e colori, gomma, appuntamento, notifiche (anche iPhone), dati ed
  eliminazione; i nomi sono copiati dal codice.
- T151: bozze legali allineate a R18 e R20: chiusura dall'app (termini §11), riaccettazione dei termini (§15),
  nuova §7 «Aiuto su strada» (termini rinumerati §8–§16), trattamento in informativa e registro A6, link alle
  procedure in bozza (registro accessi, copie di sicurezza) in README e DPA, domanda 15 per il consulente.

**Decisioni prese al posto di Davide**

- Registro A6 in Parte A (TyreCare titolare dell'inoltro); ruolo dell'officina che accetta lasciato
  `[DA COMPLETARE]` per il consulente.
- Targa visibile prima dell'accettazione, come in R18 (il testo del compito diceva solo distanza e descrizione).

**Verifica**

- Prova d'insieme: 346 test verdi; format, lint, typecheck e build verdi (Node 24). CI del treno da vedere.

### Sessione agenti — 2026-10-31 — ciclo 20261031-15 — T080 T090

**Fatto**

- T080: `nominativo()` ora è una sola funzione in `packages/shared/src/clienti.ts`: l'export CSV (`importa.ts`)
  e l'app web (`lib/officina.ts`, che la riesporta) danno sempre lo stesso nome; le due copie erano identiche.
  Commento di `caricaVeicoli` allineato alla lettura a pagine (T042).
- T090: nella lista clienti chi non usa l'app ha un link "Invita" (`/cliente/invito?id=…`) accanto al link
  della riga, nome accessibile "Invita nell'app" con il nominativo in `aria-describedby` (non omonimo del link
  della riga), bersaglio ≥ 44px; lo stato vuoto mostra la ricerca
  come scritta (con trim, non in minuscolo).

### Sessione agenti — 2026-10-31 — ciclo 20261031-09 — T138 T139

**Fatto**

- T138: la prova delle officine nuove dura 30 giorni contando oggi (default `prova_fino_al = current_date + 29`;
  le righe esistenti non cambiano). Job pg_cron `scadenza-prove` (0:25 UTC): le prove finite, non PILOTA,
  passano a SCADUTO, senza blocchi delle funzioni (R19). pgTAP `abbonamenti-scadenza.test.sql`; in
  `abbonamenti.test.sql` le due attese diventano `current_date + 29` (cambio voluto).
- T139: intervento su strada, database (R18). Tabella `richieste_strada` con RLS di sola lettura (cliente,
  officina che ha accettato, admin), `crea_richiesta_strada`, `annulla_richiesta_strada`, `distanza_km`, colonne
  `intervento_strada` e `raggio_strada_km` di `officine`, 3 tipi di notifica con le icone. Job `richieste-strada`
  ogni 10 minuti (scadenza 2 ore, chiusura 24 ore, cancellazione 90 giorni). pgTAP `strada.test.sql` (57).
- Decisioni dello sviluppatore (reversibili con una migrazione nuova): lat/lon obbligatorie; errori
  POSIZIONE_NON_VALIDA, DESCRIZIONE_NON_VALIDA, TELEFONO_NON_VALIDO, TARGA_NON_VALIDA; indice unico parziale per
  una sola richiesta in corso; una notifica per persona e mai a chi agisce.
- Verifiche: 339 unit test verdi (Node 24). Il pgTAP non è stato eseguito (niente Docker): T139 provato solo con
  Postgres 16 locale e sostituti di pgTAP e auth (57/57); lo verifica la CI del treno (`db:test`).
- Idee: default di `prova_fino_al` con la data italiana invece di `current_date` (UTC); limite di richieste su
  strada per ora per cliente. Rilievi `nota` del supervisore: anon legge `intervento_strada` e
  `raggio_strada_km` (non riservati); richiedente membro dell'unica officina vicina, nessuna notifica (marginale).

### Sessione agenti — 2026-10-31 — ciclo 20261031-03 — T103 T106

**Fatto**

- T103: pagina `/admin/commenti` per l'amministratore, in sola lettura: tutti i commenti dal più recente
  (data e ora di Roma, autore, pagina di provenienza) e link "Commenti degli utenti" nel Profilo
  dell'admin. Nessuna migrazione: bastano la RLS di `commenti` e i pgTAP esistenti. e2e: il cliente
  scrive, l'admin vede, il titolare trova il messaggio riservato.
- T106: nella pagina "Officine" dell'amministratore ogni riga mostra piano e stato dell'abbonamento e un
  modulo "Piano" + "Salva" che aggiorna `abbonamenti.piano`: l'officina pilota (LA SANTI GOMME) si mette
  su "Officina pilota" senza SQL. Unit test e un e2e (registrazione, piano pilota, ricarica, sospensione).
- Verifiche: 339 unit test verdi; pgTAP ed e2e in CI. Gate del supervisore approvato al primo giro.

### Sessione agenti — 2026-10-31 — ciclo 20261031-00 — T101 T075

**Fatto**

- T101: carta "Primi passi" nella home del titolare, con 5 passi che si spuntano dallo stato reale
  dell'officina; si può nascondere (memoria nel browser); unit ed e2e. L'e2e `primi-passi` non è stato
  eseguito in locale (manca Docker): da verificare nella CI del treno.
- T075: il CSV delle righe con errori non perde più le celle oltre l'intestazione: finiscono in fondo
  alla colonna `errore` come "(celle in più: «a», «b»)", senza colonne nuove.

### Sessione agenti — 2026-10-30 — ciclo 20261030-21 — T058 T102

**Fatto**

- T058: bozze legali (README, informativa §4 §6, DPA §13, registro A1 A2 B) allineate a main:
  «Scarica i tuoi dati», «Elimina il tuo account», esportazione per l'officina, pulizia notifiche 180/365
  giorni (R6), bozze T048. Restano: pulizia delle prenotazioni passate e tempi da confermare.
- T102: in `DOCS/pilota/` il piano del pilota (8 settimane, 4 misure, avvio, cadenza, criteri Fase 7,
  problemi) e la lista di controllo del lancio (D3, D5, D7, decisioni, DPA, D9 con i passi, violazioni,
  registro accessi, copie, officina, import, primo cliente, D8); 2 righe nell'indice di `PLAN.md`.
- Correzione chiesta dal supervisore: in `piano-pilota.md` §7, "L'officina vuole smettere", la
  restituzione cita ora entrambi i file, «Scarica clienti e veicoli» e «Scarica i controlli» (da
  "Importa dal gestionale"), come nel DPA §13.

### Sessione agenti — 2026-10-30 — ciclo 20261030-18 — T070 T105

**Fatto**

- T070: `apps/web/scripts/dimensioni.mjs` gira dopo `vite build` (script `build` di `apps/web`) e fallisce
  se il JS iniziale (gzip) supera 70 kB (misurati 60,7 + 15%) o il CSS supera 40 kB (oggi 31,5). In
  `eslint.config.js` aggiunto `apps/web/scripts/**/*.mjs` al blocco dei globali Node (modifica fuori dal
  campo file del compito, accettata dal supervisore).
- T105: aggiunto il controllo axe (wcag2a/aa, impatto grave o critico) ai moduli dell'officina: nuovo
  cliente, nuovo veicolo, nuovo controllo, import clienti; per il nuovo cliente anche con gli errori
  mostrati dopo "Salva cliente" a modulo vuoto. La revisione statica non ha trovato problemi nelle pagine
  (nessuna pagina cambiata); l'esecuzione la verifica la CI.

### Sessione agenti — 2026-10-30 — ciclo 20261030-15 — T073 T094

**Fatto**

- T073: dopo l'unione di due clienti, `unisci_clienti` annulla gli inviti aperti diventati inutili: se la
  scheda rimasta ha un account li annulla tutti, altrimenti resta aperto solo il più recente. Migrazione
  `20261030150000_unisci_clienti_inviti.sql` e pgTAP `unisci-clienti-inviti.test.sql` (pgTAP verificato
  dalla CI).
- T094: l'import dei controlli salta per intero i documenti con almeno una riga errata (le righe valide
  diventano errori "Documento «…» non importato…"), così si corregge il file e si reimporta senza
  documenti a metà. Aggiornati il testo dell'anteprima e le attese di 3 test esistenti (cambio voluto,
  approvato dal supervisore); 5 test nuovi (328 test in tutto).
- Correzione al treno precedente: nella voce del ciclo 20261030-03 la parte su T062 elencava `main.ts` e
  `lib/auth.ts`, che non erano cambiati; tolti.

**Gate**

- Il supervisore ha approvato entrambi i compiti al primo giro; corsia C1 coordinata dal direttore.

### Sessione agenti — 2026-10-30 — ciclo 20261030-03 — T053 T062

**Fatto**

- T053: scritta la guida completa per le officine, `DOCS/pilota/guida-officina.md`: una sezione per
  funzione, con i nomi esatti di pulsanti e voci di menu verificati nel codice. In fondo "In arrivo":
  pagamento dell'abbonamento e Primi passi. Collegata dall'indice di `PLAN.md`.
- T062: pagina pubblica `/per-le-officine` (4 vantaggi, 3 passi, pulsante verso
  `/registrati?dopo=/officina/registra`), link dal piede di `/accedi`, 3 e2e. File:
  `pagine/per-le-officine.ts`, `pagine/accedi.ts`, `styles/_pagine.scss`.

**Verifiche**

- 323 test unitari verdi; gli e2e della pagina sono affidati alla CI (manca Docker).

### Sessione agenti — 2026-10-30 — ciclo 20261030-00 — T064 T092

**Fatto**

- T064: "Condividi il report" nel report del controllo (link `/r?c=…` con copia e WhatsApp, revoca dei
  link) e pagina pubblica `/r` che riusa `htmlReport` senza account né menu e senza link alle pagine
  private. Aggiunti `creaLinkReport`, `revocaLinkReport` e `caricaReportPubblico`, 2 test unitari e l'e2e
  `report-pubblico.spec.ts`.
- T092: la conferma in sospeso (es. "Il tuo account è stato eliminato.") si vede anche su Registrati e
  Password dimenticata, oltre che su Accedi; la schermata "Controlla la posta" non la richiama.

**Verifiche**

- 323 test unitari verdi (37 file); e2e `report-pubblico.spec.ts` da verificare in CI (manca Docker).

### Sessione agenti — 2026-10-29 — ciclo 20261029-21 — T057 T069

**Fatto**

- T057: nuovo e2e `e2e/tests/percorso-pilota.spec.ts`: import di clienti, veicoli e controlli, invito,
  registrazione del cliente, garage rosso e storico delle misure dello pneumatico.
- T069: il controllo di accessibilità (axe, critical/serious) copre anche 7 pagine con accesso, di cliente e
  titolare. Nessuna correzione al codice.

**Verifiche**

- e2e da verificare in CI.

### Sessione agenti — 2026-10-29 — ciclo 20261029-18 — T065 T068

**Fatto**

- T065: home dell'officina con due filtri nuovi, "Cambio di stagione" e "Da ricontrollare", combinati con la
  ricerca. `gommeFuoriStagione` e `daRicontrollare` in `packages/shared/src/stagioni.ts`, con test sulle date
  di confine. `caricaVeicoli` legge le stagioni delle gomme montate, scorta esclusa.
- T068: pagina `/officina/abbonamento` per il titolare: piano attuale, giorni di prova, carte Starter
  (29 EUR/mese) e Pro (49 EUR/mese), pulsante "Attiva l'abbonamento" disattivato fino a Stripe. `PIANI` e
  `giorniDiProva` in `packages/shared/src/abbonamenti.ts`; link dalla pagina "Dati dell'officina"; unit ed
  e2e `abbonamento.spec.ts`.

**Verifiche**

- Format, lint, typecheck, 321 test unitari e build verdi; e2e in CI.

### Sessione agenti — 2026-10-29 — ciclo 20261029-15 — T048 T061

**Fatto**

- T048: due bozze. `DOCS/legale/registro-accessi.md`: chi del personale può accedere ai dati delle officine,
  quando, cosa annotare, con la tabella vuota. `DOCS/pilota/copie-di-sicurezza.md`: copia a mano con la CLI,
  conservazione su disco cifrato, prova di ripristino solo in locale con `db reset --no-seed` e i soli dati.
- T061: pagina `/admin/officine`: l'amministratore vede le officine (quelle in attesa per prime) con titolare
  e stato e le attiva o sospende con conferma, tramite le rpc `attiva_officina` e `sospendi_officina`. Nel
  Profilo dell'ADMIN la sezione "Amministrazione" con "Officine da attivare (n)". Unit test su ordinamento e
  conteggio, e2e `admin-officine.spec.ts`.

**Verifiche**

- Format, lint, typecheck, 305 test unitari e build verdi; e2e e pgTAP in CI.

### Sessione agenti — 2026-10-29 — ciclo 20261029-03 — T060 T056

**Fatto**

- T060: pagina "Registra la tua officina" (`/officina/registra`) con `RichiestaAffiliazioneSchema` (P.IVA con
  cifra di controllo), rpc `richiedi_affiliazione` ed errori tradotti; link dalla home del cliente senza
  officina; unit test ed e2e.
- T056: la registrazione richiede la spunta "Ho letto l'informativa privacy e accetto i termini di servizio"
  (link a `/privacy` e `/termini`); `registrati()` salva `termini_versione` nei metadati e il trigger la copia
  nel profilo.

### Sessione agenti — 2026-10-29 — ciclo 20261029-00 — T095 T051

**Fatto**

- T095: quando il codice di una pagina non arriva o la pagina va in errore, il router mostra "Pagina non
  disponibile" con il pulsante "Riprova" (prima restava la pagina precedente con il titolo nuovo). Nuovo
  `router.test.ts` con 4 test.
- T051: nuovo e2e `accessibilita.spec.ts` con axe-core (WCAG 2 A/AA) su `/accedi`, `/registrati` e
  `/password-dimenticata`: la CI fallisce con violazioni critical o serious. L'unico falso positivo di
  contrasto veniva dalla dissolvenza d'ingresso, ora attesa prima dell'analisi.

**Verifiche**

- Format, lint, typecheck, 291 test unitari e build verdi. L'e2e nuovo (axe) lo verifica la CI; prova locale
  di axe con Chromium: 0 violazioni gravi a pagina ferma sulle 3 pagine.

### Sessione agenti — 2026-10-28 — ciclo 20261028-21 — T052 T081

**Fatto**

- T052: la pagina `/clienti/importa` ha il riquadro "Hai anche lo storico dei controlli?" con il link a
  `/clienti/importa-controlli`, così l'import dei controlli si trova dal flusso normale. Nuovo e2e in
  `import.spec.ts`.
- T081: nell'unione dei clienti l'errore compare solo nel dialogo di conferma (che resta aperto), non più
  anche nella pagina. Tolti l'avviso duplicato, il flag `inCorso` e il try/catch (i pulsanti sono già
  disabilitati da `chiediConferma`).

**Verifiche**

- Format, lint, typecheck, 287 test unitari e build verdi. L'e2e nuovo di T052 lo verifica la CI.
- Corsia C2 coordinata dal direttore (`create_session` assente): 2 esecutori Sonnet in parallelo.
  Gate del supervisore 2/2 approvati al primo giro.

### Sessione agenti — 2026-10-28 — ciclo 20261028-18 — T067 T066

**Fatto**

- T067: tabella `abbonamenti` (piano STARTER/PRO/PILOTA, stato PROVA/ATTIVO/SCADUTO/ANNULLATO,
  `prova_fino_al`, id Stripe), creata in automatico per ogni officina (trigger) e per quelle già esistenti.
  RLS: legge il titolare, scrive solo l'admin o il service role. Migrazione `20261028000300_abbonamenti`;
  pgTAP `abbonamenti.test.sql` (26 test, non eseguito in locale).
- T066: email di riserva per le notifiche. Se nessuna push parte e `EMAIL_NOTIFICHE=si`, `invia-notifica`
  manda la notifica per email con Resend. È spenta finché non c'è il dominio di TyreCare (R3, D3); la
  composizione è in `supabase/functions/invia-notifica/email.ts` con 10 unit test (nuovo project vitest
  `funzioni`).

**Verifiche**

- Corsia C1 coordinata dal direttore (`create_session` assente): 2 esecutori-senior Opus in parallelo.
  Revisione al primo giro; gate del supervisore 2/2 approvati al primo giro.
- Prova d'insieme verde (287 test). I test pgTAP non sono stati eseguiti in locale: li esegue la CI.

### Sessione agenti — 2026-10-28 — ciclo 20261028-06 — T083 T100

**Fatto**

- T083: `report_pubblico` restituisce null se l'officina del controllo è SOSPESA (IN_ATTESA e ATTIVA
  funzionano, R12). Migrazione `20261028000100_report_pubblico_sospese`; test pgTAP nuovi (un'altra officina
  non legge i link, anon esegue la funzione, SOSPESA -> IN_ATTESA -> ATTIVA).
- T100: nuove funzioni dell'admin `attiva_officina` e `sospendi_officina`: stato e ruolo dei titolari cambiano
  in una sola transazione; la sospensione non toglie il ruolo (R14). 27 test pgTAP, con i casi negati.

**Verifiche**

- Controlli veloci verdi (277 test). I test pgTAP li esegue la CI (job `database`).

### Sessione agenti — 2026-10-26 — ciclo 20261026-21 — T045 T055

**Fatto**

- T045: la libreria Excel (chunk `xlsx-*.js`, ~490 kB) è fuori dal precache della PWA e si salva in cache
  al primo uso. Precache da 1114 a 634 KiB (119 voci); l'import funziona offline dopo il primo utilizzo.
- T055: le pagine `/privacy` e `/termini` mostrano i testi di `DOCS/legale/` (importati con `?raw` e
  convertiti con `marked` 18.1.2), con avviso giallo di bozza e link "Torna indietro". `lib/legale.ts`
  espone `TESTI_LEGALI_DEFINITIVI = false` e `VERSIONE_TERMINI = '2026-10-bozza'` (la usa T056).

**Verifiche**

- Revisione T055: un giro di correzione (lockfile rigenerato con npm 11); gate del supervisore 2/2
  approvati al primo giro.
- Prova d'insieme verde: format, lint, typecheck; 277 test su 30 file; build ok (precache 119 voci,
  703.51 KiB). E2e non eseguiti nel sandbox: li esegue la CI.

### Sessione agenti — 2026-10-26 — ciclo 20261026-18 — T091 T050

**Fatto**

- T091: l'eliminazione dell'account arriva sempre a `/accedi` con "Il tuo account è stato eliminato.",
  anche se `esci()` fallisce (signOut locale e `vaiA` di riserva).
- T050: la carta del veicolo nel garage avvisa se una o più gomme montate hanno più di 5 anni dal DOT;
  soglia condivisa con la scheda pneumatico.

**Verifiche**

- Corsia C3 coordinata dal direttore con 2 esecutori Sonnet; revisione e gate del supervisore approvati
  al primo giro per entrambi i compiti.
- Prova d'insieme verde: 273 test, con `format:check`, lint, typecheck e build (Node 22). E2e non
  eseguiti in locale (manca Docker): li esegue la CI.
- Limite residuo T091: con la rete caduta `signOut` non cancella la sessione locale e `/accedi` rimanda
  alla home (raro, dichiarato).

### Sessione agenti — 2026-10-26 — ciclo 20261026-15 — T088 T099

**Fatto**

- T088: gli e2e girano con `reducedMotion: 'reduce'` (config Playwright), così l'animazione `tc-entra`
  non sposta i pulsanti sotto il clic; il fallimento di `[telefono] › unisci-clienti.spec.ts:7` (treni
  #22, #23, #25) dovrebbe sparire.
- T099: 8 rotte delle pagine nuove del lancio in `main.ts` con segnaposto caricati con `pigra` (un chunk
  ciascuno); T055, T060–T062, T064, T068, T103 riscrivono solo i loro file.

**Verifiche**

- Corsia C5 coordinata dal direttore con 2 esecutori Sonnet; revisione e gate del supervisore approvati
  al primo giro per entrambi i compiti.
- Prova d'insieme verde: 270 test, con `format:check`, lint, typecheck e build (Node 22). E2e non
  eseguiti in locale (manca Docker): li esegue la CI.

### Sessione agenti — 2026-10-26 — ciclo 20261026-03 — T096 T089

**Fatto**

- T096: il testo dell'esportazione non promette più che tutto si reimporta (clienti e veicoli sì; un
  cliente senza codice gestionale e senza veicoli no; i controlli inseriti dall'app vengono segnalati come
  righe con errori); "1 già presente" al singolare; l'anteprima dell'import dei controlli mostra il periodo
  delle date.
- T089: nell'elenco clienti lo stato vuoto è scelto da `testoVuoto`; con "Senza app" attivo e ricerca vuota
  dice "Tutti i clienti usano già l'app."; con ricerca e filtro insieme aggiunge "tra chi non usa l'app".

**Verifiche**

- Corsia C2 coordinata dal direttore con 2 esecutori Sonnet; revisione di T096 al primo giro, di T089 al
  secondo; gate del supervisore approvati al primo giro.
- Prova d'insieme verde: 270 test su 29 file, con `format:check`, lint, typecheck e build (Node 22). E2e
  non eseguiti in locale: li esegue la CI.

### Sessione agenti — 2026-10-26 — ciclo 20261026-00 — T074 T078

**Fatto**

- T074: l'import dei controlli considera "stessa gomma" anche un valore mancante nel database (DOT nullo,
  marca o misura vuote): una gomma montata dall'app senza DOT non viene più smontata né duplicata.
  Migrazione `create or replace` e pgTAP `import-controlli-mancanti` (9 test).
- T078: versione dei termini e data di accettazione si cambiano solo con `accetta_termini` (trigger nuovo
  `profiles_proteggi_termini`); un `update` diretto del proprio profilo dà 42501. `termini.test.sql` con
  21 test, tra cui i casi negati e "entrambi nulli" diviso per colonna.

**Verifiche**

- Corsia C1 coordinata dal direttore con 2 esecutori-senior; gate approvati al primo giro.
- Test pgTAP non eseguiti in locale: li verifica la CI.
- CI verde al primo giro (check, database con pgTAP, e2e); unita in main con la PR #27.

### Sessione agenti — 2026-10-25 — ciclo 20261025-18 — T047 T041

**Fatto**

- T047: pagina `/clienti/importa-controlli` (solo titolare): legge il file, controlla le righe, mostra
  l'anteprima in simulazione e importa con `importa_controlli`. Unit test della lettura della risposta e
  due e2e (`import-controlli.spec.ts`).
- T041: esportazione dei controlli: `csvControlli` in `packages/shared/src/esporta.ts` (una riga per
  pneumatico misurato, decimali con la virgola) e pulsante "Scarica i controlli" in `/clienti/importa`.
  Test di andata e ritorno con l'import.

**Verifiche**

- 262 test unitari verdi, con `format:check`, lint, typecheck e build (Node 22). E2e non eseguiti in
  locale: li verifica la CI.

**Da sapere**

- decisione R11: un `codice_documento` nullo (controllo fatto in app) resta vuoto nel file esportato e
  quella riga non si reimporta.
- Idee accodate: T096, T097, T098.
- Il link alla nuova pagina dalla pagina dell'import arriva con T052.

### Sessione agenti — 2026-10-25 — ciclo 20261025-15 — T044 T046

**Fatto**

- T044: `packages/shared/src/importa-controlli.ts`, lettura e controllo nel browser del file dei controlli
  (CSV/Excel, date e decimali all'italiana). Le righe valide hanno il formato di `importa_controlli` (T043)
  e non ne violano i vincoli; quelle con errori restano fuori e sono riportate per riga.
- T046: le pagine si scaricano solo quando si aprono (`pigra` con `import()` dinamico, `lib/pigra.ts`):
  `index-*.js` iniziale da 315 kB a 20 kB (gzip 89 → 6 kB). Se l'import fallisce per un deploy nuovo la
  pagina si ricarica una volta sola.

**Verifiche**

- 246 test unitari verdi, con `format:check`, lint, typecheck e build (Node 22). E2e non eseguiti in
  locale: li verifica la CI.

**Da sapere**

- Idee accodate: T094 (scartare tutto il documento se una riga è in errore), T095 (messaggio "Pagina non
  disponibile" con "Riprova" quando l'import di una pagina fallisce).
- Un numero di 1-5 cifre nella colonna data è letto come seriale Excel ("2024" diventa 1905-07-17).
- Controlli parziali (documento con alcune righe in errore): attenzione aggiunta a T047.
- Il service worker precarica comunque tutti i chunk (precache da 21 a 110 voci, da 1060 a 1092 KiB).

### Sessione agenti — 2026-10-25 — ciclo 20261025-09 — T039 T040

**Fatto**

- T039: Profilo → "Elimina il tuo account" (`/profilo/elimina`): spiegazione, pulsante di pericolo, conferma
  "Sì, elimina" e `rpc elimina_account`; poi uscita e avviso "Il tuo account è stato eliminato." sulla pagina
  di accesso, che ora mostra la conferma in sospeso. E2e `elimina-account.spec.ts`.
- T040: Profilo → "Scarica i tuoi dati": un JSON con profilo, email, schede nelle officine, garage,
  prenotazioni, notifiche, commenti, officine in cui si lavora e numero di iscrizioni push (portabilità,
  art. 20 GDPR). Funzione pura `componiMieiDati` testata e e2e `miei-dati.spec.ts`.

**Verifiche**

- 208 test unitari verdi, con `format:check`, lint, typecheck e build (Node 22). Gli e2e
  `elimina-account.spec.ts` e `miei-dati.spec.ts` non sono stati eseguiti in locale: li verifica la CI.

**Da sapere**

- Idee accodate: T091 (eliminazione: `esci()` fallito dopo l'eliminazione, uscita forzata e conferma
  pulita), T092 (`avvisoConferma()` anche nelle altre pagine ospite), T093 (export dati: valutare
  `inviti_cliente` e `link_report`).
- Il link "Elimina il tuo account" è in fondo alla navigazione Account, dopo "Invia un commento".

### Sessione agenti — 2026-10-25 — ciclo 20261025-03 — T033 T035

**Fatto**

- T033: nell'elenco clienti il filtro "Tutti" / "Senza app (n)" mostra i clienti senza `profile_id`, da
  invitare, e si combina con la ricerca; le loro righe riportano "Non usa l'app". Nuovi e2e
  `clienti-filtro.spec.ts` e 3 test unitari.
- T035: il calendario dell'officina mostra per ogni fascia le richieste rispetto alla capienza ("Mattina · 2
  su 4 richieste", "· piena" al limite), con la funzione pura `occupazioneFascia` che ha le regole di
  `occupazione_fascia()` del database, sulle prenotazioni della settimana già caricate.

**Verifiche**

- 204 test unitari verdi, con `format:check`, lint, typecheck e build (Node 22). L'e2e
  `clienti-filtro.spec.ts` non è stato eseguito in locale: lo verifica la CI.

**Da sapere**

- Idee accodate: T089 (stato vuoto per "Senza app" senza ricerca: oggi compare "Nessun cliente per «»"),
  T090 (invito con un tocco dalla riga "Non usa l'app"; conteggio "Senza app" nella home dell'officina).

### Sessione agenti — 2026-10-25 — ciclo 20261025-00 — T059 T063

**Fatto**

- T059: funzione `richiedi_affiliazione`: un account crea la sua officina IN_ATTESA e ne diventa TITOLARE; il
  ruolo globale non cambia (lo cambia T061). Test pgTAP `affiliazione.test.sql` (16) e `database.types.ts`.
- T063: tabella `link_report` con `crea_link_report`, `revoca_link_report` e `report_pubblico`: link casuale
  al report di un controllo, valido 30 giorni, che si può disattivare e non mostra dati del cliente.
  Migrazione `20261025000200`, 14 test pgTAP e tipi aggiornati.

**Verifiche**

- 195 test unitari verdi, con `format:check`, lint, typecheck e build (Node 22). I test pgTAP non sono stati
  eseguiti in locale (pgTAP manca nel sandbox): provati su Postgres 16 con un sostituto minimo (16/16 e
  14/14); li verifica la CI `database`.

**Da sapere**

- Idee accodate: T083 (report spento per le officine sospese), T084 (caso negato pgTAP sulla lettura di
  `link_report`), T085 (rifiutare le richieste di affiliazione), T086 (indice unico su
  `officina_utenti(profile_id)`), T087 (elenco dei link attivi con "Disattiva").
- Le pagine restano da fare: richiesta (T060), attivazione dell'admin (T061) e report pubblico (T064).

### Sessione agenti — 2026-10-24 — ciclo 20261024-21 — T030 T032

**Fatto**

- T030: esportazione di clienti e veicoli in CSV, nello stesso formato del modello di import (DPA §13);
  sezione "Esporta i dati" in fondo a `/clienti/importa`; `csvClientiVeicoli` in shared con 7 test unitari e
  test e2e `esporta.spec.ts`.
- T032: dalla scheda cliente il titolare apre "Unisci con un altro cliente" (`/cliente/unisci`), sceglie il
  doppione con la ricerca dell'elenco clienti e conferma; `unisciClienti()` chiama la rpc `unisci_clienti`
  (T031) senza riprova; la ricerca è estratta in `filtraClienti` con 4 test.

**Da sapere**

- Correzione di documentazione (T077): cancellazione dell'account e intestazioni di sicurezza sono "in
  parte" (manca il pulsante nel profilo, T039; la CSP è solo Report-Only); l'export dei controlli manca
  ancora (T041).

### Sessione agenti — 2026-10-24 — ciclo 20261024-18 — T049 T054

**Fatto**

- T049: job notturno `pulizia-notifiche` (1:40 UTC) che cancella le notifiche lette da 180 giorni e tutte
  quelle di oltre 365 (R6).
- T054: `profiles` ha `termini_versione` e `termini_accettati_il`; il trigger di registrazione
  `crea_profilo_nuovo_utente` li compila dai metadati `termini_versione`; `accetta_termini(p_versione)` serve
  per riaccettare.

**Da sapere**

- Il coordinatore C1 ha scritto il codice da solo (sottoagente senza Agent); gate del supervisore approvato
  con revisione profonda e verifica della logica su Postgres 16 locale. pgTAP e cron non sono stati eseguiti
  nel cloud: li verifica la CI `database`.
- La registrazione web deve ancora passare `termini_versione` nei metadati (T056, corsia C3).

### Sessione agenti — 2026-10-24 — ciclo 20261024-09 — T038 T043 T042 T029 T028 T036

**Fatto**

- T038: funzione `elimina_account()` (security definer) per cancellare il proprio account dall'app; 17 test
  pgTAP.
- T043: funzione `importa_controlli`, 4 colonne in `import_log` e tipo CONTROLLI per l'import dei controlli
  dal CSV; 20 test pgTAP.
- T042: elenchi dell'officina (veicoli, clienti, elenco clienti) letti a pagine da 1000 con `leggiTutte`:
  oltre 1000 righe non spariscono più.
- T029: nell'anteprima dell'import il pulsante "Scarica le righe con errori" scarica
  `tyrecare-righe-con-errori.csv` (colonna `errore`), reimportabile dopo la correzione.
- T028: nuova pagina `DOCS/pilota/crea-officina.md` (6 passi per Davide: account, officina, consegna
  credenziali, attivazione dopo il DPA, ritiro, password dimenticata); passo 1 della guida di avvio
  aggiornato.
- T036: `apps/web/vercel.json` invia le intestazioni di sicurezza; test Vitest `vercel.test.ts`.

**Da sapere**

- Per ordine del supervisore (T038): in `DOCS/legale/README.md` c'è la domanda 14 per il consulente sulla
  sparizione delle prenotazioni passate insieme all'account.

### Sessione agenti — 2026-10-24 — ciclo 20261024-03 — T025, T026, T027, T031, T034, T037

**Fatto**

- T025: `ErroreModulo` ha il campo `codice`; dopo `FASCIA_PIENA` il modulo Prenota ricarica le fasce piene e
  spegne quella riempita. e2e `capienza-corsa.spec.ts` (giorno feriale 32).
- T026: roadmap (Fasi 2, 4, 6) e "Prossima sessione" allineate al lavoro fatto (blocco iniziale di 4 righe;
  P22 e capienza barrate; "Officine vicine" fatta). Solo `DOCS/`.
- T027: funzione `crea_officina_con_titolare(ragione_sociale, partita_iva, email)` (solo admin o senza
  utente) per creare l'officina del pilota; pgTAP con 14 test, verificati in locale.
- T031: funzione `unisci_clienti(p_da, p_in)` per unire due anagrafiche dello stesso officina; pgTAP con
  19 test, verificati in locale (compreso il telefono vuoto preso da `p_da`).
- T034: «Nuovo cliente» ha la casella «Invitalo nell'app dopo il salvataggio»; se spuntata, dopo il
  salvataggio si va a `/cliente/invito?id=`. e2e `nuovo-cliente-invito.spec.ts`.
- T037: bozza di `DOCS/legale/procedura-violazioni.md` (esempi, primi passi tecnici, tempi di avviso artt.
  33-34, registro art. 33.5) e README legale aggiornato. Solo documentazione.

**Da sapere**

- I coordinatori non avevano sottoagenti: il codice l'hanno scritto loro; la revisione l'ha fatta il gate del
  supervisore (4 correzioni su 6 compiti).

### Sessione agenti — 2026-10-24 — T024

**Fatto**

- Migrazione `20261024120000_officine_campi_riservati.sql`: `create or replace` di
  `public.proteggi_campi_riservati()` con lo stesso corpo di prima più, nel ramo `officine`, due controlli
  come quello di `stato_affiliazione`: chi non è ADMIN non cambia `ragione_sociale` né `partita_iva`
  (`42501`, "Solo un amministratore può cambiare la ragione sociale" / "… la partita IVA"). Nessun trigger
  nuovo: `officine_proteggi_campi` chiama già la funzione. ADMIN e `auth.uid()` nullo restano liberi.
- pgTAP `supabase/tests/database/officine-riservati.test.sql` (10 test): titolare cambia il telefono;
  ragione sociale e partita IVA → `42501`; stesso valore di prima insieme al telefono → riesce; titolare2
  e lo stato di affiliazione → ancora `42501`; admin e service role le cambiano.
- `NOTES.md` → "Dati dell'officina e posizione": riga sul trigger (T024).

**Da sapere**

- Fatti in locale: format, lint, typecheck, test, build. pgTAP e e2e si verificano in CI (niente Docker).
- `database.types.ts` non cambia (nessuna colonna nuova). La pagina `/officina/dati` non invia ragione
  sociale e partita IVA (`DatiOfficinaSchema` non le ha): `dati-officina.spec.ts` non è toccato.

### Sessione agenti — 2026-10-23 — T021

**Fatto**

- `/officina/orari`: campo "Richieste al massimo per fascia" (vuoto = nessun limite, 1–99), salvato insieme
  agli orari (`creaOrariECapienzaSchema`, `salvaOrari(id, orari, capienza)`).
- `/prenota`: le fasce piene (`rpc('fasce_piene')`, `caricaFascePiene`) sono disabilitate con "(piena)"
  accanto; un giorno aperto con tutte le fasce piene dice che le richieste sono al completo.
- `FASCIA_PIENA` nella tabella degli errori di `lib/prenotazioni.ts`: messaggio sotto il campo fascia.
- Funzioni pure `fascePieneIl` e `fasceLibere` in `packages/shared/src/prenotazioni.ts` (+ test vitest);
  `creaOrariSchema` ora condivide il codice con il nuovo schema (comportamento invariato).
- e2e `e2e/tests/capienza.spec.ts` (da verificare in CI): capienza 1, un cliente chiede la mattina del
  `prossimoFeriale(40)`, un secondo la vede piena e il pomeriggio libero; il primo annulla la richiesta e nel
  `finally` il titolare rimette la capienza vuota. Offset 40 scelto perché gli altri test usano 0, 1, 2 e 25
  (la chiusura del seed è tra 20 e 22 giorni) e resta entro i 60 giorni prenotabili.

**Da sapere**

- Fatti in locale: format, lint, typecheck, test (167), build. L'e2e si verifica in CI.
- Correzione dopo la CI rossa: `capienza.spec.ts` superava i 60 s (due registrazioni, tre accessi) e, scaduto il
  tempo, il `finally` trovava la pagina chiusa: la capienza 1 restava e rompeva `prenotazioni.spec.ts`. Ora
  timeout di 180 s, ripristino in `beforeEach`/`afterEach` con un contesto nuovo del titolare e giorno
  `prossimoFeriale(40 + retry)`.
- Seconda correzione: le verifiche sulla capienza passavano; il test si bloccava sull'annullamento finale
  perché cercava "Annulla l'appuntamento", ma la richiesta del primo cliente non è confermata e il pulsante
  è "Annulla la richiesta". Corretto il nome del pulsante nel test (l'interfaccia era giusta).

### Sessione agenti — 2026-10-23 — T020

**Fatto**

- Migrazione `20261023150000_capienza_fasce.sql` (solo aggiunte): colonna `officine.capienza_fascia`
  (1–99, `null` = nessun limite), funzione interna `occupazione_fascia` (non concessa ad anon e
  authenticated), funzione pubblica `fasce_piene` (solo giorno e fascia, nessun conteggio),
  `richiedi_prenotazione` uguale alla versione del 2026-10-12 più il lucchetto per fascia e `FASCIA_PIENA`.
- `supabase/tests/database/capienza.test.sql` (29 test pgTAP) e `database.types.ts` aggiornato a mano.
- Decisione in `PLAN.md` P14: restano le richieste; la capienza limita solo le richieste nuove dei clienti.

**Da sapere**

- pgTAP provato in locale con Postgres 16 + pgTAP e una base Supabase finta (ruoli, `auth.uid()`, stub di
  pg_net/pg_cron/vault): passano i nuovi e quelli di prenotazioni, orari, cliente-da-prenotazione,
  notifiche e push. Provate a mano due richieste contemporanee per l'ultimo posto: la seconda aspetta e
  riceve `FASCIA_PIENA`. I tipi generati e il job `database` si verificano in CI.
- Fatti in locale: format, lint, typecheck, test, build.

### Sessione 20 — 2026-10-23 (PC di casa, breve)

**Fatto**

- Panoramica del lavoro degli agenti (T001–T019, PR #1–#13); repo del PC di casa allineato a `origin/main`
  (`git pull`, `npm install`, `db:reset`): `db:test`, typecheck e Vitest passano; app provata nel browser.
- Nuovo script `npm run db:stop` (`supabase stop`, i dati restano), in `STRUCT.md` e nell'avvio di `NEXT.md`.

### Sessione agenti — 2026-10-23 — T019

**Fatto**

- `/officine`: pulsante "Vicino a me" (posizione del browser) che riordina le officine dalla più vicina e
  mostra "A X da te" in ogni scheda; permesso negato o errore → avviso giallo e elenco invariato.
- `packages/shared/src/distanza.ts`: `distanzaKm`, `formattaDistanza`, `ordinaPerDistanza`, con test Vitest.
  `OfficinaPubblica` ora include `latitudine` e `longitudine`.
- e2e `e2e/tests/officine.spec.ts` (contesto con geolocalizzazione vicino a Torino; contesto senza
  permesso): da verificare in CI. La posizione del cliente non viene salvata (vedi `NOTES.md`).

**Da sapere**

- Nel seed c'è una sola officina ATTIVA (Gomme Rossi, con coordinate): l'ordinamento è provato solo da Vitest.
- Fatti in locale: format, lint, typecheck, test, build. Non eseguibile qui: e2e.

### Sessione agenti — 2026-10-23 — T018

**Fatto**

- Pagina `/officina/dati` ("Dati dell'officina"), raggiungibile da Profilo → Officina (solo TITOLARE):
  indirizzo, CAP, città, provincia, telefono, email e "Posizione sulla mappa"; ragione sociale e partita
  IVA in sola lettura. Salvataggio → `/profilo` con "Dati dell'officina salvati."; l'operatore vede
  l'avviso "Solo il titolare dell'officina può modificare i dati dell'officina."
- `packages/shared/src/officina.ts`: `leggiCoordinate` e `DatiOfficinaSchema`, con test Vitest. Nessuna
  migrazione: bastano le colonne e la policy "officine: modifica titolare o admin".
- Pulsante "Usa la posizione attuale" (`navigator.geolocation`).
- e2e `e2e/tests/dati-officina.spec.ts` con titolare2 (Pneus Express): da verificare in CI.

**Da sapere**

- `is_titolare_officina` non guarda lo stato di affiliazione: titolare2 (IN_ATTESA) può aggiornare la sua
  officina. Indirizzo e città sono obbligatori (colonne `not null`); CAP, provincia, telefono, email no.
- La virgola decimale ("45,07 7,68") è rifiutata con un messaggio che chiede il punto.
- Fatti in locale: format, lint, typecheck, test, build. Non eseguibile qui: e2e.

### Sessione agenti — 2026-10-22 — T017

**Fatto**

- Pilota: nuova guida di una pagina per LA SANTI GOMME in `DOCS/pilota/guida-avvio.md` (9 passi: accesso e
  app sulla Home, orari e chiusure, servizi, import, controlli, inviti, richieste di appuntamento,
  notifiche, commento) con l'avviso sul DPA in fondo. Riga aggiunta nell'indice di `DOCS/PLAN.md`.
- Ogni nome di pulsante o pagina citato è stato cercato con `grep` in `apps/web/src`. Solo documentazione:
  nessun codice toccato.

**Da sapere**

- Le istruzioni per Android/iPhone (menu del browser) sono quelle generali dei browser, non dell'app.
- Il passo 1 dà per scontato che il titolare abbia già un account: come viene creato quello del pilota
  va deciso con Davide.

### Sessione agenti — 2026-10-22 — T016

**Fatto**

- Pilota: pagina `/commento` ("Invia un commento"), raggiungibile da Profilo → Account → "Invia un
  commento su TyreCare". Textarea "Cosa vuoi dirci?" (3–2000 caratteri, contatore), invio con id del
  browser e ripetibile (`23505` sullo stesso id = riuscito), `officina_id` = officina attiva o `null`,
  `percorso` = `?da=`. Conferma "Grazie, abbiamo ricevuto il tuo commento." nel Profilo;
  `TROPPI_COMMENTI` → "Hai mandato molti commenti oggi: riprova domani."
- `packages/shared/src/commenti.ts` (`CommentoSchema`, `percorsoCommento`) con test Vitest; e2e
  `e2e/tests/commenti.spec.ts` (invio del cliente, testo troppo corto) da verificare in CI
- Il router ricorda la pagina lasciata (`paginaPrecedente()`), usata per il parametro `da`

### Sessione agenti — 2026-10-22 — T015

**Fatto**

- Pilota: tabella `public.commenti` per i commenti (feedback) di officine e clienti — migrazione
  `20261022150000_commenti.sql`. `id` senza default (lo genera il browser, scritture ripetibili),
  `autore_id` = chi scrive, `officina_id` facoltativo (solo un'officina di cui si è membri), `percorso`
  (pagina dell'app, max 200), `testo` 3–2000 caratteri senza contare gli spazi ai lati
- RLS: inserisce solo un utente con account, a proprio nome; legge l'autore (i suoi) e l'ADMIN; niente
  modifica né eliminazione dall'app (`revoke update, delete`: solo l'ADMIN dalla dashboard)
- Trigger `limita_commenti` (`before insert`, senza `security definer`): massimo 20 commenti in 24 ore per
  autore, poi errore `TROPPI_COMMENTI` (P0001). Forza `created_at = now()`, altrimenti con una data vecchia
  si aggirerebbe il limite
- 13 pgTAP in `supabase/tests/database/commenti.test.sql` (permessi e accessi negati, testo corto, data
  forzata, limite con `generate_series`); `database.types.ts` aggiornato a mano. Test del database e tipi
  verificati dalla CI (nel cloud manca Docker)

### Sessione agenti — 2026-10-22 — T014

**Fatto**

- P17: nuove bozze in `DOCS/legale/` — `dpa-officine.md` (accordo art. 28: parti, oggetto e durata,
  finalità, interessati e dati come nell'informativa, istruzioni, riservatezza, misure di sicurezza,
  sub-responsabili Supabase/Vercel/Resend con avviso per i nuovi, assistenza per i diritti, data breach,
  cancellazione o restituzione, audit) e `registro-trattamenti.md` (art. 30: parte A TyreCare titolare —
  account, notifiche, iscrizioni push, anagrafica officine, dati tecnici; parte B responsabile — clienti,
  veicoli, pneumatici, controlli, inviti, prenotazioni, import). Entrambi con "BOZZA — da rivedere…" in
  testa
- Misure di sicurezza verificate nel codice prima di scriverle: `enable row level security` su tutte le 16
  tabelle, policy per officina e per ruolo (admin escluso dai dati delle officine), test pgTAP sugli accessi
  negati, SHA-256 dei codici invito, chiave di servizio solo in `invia-notifica`, Supabase eu-west-1
- `legale/README.md`: elenco aggiornato e sezione "Da fare prima del lancio" con le misure che mancano
  (registro accessi del personale, copie di sicurezza, esportazione e cancellazione, procedura violazioni,
  2FA, password, intestazioni di sicurezza, captcha, regioni dei fornitori, impostazioni cloud, DPA dei
  fornitori)
- `PLAN.md`: riga in §P17 e indice. Solo documentazione, niente codice

### Sessione agenti — 2026-10-21 — T013

**Fatto**

- P17: bozze legali in `DOCS/legale/` — `README.md` (elenco, dati mancanti, 12 domande per il consulente),
  `informativa-privacy.md` (titolarità account/officina, dati ricavati dalle migrazioni, finalità e basi
  giuridiche, conservazione, fornitori, diritti, cookie e archiviazione locale), `termini-di-servizio.md`
  (ruoli, prenotazioni come richieste, dati degli pneumatici indicativi, abbonamento come segnaposto,
  legge italiana). Ogni file comincia con "BOZZA — da rivedere con un consulente prima dell'uso"
- Verificato nel codice: nessun cookie né analisi; `localStorage` solo per la sessione di Supabase e
  l'officina scelta; il service worker mette in cache solo i file dell'app; caratteri non da siti esterni
- Dati del titolare (voce D5) non ancora compilati: segnaposto `[DA COMPLETARE: …]`
- `PLAN.md`: riga in §P17 e riga `legale/` nell'indice. Solo documentazione, niente codice

### Sessione agenti — 2026-10-21 — T012

**Fatto**

- Import, P22: nel passo "Associa le colonne" si può salvare l'associazione con un nome (facoltativo,
  max 60 caratteri), sceglierne una salvata ("Usa un'associazione salvata") ed eliminarla (con conferma)
- Caricando un file non riconosciuto da solo, si applica la più recente salvata che corrisponde e si va
  all'anteprima con "Colonne associate con «nome»" e "Cambia le colonne"; errore di salvataggio = avviso
  e anteprima comunque
- `lib/importa.ts`: `caricaMappature`, `salvaMappatura` (upsert), `eliminaMappatura`
- Test: 1 e2e nuovo in `import.spec.ts` (nome con `<`, elimina in `finally`); gli esistenti non toccati.
  e2e da verificare in CI

### Sessione agenti — 2026-10-21 — T011

**Fatto**

- Import, P22: nuova migrazione `20261021120000_import_mappature.sql` con la tabella `import_mappature`
  (associazioni di colonne salvate per officina: `nome` unico nell'officina, `colonne` jsonb, `creata_da`,
  `updated_at` con trigger) e la funzione `mappatura_import_valida(jsonb)` usata nel `check` (chiavi tra
  le 11 di `COLONNE_IMPORT`, valori testo 1–200, almeno targa o codice cliente)
- RLS: select, insert, update (`using` + `with check`), delete solo `is_titolare_officina(officina_id)`
- Test: 24 pgTAP in `import-mappature.test.sql` (titolare inserisce/legge/modifica/elimina; operatore,
  titolare2, cliente e anonimo né vedono né scrivono; vincoli; nome doppio `23505`; spostamento in
  un'altra officina rifiutato); da verificare in CI (niente Docker nel cloud)
- `database.types.ts` aggiornato a mano (tabella e funzione). Niente interfaccia: è T012

### Sessione agenti — 2026-10-20 — T010

**Fatto**

- Import, P22: nuovo passo "Associa le colonne" in `/clienti/importa`. Se `mappaturaAutomatica` non
  trova targa o codice cliente, o c'è un'intestazione non riconosciuta, il titolare sceglie per ognuna
  delle 11 colonne di TyreCare la colonna del file (con esempio dalla prima riga) e poi vede l'anteprima;
  "Cambia le colonne" torna indietro con le scelte fatte. Nessun salvataggio (T012)
- `ui/mappatura.ts` (HTML e funzioni pure), `pagine/importa.ts` rifatto in tre passi
  (`leggiEMostra`, `mostraMappatura`, `mostraAnteprima`) con `ancoraAttuale` e `scelta` rispettati;
  stile a due colonne da computer in `_officina.scss`
- Test: 4 Vitest in `ui/mappatura.test.ts`; 1 e2e nuovo in `import.spec.ts` (intestazioni inventate,
  errore di colonna doppia, "Cambia le colonne", import); gli altri e2e non sono stati toccati. e2e da
  verificare in CI

### Sessione agenti — 2026-10-20 — T009

**Fatto**

- Import: `/clienti/importa` legge anche i file Excel (`.xls`, `.xlsx`, `.ods`), sempre nel browser. Nuova
  dipendenza `@e965/xlsx` 0.20.3 (versione esatta; anche devDependency di `e2e`), caricata con `import()`
  dinamico: pezzo `xlsx` di 492 kB (160 kB gzip) separato dal codice iniziale, sotto il limite di 2 MiB
  del precache Workbox (precache 1031 KiB, service worker generato)
- `lib/excel.ts`: `tabellaDaFoglio(foglio, XLSX)` (pura; prende anche la libreria per non importarla
  nel codice iniziale) e `leggiExcel(file)`; `lib/importa.ts`: `leggiTabella(file)` sceglie Excel o CSV
  per estensione e rifiuta file oltre 10 MB. La pagina usa `controllaTabella` + `mappaturaAutomatica`
- Test: 3 Vitest in `excel.test.ts` (righe vuote, date, giro `.xls` BIFF8 con "Niccolò"); 1 e2e nuovo in
  `import.spec.ts` (da verificare in CI)

### Sessione agenti — 2026-10-20 — T008

**Fatto**

- Import, primo passo di P22 (solo logica, senza interfaccia): in `packages/shared/src/importa.ts` la lettura
  e il controllo sono separati dal riconoscimento delle colonne. Nuovi: `Tabella`, `tabellaDaCsv`,
  `Mappatura`, `mappaturaAutomatica`, `ETICHETTE_COLONNE_IMPORT`, `erroriMappatura`, `applicaMappatura`,
  `controllaTabella`. `controllaImport` ha la stessa firma e lo stesso comportamento (13 test esistenti
  invariati); 9 test nuovi in `importa.test.ts`

### Sessione agenti — 2026-10-20 — T001

**Fatto**

- Avvio più leggero: lo storico delle sessioni è passato da `NEXT.md` a questo file (`STORICO.md`), senza
  modifiche; in `NEXT.md` restano "Prossima sessione", la nuova sezione "Sessioni nel cloud" (Node 24 da npm,
  niente Docker: database ed e2e solo in CI) e i promemoria permanenti sotto "Solo per i PC di Davide"
  (con l'avvio della sessione sul PC di casa, prima dentro "Prossima sessione")
- `CLAUDE.md`: all'avvio si legge solo "Prossima sessione" di `NEXT.md` e, di `PLAN.md`, l'indice e le
  sezioni che servono; lo storico va in cima a `STORICO.md`; aggiunto `STORICO.md` all'elenco dei documenti
  (anche nell'indice di `PLAN.md`)
- `PLAN.md` §B: nuove decisioni del titolare **P22 — Import con mappatura delle colonne** (sostituisce
  l'adattatore GESTITYRE) e **P23 — Email dal dominio di TyreCare** (mittente unico, DNS configurati una
  volta dal titolare); aggiornati di conseguenza §6, §7, P8, P21 e le voci di `NEXT.md`
- `STRUCT.md`: aggiornato il rimando a `NEXT.md` (la sezione dei promemoria ha cambiato nome)

### Sessione 19 — 2026-10-16 (PC di casa)

**Fatto**

- Il file `.xls` di GESTITYRE **non è ancora arrivato**. Il titolare ha confermato che il **report segna
  letta la sua notifica** (prova della sessione 18). Scelto il **CSV standard + import (P8)**
- **Decisioni del titolare:** il CSV si legge e si controlla **nel browser** con una funzione SQL che
  scrive in transazione (niente Fastify per ora); **prima clienti e veicoli**, i controlli dopo
- **Shared:** `importa.ts` (lettore CSV, riconoscimento colonne e separatore, controllo delle righe con
  gli schemi dei moduli, doppioni nel file, modello da scaricare) + 13 Vitest
- **Database:** migrazione `20261016120000_import_clienti_veicoli.sql` — tabella `import_log` e funzione
  `importa_clienti_veicoli` (solo TITOLARE, idempotente, celle vuote che non cancellano, simulazione per
  l'anteprima) + 17 pgTAP. Tipi rigenerati
- **Web:** pagina `/clienti/importa` (modello, scelta del file, anteprima con conteggi ed errori per riga,
  import, import precedenti); pulsante "Importa dal gestionale" in *Clienti* per il titolare. File di
  Excel in Windows-1252 riletti con la codifica giusta. Componenti esistenti (`tc-riepilogo`,
  `tc-lista`, `tc-avviso`)
- E2e nuovo `import.spec.ts` (2 test verdi). `npm run check` verde (119 Vitest), `db:test` verde (i
  pgTAP dell'import non dipendono dai dati lasciati dagli e2e)
- Migrazione **pubblicata sul cloud da Claude** con `db push` (ok del titolare, prima `--dry-run`);
  funzione e tabella verificate con `supabase db query --linked`. Commit `a94c305`, **CI verde**,
  pubblicato (Vercel)
- **Prova del titolare:** aggiunto "Francesco Totti" al modello, ma non importato. Sul cloud c'è un solo
  import (le 2 righe del modello, 0 saltate): la riga di Totti è stata scartata dall'anteprima. Difetto
  trovato: con le righe valide già importate e una riga con errori l'anteprima diceva in verde *"Nessuna
  modifica: i dati di questo file sono già in TyreCare"*, che sembrava un via libera. Ora dice in rosso
  che la riga con errori non è stata importata e va corretta (e2e aggiornato). Corretta la riga, il
  titolare ha importato Totti (codice `C0003`, 1 veicolo, verificato sul cloud): **import provato e
  funzionante**. Correzione nel commit `88fdf19`, CI verde, pubblicata (nessuna migrazione)

### Sessione 18 — 2026-10-15 (PC di casa)

**Fatto**

- Il file `.xls` di GESTITYRE **non è ancora arrivato**. Il titolare ha provato i **promemoria dal
  telefono: funzionano tutti** (giorno prima, esito del controllo, cambio stagionale). Scelte le
  **rifiniture delle notifiche**
- **Web:** sezione "Avvisi sul telefono" spostata in `ui/avvisi-push.ts`; dopo l'invio di una richiesta la
  pagina dell'appuntamento invita (una volta, solo se le push sono spente) ad attivare gli avvisi. Aprire
  il report di un controllo segna letta la sua notifica di esito (`segnaLette({ controllo })`, filtro sulla
  `chiave`; nessuna migrazione). Componente esistente riusato senza nuovo design
- E2e nuovo in `notifiche.spec.ts` (invito che compare e poi sparisce, con service worker e permesso
  finti); lettura dal report provata a mano con una notifica inserita via `psql` e poi rimossa.
  `npm run check` verde (106 Vitest), e2e delle notifiche verdi
- Commit `6c71a9d`, CI verde, **pubblicato** (Vercel, nessuna migrazione). Prova dal telefono: l'invito
  all'inizio non compariva perché gli avvisi erano già attivi (previsto); spenti gli avvisi, **funziona**

### Sessione 17 — 2026-10-14 (PC di casa)

**Fatto**

- Il file `.xls` di GESTITYRE **non è ancora arrivato**. Il titolare ha provato le **push dal telefono:
  funzionano**. Scelto il **promemoria del giorno prima**
- **Database:** migrazione `20261014180000_promemoria_appuntamenti.sql`: nuovo tipo di notifica
  `PROMEMORIA`, colonna `prenotazioni.promemoria_per`, funzione `crea_promemoria_appuntamenti(p_adesso)` e
  job **pg_cron** `promemoria-appuntamenti` ogni ora (minuto 5): dalle 18 italiane avvisa il cliente degli
  appuntamenti confermati del giorno dopo, una volta per orario (di nuovo se l'appuntamento è spostato).
  `promemoria.test.sql`: **13 pgTAP** (totale **247**); tipi rigenerati
- **Web:** icona sveglia per i promemoria nella pagina Notifiche
- `npm run check` verde, `db:test` verde, CI verde. Il token della Supabase CLI era scaduto: il titolare ha
  rifatto `npx supabase login` **in un PowerShell esterno** (dentro Claude Code il login interattivo non
  funziona). **Pubblicato sul cloud** con `db push`; verificato con `supabase db query --linked` che il job
  `promemoria-appuntamenti` esiste ed è attivo
- **Promemoria degli pneumatici** (P11). Scelte del titolare: esito del controllo e cambio stagionale, solo al
  cliente, alle 10 (scartati per ora: gomme vecchie e stima del consumo). Migrazione
  `20261014200000_promemoria_pneumatici.sql`: tipi `ESITO_CONTROLLO` e `CAMBIO_STAGIONE`, colonna
  `notifiche.chiave` (unica per destinatario: niente doppioni), `stato_battistrada()` (soglie come
  `packages/shared`), constraint trigger **deferred** `controlli_notifica_esito`, funzione
  `crea_promemoria_pneumatici()` e job pg_cron `promemoria-pneumatici` (minuto 15). 21 pgTAP (totale
  **268**); verificato a mano che il trigger scatta al commit. Icone nella pagina Notifiche. Commit
  `d0ad309`, CI verde, **pubblicato sul cloud** con `db push`: i due job pg_cron risultano attivi

### Sessione 16 — 2026-10-14 (PC di casa)

**Fatto**

- Il file `.xls` di GESTITYRE **non è ancora arrivato**. Il titolare ha **confermato la decisione P14**
  (cliente creato dalla richiesta collegato all'account senza invito) e ha scelto la **Fase 5: notifiche**
- **Database:** migrazione `20261014120000_notifiche.sql`: tabella `notifiche` (titolo, testo e link in
  italiano), trigger `prenotazioni_notifica` su ogni cambio di stato (nuova richiesta, proposta accettata,
  annullamento → officina; conferma, proposta, rifiuto → cliente; chi agisce non riceve nulla),
  `testo_quando()`, RLS (solo il destinatario; dall'app si cambia solo `letta_il`), tabella in Realtime.
  `notifiche.test.sql`: **31 pgTAP** (totale **226**); tipi rigenerati
- **Web:** voce **"Notifiche"** (campanella, quinta voce) con badge rosso delle non lette aggiornato in
  tempo reale (`lib/notifiche.ts`, Supabase Realtime); pagina `/notifiche` (ultime 50, nuove evidenziate,
  aprirla le segna lette); aprire un appuntamento segna lette le sue. Skill `ui-ux-pro-max` consultata
  (badge sulla voce che si azzera dopo la visita, conteggio annunciato come frase, link diretti)
- 6 Vitest nuovi (totale **106**); e2e `notifiche.spec.ts` (badge che arriva senza ricaricare, dai due
  lati): **15/15 e2e verdi**. `npm run check` verde. Screenshot a 390 e 1440 px controllati: corretto un
  problema (aprendo direttamente `/notifiche` chi lavora in officina vedeva le voci del cliente)
- Aggiornati `NOTES.md`, `PLAN.md` (P21, roadmap), `STRUCT.md` (Realtime), `IMPLEMENTAZIONI.md`

**Note**

- Nessuna nuova libreria.
- Commit `56b13df` (codice) e `4d13a93` (documenti). **Migrazione pubblicata sul cloud da Claude** (ok del
  titolare, prima `--dry-run`): 12 migrazioni allineate, trigger e Realtime verificati sul cloud
- La prima CI ha fallito solo nel job `e2e`: Supabase partiva **senza Realtime** (`-x realtime` in
  `ci.yml`) e il badge non arrivava. Tolto dalla lista (`ci:` commit successivo): **CI tutta verde**,
  deploy Vercel verde
- Test del titolare superati. **Web Push** (autorizzazione del titolare a fare e pubblicare tutto; P21
  confermata): migrazione `20261014150000_notifiche_push.sql` (`iscrizioni_push`, `iscrivi_push()`,
  trigger `notifiche_push` con pg_net e segreti nel Vault), Edge Function `invia-notifica` (`web-push`,
  iscrizioni scadute eliminate), `public/sw-push.js` importato nel service worker, `lib/push.ts` e sezione
  "Avvisi sul telefono" nella pagina Notifiche (permesso chiesto solo dopo il tocco, istruzioni per iPhone).
  8 pgTAP in `push.test.sql` (totale **234**), `npm run check` verde, e2e delle notifiche verdi
- **Pubblicato sul cloud da Claude:** segreti della funzione (`VAPID_*`, `PUSH_SEGRETO`), deploy di
  `invia-notifica`, migrazione (prima `--dry-run`), segreti nel Vault. Verificato: funzione 401 senza
  segreto, 404 con id inventato; notifica di prova con iscrizione finta → la funzione è stata chiamata dal
  database e ha risposto 200 (`dispositivi: 1`). Dati di prova cancellati. **Consegna vera sul telefono non
  ancora provata** (serve un dispositivo reale)
- Commit `684d5da`: **CI (`check`, `database`, `e2e`) e deploy Vercel verdi**. La chiave privata VAPID è
  solo nei segreti di Supabase (copia locale cancellata): se si perde, nuove chiavi e nuove iscrizioni
- Le notifiche nascono nel database: Web Push ed email leggeranno la stessa tabella (P21).

### Sessione 15 (in parallelo) — 2026-10-13: impaginazione da computer

Lavoro svolto da un secondo agente in parallelo alla sessione 15, nel worktree
`desktop-ottimizzazione` (ramo `worktree-desktop-ottimizzazione`), senza toccare i file di `src/pagine/`
su cui lavorava l'altro agente.

**Fatto**

- **Richiesta del titolare:** ottimizzare la versione da computer, perché le officine accedono di solito
  dal PC (decisione in `PLAN.md` P20). Skill `ui-ux-pro-max` consultata (navigazione che non copre il
  contenuto, ordine del Tab uguale a quello visivo, larghezza di lettura limitata)
- Da 992 px **barra laterale** al posto delle barre del telefono; moduli 40 rem, elenchi 60 rem, schede
  76 rem su **due colonne** (home dell'officina, scheda del veicolo con cruscotto fermo, scheda del
  cliente, dettaglio dell'appuntamento compresa la nuova sezione "Nella tua officina", calendario con
  mattina e pomeriggio affiancati, garage del cliente con le carte affiancate)
- **"Salta al contenuto"** e tasto **`/`** per la ricerca
- Tutto in `ui/layout.ts` (attributo `data-pagina` per percorso) e nel nuovo `styles/_desktop.scss`;
  telefono e stampa invariati (screenshot a 390 px controllato)
- Nuovo e2e `computer.spec.ts` (1280×800). **12/12 e2e verdi** (contro il Vite del worktree), `npm run
  check` verde. Screenshot controllati a 1440 e 1024 px
- Aggiornati `NOTES.md`, `DESIGN-SYSTEM.md`, `PLAN.md` (P20), `IMPLEMENTAZIONI.md` (4 idee nuove)

**Note**

- Nessuna migrazione e nessuna nuova libreria (`STRUCT.md` invariato).
- Unito in `main` dopo la chiusura della sessione 15 (richiesta del titolare); unico conflitto in
  `NOTES.md`, risolto tenendo entrambe le parti.
- CI di `48e1cef` (`check`, `database`, `e2e`) **verde**; worktree e ramo cancellati. **Provata dal titolare
  dal PC dell'officina: funziona** (barra laterale, colonne, tasto `/`).
- Le colonne dipendono dalla struttura delle pagine (figli di `.tc-contenuto`): se si riordina una di
  quelle pagine, controllarla a 1440 px (vedi `NOTES.md`, "Impaginazione da computer").

### Sessione 15 — 2026-10-13 (PC di casa)

**Fatto**

- Il file `.xls` di GESTITYRE **non è ancora arrivato**; scelta del titolare: **"Prenota" dal garage**
- **Carta dell'officina** nella scheda del garage: pulsante rosso "Prenota" a tutta larghezza sopra
  Chiama/Indicazioni, solo per le officine prenotabili (ATTIVA, servizi prenotabili, orari);
  `caricaOfficinePrenotabili()` in una query, errore ignorato (è solo una scorciatoia)
- **Avviso sulle ruote** nel garage: "Prenota la sostituzione" (rosso) / "Prenota un controllo" (giallo)
  verso l'officina prenotabile più recente. Il report del controllo resta senza "Prenota"
- **Modulo `/prenota`** con `targa=`: compila targa e descrizione con quel veicolo; "Annulla" torna al garage
- Nuovo e2e (Giulia del seed: Prenota solo per Gomme Rossi, non per Pneus Express in attesa; modulo
  compilato; Annulla): **11/11 verdi**. `npm run check` verde (97 Vitest). Screenshot a 390 px controllato
- Aggiornati `NOTES.md`, `PLAN.md` (roadmap), `IMPLEMENTAZIONI.md` (due idee fatte)

**Note**

- Nessuna migrazione e nessuna nuova libreria (`STRUCT.md` invariato).
- Commit `b496bdc` (codice) e `7c2d720` (documenti): deploy Vercel verde, ma il job CI `database` è
  fallito per un **bug di date in `orari.test.sql`** (nulla a che fare con "Prenota"): di **martedì**
  `prossimo(3)` (domani) viene prima di `prossimo(2)` (tra 7 giorni). Corretto usando `prossimo(2) + 1`;
  `db:test` 176/176
- Titolare: "Prenota" visto dal telefono nella scheda del veicolo ("La tua officina")
- **Cliente e veicolo dalla richiesta:** migrazione `20261013120000_cliente_da_prenotazione.sql` con
  `registra_cliente_da_prenotazione` (`security definer`, solo membri dell'officina; cliente nuovo
  collegato all'account o veicolo sulla scheda già collegata; si ferma se la targa c'è già o la richiesta
  è chiusa; ripetibile). 17 pgTAP (totale **193**); tipi rigenerati. `dividiVeicolo` in shared con 3
  Vitest (totale **100**). Dettaglio della richiesta: sezione "Nella tua officina" sotto le azioni, con
  dialogo di conferma. Nuovo e2e: **12/12 verdi**. Screenshot a 390 px controllati (sezione spostata sotto
  "Conferma appuntamento" per non spingerlo in basso). Commit `0e5b4d9` (codice) e
  `c6a6d75` (documenti). **Migrazione pubblicata sul cloud da Claude** (ok del titolare, prima
  `--dry-run`): 10 migrazioni allineate, funzione presente. CI e deploy Vercel verdi
- **Bug dal telefono (titolare):** "Aggiungi cliente e veicolo" falliva ("Qualcosa è andato storto") con
  un account senza nome nel profilo (creato dalla dashboard): vincolo `clienti_officina_nominativo`.
  Correzione nella migrazione `20261013150000_cliente_da_prenotazione_senza_nome.sql`: nome di ripiego
  dalla parte dell'email prima della @ (o "Cliente"). 2 pgTAP (totale **195**); testo "Chi ha prenotato"
  quando manca il nome. Commit `7b3f29f` (CI verde); migrazione **pubblicata dal titolare** con `db push`
  (prima `--dry-run`): 11 migrazioni allineate, ripiego verificato nella funzione sul cloud
- **Prove dal telefono del titolare riuscite:** "Prenota" nella carta "La tua officina"; "Aggiungi cliente
  e veicolo" funziona (dopo la correzione del profilo senza nome)
- Un altro agente lavora in parallelo sulla **versione desktop**: questo lavoro non tocca stili né
  `ui/layout.ts`

### Sessione 14 — 2026-10-12 (PC di casa)

**Fatto**

- Il file `.xls` di GESTITYRE **non è ancora arrivato** (arriverà a breve): il titolare ha scelto di passare
  alla **Fase 4** dopo i test end-to-end
- **Test end-to-end con Playwright** (PLAN P7): nuovo workspace `e2e/` (`@playwright/test` 1.64, Chromium
  con schermo da telefono), `npm run test:e2e`. Primi 4 test sul flusso degli inviti: invito completo con la
  vera email di conferma letta da Mailpit (registrazione → conferma → collega → garage → "Usa l'app" →
  "Invito già usato" per un altro), email diversa, invito annullato, codice inventato. **4/4 verdi** in
  ~1 minuto, anche ripetuti senza `db:reset` (dati con nomi unici)
- Nuovo job CI `e2e` (Supabase senza i servizi inutili, report di Playwright tra gli artifact se fallisce)
- Test pgTAP "l'operatore vede solo i veicoli della propria officina" reso indipendente dal numero di
  veicoli (gli e2e ne aggiungono): `db:test` 107/107 anche dopo gli e2e. `npm run check` verde
- Aggiornati `STRUCT.md` (Playwright), `NOTES.md`, `PLAN.md` (P7). Commit `d1780c1` e `b9a459c`: **CI verde,
  anche il nuovo job `e2e`** (3 min 26 s)
- **Fase 4 — decisioni del titolare:** prenotazioni da **tutte le officine attive**, **giorno + fascia**
  (l'officina conferma con l'ora), **prezzo indicativo facoltativo** nel catalogo
- **Database:** migrazione `20261012120000_prenotazioni.sql` — `servizi_officina` (catalogo, lo modifica il
  TITOLARE), `prenotazioni` (scrittura solo dalle funzioni `richiedi_prenotazione`,
  `rispondi_prenotazione`, `rispondi_proposta`, `annulla_prenotazione`), `fasce_aperte`, `oggi_in_italia`.
  Seed: 4 servizi di Gomme Rossi e una richiesta di Giulia. `prenotazioni.test.sql`: **50 test pgTAP**
  (totale **157**); tipi rigenerati. **Pubblicata sul cloud da Claude** con `db push` (ok del titolare,
  prima `--dry-run`): 8 migrazioni allineate
- **Shared:** `prenotazioni.ts` (fasce, date italiane con ora legale, schemi di servizio, richiesta,
  conferma, proposta, rifiuto), 19 nuovi Vitest (totale **87**)
- **Web:** catalogo `/servizi` (Profilo → "Servizi e prezzi"); per il cliente voce "Officine" → scheda
  dell'officina con servizi e orari → `/prenota` (veicoli del garage come scorciatoie, fascia chiusa
  spenta); voce "Appuntamenti" per tutti con elenco e dettaglio (conferma con l'ora, proponi un altro
  orario, rifiuta/annulla con motivo, completato/non presentato; il cliente accetta la proposta o annulla);
  avviso "richieste da confermare" nella home dell'officina. Skill `ui-ux-pro-max` consultata (date per
  esteso, stato con icona e testo, conferma prima di annullare)
- **E2e:** 4 test sulle prenotazioni (cliente nuovo per ogni test, creato dall'API di Auth): **8/8 verdi**.
  Screenshot a 390 px controllati (corretti spazio sopra "Rifiuta" e suggerimento sul giorno chiuso).
  Test pgTAP resi indipendenti dai dati lasciati dagli e2e. `npm run check` verde
- Aggiornati `NOTES.md`, `PLAN.md` (P14, roadmap, §7 prezzi), `DESIGN-SYSTEM.md`, `IMPLEMENTAZIONI.md`

- CI (`check`, `database`, `e2e`) e deploy Vercel di `86eff70`: **verdi**
- **Officina di prova sul cloud resa prenotabile da Claude** (richiesta del titolare) con
  `npx supabase db query --linked`: `ATTIVA`, orari lun–ven 8:30–12:30 e 14:30–19:00, sabato mattina. Il
  servizio "Controllo di routine" (da 75 €) c'era già. Verificato come utente anonimo che officina e
  servizio sono visibili
- **Calendario dell'officina** (richiesta del titolare) `/appuntamenti/calendario`: settimana con il numero
  di appuntamenti per giorno, agenda del giorno per mattina/pomeriggio (ore in ordine, richieste "da
  fissare"), proposte nel giorno proposto; selettore Calendario/Elenco. `lib/calendario.ts` con 5 Vitest
- **Orari e chiusure** (titolare, Profilo → "Orari e chiusure"): editor degli orari (due turni al giorno,
  copia del lunedì), chiusure straordinarie (dal/al/motivo). Migrazione `20261012150000_orari_chiusure.sql`:
  vincolo `orari_validi`, tabella `chiusure_officina`, `richiedi_prenotazione` rifiuta i giorni di
  chiusura; seed con una chiusura "Inventario" tra 20 e 22 giorni. `orari.test.sql`: 19 pgTAP (totale
  **176**). Chiusure nel modulo "Prenota", nella scheda dell'officina e nel calendario. **Migrazione pubblicata
  sul cloud da Claude** (ok del titolare): 9 migrazioni allineate, orari dell'officina di prova validi
- 2 nuovi e2e (orari, chiusura) + controllo del calendario nel test della conferma: **10/10 verdi**;
  Vitest **97**; `npm run check` verde. Screenshot controllati (campi ora affiancati: pagina lunga la metà)
- Commit `03d4600` (codice) e `ff71f61` (documenti): **CI e deploy Vercel verdi**
- **Prova dal telefono del titolare: funziona tutto** (prenotazioni, calendario, orari e chiusure)

**Note**

- Nessuna nuova libreria per la Fase 4 (`STRUCT.md` invariato).
- Claude può interrogare il database cloud con `npx supabase db query --linked "…"` (CLI autenticata sul
  PC di casa): utile per controlli e piccole correzioni di dati, sempre con l'ok del titolare.
- Niente notifiche ancora (Fase 5): le novità si vedono aprendo l'app.

### Sessione 13 — 2026-10-11 (PC di casa)

**Fatto**

- CI (`check` e `database`) e deploy Vercel di `7d04c0c` (fine sessione 12): verdi
- **Migrazione `20261010120000_inviti_cliente.sql` pubblicata sul cloud da Claude** con `npx supabase db
  push` (con l'ok del titolare; prima un `--dry-run`). Ora tutte e 7 le migrazioni risultano anche sul
  cloud; `info_invito` chiamata senza accesso con un codice inventato risponde `[]`. Redirect URLs già a
  posto (titolare)
- **Prove dal telefono del titolare:** A (invito come titolare), B (come cliente) e C (email diversa,
  invito annullato) **riuscite**. C3 ("Invito già usato") saltata su richiesta del titolare
- **Problema trovato nella B:** "Crea account" con un'email diversa da `albodavide1@gmail.com` →
  "Qualcosa è andato storto". Causa: Resend in prova rifiuta il destinatario, Supabase risponde 500
  `unexpected_failure` "Error sending confirmation email". Non è un bug dell'app; la B è stata completata
  creando l'account dalla dashboard con "Auto Confirm User" e poi "Accedi" dal link dell'invito
- **Correzione:** `messaggioErrore` riconosce l'email non inviata e mostra "Non riusciamo a inviarti
  l'email in questo momento…"; 2 test in `lib/auth.test.ts` (Vitest **68**). `npm run check` verde
- Aggiornati `NOTES.md` (Auth) e questo file

**Note**

- Pubblicare le migrazioni con `npx supabase db push` (CLI già autenticata sul PC di casa) invece del SQL
  Editor: così finiscono nello storico del cloud e un `db push` futuro non prova a rieseguirle.
- Claude non può leggere i log di Supabase dal PC (servirebbe estrarre il token della CLI dal Gestore
  credenziali, bloccato): per errori sul cloud chiedere al titolare *Logs → Auth* dalla dashboard.
- Non verificato se Resend in prova accetta gli alias Gmail con `+`.

### Sessione 12 — 2026-10-10 (PC di casa)

**Fatto**

- **Prove dal telefono della sessione 11 riuscite** (titolare): report del controllo, PDF, stato di salute
  dello pneumatico. Controllati da Claude CI (`check` e `database`) e deploy Vercel di `81245ec`: verdi
- **Decisioni del titolare:** link pubblico del report **non serve per ora** (basta il PDF);
  rivendicazione dei veicoli con **invito via email dall'officina**
- **Migrazione `20261010120000_inviti_cliente.sql`:** tabella `inviti_cliente` (solo lettura per i membri,
  si scrive dalle funzioni), `crea_invito_cliente`, `annulla_invito_cliente`, `info_invito` (anche senza
  accesso), `accetta_invito`. Codice casuale di 128 bit salvato solo come SHA-256, scadenza 14 giorni, un
  nuovo invito annulla i precedenti, si accetta solo con **la stessa email confermata**. Il trigger
  `proteggi_collegamento_cliente` ora lascia scrivere `profile_id` a una funzione `security definer`
- `inviti.test.sql`: 27 test pgTAP (totale **107**)
- **App:** sezione "App TyreCare" nella scheda del cliente; pagina `/cliente/invito` (email, "Scrivi
  l'email" con `mailto:`, "Condividi il link", "Copia il link"); pagina pubblica `/invito?codice=…` per il
  cliente (crea account / accedi con l'email già scritta, collega, email diversa, annullato, scaduto, già
  usato, non valido); il link di conferma della registrazione riporta alla pagina richiesta; avviso verde
  nel garage dopo il collegamento; testo nuovo del garage vuoto. `InvitoSchema` e `lib/inviti.ts` con test
  (Vitest **66**)
- Provato in Chrome headless (390 px) contro Supabase locale, con l'email di conferma vera letta da Mailpit:
  **22 verifiche verdi**. `npm run check` verde, `db:test` 107/107
- Aggiornati `NOTES.md`, `PLAN.md` (decisione e roadmap), `IMPLEMENTAZIONI.md` (invio automatico,
  scollegare, invito da "Nuovo cliente", filtro "da invitare")

**Note**

- Nessuna nuova libreria (`STRUCT.md` invariato).
- L'email d'invito parte dal programma di posta dell'officina (`mailto:`), non da TyreCare: con Resend in
  prova le email automatiche arriverebbero solo al titolare. Con l'SMTP definitivo si potrà aggiungere
  l'invio automatico.
- Il push è stato fatto **prima** della migrazione sul cloud (scelta del titolare, per fare tutto nella
  prossima sessione). Per non rompere la scheda del cliente nel frattempo, il caricamento dell'invito in
  corso ignora gli errori (`caricaInvitoInCorso(id).catch(() => null)` in `pagine/cliente.ts`).
- Commit `020a8bb` (codice), `49443f6` (documenti) e quello finale con questa nota.

### Sessione 11 — 2026-10-09 (PC di casa)

**Fatto**

- Migrazione `garage_cliente` già pubblicata sul cloud dal titolare. Prove dal telefono delle sessioni 9 e
  10 **riuscite** (titolare). Spiegato come collegare un account cliente a un cliente dell'officina dal SQL
  Editor (query con email dell'account e nome del cliente, senza copiare gli UUID)
- **Report del controllo** `/controllo?id=…` (Fase 3, PLAN §2.3): data, targa, auto e km; cruscotto di quel
  controllo; avviso sull'esito (anche "tutto in buono stato"); una carta per ruota con stato, battistrada,
  pressione, usura, danni e pneumatico; soglie spiegate; note; officina con Chiama e Indicazioni. Lo vedono
  il cliente e chi lavora nell'officina che l'ha eseguito (RLS); un'altra officina con la stessa targa no
- "Apri il report" nello storico del garage e della scheda officina; "Correggi o elimina" anche nel
  report per l'officina; "Torna al veicolo" verso il garage o la scheda dell'officina
- **Stampa o salva in PDF** con foglio di stile di stampa (nero su bianco, senza barre e pulsanti, telefono
  dell'officina, data di stampa); il titolo della pagina dà il nome al PDF. Nuovo token `$tc-grigio-stampa`
- Avviso delle ruote spostato in `ui/avviso-pneumatici.ts` (garage e report); `cruscotto()` con
  `{ ultimo: false }`; `cartaOfficina()` esportata
- Skill `ui-ux-pro-max` consultata (navigazione indietro prevedibile, carte invece di tabelle sul
  telefono; nessuna regola sulla stampa nel suo database: usate regole generali)
- Provato in Chrome headless (390 px e stampa emulata) come cliente, titolare, operatore e titolare di
  un'altra officina: **25 verifiche verdi**. `npm run check` verde (52 Vitest), `db:test` 80/80
- Aggiornati `NOTES.md`, `PLAN.md` (roadmap), `DESIGN-SYSTEM.md`, `IMPLEMENTAZIONI.md`
- Commit `9d11bf4` (codice) e `34821f5` (documenti) su `main`: **CI e deploy Vercel verdi**. Prova dal
  telefono non ancora fatta
- *Seconda parte, senza il titolare (non poteva usare il telefono):*
- **CI:** nuovo job `database` (`supabase db start` solo Postgres, `db:test`, tipi generati uguali a quelli
  nel repo); simulato in locale e **verde su GitHub** (~2 min, commit `f66f8e1`)
- **Stato di salute dello pneumatico** `/pneumatico?id=…` (PLAN §2.4): contagiri dell'ultima misura,
  grafico SVG dell'andamento con le soglie (skill `dataviz`), consumo al mese e ogni 10.000 km (retta dei
  minimi quadrati), stima di quando arriverà alla soglia, età dal DOT con avviso oltre i 5 anni, elenco
  delle misure con link ai report. Si apre toccando un contagiri del cruscotto (garage, scheda officina,
  report) o da "Stato di salute" nel report. `lib/salute.ts` con 8 test Vitest (totale 60)
- Corretto dopo gli screenshot: etichette delle soglie spostate in una legenda sotto il grafico (si
  sovrapponevano all'ultimo valore); "Oggi" → "Ultima" sotto il contagiri
- Provato in Chrome headless (390 px) con un secondo controllo aggiunto a mano al DB locale: **22 verifiche
  verdi**. `npm run check` verde, `db:test` 80/80
- Scritto in cima a questo file l'elenco completo delle prove del titolare (punto 0)
- Commit `c3b6692` (codice) e `c906c02` (documenti) su `main`: **CI (`check` e `database`) e deploy Vercel
  verdi**

**Note**

- Nessuna nuova libreria (`STRUCT.md` invariato), nessuna migrazione. Il grafico è SVG scritto a mano.
- Il seed ha un solo controllo: per vedere il grafico in locale serve un controllo più vecchio aggiunto
  dal SQL (`npm run db:reset` lo toglie).
- Il link pubblico del report è rimandato: richiede un token revocabile letto lato server, non una policy
  RLS aperta (vedi `IMPLEMENTAZIONI.md`).

### Sessione 10 — 2026-10-09 (PC di casa)

**Fatto**

- **Controllo dopo lo standby:** repo pulito e allineato, CI e Vercel della sessione 9 verdi,
  `npm run check` verde. Un test pgTAP falliva per i dati lasciati dalle prove della sessione 9 ("Smonta"
  sulla Panda) → `db:reset`, 74/74 verdi. `supabase_vector` in loop di riavvio dopo lo standby (solo log,
  non tocca l'app). Allineata con `git pull` anche la copia `Documents\GitHub\TyreCare-v2`
- **Database:** migrazione `20261009120000_garage_cliente.sql` — il cliente collegato legge anche le
  officine non attive di cui è cliente (`is_cliente_officina` + policy); 6 test pgTAP in
  `garage.test.sql` (totale 80, verdi); tipi rigenerati. **Da pubblicare sul cloud** (titolare)
- **Garage del cliente** (Fase 3): home con una carta per veicolo (stato, ultimo controllo e officina),
  veicoli **uniti per targa** tra le officine (`lib/garage.ts`, `unisciPerTarga` con 4 test Vitest, totale
  52); scheda `/garage/veicolo?targa=…` in sola lettura con cruscotto, avviso sulle ruote da sostituire,
  pneumatici montati, storico di tutte le officine e carte delle officine (Chiama, Indicazioni)
- `cruscotto()` e storico spostati in `ui/cruscotto.ts` e `ui/storico.ts`, usati da entrambe le schede
- Skill `ui-ux-pro-max` consultata (carte cliccabili, stato non solo col colore, stato vuoto)
- Provato in Chrome headless (390 px) come cliente, titolare e admin: **24 verifiche verdi**.
  `npm run check` verde
- Aggiornati `NOTES.md`, `PLAN.md` (roadmap), `DESIGN-SYSTEM.md`, `IMPLEMENTAZIONI.md`
- Commit `d4622f0` (codice) e `2a4e9a6` (documenti) su `main`: **CI e deploy Vercel verdi**. Migrazione
  **non ancora pubblicata** sul cloud; prova dal telefono non ancora fatta

**Note**

- Nessuna nuova libreria (`STRUCT.md` invariato).
- Chi lavora in un'officina vede sempre la home dell'officina, anche se è cliente di un'altra: il suo
  garage non è ancora raggiungibile (idea in `IMPLEMENTAZIONI.md`).

### Sessione 9 — 2026-10-09 (PC di casa)

**Fatto**

- Ambiente avviato (Docker, Supabase locale, `db:reset`); repo già allineato a `origin/main`
- **Elenco clienti** `/clienti`: ordine alfabetico, targhe e telefono in ogni riga, ricerca per nome,
  email, targa e telefono (solo cifre); "Nuovo cliente" che porta alla scheda del cliente creato
- **Scheda cliente** `/cliente?id=…`: contatti (Chiama/Scrivi), note, "Usa l'app TyreCare" se collegato a
  un account, veicoli con lo stato (stesse righe della home), "Nuovo veicolo" con il cliente già scelto,
  "Modifica dati del cliente". Ora si raggiungono anche i clienti senza veicoli
- **Navigazione:** voce "Clienti" nella barra in basso solo per chi lavora in officina; nella scheda del
  veicolo il nome del cliente porta alla sua scheda; modifica/eliminazione del cliente tornano alla scheda
  o all'elenco
- **Smonta pneumatici** senza sostituirli (`/veicolo/pneumatici/smonta`, "Smonta" nella scheda del
  veicolo): posizioni + data, errore sotto la data se precede il montaggio; schema
  `SmontaPneumaticiSchema` con 2 test Vitest (totale 48). Nessuna migrazione (update diretto, P2)
- Skill `ui-ux-pro-max` consultata per navigazione inferiore e righe della lista
- Provato in Chrome headless (390 px) come titolare, operatore e cliente: **37 verifiche verdi**.
  `npm run check` verde
- Aggiornati `NOTES.md`, `PLAN.md` (roadmap), `DESIGN-SYSTEM.md`, `IMPLEMENTAZIONI.md`

**Note**

- Nessuna nuova libreria (`STRUCT.md` invariato).
- Il driver di prova (`cdp.mjs`) usa Chrome headless via DevTools Protocol con il `WebSocket` di Node 24:
  va avviato con un profilo Chrome vuoto, altrimenti la sessione salvata reindirizza `/accedi` alla home.

### Sessione 8 — 2026-10-08 (PC di casa)

**Fatto**

- CI e deploy Vercel della sessione 7 verdi; ambiente avviato (Docker, Supabase locale)
- **Database:** migrazione `20261008150000_modifica_controllo.sql` con la funzione `modifica_controllo`
  (data, km, note e misure per posizione in una transazione, ripetibile); 16 nuovi test pgTAP in
  `modifiche.test.sql` (totale 74, verdi): correzione, errori senza modifiche a metà, permessi di altre
  officine e del cliente, eliminazione di controllo e cliente; tipi rigenerati
- **Correzioni (web)** dalla scheda del veicolo: modifica cliente (`/clienti/modifica`), modifica veicolo
  (`/veicolo/modifica`, targa duplicata sotto il campo), correzione di un gruppo di pneumatici
  (`/veicolo/pneumatici/modifica`, togliendo una posizione il gruppo si divide), correzione di un controllo
  (`/controllo/modifica`, anche su pneumatici ora smontati). I moduli "nuovo" e "modifica" condividono i
  campi (`campiCliente`, `campiVeicolo`, `campiPneumatico`, `campiControllo`)
- **Eliminazioni** con dialogo di conferma (`ui/conferma.ts`, `<dialog>` nativo, skill `ui-ux-pro-max`):
  cliente e veicolo solo per il TITOLARE, controllo anche per l'OPERATORE; il dialogo dice cosa si perde
- Provato in Chrome headless (390 px) con uno script DevTools come titolare, operatore e cliente: 21
  verifiche verdi. `npm run check` verde (46 test Vitest)
- Aggiornati `NOTES.md`, `PLAN.md` (P2, roadmap), `DESIGN-SYSTEM.md` (dialogo, pulsante elimina),
  `IMPLEMENTAZIONI.md`
- Commit `cf22e57` (codice) e `28c099d` (documenti) su `main`: **CI e deploy Vercel verdi**, le nuove
  schermate sono online. Migrazione pubblicata sul cloud dal titolare. **Non ancora fatta** la prova dal
  telefono

**Note**

- La copia `Documents\GitHub\TyreCare-v2` del PC di casa ora è allineata (stesso commit di inizio
  sessione), ma si lavora sempre in `C:\Users\albod\TyreCare-v2`.
- Nessuna nuova libreria (`STRUCT.md` invariato).

### Sessione 7 — 2026-10-08 (PC di casa)

**Fatto**

- CI e deploy Vercel della sessione 6 verdi; ambiente avviato (Docker, Supabase locale, `db:reset`)
- **Database:** migrazione `20261008120000_operazioni_officina.sql` con le funzioni `registra_controllo`
  (controllo + misure in una transazione, pneumatico ricavato dalla posizione) e `monta_pneumatici`
  (smonta e monta, cambio stagionale in un colpo), `security invoker`; 17 nuovi test pgTAP (totale 54,
  verdi); tipi rigenerati
- **Schemi Zod** in `packages/shared/src/officina.ts`: cliente, veicolo (targa normalizzata), montaggio
  pneumatici (DOT), controllo (decimali all'italiana, schema creato dalle ruote montate); `statoPeggiore`;
  16 nuovi test Vitest (totale 41)
- **Schermate officina** (skill `ui-ux-pro-max` per le regole di moduli, ricerca e stati vuoti): home con
  riepilogo e filtro per stato, ricerca ed elenco per urgenza; nuovo veicolo; nuovo cliente; scheda veicolo
  con cruscotto, cliente, pneumatici raggruppati e storico; monta pneumatici; nuovo controllo pensato per
  tablet e telefono (campi grandi con unità, `inputmode="decimal"`, stato della ruota in diretta, due ruote
  per riga sul tablet)
- `ui/modulo.ts`: menu a tendina, area di testo, gruppi di caselle, unità nei campi, errori del salvataggio
  sotto il campo (`ErroreModulo`); avviso di conferma comune (`vaiConConferma`)
- Provate nel browser (Chrome headless a 390 e 820 px) con i dati di prova: errori di validazione e focus,
  controllo salvato, cambio pneumatici con data incoerente, nuovo cliente → veicolo, targa duplicata,
  ricerca vuota, filtro, cliente che apre la scheda officina ("non trovato"). `npm run check` verde
- Aggiornati `NOTES.md`, `PLAN.md` (P2: funzioni SQL per le scritture su più tabelle), `DESIGN-SYSTEM.md`,
  `IMPLEMENTAZIONI.md`
- Migrazione pubblicata sul cloud (titolare); creata sul cloud l'**officina di prova** "Officina di prova
  TyreCare" (IN_ATTESA) con il titolare come TITOLARE; **prova dal telefono riuscita**
- **Bug dal telefono:** il primo salvataggio dopo qualche minuto falliva ("Qualcosa è andato storto"), il
  secondo funzionava. Causa: connessione chiusa durante la compilazione, e postgrest-js ripete da solo solo
  le letture. Correzione: le scritture si ripetono una volta dopo un errore di rete, con id scelti dal web e
  funzioni SQL che riconoscono una scrittura già arrivata (migrazione `20261008130000_scritture_ripetibili.sql`,
  `lib/rete.ts`); 4 nuovi test pgTAP (58) e 5 Vitest (46). Vedi `NOTES.md`. **Riprovato dal telefono dal
  titolare: funziona** (commit `83e1aa3`, `151faa6`; CI e Vercel verdi)

**Note**

- Sul PC di casa la copia aggiornata del repo è `C:\Users\albod\TyreCare-v2`; quella in
  `Documents\GitHub\TyreCare-v2` è vecchia (14 commit indietro): non usarla, o allinearla con `git pull`.
- Nessuna nuova libreria (`STRUCT.md` invariato). `vitest` ora è dichiarato anche in `apps/web`: il primo
  test del web (`lib/rete.test.ts`) aveva fatto fallire il deploy Vercel, perché la build del web controlla i
  tipi di tutto `src/` e Vercel installa solo le dipendenze del workspace. **Regola:** ogni pacchetto usato
  in un workspace va dichiarato nel suo `package.json`, anche se c'è già nella root.

### Sessione 6 — 2026-10-07 (PC di casa, breve)

**Fatto**

- Errore "Non riusciamo a caricare i tuoi dati" sul sito online: **risolto** per il titolare rifacendo
  l'accesso (era la sessione salvata non più valida dopo i cambi di password)
- Miglioramento: se il caricamento dei dati fallisce per una sessione non valida (`PGRST301`/`PGRST303`,
  profilo assente `PGRST116`, errori Auth 401/`bad_jwt`/`session_not_found`), l'app esce e torna ad
  `/accedi` invece di mostrare l'errore generico (`sessioneNonValida` in `lib/profilo.ts`,
  `gestisciErroreCaricamento` in `pagine/comune.ts`). `npm run check` verde; non provato nell'app


### Sessione 5 — 2026-10-07 (PC di casa)

**Fatto**

- **Profilo (C):** pagine `/profilo/dati` (nome, cognome, telefono) e `/profilo/password` (password attuale +
  nuova), sezione "Account" nel Profilo, avviso verde dopo il salvataggio; schemi Zod
  `ModificaProfiloSchema` e `CambioPasswordSchema` con test. Provato contro Supabase locale: salvataggio,
  telefono non valido rifiutato, profilo altrui bloccato dalla RLS, password attuale errata riconosciuta
- **Email (B, parte locale):** 4 template in italiano nello stile del design, provati su Mailpit con
  screenshot
- Risolto il blocco delle porte di Supabase su Windows (vedi Promemoria permanenti)
- **Configurazione online (A):** Site URL e Redirect URLs, password minima 8, SMTP con Resend in prova,
  4 template copiati nel cloud
- **Colore del marchio (D):** nuova variabile `--tc-brand` (rosso `#e10600`) per marchio, fanali, pallini
  di navigazione e notifica; il corallo resta solo per stati ed errori. Approvato dal titolare
- **Logo definitivo (D):** contagiri con zona rossa e lancetta rossa, scelto dal titolare tra 3 varianti;
  icone PWA rigenerate con sfondo nero (prima il generatore aggiungeva un bordo bianco)
- **Prova completa dal telefono sul sito Vercel superata** (commit `41ef3eb`, CI verde)
- **Fase 1 chiusa** (PLAN.md aggiornato). Rimandati: SMTP col dominio dell'officina, rifinitura dell'auto
- **Fase 2 iniziata — database:** migrazione `20261007120000_dati.sql` con `clienti_officina`, `veicoli`,
  `pneumatici`, `controlli`, `misure_pneumatico`, RLS e trigger; **decisione del titolare: veicoli per
  officina** (niente `veicoli_officina`, vedi PLAN P12); seed con seconda officina e titolare
  (`titolare2@tyrecare.test`); 20 nuovi test pgTAP (totale 37, verdi); tipi rigenerati; enum Zod
  `PosizioneSchema` e `UsuraSchema` con test di allineamento al database. **Pubblicata sul cloud** con `db push` dal titolare

**Note**

- Gmail mette in Spam le email da `onboarding@resend.dev` e lì disattiva i link: segnarle come "non spam".
- Se l'app è installata sul telefono, la nuova icona compare solo dopo averla rimossa e aggiunta di nuovo.
- `supabase start` dopo un riavvio di Docker può lasciare i container senza porte pubblicate:
  `npx.cmd supabase stop` e poi di nuovo `start`.


### Sessione 4 — 2026-10-06 (PC di casa)

**Fatto**

- **Ambiente sul PC di casa:** Node 24.19 di sistema (fnm non serve), `npm install` + `npm run check` verdi,
  Docker 29.8 → **Supabase locale avviato**; creati `apps/web/.env` (chiavi demo locali) e `apps/api/.env`
- **Prima migrazione** `supabase/migrations/20261006120000_fondamenta.sql`: tabelle `profiles`, `officine`,
  `officina_utenti` (TITOLARE/OPERATORE), enum, funzioni dei ruoli `security definer`, policy RLS, trigger
  (creazione profilo alla registrazione, campi riservati solo ADMIN, almeno un titolare per officina)
- `supabase/seed.sql`: 4 utenti di prova (password `password123`) e 2 officine; login verificato via API
- **Test pgTAP** `supabase/tests/database/fondamenta.test.sql`: 17 test sulle policy per ogni ruolo, tutti
  verdi (hanno trovato un bug nel trigger dei campi riservati, corretto)
- Tipi del database generati in `packages/shared/src/database.types.ts`, client Supabase del web tipizzato;
  test che verifica l'allineamento enum Zod ↔ database
- Script npm `db:start`, `db:reset`, `db:test`, `db:types`
- Titolare: token Supabase CLI rinnovato, login + link, **migrazione pubblicata sul cloud** con `db push`
  (commit `81bfabd`)
- **Auth (web):** router lato client senza librerie, pagine accedi / registrati / password dimenticata /
  nuova password / home / profilo con "Esci" / 404; `/anteprima` resta come riferimento del design.
  Moduli accessibili (skill `ui-ux-pro-max`) con schemi Zod condivisi in `packages/shared/src/auth.ts`
- **Auth (API):** verifica dei JWT di Supabase con `jose` e le chiavi pubbliche JWKS; rotte protette in un
  plugin Fastify; `GET /me`. 7 test (token valido, assente, scaduto, altro emittente/destinatario/chiave)
- `supabase/config.toml`: site URL `http://localhost:5173`, conferma email attiva, password minima 8
- Verificato in locale: `/me` con token reale, registrazione → email di conferma su Mailpit → profilo creato
  dal trigger; screenshot delle pagine con Edge headless
- Aggiornati `NOTES.md`, `STRUCT.md`, `PLAN.md`

**Note**

- Il token Supabase CLI per il cloud **non** serve per lavorare in locale: serve solo per `link`/`db push`.
- Link delle email aperti su iPhone → errore `NSURLErrorDomain`: puntavano a `localhost` perché nel progetto
  cloud il Site URL non era ancora impostato (Supabase ignora i redirect non in elenco e usa il Site URL).
- Creare un account senza email: dashboard → *Authentication → Users → Add user → Create new user* con
  "Auto Confirm User"; nome, cognome e ruolo si impostano con un `update public.profiles` dal SQL Editor.
- Anche sul PC di casa PowerShell blocca gli script `.ps1`: in un terminale normale usare `npx.cmd`/`npm.cmd`
  (oppure `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`).
- Ruolo globale e stato di affiliazione li cambia solo un ADMIN (o il backend con service role): decisione
  coerente con P2 (operazioni sensibili lato server).

### Sessione 3 — 2026-10-06 (PC scolastico)

**Fatto**

- **Ambiente sul PC scolastico** (vedi Promemoria permanenti):
  - GitHub CLI portable (installazione MSI bloccata senza permessi di amministratore) + `gh auth login`
    (account `DALBO-creator`) + `gh auth setup-git`
  - Node di sistema è v22 → installato **fnm** per l'utente con Node 24.21
  - `npm install`, `npm run check` verde; Python 3.13 presente
  - WSL 2 e Docker 28.1 funzionanti; condivisa la cartella `Documents\GitHub` in Docker Desktop;
    **Supabase locale avviato**
  - `apps/web/.env` e `apps/api/.env` creati (puntano a Supabase locale)
  - Skill `ui-ux-pro-max` reinstallata
- **Fase 1 — design system** ([`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md)):
  - palette navy + blu per le azioni; verde/ambra/rosso riservati allo stato degli pneumatici, contrasti
    verificati (tutti ≥ 4.5:1, chiaro e scuro); scartata la prima proposta della skill (rosso come colore
    delle azioni, stile da landing page)
  - font Lexend + Source Sans 3 inclusi nell'app (offline, GDPR); icone Lucide
  - Bootstrap importato via Sass in modo selettivo (`apps/web/src/styles/`), tema scuro automatico
  - componenti: barra superiore, navigazione inferiore, badge di stato, scheda pneumatico con misuratore
    del battistrada; pagina di anteprima `src/anteprima.ts`
  - `theme-color` della PWA → navy `#0f172a`; font latini nella precache del service worker
- **Design system v2** su richiesta del titolare: interfaccia **premium rosso e nera**, tema sempre scuro,
  font Outfit + Inter, rosso brand `#E10600` per le azioni e rosso corallo `#FF6B6B` (con ottagono) per lo
  stato "da sostituire"; nuovi componenti scheda veicolo, targa, avviso di stato, etichette di sezione.
  Verificato con screenshot headless di Edge (Chrome headless è bloccato sul PC scolastico)
- **Design system v3** (la v2 è stata giudicata "spoglia, non premium"): direzione **cruscotto sportivo**
  con riferimento **My Porsche** scelta dal titolare. Auto vista dall'alto in SVG con ruote illuminate del
  colore dello stato, indicatori a contagiri per ogni ruota, solo font Inter, liste "di lusso", hero con
  modello in grande, animazioni d'ingresso. Corretto un bug di layout (area di griglia chiamata `auto`).
  **Approvato dal titolare** dopo averlo visto dal telefono su Vercel
- Commit su `main` (CI verde, deploy Vercel riuscito su https://tyre-care-v2.vercel.app):
  `cca8174` design system v1, `5a70057` NEXT, `5e8027c` design system v3
- Aggiornati `NOTES.md`, `STRUCT.md` (anche righe Supabase/Vercel ferme alla sessione 1), `PLAN.md`

**Note**

- Avvisi di deprecazione Sass di Bootstrap 5.3 silenziati in `vite.config.ts` (spariranno con Bootstrap 6).
- Il bundle JS include Zod tramite `@tyrecare/shared` (~17 kB gzip): voluto.
- La v2 non è mai stata pubblicata (sostituita dalla v3 prima del commit).
- Lezione sul design: per "premium" non basta ricolorare Bootstrap; serve un **elemento protagonista**
  (qui l'auto + contagiri) e una tipografia con forti contrasti di dimensione. Chiedere subito riferimenti
  visivi al titolare (es. app che considera premium) prima di disegnare.

### Sessione 2 — 2026-10-06

**Fatto**

- Accettate tutte le proposte P1–P19 di `PLAN.md`
- **Fase 0 (codice):**
  - monorepo npm workspaces: `apps/web`, `apps/api`, `packages/shared`
  - TypeScript ovunque, configurazione comune in `tsconfig.base.json`
  - ESLint (flat config + typescript-eslint) e Prettier, EditorConfig
  - Vitest con un project per workspace — 4 test passano
  - `apps/web`: Vite + Bootstrap 5 + vite-plugin-pwa (manifest, service worker, icone generate da `logo.svg`)
    + client Supabase
  - `apps/api`: Fastify con `GET /health`, validazione env con Zod, build con tsup (verificato avvio reale)
  - `packages/shared`: ruoli, stagioni, soglie battistrada e funzione `statoBattistrada`
  - Supabase CLI installata e `supabase/config.toml` creato
  - CI GitHub Actions: formattazione, lint, tipi, test, build
- CI: azioni aggiornate a `@v7`; `.gitattributes` forza fine riga LF
- **Vercel:** `apps/web/vercel.json` (header di cache per service worker e manifest); build fallita per `tsc`
  non trovato → corretta dichiarando `typescript` in ogni workspace (Vercel installa solo le dipendenze del
  workspace). PWA online su https://tyre-care-v2.vercel.app (gli URL dei singoli deploy sono protetti da login)
- **Supabase:** CLI autenticata con token, repo collegato al progetto `boqksbqcqulrtmyshhxe` (eu-west-1)
- **Docker:** Docker Desktop installato ma senza WSL → avviata installazione WSL e riavvio
- Aggiornati `STRUCT.md`, `NOTES.md`, `PLAN.md`

**Note**

- `npm run check` esegue in locale gli stessi controlli della CI.
- Il logo in `apps/web/public/logo.svg` è provvisorio: verrà sostituito in Fase 1.
- La build web impiega ~1 minuto per la generazione del service worker (lento su Windows, non è un errore).

### Sessione 1 — 2026-10-05

**Fatto**

- Installata e configurata GitHub CLI, clonato il repo `TyreCare-v2`
- Installata la skill `ui-ux-pro-max` (plugin Claude Code)
- Creata la cartella `DOCS/` con: `PLAN.md`, `NEXT.md`, `NOTES.md`, `STRUCT.md`,
  `PRODUZIONE-MARKETING.md`, `IMPLEMENTAZIONI.md`, `LICENSE.md`, `first-prompt.md`
- `PLAN.md`: inserita la struttura ideata (Parte A) + 19 proposte di modifica (Parte B) + roadmap
- Creato `CLAUDE.md` nella root con le regole di lavoro sui documenti

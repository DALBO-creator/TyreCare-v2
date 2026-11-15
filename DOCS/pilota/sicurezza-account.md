# Sicurezza degli account: regole delle password in produzione

Pagina per Davide. Le regole delle password si impostano **una volta sola**, nel progetto Supabase **di
produzione**, prima di invitare il titolare di LA SANTI GOMME. Si rivedono solo se cambiano le regole
dell'app (vedi "Se cambia la lunghezza minima"). Il file `supabase/config.toml` vale solo per il database
locale: in produzione non ha effetto, i valori si impostano dal pannello.

Stato: **da impostare nel pannello** (non risulta fatto: controlla nel pannello i valori attuali).

## Una volta sola: impostazioni nel pannello

Apri il progetto di produzione e vai alle impostazioni di autenticazione del progetto (controlla il nome
esatto nella pagina di Supabase: i nomi e i percorsi cambiano). Cerca le opzioni sulle password.

1. **Lunghezza minima della password: 8.** Deve essere uguale a quella dell'app (`PASSWORD_MIN = 8` in
   `packages/shared/src/auth.ts`). Il valore locale di `minimum_password_length` è già 8.
2. **Requisiti dei caratteri: lettere e numeri** (oggi in locale `password_requirements` è vuoto, cioè
   nessun requisito). Scegli l'opzione che richiede almeno una lettera e un numero.
3. **Protezione dalle password trapelate** (controllo contro elenchi di password note): attivala se la
   trovi. Potrebbe dipendere dal piano Supabase del progetto: da controllare; se non è disponibile,
   annotalo qui sotto e vai avanti.
4. **Riautenticazione per il cambio password** (`secure_password_change`, in locale `false`): attivala
   se la trovi. Con l'opzione attiva, chi cambia la password dopo molto tempo dall'accesso deve prima
   confermare la sua identità. Controlla poi che il cambio password dell'app (Profilo) funzioni ancora
   (vedi "Come verificare").
5. Salva e, se il pannello lo chiede, conferma.

## Se cambia la lunghezza minima

Se decidi una lunghezza diversa da 8, chiedi agli agenti un compito che allinei `PASSWORD_MIN` in
`packages/shared/src/auth.ts` e il messaggio dell'app, **prima o insieme** al cambio nel pannello. Se i due
valori differiscono, l'utente vede l'errore di Supabase al posto di quello chiaro dell'app.

## Da verificare: i messaggi dell'app

L'app controlla in anticipo solo la lunghezza (da 8 a 72 caratteri). I requisiti «lettere e numeri» li
controlla solo Supabase. Nel codice (`apps/web/src/lib/auth.ts`) il codice di errore `weak_password` è già
tradotto in «Password troppo debole: scegline una più lunga o meno comune.», che però non dice che servono
lettere e numeri. Il codice non è stato cambiato: è un compito per gli agenti (messaggio che nomini i requisiti,
o controllo anticipato nel modulo). Prima del compito, prova a mano come sotto e guarda cosa compare.

## Come verificare

Con le impostazioni già salvate:

1. Apri l'app pubblicata e prova a registrare un account di prova (email tua, non di un cliente).
2. Prova una password di 8 caratteri solo lettere, poi una solo numeri: devono essere rifiutate.
3. Prova una password nota e banale (es. «password1»): se la protezione dalle password trapelate è attiva,
   deve essere rifiutata.
4. Prova una password valida (lettere e numeri, 8 o più caratteri): la registrazione riesce.
5. Annota il messaggio mostrato ai punti 2-3: se è poco chiaro, segnalalo agli agenti (sopra).
6. Dall'account di prova prova «cambia password» dal Profilo. Poi elimina l'account di prova.

Nota: gli account creati dal pannello ("Add user", vedi [`crea-officina.md`](crea-officina.md)) usano una
password provvisoria che scegli tu: usa comunque una password che rispetti le stesse regole.

## Autenticazione a due fattori: perché resta per dopo (R39)

Nel pilota **non** c'è la 2FA. Servirebbero le pagine di iscrizione e di verifica del codice (TOTP) e
l'accensione in `supabase/config.toml` (`[auth.mfa.totp]`, oggi `enroll_enabled = false` e
`verify_enabled = false`): file in zona vietata agli agenti. Si è scelto di rimandarla dopo il pilota
(decisione R39) e di compensare con le regole sulle password sopra.

Quando servirà (dopo il pilota):

1. Davide accende `[auth.mfa.totp]` e la stessa opzione nel pannello del progetto di produzione.
2. Gli agenti ricevono un compito per le pagine di iscrizione e verifica (autenticazione: modello opus),
   da imporre ai titolari e agli admin.

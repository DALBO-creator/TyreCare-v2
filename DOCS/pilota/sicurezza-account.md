# Sicurezza degli account: regole delle password in produzione

Pagina per Davide. Le regole delle password si impostano **una volta sola**, nel progetto Supabase **di
produzione**, prima di invitare il titolare di LA SANTI GOMME. Si rivedono solo se cambiano le regole
dell'app (vedi "Se cambia la lunghezza minima"). Il file `supabase/config.toml` vale solo per il database
locale: in produzione non ha effetto, i valori si impostano dal pannello.

Stato: **da impostare nel pannello** (non risulta fatto: controlla nel pannello i valori attuali).

## Una volta sola: impostazioni nel pannello

Apri il progetto di produzione e vai alle impostazioni di autenticazione del progetto (controlla il nome
esatto nella pagina di Supabase: i nomi e i percorsi cambiano). Cerca le opzioni sulle password.

1. **Lunghezza minima della password: 10.** Deve essere uguale a quella dell'app (`PASSWORD_MIN = 10` in
   `packages/shared/src/auth.ts`, dal 2026-11-16). Il valore locale di `minimum_password_length` è già 10.
2. **Requisiti dei caratteri: lettere minuscole, maiuscole e numeri** (`lower_upper_letters_digits`, come
   in locale). L'app controlla la stessa regola prima di inviare il modulo.
3. **Protezione dalle password trapelate** (controllo contro elenchi di password note): attivala se la
   trovi. Potrebbe dipendere dal piano Supabase del progetto: da controllare; se non è disponibile,
   annotalo qui sotto e vai avanti.
4. **Riautenticazione per il cambio password** (`secure_password_change`, in locale `false`): attivala
   se la trovi. Con l'opzione attiva, chi cambia la password dopo molto tempo dall'accesso deve prima
   confermare la sua identità. Controlla poi che il cambio password dell'app (Profilo) funzioni ancora
   (vedi "Come verificare").
5. Salva e, se il pannello lo chiede, conferma.

## Se cambia la lunghezza minima

Se decidi una lunghezza diversa da 10, chiedi agli agenti un compito che allinei `PASSWORD_MIN` in
`packages/shared/src/auth.ts` e il messaggio dell'app, **prima o insieme** al cambio nel pannello. Se i due
valori differiscono, l'utente vede l'errore di Supabase al posto di quello chiaro dell'app.

## Da verificare: i messaggi dell'app

Dal 2026-11-16 l'app controlla in anticipo lunghezza (da 10 a 72 caratteri) e caratteri (maiuscola,
minuscola, numero) e mostra questi messaggi (testi in `packages/shared/src/auth.ts`):

- password troppo corta: «La password deve avere almeno 10 caratteri»;
- senza maiuscola, minuscola o numero: «La password deve avere almeno una maiuscola, una minuscola e un
  numero»;
- password che l'app accetta ma Supabase rifiuta (per esempio una password molto comune): «Password troppo
  debole: usa almeno 10 caratteri, con una maiuscola, una minuscola e un numero, ed evita le password più
  comuni.» (codice `weak_password`, in `apps/web/src/lib/auth.ts`).

Il messaggio di Supabase compare quindi solo se il pannello è più severo dell'app.

## Come verificare

Con le impostazioni già salvate:

1. Apri l'app pubblicata e prova a registrare un account di prova (email tua, non di un cliente).
2. Prova una password di 10 caratteri solo lettere minuscole, poi una con maiuscole e minuscole ma senza
   numeri: devono essere rifiutate.
3. Prova una password nota e banale (es. «password1»): se la protezione dalle password trapelate è attiva,
   deve essere rifiutata.
4. Prova una password valida (di almeno 10 caratteri con maiuscola, minuscola e numero): la registrazione
   riesce.
5. Annota il messaggio mostrato ai punti 2-3 e confrontalo con quelli sopra: se è diverso o poco chiaro,
   segnalalo agli agenti.
6. Dall'account di prova prova «cambia password» dal Profilo. Poi elimina l'account di prova.

Nota: gli account creati dal pannello ("Add user", vedi [`crea-officina.md`](crea-officina.md)) usano una
password provvisoria che scegli tu: usa comunque una password che rispetti le stesse regole.

## Autenticazione a due fattori

**Fatta il 2026-11-16** (supera R39): ogni account può attivarla da Profilo → «Verifica in due passaggi»;
per l'amministratore è obbligatoria. Impostazioni del cloud e dettagli in [`../SICUREZZA.md`](../SICUREZZA.md).

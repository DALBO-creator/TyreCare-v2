# Creare l'officina del pilota e dare l'accesso al titolare

Pagina per Davide. Si usa una volta per ogni officina del pilota (LA SANTI GOMME). Le azioni si fanno nel
progetto Supabase **di produzione**. Nel file ci sono solo segnaposto: scrivi i dati veri solo nell'editor,
mai in un file del progetto.

Segnaposto: `<ragione sociale>`, `<partita IVA, 11 cifre>`, `<email del titolare>`,
`<password provvisoria>`.

## 1. Crea l'account del titolare

Supabase → progetto di produzione → **Authentication → Users → "Add user" → "Create new user"**.

- Email: `<email del titolare>`.
- Password: `<password provvisoria>` (almeno 10 caratteri, con una maiuscola, una minuscola
  e un numero; scegline una nuova ogni volta).
- Spunta **"Auto Confirm User"**. Serve perché, finché il dominio di TyreCare (P23) non è pronto, le email
  di conferma arrivano solo a Davide: senza la spunta il titolare non riceverebbe mai il messaggio.

## 2. Crea l'officina

**SQL Editor** → incolla ed esegui:

```sql
select public.crea_officina_con_titolare(
  '<ragione sociale>', '<partita IVA, 11 cifre>', '<email del titolare>'
);
```

Torna l'identificativo dell'officina: annotalo (serve al punto 4). L'officina nasce `IN_ATTESA` e il titolare
la usa già; i clienti la vedranno solo dopo il punto 4. Se compare un errore:

- `ACCOUNT_NON_TROVATO`: l'email non corrisponde a nessun account. Controlla di averla scritta uguale al
  punto 1 (maiuscole e minuscole non contano) e che il punto 1 sia finito.
- `PARTITA_IVA_GIA_PRESENTE`: esiste già un'officina con quella partita IVA. Non ripetere il comando:
  verifica in **Table Editor → officine** se è già quella giusta.

## 3. Dai l'accesso al titolare

Comunica `<email del titolare>` e `<password provvisoria>` **di persona o al telefono, mai nella stessa
email** (né con lo stesso messaggio). Consegna anche la guida di avvio (`DOCS/pilota/guida-avvio.md`): il
passo 1 gli dice di cambiare la password e completare nome e cognome.

## 4. Dopo la firma del DPA: rendi l'officina visibile ai clienti

Prima di caricare dati veri serve l'accordo sul trattamento dei dati (`DOCS/legale/dpa-officine.md`) firmato.
Poi, nell'SQL Editor:

```sql
update public.officine set stato_affiliazione = 'ATTIVA' where id = '<identificativo del punto 2>';
```

## 5. Se il pilota non parte

Non cancellare niente da solo. Se l'officina o l'account vanno tolti, fallo insieme a chi segue il progetto
(Claude): serve decidere cosa fare dei dati già inseriti.

## 6. Il titolare dimentica la password

Finché non c'è il dominio (R3) le email di recupero arrivano solo a Davide, quindi il titolare non può
rifarla da solo. Nell'SQL Editor:

```sql
update auth.users
set encrypted_password =
  extensions.crypt('<password provvisoria nuova>', extensions.gen_salt('bf'))
where lower(email) = lower('<email del titolare>');
```

Poi comunicala come al punto 3. Il titolare la cambia da **Profilo → Cambia password**.

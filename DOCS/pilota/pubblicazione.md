# Pubblicare gli aggiornamenti in produzione (database e funzioni)

> Pagina per Davide (voce D10 della [lista di lancio](lista-lancio.md)). Tempo: 5-10 minuti. Nessun dato
> reale qui: `<ref>` è il codice del tuo progetto Supabase (Project Settings -> General -> Reference ID).

**Perché serve.** Vercel pubblica da solo il codice dell'app dopo ogni treno unito; il database e le
funzioni di Supabase invece no: li pubblichi tu. Se li dimentichi, l'app nuova cerca tabelle e funzioni che
nel cloud non ci sono e compaiono errori come «Qualcosa è andato storto». Gli agenti non possono farlo.

## 1. Quando farla

Dopo ogni treno unito che aggiunge file in `supabase/migrations/` o in `supabase/functions/`. Per vederlo,
dalla cartella del repository:

```powershell
git fetch origin
git diff --stat <ultimo-pubblicato>..origin/main -- supabase/
```

`<ultimo-pubblicato>` è lo sha dell'ultima riga della tabella «Pubblicazioni fatte» in fondo a questa
pagina. Se il comando non scrive niente, non c'è niente da pubblicare. Se elenca file, fai i passi 2-6.
Se la tabella è vuota (prima volta), salta questo controllo e fai i passi 2-6.

## 2. Prerequisiti

Ogni volta:

```powershell
git checkout main
git pull
npm ci
```

Una volta sola:

```powershell
npx supabase login
npx supabase link --project-ref <ref>
```

`login` apre il browser per il token; `link` chiede la password del database (quella scelta alla creazione
del progetto; se non la ricordi, si cambia da Supabase -> Project Settings -> Database). Se il PC è già
collegato, salta i passi `login` e `link`. Attenzione: `<ref>` deve essere il progetto **di produzione**.

## 3. Il database (migrazioni)

```powershell
npx supabase migration list          # colonna "Remote" vuota = migrazione che manca sul cloud
npx supabase db push --dry-run       # elenca cosa verrebbe applicato, senza toccare niente
npx supabase db push                 # le applica, in ordine, e chiede conferma
```

Leggi l'elenco del `--dry-run`: deve contenere solo migrazioni nuove (quelle di `git diff`). Se elenca
cose che non ti aspetti, fermati e passa l'elenco agli agenti.

## 4. La funzione `invia-notifica`

```powershell
npx supabase functions deploy invia-notifica --no-verify-jwt
```

Va con `--no-verify-jwt` perché la chiama il database con un segreto suo (`x-segreto`), non un utente
loggato: è lo stesso valore `verify_jwt = false` di `supabase/config.toml`. I segreti della funzione (email
di riserva: `EMAIL_NOTIFICHE`, ecc.) restano com'erano: non vanno reimpostati a ogni pubblicazione.

## 5. Le funzioni Stripe (solo dopo D8)

Falle solo quando hai finito [`stripe-prova.md`](stripe-prova.md) (voce D8): prima non servono.

```powershell
npx supabase functions deploy stripe-checkout
npx supabase functions deploy stripe-portale
npx supabase functions deploy stripe-webhook --no-verify-jwt
```

Il webhook ha `--no-verify-jwt` perché Stripe non manda il JWT di Supabase (la sicurezza è la firma
`whsec_…`); le altre due verificano l'utente loggato.

## 6. Controllo finale

- **Pagina admin "Officine"**: il riquadro del database mostra «Database aggiornato» (arriverà con T247).
- **Finché T247 non c'è**, in alternativa uno di questi due:
  - `npx supabase migration list`: nessuna riga con "Remote" vuota;
  - SQL Editor di Supabase: `select max(version) from supabase_migrations.schema_migrations;` deve dare il
    numero all'inizio del nome dell'ultimo file in `supabase/migrations/` (per esempio
    `20261108000200` per `20261108000200_monitoraggio.sql`).
- Poi aggiungi una riga alla tabella qui sotto e salva la modifica nel repository (commit e push su
  `main`, o con una PR): altrimenti il passo 1 della volta dopo non trova lo sha.

## Se il push si ferma con un errore

Non insistere e **non correggere lo schema a mano** (né dal SQL Editor né con altri comandi): il database
cloud resterebbe diverso da quello dei test. Copia il messaggio intero, annota quale migrazione si è
fermata e passalo agli agenti: preparano una migrazione nuova che lo sistema. Le migrazioni già applicate
prima dell'errore restano; `migration list` ti dice fin dove è arrivato.

## Mai `db reset` sul progetto di produzione

`db reset` **cancella tutto il database**. Va usato solo sul database locale (provare il ripristino delle
copie di sicurezza, [`copie-di-sicurezza.md`](copie-di-sicurezza.md)). In produzione non serve mai.

## Pubblicazioni fatte

| Data | sha di `origin/main` pubblicato | Note |
|---|---|---|
| | | |

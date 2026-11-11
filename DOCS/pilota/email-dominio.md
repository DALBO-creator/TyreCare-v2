# Dominio ed email di TyreCare (Resend e Supabase)

> Pagina per Davide (voce D3 della [lista di lancio](lista-lancio.md)). Tempo: 30-60 minuti, più l'attesa
> dei DNS (da pochi minuti a qualche ora). Nessun dato reale qui: `<dominio>` è il dominio che hai scelto
> (per esempio `tyrecare.it`, se libero), `<ref>` è il codice del progetto Supabase.

**Perché serve.** Finché Resend è in prova, le email (conferma, «password dimenticata», inviti, notifiche
di riserva) arrivano solo a te. Con il dominio verificato partono da `noreply@<dominio>` verso chiunque
(decisione P23). Gli agenti non possono farlo: servono il tuo account sul sito del dominio, su Resend e su
Supabase.

**Cosa non è verificabile da qui.** Le schermate di Resend, di Supabase e del sito dove hai comprato il
dominio cambiano nel tempo. Dove un nome o un valore viene da loro, trovi «controlla nella pagina di …»:
fidati di quello che vedi lì, non di questa pagina. Se una schermata non combacia, fermati e scrivilo agli
agenti.

## 1. Quando farla

Una volta, quando hai comprato il dominio (D3) e vuoi che le email arrivino a tutti. Prima non serve:
l'app funziona già, con le email limitate a te.

## 2. Prima di cominciare

Una volta sola:

- il dominio è tuo e sai entrare nel suo pannello DNS (il sito dove l'hai comprato);
- hai un account su resend.com (gratuito per cominciare: controlla nella pagina dei prezzi di Resend);
- il Supabase CLI è collegato al progetto **di produzione**, come per
  [`pubblicazione.md`](pubblicazione.md): `npx supabase login` e `npx supabase link --project-ref <ref>`.

Scrivi le chiavi solo nel terminale e nelle pagine di Resend e Supabase, mai in un file del progetto.

## 3. Aggiungere il dominio in Resend (una volta sola)

1. Su Resend apri **Domains** e premi **Add Domain** (controlla nella pagina di Resend il nome esatto
   dei pulsanti). Scrivi `<dominio>` e scegli la regione che propone come predefinita.
2. Resend mostra una tabella di **record DNS** (tipo, nome, valore). Non li ho scritti qui perché sono
   generati per il tuo dominio: **copia quelli che Resend ti mostra**, uno per uno.
3. Nel pannello DNS del sito dove hai comprato il dominio aggiungi ogni record con lo stesso tipo, nome e
   valore. Controlla nella pagina del tuo fornitore come si aggiunge un record; se chiede il nome senza il
   dominio, o con il dominio, segui l'esempio che mostra il fornitore stesso.
4. Torna su Resend e premi il pulsante di verifica (controlla nella pagina di Resend come si chiama).
   Aspetta che il dominio passi a **Verified**. Se resta in attesa, riprova dopo qualche ora; se dopo un
   giorno non cambia, ricontrolla i record uno per uno e poi scrivi agli agenti cosa vedi.

Non proseguire finché non vedi **Verified**: senza, Resend non spedisce a indirizzi qualsiasi.

## 4. Creare la chiave API (una volta sola)

1. Su Resend apri **API Keys** e crea una chiave (controlla nella pagina di Resend i permessi che offre:
   basta quello di invio, limitato al tuo dominio se lo propone).
2. Copiala subito: Resend la mostra una volta sola. Tienila nel gestore di password. Qui sotto è
   `<chiave-resend>`.

## 5. Le email di accesso: SMTP di Supabase (una volta sola)

Sono le email di conferma, «password dimenticata» e inviti: le spedisce Supabase, che deve usare Resend.

1. Su Supabase apri il progetto **di produzione**, **Authentication** e la pagina **SMTP Settings**
   (controlla nella pagina di Supabase dove si trova: a volte sta sotto **Emails**).
2. Attiva l'SMTP personalizzato e scrivi:

   | Campo | Valore |
   |---|---|
   | Host | `smtp.resend.com` |
   | Porta | `465` |
   | Utente | `resend` |
   | Password | `<chiave-resend>` (la chiave API del passo 4) |
   | Indirizzo mittente | `noreply@<dominio>` |
   | Nome mittente | `TyreCare` |

   Se Supabase chiede altri campi (per esempio l'intervallo minimo tra due email), lascia il valore
   proposto. I valori di Resend (host, porta, utente) vengono dalla documentazione di Resend: **controlla
   nella pagina di Resend** («SMTP») che siano ancora quelli.
3. Salva. Un altro indirizzo dello stesso dominio verificato (per esempio `notifiche@<dominio>`) va bene
   uguale: l'importante è che il dominio sia quello verificato.

## 6. Site URL e Redirect URLs (una volta sola)

Su Supabase, **Authentication** e **URL Configuration** (controlla nella pagina di Supabase il nome
esatto):

- **Site URL**: `https://<dominio>`
- **Redirect URLs**: aggiungi `https://<dominio>/**`. Il carattere jolly copre le due pagine a cui l'app
  riporta l'utente: `/nuova-password` (dopo «password dimenticata») e il ritorno dopo la conferma
  dell'account o dell'invito (`emailRedirectTo`, che punta alla pagina richiesta). Nel repository non c'è
  un elenco di indirizzi precisi da riusare: l'unico riferimento è `supabase/config.toml`, che per l'uso
  locale usa lo stesso schema (`http://localhost:5173/**`).
- Se il sito oggi è raggiungibile anche su un indirizzo `*.vercel.app` e vuoi che continui a funzionare,
  lascia anche il suo Redirect URL; si toglie quando il dominio è definitivo.

Il dominio vero deve prima puntare al sito su Vercel (Settings -> Domains del progetto, controlla nella
pagina di Vercel i record da copiare, come al passo 3). Se non è ancora fatto, fallo prima di questo passo.

## 7. Le email di riserva delle notifiche (una volta sola)

Sono le email che la funzione `invia-notifica` spedisce quando un cliente non ha un dispositivo con le
notifiche push. Dal terminale, nella cartella del repository:

```powershell
npx supabase secrets set EMAIL_NOTIFICHE=si RESEND_API_KEY=<chiave-resend> EMAIL_MITTENTE="TyreCare <noreply@<dominio>>" SITO_URL=https://<dominio>
```

- `EMAIL_NOTIFICHE=si` accende la funzione; senza, il comportamento resta quello di prima.
- `EMAIL_MITTENTE` deve usare il dominio verificato al passo 3.
- `SITO_URL` senza barra finale: serve per i link dentro le email.
- Non serve ripubblicare la funzione ([`pubblicazione.md`](pubblicazione.md)): i segreti valgono subito.
  Se cambi dominio o chiave, ripeti solo questo comando.

## 8. Le prove (una volta sola, dopo i passi 3-7)

1. **Password dimenticata verso un indirizzo diverso dal tuo.** Nel sito pubblicato, «Password dimenticata»
   con un indirizzo diverso da quello del tuo account Resend (un'altra persona o un tuo secondo
   indirizzo). L'email deve arrivare; con il dominio non verificato, o in prova, non arriverebbe.
2. **Spam.** Guarda se l'email sta nella posta in arrivo o nello Spam. Se è nello Spam, segnala «Non è
   spam» e, se capita anche con altri indirizzi, scrivi agli agenti il fornitore della posta (Gmail,
   ecc.): di solito si sistema controllando i record del passo 3 nella pagina di Resend.
3. **Notifica con un telefono senza push.** Con un account cliente di prova che non ha attivato le
   notifiche (nessun dispositivo), fai generare una notifica (per esempio un promemoria o un messaggio
   dell'officina di prova). L'email deve arrivare con oggetto `TyreCare · <titolo>` e il pulsante «Apri
   TyreCare» deve portare al sito sul dominio.

Se una prova fallisce, non cambiare altro: copia l'errore o descrivi cosa vedi, e passalo agli agenti.

## 9. Cosa dire agli agenti dopo

Scrivi nel file della D3 (`in-attesa-di-davide.md`) «Dominio scelto: `<dominio>`» e che hai finito questa
pagina. Così gli agenti possono riprendere queste due idee, che aspettano proprio il dominio:

- **T076**: passare la sicurezza del sito da «solo segnalazioni» a obbligatoria (CSP) e aggiungere
  `includeSubDomains` all'HSTS in `apps/web/vercel.json` (oggi `max-age=63072000`, senza sottodomini).
  **Attenzione:** con `includeSubDomains` ogni sottodominio di `<dominio>` dovrà usare solo `https`, per
  molto tempo; non va fatto se ne userai uno senza https.
- **T210**: aggiungere la riga `Sitemap: https://<dominio>/sitemap.xml` a `robots.txt`.

Poi aggiorna la voce D3 di `lista-lancio.md`, spuntandola.

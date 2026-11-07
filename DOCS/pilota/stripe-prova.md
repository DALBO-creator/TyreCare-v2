# Accendere i pagamenti in prova con Stripe (modalità test)

Pagina per Davide (voce D8 della [lista di lancio](lista-lancio.md)). Tempo: circa 15 minuti. Nessun
pagamento vero: tutto in **modalità test** di Stripe, con carte finte. Le funzioni nel progetto Supabase
sono già scritte e restano spente finché non imposti i segreti qui sotto.

Segnaposto: `<sk_test_…>` (chiave segreta di test), `<price_… Starter>`, `<price_… Pro>`, `<whsec_…>`
(segreto del webhook), `<ref>` (identificativo del progetto Supabase), `<indirizzo del sito>`.
Scrivi i valori veri solo nel terminale e su Stripe, mai in un file del progetto.

Prima di cominciare servono: il Supabase CLI collegato al progetto (`supabase link --project-ref <ref>`,
come per le altre procedure) e un account su stripe.com (gratuito).

## 1. Resta in modalità test

Stripe Dashboard → in alto a destra l'interruttore **"Test mode"** deve essere acceso (la pagina ha
un'etichetta o una banda arancione "Test mode"). Tutti i passi sotto si fanno così.

## 2. Crea i due prodotti

**Product catalog → "Add product"**, due volte. Prezzo **ricorrente**, **mensile**, valuta **EUR**:

| Nome del prodotto | Prezzo       |
| ----------------- | ------------ |
| Starter           | 29 € al mese |
| Pro               | 49 € al mese |

I nomi e i prezzi sono quelli della pagina "Abbonamento" dell'app (`PIANI` in
`packages/shared/src/abbonamenti.ts`). Se un giorno cambi un prezzo, cambialo prima lì e poi su Stripe,
altrimenti l'app mostra una cifra e Stripe ne addebita un'altra.

## 3. Copia i due `price_…`

Apri ogni prodotto: nella riga del prezzo c'è l'identificativo che inizia con `price_`
(è l'id del **prezzo**, non quello del prodotto, che inizia con `prod_`). Annotali: `<price_… Starter>`
e `<price_… Pro>`.

## 4. Copia la chiave segreta di test

**Developers → API keys → "Secret key"** (inizia con `sk_test_`; premi "Reveal"). Non usare la
"Publishable key" (`pk_test_…`): non serve.

## 5. Imposta i segreti su Supabase

Nel terminale, dalla cartella del progetto:

```
supabase secrets set STRIPE_SECRET_KEY=<sk_test_…> \
  STRIPE_PRICE_STARTER=<price_… Starter> STRIPE_PRICE_PRO=<price_… Pro> \
  SITO_URL=<indirizzo del sito>
```

- `SITO_URL` è l'indirizzo dell'app, per esempio `https://dominio`, **senza barra finale** (se la
  metti, le funzioni la tolgono). Serve per riportare il cliente all'app dopo il pagamento
  (`/officina/abbonamento`). La usa già anche la funzione `invia-notifica` (email di riserva): se l'hai
  già impostata, scrivi lo stesso valore, non cambia nulla.
- `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` le fornisce Supabase da solo: non vanno impostate.
- Manca ancora `STRIPE_WEBHOOK_SECRET`: arriva al punto 7.

## 6. Pubblica le tre funzioni

```
supabase functions deploy stripe-checkout
supabase functions deploy stripe-portale
supabase functions deploy stripe-webhook --no-verify-jwt
```

Il webhook va pubblicato con `--no-verify-jwt` perché Stripe non manda il JWT di Supabase: la sicurezza è
la firma `whsec_…` (punto 7), che la funzione controlla su ogni richiesta e rifiuta se non torna.
`stripe-checkout` e `stripe-portale` invece verificano l'utente loggato e si pubblicano normalmente.

## 7. Crea il webhook su Stripe

**Developers → Webhooks → "Add endpoint"** (in alcune versioni "Add destination": scegli "Webhook
endpoint"):

- Endpoint URL: `https://<ref>.supabase.co/functions/v1/stripe-webhook`
- Eventi da ascoltare (esattamente questi quattro):
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`

Salva. Nella pagina del webhook premi **"Reveal"** accanto a "Signing secret": inizia con `whsec_`.
Rimettilo su Supabase:

```
supabase secrets set STRIPE_WEBHOOK_SECRET=<whsec_…>
```

I segreti nuovi valgono dalla prossima chiamata: non serve ripubblicare le funzioni.

## 8. Attiva il portale clienti

**Settings → Billing → Customer portal** (sempre in modalità test): attivalo e salva. Serve al pulsante
"Gestisci il pagamento" (cambio carta, annullamento). Senza questo passo il pulsante risponde con "Il
servizio di pagamento non è disponibile in questo momento".

## 9. Prova il pagamento

Serve un account **titolare** di un'officina **attiva**, con piano Starter o Pro in prova. Il checkout
rifiuta le officine non ancora attive ("Potrai attivare l'abbonamento quando la tua officina sarà attiva")
e quelle del pilota ("La tua officina è nel pilota: l'abbonamento è gratuito"). Per una prova pulita
crea un'officina di prova con [`crea-officina.md`](crea-officina.md) (passi 1, 2 e 4, con dati inventati)
e accedi con quel titolare.

1. Nell'app apri la pagina **Abbonamento** (dai dati dell'officina; indirizzo `/officina/abbonamento`).
2. Scegli il piano (Starter 29 €/mese o Pro 49 €/mese) e premi **"Attiva l'abbonamento"**.
3. Si apre la pagina di pagamento di Stripe. Carta: `4242 4242 4242 4242`, scadenza una data futura
   qualsiasi (es. 12/34), CVC qualsiasi (es. 123), nome e codice postale qualsiasi. Paga.
4. Torni all'app su `/officina/abbonamento?pagamento=ok`. Compare l'avviso verde: "Pagamento ricevuto:
   l'abbonamento si aggiorna entro pochi minuti."
5. Ricarica la pagina dopo qualche secondo. Sotto "Il tuo piano" devi vedere il nome del piano scelto
   (**Starter** o **Pro**) e **"Abbonamento attivo"**. Al posto del pulsante "Attiva l'abbonamento" c'è
   "Il tuo abbonamento è a posto: non devi fare nulla.", e compare **"Gestisci il pagamento"**.
6. Premi "Gestisci il pagamento": si apre il portale di Stripe, dove si cambia la carta o si annulla.
   Non annullare se vuoi rifare la prova con la stessa officina.

Su Stripe, **Developers → Webhooks →** il tuo endpoint deve mostrare gli eventi ricevuti con risposta
**200**.

## Se qualcosa non va

- **"Il pagamento online non è ancora attivo: per ora scrivici con «Invia un commento»."** (codice
  `PAGAMENTI_NON_ATTIVI`): manca un segreto. Controlla con `supabase secrets list` (mostra solo i nomi) che
  ci siano `STRIPE_SECRET_KEY`, `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PRO` e `SITO_URL`; per il solo
  portale bastano `STRIPE_SECRET_KEY` e `SITO_URL`. Il webhook ne vuole `STRIPE_WEBHOOK_SECRET` (senza,
  Stripe riceve 503). Rimetti il segreto mancante con `supabase secrets set`.
- **"Il servizio di pagamento non è disponibile in questo momento"** (codice `STRIPE`): Stripe ha
  rifiutato la richiesta. Cause tipiche: portale clienti non attivato (punto 8), `price_…` sbagliato o di
  un altro account, chiave `sk_test_…` copiata male. Il dettaglio è nel log della funzione.
- **Log delle funzioni**: Supabase Dashboard → **Edge Functions →** la funzione (`stripe-checkout`,
  `stripe-portale` o `stripe-webhook`) **→ Logs**.
- **Pagamento riuscito ma l'app resta in prova**: su Stripe, **Developers → Webhooks →** l'endpoint,
  e guarda la risposta degli eventi. Se non è 200: 400 = firma non valida (rimetti `STRIPE_WEBHOOK_SECRET`
  con il `whsec_…` di *questo* endpoint), 503 = segreto del webhook mancante, 500 = errore temporaneo
  (Stripe riprova da solo). Un 200 con `scartato` nel
  messaggio vuol dire che l'evento non corrisponde a nessuna officina: il motivo è nel log.
- **Le altre risposte dell'app**: "Solo il titolare può attivare l'abbonamento" (accedi con il titolare),
  "L'abbonamento è già attivo", "L'ultimo pagamento non è riuscito: aggiorna la carta con «Gestisci il
  pagamento»".

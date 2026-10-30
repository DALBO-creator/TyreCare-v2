# Piano del pilota — LA SANTI GOMME (Fase 6) e apertura alle altre officine (Fase 7)

Pagina per Davide. **Bozza**: i numeri con `[DA COMPLETARE]` vanno decisi da te. Nessun dato reale qui.
Prima di partire spunta la lista in [`lista-lancio.md`](lista-lancio.md).

## 1. Obiettivo

Far usare TyreCare per davvero a una sola officina, LA SANTI GOMME (Fase 6 — Pilota), e capire se l'app le
fa risparmiare tempo e porta clienti. Se funziona, si apre alle altre officine (Fase 7 — Commerciale).

## 2. Durata

**8 settimane** dall'incontro di avvio. `[DA COMPLETARE: durata confermata da Davide]`

## 3. Cosa si misura

Si annotano ogni settimana, in una tabella tua (non nel repository), questi quattro numeri:

| Cosa | Dove si legge |
|------|---------------|
| Clienti invitati e clienti collegati (hanno accettato l'invito) | Scheda del cliente → "App TyreCare" |
| Controlli inseriti | Schede dei veicoli, "Nuovo controllo" (o tabella `controlli` in Supabase) |
| Richieste di appuntamento arrivate | **Appuntamenti** → "Da confermare" e storico |
| Commenti arrivati dall'app | Console di Supabase, tabella `commenti` |

Per i commenti oggi serve la console di Supabase; una pagina nell'app è in preparazione (T103), ma non
contarci finché non la vedi in **Profilo**.

## 4. Incontro di avvio con l'officina

Un'ora, in officina, con il telefono del titolare. Prima: l'officina è creata e attivata e il DPA è firmato
(vedi la lista di lancio). Poi si seguono i passi di [`guida-avvio.md`](guida-avvio.md):

1. Accesso, cambio password, app sulla schermata Home (su iPhone le notifiche funzionano solo da lì).
2. Orari e chiusure; servizi e prezzi.
3. Import di clienti e veicoli dal gestionale (GESTITYRE) con la mappatura delle colonne.
4. Primo controllo di uno pneumatico fatto insieme.
5. Primo invito a un cliente di fiducia; attivazione delle notifiche; dove scrivere un commento.

Lascia al titolare [`guida-officina.md`](guida-officina.md) per tutto il resto.

## 5. Cadenza dei controlli

- **Una telefonata a settimana** di 10 minuti con il titolare: cosa ha usato, cosa non ha capito, cosa manca.
  Annota i quattro numeri della tabella.
- **Lettura dei commenti** dell'app almeno due volte a settimana; rispondi al titolare in telefonata, non
  per email in massa.
- Le richieste di cambio che ne escono le porti in coda (idee), non le prometti a voce.

## 6. Quando il pilota è riuscito

Si passa alla Fase 7 se, entro la fine della durata:

- almeno `[DA COMPLETARE: es. 30]` clienti sono collegati e `[DA COMPLETARE: es. 50]` controlli inseriti;
- almeno `[DA COMPLETARE: es. 10]` richieste di appuntamento arrivate dall'app;
- il titolare dice che la userebbe ancora e la consiglierebbe a un collega (chiedilo a voce, alla fine);
- nessuna violazione dei dati e nessun problema aperto che blocchi il lavoro dell'officina.

Poi: seguire le voci "solo Fase 7" della lista di lancio (Stripe in prova) e invitare 2–3 officine nuove
con gli stessi passi, partendo da [`crea-officina.md`](crea-officina.md).

## 7. Se qualcosa va storto

- **Dati esposti o persi, accesso non autorizzato:** segui subito
  [`../legale/procedura-violazioni.md`](../legale/procedura-violazioni.md) (chi avvisare, entro quanto,
  registro). Non aspettare la telefonata del venerdì.
- **L'app non funziona:** controlla lo stato di Supabase e di Vercel, poi riprova; annota ora e sintomo.
- **Dati dell'officina da rimettere a posto:** copia di sicurezza in
  [`copie-di-sicurezza.md`](copie-di-sicurezza.md).
- **L'officina vuole smettere:** si ferma e si restituiscono i dati (esportazione da "Importa dal gestionale"
  → clienti e veicoli) secondo il DPA ([`../legale/dpa-officine.md`](../legale/dpa-officine.md)).

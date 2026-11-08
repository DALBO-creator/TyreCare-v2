# Demo per il titolare di LA SANTI GOMME

> Passi per Davide (2026-11-08). Servono a mostrare TyreCare al titolare con l'app "piena", come se
> l'officina la usasse da qualche mese: l'officina di prova diventa **La Santi Gomme**, l'account cliente
> ha 2 veicoli con lo storico dei controlli degli ultimi 2 mesi, l'officina 12 veicoli in stati diversi,
> appuntamenti passati e futuri, notifiche lette e da leggere.
>
> Script: [`supabase/demo/la-santi-gomme.sql`](../../supabase/demo/la-santi-gomme.sql). Provato su una copia
> locale del database con tutte le migrazioni (anche rieseguito due volte di fila).

## 1. Prima di tutto: allineare il database cloud (corregge i due errori)

I due errori visti dal telefono il 2026-11-08 — «Qualcosa è andato storto» inviando un commento e «Non
riusciamo a caricare i tuoi dati» in *Appuntamenti* — hanno quasi certamente la stessa causa: **il
database cloud non ha le migrazioni degli ultimi giorni**. Dallo storico, l'ultima pubblicazione con
`db push` è di metà ottobre; da allora gli agenti hanno aggiunto circa 35 migrazioni (la tabella
`commenti`, gli abbonamenti, l'aiuto su strada, …) e Vercel pubblica da solo il codice nuovo, che le usa.
Gli agenti non possono pubblicare sul cloud: va fatto da te. Sulla copia locale con tutte le migrazioni
l'invio del commento e l'elenco degli appuntamenti dell'officina funzionano (provati con la RLS, come
utente dell'app).

Dal PC con la CLI già collegata al progetto (cartella del repository, `main` aggiornato):

```powershell
npx supabase migration list          # colonna "Remote" vuota = migrazione mancante sul cloud
npx supabase db push --dry-run       # elenca cosa verrebbe applicato, senza toccare niente
npx supabase db push                 # le applica, in ordine
```

In alternativa, solo per controllare, nel SQL Editor:

```sql
select max(version) from supabase_migrations.schema_migrations;  -- deve essere 20261108000100
```

Poi riprova dal telefono *Profilo → Invia un commento* e *Appuntamenti*. Se un `db push` si ferma con un
errore, non insistere: copia il messaggio e passalo alla prossima sessione. Se dopo il push i due errori
restano, serve il dettaglio: Supabase → *Logs → API* (le richieste con stato 4xx/5xx all'ora della prova).

## 2. Caricare i dati della demo

Va eseguito **dopo** il passo 1 (lo script controlla lo schema e si ferma con un messaggio chiaro se
manca qualcosa) e conviene farlo **il giorno prima o la mattina della demo**: le date sono relative al
giorno di esecuzione ("domani", "tra 3 giorni", "2 mesi fa"…) e cadono sempre negli orari di apertura.

1. Supabase → progetto di produzione → **SQL Editor** → *New query*.
2. Incolla tutto il contenuto di `supabase/demo/la-santi-gomme.sql` e premi **Run** (se l'editor chiede
   conferma per i comandi "distruttivi", conferma: sono le cancellazioni dei dati di prova).
3. Il risultato è un riepilogo: 6 servizi, 11 clienti, 12 veicoli, 15 controlli, 18 appuntamenti, 18
   notifiche per l'officina e 10 per il cliente.
4. Esci e rientra nell'app con i due account (o tira giù la pagina per aggiornare).

Tutto avviene in una transazione: se qualcosa va storto non cambia niente. Si può rieseguire quando vuoi
(per esempio per "rinfrescare" le date prima di un'altra demo): riparte da zero.

**Cosa cancella:** dell'officina di `albodavide1@gmail.com` clienti, veicoli, gomme, controlli,
appuntamenti, servizi, chiusure, import, mappature e richieste su strada; dei due account le notifiche;
dell'account cliente `albodavidexd@gmail.com` gli appuntamenti e le richieste su strada (se fosse
collegato come cliente ad altre officine viene solo scollegato). **Non** tocca i commenti, gli account,
le iscrizioni alle push, il ruolo di admin.

**Clienti finti:** ogni appuntamento nel database appartiene a un account cliente, quindi lo script crea 7
account finti (Marco Bertoli, Giulia Ferrari, …) con email `…@demo.tyrecare.invalid`, password casuale (non
possono accedere) e il segno `demo: true`. Nessuna email parte: i dati si scrivono direttamente.

**Notifiche:** durante il caricamento i trigger delle notifiche sono spenti, quindi nessuna push arriva ai
telefoni; le notifiche sono scritte a mano con l'ora in cui sarebbero arrivate. Dopo, tutto torna normale:
la sera prima dell'appuntamento della Panda (alle 18) arriva al cliente il **promemoria vero**, utile da
mostrare se la demo cade quel giorno.

## 3. Cosa c'è nell'app

**Officina — La Santi Gomme**, Via della Scienza, 6 — 25039 Travagliato (BS), 030 6864669,
info@lasantigommesrl.it. Orari: lun–ven 8–12 e 14–18, sabato 8–12, domenica chiuso; massimo 4 richieste
per fascia; aiuto su strada attivo entro 30 km; chiusure l'8 dicembre e dal 24 al 26 dicembre; piano
*Officina pilota* (gratuito).

**Servizi** (prezzi "da", li cambi da *Servizi dell'officina*):

| Servizio | Durata | Prezzo da | Prenotabile |
| --- | --- | --- | --- |
| Cambio gomme stagionale | 45 min | 45 € | sì |
| Riparazione pneumatici | 30 min | 20 € | sì |
| Equilibratura e convergenza | 60 min | 60 € | sì |
| Deposito gomme | — | 50 € a stagione | sì |
| Raddrizzatura cerchi | 60 min | 50 € a cerchio | sì |
| Intervento su strada | — | 60 € | no (si usa "Aiuto su strada") |

**Veicoli dell'officina (12)** — gli stati che il titolare vede in *Clienti*:

| Targa | Veicolo | Cliente | Stato |
| --- | --- | --- | --- |
| FX 482 RN | VW Golf | account cliente (tu) | verde: invernali montate 5 giorni fa |
| FF 913 LB | Fiat Panda | account cliente (tu) | giallo: anteriori 3,8 mm con usura interna |
| GH 512 KT | Audi A4 Avant | Marco Bertoli | estive montate (fuori stagione), cambio richiesto |
| GA 318 PL | Toyota Yaris Hybrid | Giulia Ferrari | giallo (4 stagioni a 3,5 mm) |
| GE 774 ZR | BMW X1 | Luca Zanardelli | verde: invernali nuove |
| FY 209 BN | Peugeot 3008 | Sara Bonomi | giallo e fuori stagione, cambio al prossimo giorno di apertura |
| EZ 641 HD | Ford Fiesta | Andrea Pedrali | rosso: posteriori sotto il limite di legge |
| FL 883 TS | Fiat Ducato | Edil Franciacorta S.r.l. | giallo: usura sui bordi (dal gestionale) |
| FR 455 MV | Jeep Compass | Roberto Gatti | da ricontrollare: ultimo controllo di oltre un anno fa |
| EP 127 XC | Lancia Ypsilon | Elena Marchetti | rosso e fuori stagione, taglio sul fianco |
| FV 093 AR | VW Polo | Francesco Tonoli | verde: invernali montate ieri |
| EH 562 DK | Renault Clio | Giovanni Pasini | nessun controllo (cliente nuovo) |

**Appuntamenti:** 3 da confermare (uno di una cliente non ancora in anagrafica, per mostrare "Aggiungi ai
clienti"), 1 orario proposto in attesa del cliente, 3 confermati nei prossimi giorni, 1 di ieri da
chiudere ("Passati: com'è andata?"), e lo storico (completati, un "non presentato", un rifiuto, un
annullamento). Più una richiesta di aiuto su strada chiusa la settimana scorsa e due import dal gestionale.

**Account cliente:** Golf e Panda nel garage, 3 controlli ciascuna negli ultimi 2 mesi (con la Panda che
peggiora: grafico del battistrada e stima utili da mostrare), 4 appuntamenti passati e la convergenza
della Panda confermata tra 3 giorni, notifiche (2 da leggere: l'esito del controllo e la conferma).

**Percorso consigliato per la demo (10 minuti):** officina → *Home* e *Appuntamenti* (conferma una
richiesta, proponi un orario) → *Clienti* (i colori degli stati, la Fiesta in rosso, il report di un
controllo) → *Servizi* e *Orari*; poi il telefono del cliente → garage, salute della Panda, appuntamento,
notifiche.

## 4. Da sistemare a mano

- **Posizione sulla mappa:** le coordinate sono quelle approssimative di Travagliato (non è stato possibile
  cercarle da qui): correggile da *Profilo → Dati dell'officina*.
- **Partita IVA:** resta quella dell'officina di prova; la cambia solo un admin (SQL o pagina Officine).
- **Prezzi e descrizioni:** da *Servizi dell'officina*.

## 5. Pulizia (dopo la demo)

Per togliere solo i clienti finti e i loro appuntamenti (i veicoli restano come clienti senza app):

```sql
delete from auth.users where raw_app_meta_data ->> 'demo' = 'true';
```

Per ripartire da un'officina vuota prima del pilota vero: si rifà l'officina seguendo
[`crea-officina.md`](crea-officina.md).

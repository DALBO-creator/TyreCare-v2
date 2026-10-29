**BOZZA — da rivedere con un consulente prima dell'uso**

# Copie di sicurezza del database — istruzioni per Davide

Serve a due cose: avere una copia dei dati se qualcosa va storto, e poter scrivere nel DPA §9
([`../legale/dpa-officine.md`](../legale/dpa-officine.md)) che il ripristino è stato provato davvero.

## Cosa offre il piano

Piano Supabase scelto e copie automatiche: [DA COMPLETARE: piano e copie automatiche]. Da verificare nella
console (copie giornaliere? per quanti giorni? ripristino a un momento preciso?) prima di scriverlo nel DPA.

## Copia a mano con la CLI

La stringa di connessione si prende dalla console del progetto (Connect). Non va scritta in nessun file.

```
supabase db dump --db-url "<stringa di connessione>" -f schema.sql
supabase db dump --db-url "<stringa di connessione>" --data-only -f dati.sql
```

`schema.sql` è la struttura, `dati.sql` sono i dati. Servono entrambi.

## Dove conservarla

Le copie contengono dati personali dei clienti delle officine:

- su un disco **cifrato**, in una cartella solo tua;
- **mai** nel repository e mai dentro `supabase/` (nemmeno se ignorata da git);
- nel nome del file metti la data, per esempio `2026-11-05-dati.sql`; cancella le copie vecchie secondo
  il tempo di conservazione [DA COMPLETARE: quante copie e per quanto tempo].

## Ogni quanto

**Ogni settimana durante il pilota.** Dopo il pilota: [DA COMPLETARE: frequenza].

## Prova di ripristino (solo in locale)

**ATTENZIONE: il ripristino si prova SOLO sul database locale, mai sul progetto cloud.** Un ripristino
sul cloud sovrascriverebbe i dati veri delle officine.

1. Avvia Supabase in locale (`supabase start`) e azzera il database locale: `supabase db reset`.
2. `psql "<url del database locale>" -f schema.sql`
3. `psql "<url del database locale>" -f dati.sql`
4. Controlla a campione: numero di clienti e veicoli, l'ultima prenotazione, un accesso di prova.
5. Segna quanto tempo è servito dall'inizio alla fine.

Se `schema.sql` dà errori perché `db reset` ha già creato le tabelle, ripeti da un database vuoto e annota
come hai fatto: serve a chi dovrà farlo con fretta.

## Dopo la prima prova

Scrivi nel DPA §9 (al posto del segnaposto su copie e ripristino) solo ciò che è vero: la **data** della
prova, l'**esito** (riuscita / con problemi, quali) e il **tempo impiegato**. Non scrivere durate delle
copie o garanzie che il piano non offre. Ripeti la prova dopo ogni cambio di piano o di struttura.

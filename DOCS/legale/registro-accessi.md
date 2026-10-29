**BOZZA — da rivedere con un consulente prima dell'uso**

# Registro degli accessi del personale di TyreCare ai dati delle officine

Versione: [DA COMPLETARE: data e numero di versione] · Responsabile del registro: [DA COMPLETARE: nome]

Questa procedura attua il §8 (Riservatezza) e il §9 (Misure di sicurezza) del DPA
([`dpa-officine.md`](dpa-officine.md)) e la domanda 9 del [`README.md`](README.md). Chi usa la chiave di
servizio o la console di Supabase legge tutto, senza traccia nell'app: la traccia è questo registro, tenuto
a mano. Finché non è in uso, il DPA non deve dire che gli accessi sono registrati.

## Chi può accedere

Solo le persone autorizzate dal §8 del DPA, vincolate da un obbligo di riservatezza:
[DA COMPLETARE: persone autorizzate]. Gli accessi che contano:

- la **chiave di servizio** (`service_role`), usata solo sul server e mai nell'app;
- la **console di Supabase** (editor delle tabelle, editor SQL, connessione diretta al database);
- il ruolo **ADMIN** nell'app: oggi non vede clienti, veicoli, pneumatici, controlli e prenotazioni
  (PLAN §P12), ma vede i profili degli account. Anche questo si annota (domanda 9).

## Quando si può accedere

1. **Assistenza chiesta dall'officina**: la richiesta resta scritta (email o messaggio) e se ne annota il
   riferimento. Si guarda solo ciò che serve a risolvere il problema.
2. **Incidente di sicurezza o violazione dei dati**: si segue
   [`procedura-violazioni.md`](procedura-violazioni.md); la notifica è un obbligo
   di legge (artt. 33-34 GDPR).
3. **Obbligo di legge** (richiesta di un'autorità): prima si coinvolge il consulente; si annota il
   riferimento della richiesta.

Fuori da questi casi non si accede ai dati delle officine.

## Cosa annotare ogni volta

Subito, non a fine mese: data e ora, chi ha acceso, per quale officina, il motivo, quali dati sono stati
consultati o modificati (tabelle e tipo di dati, **mai** copiarne il contenuto nel registro), se c'era la
richiesta dell'officina, il riferimento (email, numero di ticket, incidente).

## Registro

| Data e ora | Persona | Officina | Motivo | Dati consultati o modificati | Richiesta dell'officina (sì/no) | Riferimento |
|---|---|---|---|---|---|---|
| | | | | | | |

## Conservazione e controllo

Il registro si conserva [DA COMPLETARE: dove e per quanto tempo]. È una bozza di tabella: ogni riga
contiene dati personali di chi ha acceso, quindi il file con le righe vere non va nel repository pubblico.
[DA COMPLETARE: controllo periodico del registro e di chi ha ancora accesso alla console]

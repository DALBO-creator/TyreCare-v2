# Lista di controllo del lancio

Pagina per Davide. **Bozza**: spunta le caselle nell'ordine; ogni voce rimanda al documento da seguire.
Le voci D3, D5, D7, D8, D9 e D10 sono le azioni che gli agenti ti hanno lasciato da fare.
Nessun dato reale qui.
Il piano generale è in [`piano-pilota.md`](piano-pilota.md).

## Prima di creare l'officina (Fase 6 — Pilota)

- [ ] **Dominio e email (D3).** Scegli e compra il dominio di TyreCare (verifica prima che il marchio sia
  libero) e passalo agli agenti: preparano i record da copiare in Resend e Supabase. Serve per accendere le
  email di riserva (P23). Guida: [`../PLAN.md`](../PLAN.md) §7 (domanda sul nome); poi i passi in
  [`email-dominio.md`](email-dominio.md).
- [ ] **Dati del titolare (D5).** Scrivi ragione sociale, indirizzo, partita IVA e contatti di chi è
  titolare del trattamento, così le bozze legali non hanno più `[DA COMPLETARE]` sui tuoi dati. Guida:
  [`../legale/README.md`](../legale/README.md).
- [ ] **Revisione legale (D7).** Dai al consulente le bozze e le sue domande; correggi i testi con le sue
  risposte. Guida: [`../legale/README.md`](../legale/README.md) → "Domande per il consulente" e "Da fare
  prima del lancio".
- [ ] **Decisioni da confermare.** Sono in
  `progetti/tyrecare/decisioni-rimandate.md` nel repository ai-org (R1–R41): leggile e conferma o cambia.
- [ ] **DPA firmato.** Fai firmare all'officina l'accordo sul trattamento dei dati, nella versione rivista.
  Documento: [`../legale/dpa-officine.md`](../legale/dpa-officine.md). Senza, niente dati veri dei clienti.
- [ ] **Account ADMIN in produzione (D9).** Rendi amministratore il tuo account nel progetto Supabase di
  produzione, così usi la pagina "Officine da attivare" senza scrivere SQL ogni volta:
  1. registrati nell'app pubblicata con la tua email;
  2. Supabase → progetto di produzione → Authentication → Users: copia l'UID del tuo account;
  3. SQL Editor: `update public.profiles set ruolo = 'ADMIN' where id = '<UID del tuo account>';`
  4. esci e rientra: nel Profilo compare "Officine da attivare".
- [ ] **Procedura per le violazioni.** Rileggi e completa contatti e termini. Documento:
  [`../legale/procedura-violazioni.md`](../legale/procedura-violazioni.md).
- [ ] **Registro degli accessi.** Tienilo pronto per annotare quando entri nei dati dell'officina.
  Documento: [`../legale/registro-accessi.md`](../legale/registro-accessi.md).
- [ ] **Copie di sicurezza provate.** Fai una copia a mano e prova il ripristino in locale. Documento:
  [`copie-di-sicurezza.md`](copie-di-sicurezza.md).

## Avvio con LA SANTI GOMME (Fase 6 — Pilota)

- [ ] **Database e funzioni pubblicati (D10).** Porta sul cloud le migrazioni e le funzioni dell'ultimo
  treno unito, così l'app pubblicata da Vercel non è più avanti del database. Da rifare dopo ogni treno che
  cambia `supabase/`. Guida: [`pubblicazione.md`](pubblicazione.md).
- [ ] **Officina creata.** Account del titolare e officina in produzione. Documento:
  [`crea-officina.md`](crea-officina.md).
- [ ] **Officina attivata**, dopo il DPA firmato: da admin, voce "Officine da attivare" del Profilo
  (oppure l'`update` di [`crea-officina.md`](crea-officina.md), punto 4). Prima i clienti non la vedono.
- [ ] **Import dei dati dell'officina.** Con il titolare, clienti e veicoli dal gestionale. Documento:
  [`guida-avvio.md`](guida-avvio.md) passo 4; dettagli in [`guida-officina.md`](guida-officina.md) §5.
- [ ] **Primo cliente invitato** e collegato (ha accettato l'invito). Documento:
  [`guida-avvio.md`](guida-avvio.md) passo 6.
- [ ] **Incontro di avvio fatto** e telefonata settimanale fissata. Documento:
  [`piano-pilota.md`](piano-pilota.md) §4–5.

## Solo per la Fase 7 — Commerciale

- [ ] **Stripe in prova (D8).** Apri un account Stripe in modalità test (nessun pagamento vero) e accendi
  i pagamenti dell'abbonamento (T071) senza aiuto degli agenti. Da fare solo dopo che il pilota è riuscito
  ([`piano-pilota.md`](piano-pilota.md) §6). Guida passo passo (15 minuti):
  [`stripe-prova.md`](stripe-prova.md).

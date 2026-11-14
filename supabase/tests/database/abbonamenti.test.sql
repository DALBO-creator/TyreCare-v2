-- Test dell'abbonamento gestito a mano dall'amministratore (migrazione "abbonamento_manuale").
-- Richiede seed.sql. Eseguire con: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(52);

-- Simula una richiesta dal client con il JWT dell'utente indicato (null = anonimo). `aal2`: sessione
-- con il secondo fattore, che `is_admin()` può richiedere.
create function pg_temp.come(p_utente uuid) returns void language plpgsql as $$
begin
  reset role;
  if p_utente is null then
    set local role anon;
    perform set_config('request.jwt.claims', '{"role": "anon"}', true);
  else
    set local role authenticated;
    perform set_config(
      'request.jwt.claims',
      json_build_object('sub', p_utente, 'role', 'authenticated', 'aal', 'aal2')::text,
      true
    );
  end if;
end;
$$;

\set rossi '''b0000000-0000-4000-8000-000000000001'''
\set express '''b0000000-0000-4000-8000-000000000002'''
\set nuova '''b0670000-0000-4000-8000-000000000001'''
\set admin '''a0000000-0000-4000-8000-000000000001'''
\set titolare '''a0000000-0000-4000-8000-000000000002'''
\set operatore '''a0000000-0000-4000-8000-000000000003'''
\set cliente '''a0000000-0000-4000-8000-000000000004'''
\set titolare2 '''a0000000-0000-4000-8000-000000000005'''

create function pg_temp.oggi() returns date language sql as
  $$select (now() at time zone 'Europe/Rome')::date$$;

-- ---------------------------------------------------------------- Stripe non c'è più
select hasnt_table('public', 'stripe_eventi', 'la tabella degli eventi di Stripe non esiste più');
select hasnt_column('public', 'abbonamenti', 'stripe_customer_id', 'niente cliente Stripe');
select hasnt_column('public', 'abbonamenti', 'stripe_subscription_id', 'niente subscription Stripe');
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname ilike '%stripe%'),
  0,
  'nessuna funzione di Stripe'
);
select is(
  (select count(*)::int from cron.job where jobname ilike '%stripe%' or jobname = 'scadenza-prove'),
  0,
  'nessun job di Stripe né il vecchio job delle prove'
);
select is(
  (select count(*)::int from cron.job where jobname = 'scadenza-abbonamenti'),
  1,
  'il job notturno delle scadenze è programmato'
);

-- ---------------------------------------------------------------- una riga per officina
select is(
  (select count(*)::int from public.officine o
    where not exists (select 1 from public.abbonamenti a where a.officina_id = o.id)),
  0,
  'nessuna officina è senza abbonamento'
);

select pg_temp.come(:admin);
select lives_ok(
  format(
    $$insert into public.officine (id, ragione_sociale, partita_iva, citta)
      values (%L, 'Gomme Test Abbonamento', '67067067067', 'Bologna')$$,
    :nuova
  ),
  'l''admin crea un''officina'
);
reset role;
select results_eq(
  format('select piano, stato, installazione_pagata, scade_il from public.abbonamenti where officina_id = %L', :nuova),
  $$values ('MENSILE', 'PROVA', false, null::date)$$,
  'l''officina nuova nasce MENSILE, in PROVA, senza installazione pagata'
);
select throws_ok(
  format($$update public.abbonamenti set piano = 'PRO' where officina_id = %L$$, :nuova),
  '23514', null,
  'i piani vecchi non sono più ammessi'
);
select throws_ok(
  format($$update public.abbonamenti set stato = 'ATTIVO', scade_il = null where officina_id = %L$$, :nuova),
  '23514', null,
  'ATTIVO senza scadenza: rifiutato dal vincolo'
);

-- ---------------------------------------------------------------- lettura
select pg_temp.come(:titolare);
select is(
  (select count(*)::int from public.abbonamenti),
  1,
  'il titolare vede solo l''abbonamento della sua officina'
);
select is(
  (select officina_id from public.abbonamenti),
  :rossi::uuid,
  'ed è quello di Gomme Rossi'
);
select throws_ok(
  $$select note_admin from public.abbonamenti$$,
  '42501', null,
  'il titolare non legge le note interne dell''amministratore'
);
select throws_ok(
  $$select * from public.abbonamenti$$,
  '42501', null,
  'nemmeno con select *'
);

select pg_temp.come(:operatore);
select is_empty($$select officina_id from public.abbonamenti$$, 'l''operatore non vede l''abbonamento');
select pg_temp.come(:cliente);
select is_empty($$select officina_id from public.abbonamenti$$, 'il cliente non vede nessun abbonamento');
select pg_temp.come(:titolare2);
select is_empty(
  format('select officina_id from public.abbonamenti where officina_id = %L', :rossi),
  'il titolare di un''altra officina non vede quello di Gomme Rossi'
);
select pg_temp.come(null);
select throws_ok($$select officina_id from public.abbonamenti$$, '42501', null, 'l''anonimo non legge');

-- ---------------------------------------------------------------- nessuna scrittura dall'API
select pg_temp.come(:titolare);
select throws_ok(
  format($$update public.abbonamenti set stato = 'ATTIVO', scade_il = '2099-01-01' where officina_id = %L$$, :rossi),
  '42501', null,
  'il titolare non si attiva l''abbonamento da solo'
);
select throws_ok(
  format($$delete from public.abbonamenti where officina_id = %L$$, :rossi),
  '42501', null,
  'il titolare non elimina l''abbonamento'
);
select pg_temp.come(:admin);
select throws_ok(
  format($$update public.abbonamenti set piano = 'ANNUALE' where officina_id = %L$$, :rossi),
  '42501', null,
  'nemmeno l''admin scrive direttamente: passa dalle funzioni admin_*'
);

-- ---------------------------------------------------------------- funzioni admin: chi può
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'admin\_%'
      and (has_function_privilege('anon', p.oid, 'execute')
        or has_function_privilege('public', p.oid, 'execute'))),
  0,
  'nessuna funzione admin_* è eseguibile da anon o public'
);
select pg_temp.come(:titolare);
select throws_ok(
  format($$select public.admin_imposta_abbonamento(%L, 'ANNUALE', 'ATTIVO', null, null, '2099-01-01')$$, :rossi),
  '42501', null,
  'il titolare non chiama admin_imposta_abbonamento'
);
select throws_ok(
  format($$select public.admin_rinnova_abbonamento(%L, 'ANNO')$$, :rossi),
  '42501', null,
  'il titolare non chiama admin_rinnova_abbonamento'
);
select throws_ok(
  format($$select public.admin_registra_installazione(%L, true)$$, :rossi),
  '42501', null,
  'il titolare non chiama admin_registra_installazione'
);
select pg_temp.come(:cliente);
select throws_ok(
  format($$select public.admin_rinnova_abbonamento(%L, 'MESE')$$, :rossi),
  '42501', null,
  'il cliente non chiama admin_rinnova_abbonamento'
);
select pg_temp.come(null);
select throws_ok(
  format($$select public.admin_rinnova_abbonamento(%L, 'MESE')$$, :rossi),
  '42501', null,
  'l''anonimo non chiama admin_rinnova_abbonamento'
);

-- ---------------------------------------------------------------- installazione
select pg_temp.come(:admin);
select lives_ok(
  format($$select public.admin_registra_installazione(%L, true)$$, :rossi),
  'l''admin registra l''installazione pagata'
);
reset role;
select results_eq(
  format('select installazione_pagata, installazione_pagata_il from public.abbonamenti where officina_id = %L', :rossi),
  $$select true, pg_temp.oggi()$$,
  'installazione pagata oggi'
);
select pg_temp.come(:admin);
select lives_ok(
  format($$select public.admin_registra_installazione(%L, false, '2026-01-01')$$, :rossi),
  'l''admin toglie il pagamento dell''installazione'
);
reset role;
select results_eq(
  format('select installazione_pagata, installazione_pagata_il from public.abbonamenti where officina_id = %L', :rossi),
  $$values (false, null::date)$$,
  'non pagata: la data si svuota'
);

-- ---------------------------------------------------------------- rinnovo
delete from public.notifiche;
select pg_temp.come(:admin);
select is(
  (select public.admin_rinnova_abbonamento(:rossi, 'MESE')),
  (pg_temp.oggi() + interval '1 month' - interval '1 day')::date,
  'primo rinnovo di un mese: da oggi all''ultimo giorno incluso'
);
reset role;
select results_eq(
  format('select piano, stato, iniziato_il from public.abbonamenti where officina_id = %L', :rossi),
  $$select 'MENSILE', 'ATTIVO', pg_temp.oggi()$$,
  'dopo il rinnovo: MENSILE, ATTIVO, iniziato oggi'
);
select results_eq(
  $$select destinatario_id, tipo::text, titolo, link from public.notifiche$$,
  $$values ('a0000000-0000-4000-8000-000000000002'::uuid, 'ABBONAMENTO', 'Abbonamento rinnovato', '/officina/abbonamento')$$,
  'il titolare (non l''operatore) riceve l''avviso del rinnovo'
);
select pg_temp.come(:admin);
select is(
  (select public.admin_rinnova_abbonamento(:rossi, 'ANNO')),
  (pg_temp.oggi() + interval '1 month' + interval '1 year' - interval '1 day')::date,
  'un rinnovo prima della scadenza si aggiunge in coda'
);
reset role;
select is(
  (select piano from public.abbonamenti where officina_id = :rossi), 'ANNUALE',
  'il piano segue il periodo del rinnovo'
);
update public.abbonamenti set stato = 'SCADUTO', iniziato_il = pg_temp.oggi() - 70, scade_il = pg_temp.oggi() - 40 where officina_id = :rossi;
select pg_temp.come(:admin);
select is(
  (select public.admin_rinnova_abbonamento(:rossi, 'MESE')),
  (pg_temp.oggi() + interval '1 month' - interval '1 day')::date,
  'un abbonamento scaduto riparte da oggi'
);
select throws_ok(
  format($$select public.admin_rinnova_abbonamento(%L, 'SETTIMANA')$$, :rossi),
  'P0001', 'PERIODO_NON_VALIDO', 'periodo sconosciuto'
);
select throws_ok(
  $$select public.admin_rinnova_abbonamento('b0000000-0000-4000-8000-0000000000ff', 'MESE')$$,
  'P0001', 'OFFICINA_NON_TROVATA', 'officina inesistente'
);

-- ---------------------------------------------------------------- modulo completo
select lives_ok(
  format(
    $$select public.admin_imposta_abbonamento(%L, 'ANNUALE', 'ATTIVO', null, '2026-11-01', '2027-10-31', 900, '  Sconto primo anno  ')$$,
    :express
  ),
  'l''admin imposta tutto l''abbonamento'
);
reset role;
select results_eq(
  format('select piano, stato, iniziato_il, scade_il, importo_concordato, note_admin from public.abbonamenti where officina_id = %L', :express),
  $$values ('ANNUALE', 'ATTIVO', '2026-11-01'::date, '2027-10-31'::date, 900::numeric, 'Sconto primo anno')$$,
  'dati salvati, note ripulite dagli spazi'
);
select pg_temp.come(:admin);
select throws_ok(
  format($$select public.admin_imposta_abbonamento(%L, 'PRO', 'ATTIVO', null, null, '2027-01-01')$$, :express),
  'P0001', 'PIANO_NON_VALIDO', 'piano sconosciuto'
);
select throws_ok(
  format($$select public.admin_imposta_abbonamento(%L, 'MENSILE', 'SOSPESO')$$, :express),
  'P0001', 'STATO_NON_VALIDO', 'SOSPESO non si imposta a mano: si sospende l''officina'
);
select throws_ok(
  format($$select public.admin_imposta_abbonamento(%L, 'MENSILE', 'ATTIVO')$$, :express),
  'P0001', 'SCADENZA_MANCANTE', 'ATTIVO vuole la scadenza'
);
select throws_ok(
  format($$select public.admin_imposta_abbonamento(%L, 'MENSILE', 'ATTIVO', null, '2027-02-01', '2027-01-01')$$, :express),
  'P0001', 'DATE_NON_VALIDE', 'inizio dopo la scadenza'
);
select throws_ok(
  format($$select public.admin_imposta_abbonamento(%L, 'MENSILE', 'PROVA', null, null, null, -5)$$, :express),
  'P0001', 'IMPORTO_NON_VALIDO', 'importo negativo'
);
select throws_ok(
  format($$select public.admin_imposta_abbonamento(%L, 'MENSILE', 'PROVA', null, null, null, null, repeat('x', 2001))$$, :express),
  'P0001', 'NOTE_TROPPO_LUNGHE', 'note oltre 2000 caratteri'
);

-- ---------------------------------------------------------------- sospensione e riattivazione
select lives_ok(format('select public.sospendi_officina(%L)', :express), 'l''admin sospende l''officina');
reset role;
select is(
  (select stato from public.abbonamenti where officina_id = :express), 'SOSPESO',
  'officina sospesa → abbonamento SOSPESO'
);
select pg_temp.come(:admin);
select public.admin_rinnova_abbonamento(:express, 'MESE');
select public.attiva_officina(:express);
reset role;
select is(
  (select stato from public.abbonamenti where officina_id = :express), 'ATTIVO',
  'riattivata con la scadenza nel futuro → ATTIVO'
);
update public.abbonamenti set scade_il = pg_temp.oggi() - 1, iniziato_il = pg_temp.oggi() - 30
  where officina_id = :express;
update public.officine set stato_affiliazione = 'SOSPESA' where id = :express;
update public.officine set stato_affiliazione = 'ATTIVA' where id = :express;
select is(
  (select stato from public.abbonamenti where officina_id = :express), 'SCADUTO',
  'riattivata con la scadenza passata → SCADUTO'
);

select * from finish();
rollback;

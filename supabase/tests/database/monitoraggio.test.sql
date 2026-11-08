-- Test del monitoraggio del pilota (migrazione "monitoraggio", T244): versione_database, errori_app,
-- limite di 30 errori in 24 ore, pulizia dopo 30 giorni. Richiede seed.sql.
-- Eseguire con: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(31);

-- Simula una richiesta dal client con il JWT dell'utente indicato (null = anonimo).
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
      json_build_object('sub', p_utente, 'role', 'authenticated')::text,
      true
    );
  end if;
end;
$$;

-- Utenti del seed: …01 admin, …02 titolare di Gomme Rossi, …04 cliente Giulia, …05 titolare di Pneus Express
\set admin '''a0000000-0000-4000-8000-000000000001'''
\set titolare '''a0000000-0000-4000-8000-000000000002'''
\set cliente '''a0000000-0000-4000-8000-000000000004'''
\set titolare2 '''a0000000-0000-4000-8000-000000000005'''

-- ---------------------------------------------------------------- preparazione (senza utente)
-- L'ultima migrazione applicata, letta come utente dei test (authenticated non vede quello schema).
select max(version) as ultima from supabase_migrations.schema_migrations \gset

select ok(:'ultima' >= '20261108000200', 'preparazione: la migrazione del monitoraggio è applicata');
select is((select count(*) from public.errori_app), 0::bigint, 'preparazione: errori_app parte vuota');

-- ---------------------------------------------------------------- versione_database
select pg_temp.come(:admin);
select is(public.versione_database(), :'ultima', 'admin: legge la versione del database (max(version))');

select pg_temp.come(:cliente);
select throws_ok(
  $$select public.versione_database()$$,
  '42501', null,
  'cliente: non legge la versione del database'
);

select pg_temp.come(:titolare);
select throws_ok(
  $$select public.versione_database()$$,
  '42501', null,
  'titolare: non legge la versione del database'
);

select pg_temp.come(null);
select throws_ok(
  $$select public.versione_database()$$,
  '42501', null,
  'anonimo: non legge la versione del database'
);

-- ---------------------------------------------------------------- errori_app: cliente
select pg_temp.come(:cliente);
select lives_ok(
  $$insert into public.errori_app (id, percorso, messaggio, dettaglio, versione, agente)
    values ('e0000000-0000-4000-8000-000000000001', '/garage/:id', 'TypeError: x is undefined',
            'at mostraGarage (garage.ts:10)', '20261108000200', 'Firefox 140')$$,
  'cliente: segnala un errore'
);
select is(
  (select count(*) from public.errori_app),
  0::bigint,
  'cliente: non legge gli errori, neanche il suo'
);
select throws_ok(
  $$insert into public.errori_app (id, messaggio)
    values ('e0000000-0000-4000-8000-000000000001', 'Reinvio')$$,
  '23505', null,
  'cliente: il reinvio con lo stesso id dà 23505'
);
select throws_ok(
  format(
    'insert into public.errori_app (id, autore_id, messaggio) values (gen_random_uuid(), %L, %L)',
    :titolare, 'A nome di un altro'
  ),
  '42501', null,
  'cliente: non segnala a nome di un altro'
);
select throws_ok(
  $$insert into public.errori_app (id, messaggio) values (gen_random_uuid(), '')$$,
  '23514', null,
  'messaggio vuoto: rifiutato'
);
select throws_ok(
  $$insert into public.errori_app (id, messaggio) values (gen_random_uuid(), repeat('x', 501))$$,
  '23514', null,
  'messaggio oltre 500 caratteri: rifiutato'
);
select throws_ok(
  $$insert into public.errori_app (id, messaggio, dettaglio)
    values (gen_random_uuid(), 'Errore', repeat('x', 2001))$$,
  '23514', null,
  'dettaglio oltre 2000 caratteri: rifiutato'
);
select throws_ok(
  $$update public.errori_app set messaggio = 'Cambiato'
    where id = 'e0000000-0000-4000-8000-000000000001'$$,
  '42501', null,
  'cliente: non modifica gli errori'
);
select throws_ok(
  $$delete from public.errori_app where id = 'e0000000-0000-4000-8000-000000000001'$$,
  '42501', null,
  'cliente: non cancella gli errori'
);
select lives_ok(
  $$insert into public.errori_app (id, messaggio, created_at)
    values ('e0000000-0000-4000-8000-000000000002', 'Con data vecchia', now() - interval '40 days')$$,
  'cliente: segnala un errore con una data vecchia'
);

-- ---------------------------------------------------------------- anonimo
select pg_temp.come(null);
select throws_ok(
  $$insert into public.errori_app (id, messaggio) values (gen_random_uuid(), 'Senza account')$$,
  '42501', null,
  'anonimo: non segnala errori'
);

-- ---------------------------------------------------------------- admin
select pg_temp.come(:admin);
select results_eq(
  $$select autore_id, percorso, messaggio, dettaglio, versione, agente from public.errori_app
    where id = 'e0000000-0000-4000-8000-000000000001'$$,
  $$values ('a0000000-0000-4000-8000-000000000004'::uuid, '/garage/:id', 'TypeError: x is undefined',
            'at mostraGarage (garage.ts:10)', '20261108000200', 'Firefox 140')$$,
  'admin: legge l''errore del cliente'
);
select is(
  (select created_at >= now() - interval '1 minute' from public.errori_app
   where id = 'e0000000-0000-4000-8000-000000000002'),
  true,
  'la data dell''errore la mette il database (la data vecchia è ignorata)'
);

-- ---------------------------------------------------------------- limite di 30 in 24 ore
select pg_temp.come(:titolare2);
select lives_ok(
  $$insert into public.errori_app (id, messaggio)
    select gen_random_uuid(), 'Errore numero ' || n from generate_series(1, 30) as n$$,
  'titolare2: 30 errori in 24 ore sono permessi'
);
select is(
  (select count(*) from public.errori_app),
  0::bigint,
  'titolare2: non legge gli errori (neanche i suoi)'
);
select throws_ok(
  $$insert into public.errori_app (id, messaggio) values (gen_random_uuid(), 'Il trentunesimo')$$,
  'P0001', 'TROPPI_ERRORI',
  'il 31° errore in 24 ore: TROPPI_ERRORI'
);

reset role;
select is(
  (select count(*) from public.errori_app where autore_id = :titolare2),
  30::bigint,
  'titolare2: salvati esattamente 30 errori'
);
-- Il limite è per autore: il cliente (2 errori) scrive ancora
select pg_temp.come(:cliente);
select lives_ok(
  $$insert into public.errori_app (id, messaggio)
    values ('e0000000-0000-4000-8000-000000000003', 'Il limite è per autore')$$,
  'cliente: il limite di titolare2 non lo blocca'
);

-- Spostati i 30 errori a 25 ore fa (come postgres, sopra la RLS), titolare2 torna a scrivere
reset role;
update public.errori_app set created_at = now() - interval '25 hours' where autore_id = :titolare2;
select pg_temp.come(:titolare2);
select lives_ok(
  $$insert into public.errori_app (id, messaggio)
    values ('e0000000-0000-4000-8000-000000000004', 'Dopo 24 ore')$$,
  'titolare2: gli errori di più di 24 ore fa non contano'
);

-- ---------------------------------------------------------------- pulizia (adesso = 2026-12-15)
reset role;
select is(
  (select count(*) from public.errori_app where id in (
    'e0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000003',
    'e0000000-0000-4000-8000-000000000004')),
  3::bigint,
  'preparazione pulizia: i tre errori ci sono'
);
-- Date esplicite: …01 di 40 giorni prima (cancellato), …03 di 29 giorni prima (resta),
-- …04 nel futuro rispetto ad adesso (resta); tutti gli altri errori nella finestra di 30 giorni.
update public.errori_app set created_at = '2026-11-05 12:00+00'
where id = 'e0000000-0000-4000-8000-000000000001';
update public.errori_app set created_at = '2026-11-16 12:00+00'
where id = 'e0000000-0000-4000-8000-000000000003';
update public.errori_app set created_at = '2026-12-15 13:00+00'
where id <> 'e0000000-0000-4000-8000-000000000001' and id <> 'e0000000-0000-4000-8000-000000000003';

create temp table esito as
select public.pulisci_errori_app('2026-12-15 12:00+00') as quanti;

select is(
  (select count(*) from public.errori_app where id = 'e0000000-0000-4000-8000-000000000001'),
  0::bigint, 'errore di 40 giorni prima: cancellato'
);
select is(
  (select count(*) from public.errori_app where id = 'e0000000-0000-4000-8000-000000000003'),
  1::bigint, 'errore di 29 giorni prima: resta'
);
select is((select quanti from esito), 1, 'restituisce quanti ne ha cancellati');

select pg_temp.come(:cliente);
select throws_ok(
  $$select public.pulisci_errori_app()$$,
  '42501', null,
  'cliente: non può lanciare la pulizia'
);
reset role;

select is(
  (select schedule || ' ' || command from cron.job where jobname = 'pulizia-errori-app'),
  '50 1 * * * select public.pulisci_errori_app()',
  'il job gira ogni notte all''1:50 e chiama la funzione'
);

select * from finish();
rollback;

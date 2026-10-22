-- Test dei commenti del pilota (migrazione "commenti"). Richiede seed.sql.
-- Eseguire con: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(13);

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

-- Utenti del seed: …01 admin, …02 titolare e …03 operatore di Gomme Rossi, …04 cliente Giulia,
-- …05 titolare di Pneus Express
\set rossi '''b0000000-0000-4000-8000-000000000001'''

-- ---------------------------------------------------------------- cliente
select pg_temp.come('a0000000-0000-4000-8000-000000000004');
select lives_ok(
  $$insert into public.commenti (id, percorso, testo)
    values ('c0000000-0000-4000-8000-000000000001', '/garage', 'Non trovo la mia Panda')$$,
  'cliente: invia un commento'
);
select results_eq(
  $$select autore_id, officina_id, percorso, testo from public.commenti$$,
  $$values ('a0000000-0000-4000-8000-000000000004'::uuid, null::uuid, '/garage', 'Non trovo la mia Panda')$$,
  'cliente: rilegge il suo commento'
);
select throws_ok(
  $$insert into public.commenti (id, testo) values (gen_random_uuid(), '  ok  ')$$,
  '23514', null,
  'testo troppo corto (spazi esclusi): rifiutato'
);
select throws_ok(
  $$insert into public.commenti (id, autore_id, testo)
    values (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000002', 'A nome di un altro')$$,
  '42501', null,
  'cliente: non scrive a nome di un altro'
);
select throws_ok(
  format(
    'insert into public.commenti (id, officina_id, testo) values (gen_random_uuid(), %L, %L)',
    :rossi, 'Officina non mia'
  ),
  '42501', null,
  'cliente: non indica un''officina di cui non è membro'
);
select throws_ok(
  $$update public.commenti set testo = 'Cambiato' where id = 'c0000000-0000-4000-8000-000000000001'$$,
  '42501', null,
  'cliente: non modifica il suo commento'
);

-- ---------------------------------------------------------------- operatore
select pg_temp.come('a0000000-0000-4000-8000-000000000003');
select lives_ok(
  format(
    'insert into public.commenti (id, officina_id, testo, created_at) values (%L, %L, %L, %L)',
    'c0000000-0000-4000-8000-000000000002', :rossi, 'Il calendario è comodo', '2000-01-01'
  ),
  'operatore: invia un commento per la sua officina'
);
select is(
  (select created_at from public.commenti where id = 'c0000000-0000-4000-8000-000000000002'),
  now(),
  'la data del commento la mette il database (non si aggira il limite)'
);
select is_empty(
  $$select 1 from public.commenti where id = 'c0000000-0000-4000-8000-000000000001'$$,
  'operatore: non vede i commenti degli altri'
);

-- ---------------------------------------------------------------- admin e anonimo
select pg_temp.come('a0000000-0000-4000-8000-000000000001');
select is(
  (select count(*)::int from public.commenti
   where id in ('c0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002')),
  2,
  'admin: legge tutti i commenti'
);

select pg_temp.come(null);
select throws_ok(
  $$insert into public.commenti (id, testo) values (gen_random_uuid(), 'Senza account')$$,
  '42501', null,
  'anonimo: non invia commenti'
);

-- ---------------------------------------------------------------- limite di 20 in 24 ore
select pg_temp.come('a0000000-0000-4000-8000-000000000005');
select lives_ok(
  $$insert into public.commenti (id, testo)
    select gen_random_uuid(), 'Commento numero ' || n from generate_series(1, 20) as n$$,
  'titolare2: 20 commenti in 24 ore sono permessi'
);
select throws_ok(
  $$insert into public.commenti (id, testo) values (gen_random_uuid(), 'Il ventunesimo')$$,
  'P0001', 'TROPPI_COMMENTI',
  'il 21° commento in 24 ore: TROPPI_COMMENTI'
);

select * from finish();
rollback;

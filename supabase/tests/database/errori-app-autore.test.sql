-- Test della correzione di limita_errori_app (migrazione "errori_app_autore", T269): chi scrive un errore a
-- nome di un altro riceve il rifiuto della RLS (42501), non TROPPI_ERRORI, che rivelerebbe quanti errori
-- ha l'altro. Richiede seed.sql.
-- Eseguire con: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

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
      json_build_object('sub', p_utente, 'role', 'authenticated', 'aal', 'aal2')::text,
      true
    );
  end if;
end;
$$;

-- Utenti del seed: …02 titolare di Gomme Rossi (A), …04 cliente Giulia (B)
\set titolare '''a0000000-0000-4000-8000-000000000002'''
\set cliente '''a0000000-0000-4000-8000-000000000004'''

-- ---------------------------------------------------------------- preparazione (senza utente)
-- A ha già 30 errori nelle ultime 24 ore (inseriti come postgres, sopra la RLS)
reset role;
insert into public.errori_app (id, autore_id, messaggio)
select gen_random_uuid(), :titolare, 'Errore di A numero ' || n from generate_series(1, 30) as n;

select is(
  (select count(*) from public.errori_app where autore_id = :titolare),
  30::bigint,
  'preparazione: A ha 30 errori nelle 24 ore'
);

-- ---------------------------------------------------------------- B a nome di A
select pg_temp.come(:cliente);
select throws_ok(
  format(
    'insert into public.errori_app (id, autore_id, messaggio) values (gen_random_uuid(), %L, %L)',
    :titolare, 'A nome di A'
  ),
  '42501', null,
  'B con l''autore_id di A (che ha 30 errori): 42501 dalla RLS, non TROPPI_ERRORI'
);

-- ---------------------------------------------------------------- anonimo a nome di A
select pg_temp.come(null);
select throws_ok(
  format(
    'insert into public.errori_app (id, autore_id, messaggio) values (gen_random_uuid(), %L, %L)',
    :titolare, 'Anonimo a nome di A'
  ),
  '42501', null,
  'anonimo con l''autore_id di A: 42501, non TROPPI_ERRORI'
);

reset role;
select ok(
  not has_table_privilege('anon', 'public.errori_app', 'insert'),
  'anon non ha il privilegio INSERT su errori_app'
);
select is(
  (select count(*) from public.errori_app where autore_id = :titolare),
  30::bigint,
  'i tentativi a nome di A non hanno aggiunto righe'
);

-- ---------------------------------------------------------------- A al 31°
select pg_temp.come(:titolare);
select throws_ok(
  $$insert into public.errori_app (id, messaggio) values (gen_random_uuid(), 'Il trentunesimo')$$,
  'P0001', 'TROPPI_ERRORI',
  'A al 31° errore in 24 ore: TROPPI_ERRORI'
);

-- ---------------------------------------------------------------- B a nome suo
select pg_temp.come(:cliente);
select lives_ok(
  $$insert into public.errori_app (id, messaggio)
    values ('e0000000-0000-4000-8000-000000000269', 'Errore di B')$$,
  'B segnala un errore a nome suo'
);

reset role;
select is(
  (select count(*) from public.errori_app
   where id = 'e0000000-0000-4000-8000-000000000269' and autore_id = :cliente),
  1::bigint,
  'l''errore di B è salvato a nome di B'
);

select * from finish();
rollback;

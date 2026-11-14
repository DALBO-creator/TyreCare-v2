-- Test della preferenza sulle email di riserva (migrazione "email_notifiche", T199). Richiede seed.sql
-- (titolare a…0002 e cliente a…0004 di Gomme Rossi). Eseguire con: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(13);

create function pg_temp.come(p_utente uuid) returns void language plpgsql as $$
begin
  reset role;
  set local role authenticated;
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_utente, 'role', 'authenticated', 'aal', 'aal2')::text,
    true
  );
end;
$$;

\set titolare '''a0000000-0000-4000-8000-000000000002'''
\set cliente '''a0000000-0000-4000-8000-000000000004'''

-- ---------------------------------------------------------------- colonna e profilo nuovo
select col_not_null('public', 'profiles', 'email_notifiche', 'email_notifiche non nulla');

insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-0000000000f1',
   'authenticated', 'authenticated', 'email.notifiche@tyrecare.test', now(), '{"nome": "E"}');

select is(
  (select email_notifiche from public.profiles where id = 'a0000000-0000-4000-8000-0000000000f1'),
  true, 'profilo nuovo: email di riserva accese'
);

-- ---------------------------------------------------------------- stato di partenza (seed)
select is(
  (select email_notifiche from public.profiles where id = :titolare),
  true, 'partenza: titolare con email accese'
);
select is(
  (select email_notifiche from public.profiles where id = :cliente),
  true, 'partenza: cliente con email accese'
);

-- ---------------------------------------------------------------- il cliente sul proprio profilo
select pg_temp.come(:cliente);
select lives_ok(
  $$update public.profiles set email_notifiche = false
    where id = 'a0000000-0000-4000-8000-000000000004'$$,
  'il cliente spegne le proprie email'
);
reset role;
select is(
  (select email_notifiche from public.profiles where id = :cliente),
  false, 'cliente: email spente'
);

select pg_temp.come(:cliente);
select lives_ok(
  $$update public.profiles set email_notifiche = true
    where id = 'a0000000-0000-4000-8000-000000000004'$$,
  'il cliente riaccende le proprie email'
);
reset role;
select is(
  (select email_notifiche from public.profiles where id = :cliente),
  true, 'cliente: email riaccese'
);

-- ---------------------------------------------------------------- profili altrui: negato (0 righe)
select pg_temp.come(:cliente);
select lives_ok(
  $$update public.profiles set email_notifiche = false
    where id = 'a0000000-0000-4000-8000-000000000002'$$,
  'cliente sul profilo del titolare: nessun errore ma nessuna riga (RLS)'
);
reset role;
select is(
  (select email_notifiche from public.profiles where id = :titolare),
  true, 'il cliente non cambia le email del titolare'
);

-- La sua officina non decide per il cliente
select pg_temp.come(:titolare);
select lives_ok(
  $$update public.profiles set email_notifiche = false
    where id = 'a0000000-0000-4000-8000-000000000004'$$,
  'titolare sul profilo del cliente: nessun errore ma nessuna riga (RLS)'
);
reset role;
select is(
  (select email_notifiche from public.profiles where id = :cliente),
  true, 'il titolare non cambia le email del cliente'
);

-- Il cliente non vede le preferenze del titolare (non è un collega)
select pg_temp.come(:cliente);
select is(
  (select count(*)::int from public.profiles where id = 'a0000000-0000-4000-8000-000000000002'),
  0, 'il cliente non legge il profilo del titolare'
);
reset role;

select * from finish();
rollback;

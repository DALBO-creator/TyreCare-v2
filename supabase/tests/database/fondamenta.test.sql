-- Test delle policy RLS e dei trigger della migrazione "fondamenta". Richiede i dati di seed.sql.
-- Eseguire con: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(17);

-- Simula una richiesta dal client con il JWT dell'utente indicato (null = anonimo).
create function pg_temp.come(p_utente uuid) returns void language plpgsql as $$
begin
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

-- ---------------------------------------------------------------- anonimo
select pg_temp.come(null);

select is(
  (select count(*) from public.officine)::int, 1,
  'anonimo: vede solo le officine ATTIVE'
);
select is_empty('select * from public.profiles', 'anonimo: nessun profilo visibile');

-- ---------------------------------------------------------------- cliente
reset role;
select pg_temp.come('a0000000-0000-4000-8000-000000000004');

select results_eq(
  'select id from public.profiles',
  $$values ('a0000000-0000-4000-8000-000000000004'::uuid)$$,
  'cliente: vede solo il proprio profilo'
);
select is_empty('select * from public.officina_utenti', 'cliente: non vede i membri delle officine');

select lives_ok(
  $$update public.profiles set nome = 'Giulia Maria' where id = 'a0000000-0000-4000-8000-000000000004'$$,
  'cliente: modifica il proprio nome'
);
select throws_ok(
  $$update public.profiles set ruolo = 'ADMIN' where id = 'a0000000-0000-4000-8000-000000000004'$$,
  '42501', null,
  'cliente: non può promuoversi ADMIN'
);
select throws_ok(
  $$insert into public.officine (ragione_sociale, partita_iva) values ('Abusiva', '11111111111')$$,
  '42501', null,
  'cliente: non può creare officine'
);
select throws_ok(
  $$insert into public.officina_utenti (officina_id, profile_id, ruolo)
    values ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000004', 'TITOLARE')$$,
  '42501', null,
  'cliente: non può aggiungersi a un''officina'
);

-- ---------------------------------------------------------------- operatore
reset role;
select pg_temp.come('a0000000-0000-4000-8000-000000000003');

select is(
  (select count(*) from public.profiles)::int, 2,
  'operatore: vede il proprio profilo e quello del titolare'
);
select is(
  (select count(*) from public.officina_utenti)::int, 2,
  'operatore: vede i colleghi della propria officina'
);

update public.officine set telefono = '+39 000 0000000'
  where id = 'b0000000-0000-4000-8000-000000000001';
reset role;
select isnt(
  (select telefono from public.officine where id = 'b0000000-0000-4000-8000-000000000001'),
  '+39 000 0000000',
  'operatore: non modifica i dati dell''officina'
);

-- ---------------------------------------------------------------- titolare
select pg_temp.come('a0000000-0000-4000-8000-000000000002');

select lives_ok(
  $$update public.officine set telefono = '+39 011 9999999'
    where id = 'b0000000-0000-4000-8000-000000000001'$$,
  'titolare: modifica i dati della propria officina'
);
select throws_ok(
  $$update public.officine set stato_affiliazione = 'SOSPESA'
    where id = 'b0000000-0000-4000-8000-000000000001'$$,
  '42501', null,
  'titolare: non cambia lo stato di affiliazione'
);
select throws_ok(
  $$delete from public.officina_utenti where profile_id = 'a0000000-0000-4000-8000-000000000002'$$,
  '23514', null,
  'titolare: non può lasciare l''officina senza titolare'
);
select lives_ok(
  $$update public.officina_utenti set ruolo = 'TITOLARE'
    where profile_id = 'a0000000-0000-4000-8000-000000000003'$$,
  'titolare: promuove un operatore a titolare'
);

-- ---------------------------------------------------------------- admin
reset role;
select pg_temp.come('a0000000-0000-4000-8000-000000000001');

select is((select count(*) from public.officine)::int, 2, 'admin: vede tutte le officine');
select lives_ok(
  $$update public.officine set stato_affiliazione = 'ATTIVA'
    where id = 'b0000000-0000-4000-8000-000000000002'$$,
  'admin: attiva un''officina'
);

select * from finish();
rollback;

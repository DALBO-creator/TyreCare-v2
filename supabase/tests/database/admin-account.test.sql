-- Test di «Conferma email» e «Disconnetti» dell'amministratore (migrazione "pannello_admin").
-- Richiede seed.sql. Eseguire con: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(23);

-- p_aal: 'aal2' = sessione con la verifica in due passaggi, 'aal1' = solo password.
create function pg_temp.come(p_utente uuid, p_aal text default 'aal2') returns void language plpgsql as $$
begin
  reset role;
  set local role authenticated;
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_utente, 'role', 'authenticated', 'aal', p_aal)::text,
    true
  );
end;
$$;

-- Utenti del seed: …01 admin, …02 titolare di Gomme Rossi, …04 cliente Giulia
\set admin '''a0000000-0000-4000-8000-000000000001'''
\set titolare '''a0000000-0000-4000-8000-000000000002'''
\set cliente '''a0000000-0000-4000-8000-000000000004'''
-- Utenti del test: …e1 con l'email da confermare, …e2 già confermato il 2020-01-02
\set nuovo '''a3690000-0000-4000-8000-0000000000e1'''
\set confermato '''a3690000-0000-4000-8000-0000000000e2'''
\set inesistente '''a3690000-0000-4000-8000-0000000000ff'''

-- ---------------------------------------------------------------- dati (da postgres)
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000000', :nuovo, 'authenticated', 'authenticated',
   'nuovo.account@tyrecare.test', null, '{"nome": "Nuovo", "cognome": "Account"}'),
  ('00000000-0000-0000-0000-000000000000', :confermato, 'authenticated', 'authenticated',
   'confermato.account@tyrecare.test', '2020-01-02 10:00+00', '{"nome": "Gia", "cognome": "Confermato"}');

-- Colonne di GoTrue: una sessione e un refresh token del nuovo utente e una sessione del cliente
insert into auth.sessions (id, user_id)
values
  ('a3690000-0000-4000-8000-0000000000c1', :nuovo),
  ('a3690000-0000-4000-8000-0000000000c2', :cliente);
insert into auth.refresh_tokens (instance_id, token, user_id, revoked, session_id)
values
  ('00000000-0000-0000-0000-000000000000', 'tok-t369-nuovo', :nuovo, false,
   'a3690000-0000-4000-8000-0000000000c1');

select is(
  (select email_confirmed_at from auth.users where id = :nuovo), null,
  'partenza: l''email del nuovo utente non è confermata'
);

-- ---------------------------------------------------------------- negati (nessuna modifica)
select pg_temp.come(:admin, 'aal1');
select throws_ok(
  format('select public.admin_conferma_email(%L)', :nuovo), '42501', null, 'admin aal1: non conferma l''email'
);
select throws_ok(
  format('select public.admin_disconnetti_utente(%L)', :nuovo), '42501', null, 'admin aal1: non disconnette'
);
select pg_temp.come(:titolare);
select throws_ok(
  format('select public.admin_conferma_email(%L)', :nuovo), '42501', null, 'titolare: non conferma l''email'
);
select throws_ok(
  format('select public.admin_disconnetti_utente(%L)', :nuovo), '42501', null, 'titolare: non disconnette'
);
select pg_temp.come(:cliente);
select throws_ok(
  format('select public.admin_conferma_email(%L)', :nuovo), '42501', null, 'cliente: non conferma l''email'
);
select throws_ok(
  format('select public.admin_disconnetti_utente(%L)', :nuovo), '42501', null, 'cliente: non disconnette'
);

-- ---------------------------------------------------------------- Conferma email (admin con 2FA)
select pg_temp.come(:admin);
select lives_ok(
  format('select public.admin_conferma_email(%L)', :nuovo), 'conferma dell''email'
);
select is(
  (select azione || '|' || oggetto_id from public.admin_registro order by id desc limit 1),
  'conferma_email|' || :nuovo::text, 'la conferma finisce nel registro con l''utente'
);
select is(
  (select tabella from public.admin_registro order by id desc limit 1), 'auth.users',
  'il registro indica la tabella auth.users'
);
reset role;
select ok(
  (select email_confirmed_at is not null from auth.users where id = :nuovo),
  'l''email del nuovo utente ora è confermata'
);

select pg_temp.come(:admin);
select lives_ok(
  format('select public.admin_conferma_email(%L)', :confermato), 'conferma su un utente già confermato'
);
reset role;
select is(
  (select email_confirmed_at from auth.users where id = :confermato), '2020-01-02 10:00+00'::timestamptz,
  'già confermato: la data non cambia'
);

select pg_temp.come(:admin);
select throws_ok(
  format('select public.admin_conferma_email(%L)', :inesistente),
  'P0001', 'UTENTE_NON_TROVATO', 'conferma: utente inesistente'
);

-- ---------------------------------------------------------------- Disconnetti (admin con 2FA)
reset role;
select is(
  (select count(*) from auth.sessions where user_id = :nuovo)::int, 1, 'partenza: una sessione del nuovo utente'
);
select is(
  (select count(*) from auth.refresh_tokens where user_id = :nuovo::text)::int, 1,
  'partenza: un refresh token del nuovo utente'
);
select is(
  (select count(*) from auth.sessions where user_id = :cliente and id = 'a3690000-0000-4000-8000-0000000000c2')::int,
  1, 'partenza: una sessione di test del cliente'
);

select pg_temp.come(:admin);
select lives_ok(
  format('select public.admin_disconnetti_utente(%L)', :nuovo), 'disconnessione dell''utente'
);
reset role;
select is(
  (select count(*) from auth.sessions where user_id = :nuovo)::int, 0, 'nessuna sessione rimasta'
);
select is(
  (select count(*) from auth.refresh_tokens where user_id = :nuovo::text)::int, 0, 'nessun refresh token rimasto'
);
select is(
  (select count(*) from auth.sessions where id = 'a3690000-0000-4000-8000-0000000000c2')::int, 1,
  'la sessione di un altro utente resta'
);

select pg_temp.come(:admin);
select is(
  (select azione || '|' || oggetto_id from public.admin_registro order by id desc limit 1),
  'disconnetti|' || :nuovo::text, 'la disconnessione finisce nel registro con l''utente'
);
select throws_ok(
  format('select public.admin_disconnetti_utente(%L)', :inesistente),
  'P0001', 'UTENTE_NON_TROVATO', 'disconnetti: utente inesistente'
);

select * from finish();
rollback;

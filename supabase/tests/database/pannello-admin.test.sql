-- Test del pannello dell'amministratore (migrazione "pannello_admin"). Richiede seed.sql.
-- Eseguire con: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(24);

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

-- Utenti del seed: …01 admin, …02 titolare e …03 operatore di Gomme Rossi, …04 cliente Giulia
\set admin '''a0000000-0000-4000-8000-000000000001'''
\set titolare '''a0000000-0000-4000-8000-000000000002'''
\set cliente '''a0000000-0000-4000-8000-000000000004'''

-- ---------------------------------------------------------------- admin senza 2FA
select pg_temp.come(:admin, 'aal1');
select is(public.is_admin(), false, 'admin con la sola password: non è admin');
select throws_ok($$select public.admin_riepilogo()$$, '42501', null, 'admin aal1: niente riepilogo');
select throws_ok(
  $$select * from public.admin_cerca_utenti('')$$, '42501', null, 'admin aal1: niente ricerca'
);
-- La 2FA dell'admin è attiva (seed.sql): con aal1 la policy restrittiva (due_fattori) non apre nulla
select is(
  (select count(*) from public.officine)::int, 0,
  'admin aal1: non vede nessuna officina finché non scrive il codice'
);

-- ---------------------------------------------------------------- non admin
select pg_temp.come(:cliente);
select is(public.is_admin(), false, 'cliente con 2FA: non è admin');
select throws_ok($$select public.admin_riepilogo()$$, '42501', null, 'cliente: niente riepilogo');
select throws_ok(
  format('select public.admin_blocca_utente(%L, true)', :titolare),
  '42501', null, 'cliente: non blocca nessuno'
);
select is_empty('select * from public.admin_registro', 'cliente: non legge il registro');
select throws_ok(
  $$insert into public.admin_registro (azione) values ('finta')$$,
  '42501', null, 'cliente: non scrive nel registro'
);

-- ---------------------------------------------------------------- admin con 2FA
select pg_temp.come(:admin);
select is(public.is_admin(), true, 'admin con 2FA: è admin');
select ok((public.admin_riepilogo() ->> 'utenti')::int >= 4, 'riepilogo: conta gli utenti');
select is(
  (select count(*) from public.admin_cerca_utenti('giulia'))::int, 1, 'ricerca per nome'
);
select is(
  (select count(*) from public.admin_cerca_utenti('%'))::int, 0, '% vale come testo, non come jolly'
);

select lives_ok(
  format('select public.admin_correggi_profilo(%L, %L, %L, %L)', :cliente, ' Giulia ', 'Bianchi', ''),
  'correzione del profilo'
);
select is(
  (select telefono from public.profiles where id = :cliente), null, 'telefono vuoto → null'
);
select is(
  (select azione || ':' || tabella from public.admin_registro order by id desc limit 1),
  'update:profiles', 'la correzione finisce nel registro'
);

select throws_ok(
  format('select public.admin_cambia_ruolo(%L, %L)', :cliente, 'ADMIN'),
  'P0001', 'RUOLO_ADMIN_SOLO_DAL_DATABASE', 'nessun nuovo ADMIN dall''app'
);
select throws_ok(
  format('update public.profiles set ruolo = %L where id = %L', 'ADMIN', :cliente),
  '42501', null, 'nemmeno con un update diretto'
);
select lives_ok(
  format('select public.admin_cambia_ruolo(%L, %L)', :cliente, 'OFFICINA'), 'CLIENTE → OFFICINA'
);

select throws_ok(
  format('select public.admin_blocca_utente(%L, true)', :admin),
  'P0001', 'NON_SI_BLOCCA_UN_ADMIN', 'l''admin non blocca sé stesso'
);
select lives_ok(format('select public.admin_blocca_utente(%L, true)', :cliente), 'blocca il cliente');
select is(
  (select bloccato from public.admin_cerca_utenti('giulia')), true, 'il cliente risulta bloccato'
);
select lives_ok(format('select public.admin_blocca_utente(%L, false)', :cliente), 'e lo sblocca');

select throws_ok(
  $$delete from public.admin_registro$$, '42501', null, 'l''admin non cancella il registro'
);

select * from finish();
rollback;

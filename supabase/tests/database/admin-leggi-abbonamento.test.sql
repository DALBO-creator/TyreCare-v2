-- Test di admin_leggi_abbonamento (migrazione 20261116000100): solo l'admin con aal2 legge la riga
-- intera, note interne comprese. Richiede seed.sql. Eseguire con: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

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

\set rossi '''b0000000-0000-4000-8000-000000000001'''
\set admin '''a0000000-0000-4000-8000-000000000001'''
\set titolare '''a0000000-0000-4000-8000-000000000002'''

update public.abbonamenti set note_admin = 'nota riservata' where officina_id = :rossi;

select pg_temp.come(:admin);
select is(
  (select note_admin from public.admin_leggi_abbonamento(:rossi)), 'nota riservata',
  'admin aal2: legge le note interne'
);
select is(
  (select ragione_sociale from public.admin_leggi_abbonamento(:rossi)), 'Gomme Rossi S.n.c.',
  'admin aal2: con la ragione sociale'
);
select is(
  (select stato_affiliazione::text from public.admin_leggi_abbonamento(:rossi)), 'ATTIVA',
  'admin aal2: con lo stato dell''officina'
);
select throws_ok(
  format('select * from public.admin_leggi_abbonamento(%L)', gen_random_uuid()),
  'P0001', 'OFFICINA_NON_TROVATA', 'officina inesistente: OFFICINA_NON_TROVATA'
);

select pg_temp.come(:admin, 'aal1');
select throws_ok(
  format('select * from public.admin_leggi_abbonamento(%L)', :rossi), '42501', null,
  'admin con la sola password: rifiutato'
);

select pg_temp.come(:titolare);
select throws_ok(
  format('select * from public.admin_leggi_abbonamento(%L)', :rossi), '42501', null,
  'titolare: rifiutato'
);
select throws_ok(
  format('select note_admin from public.abbonamenti where officina_id = %L', :rossi), '42501', null,
  'titolare: la colonna note_admin non si legge'
);

reset role;
set local role anon;
select throws_ok(
  format('select * from public.admin_leggi_abbonamento(%L)', :rossi), '42501', null,
  'anonimo: rifiutato'
);

select * from finish();
rollback;

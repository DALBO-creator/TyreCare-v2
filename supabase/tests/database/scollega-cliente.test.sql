-- Test di scollega_cliente (T258, R38). Richiede seed.sql.
-- Eseguire con: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(22);

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

-- Gomme Rossi: C0001 Giulia (collegata a …0004, Panda d…0001), C0002 Franco (senza account).
-- Pneus Express: c…0003 Giulia (collegata a …0004, Panda d…0003).
\set giulia_rossi '''c0000000-0000-4000-8000-000000000001'''
\set franco_rossi '''c0000000-0000-4000-8000-000000000002'''
\set giulia_express '''c0000000-0000-4000-8000-000000000003'''
\set giulia '''a0000000-0000-4000-8000-000000000004'''

-- ---------------------------------------------------------------- stato di partenza (dritta T100)
-- Come proprietario (senza utente): il trigger di protezione lascia scrivere profile_id.
update public.clienti_officina set profile_id = :giulia where id in (:giulia_rossi, :giulia_express);
update public.clienti_officina set profile_id = null where id = :franco_rossi;

-- Un invito già usato da Giulia: deve restare com'è.
insert into public.inviti_cliente (
  officina_id, cliente_officina_id, email, codice_hash, scade_il, usato_il, usato_da
) values (
  'b0000000-0000-4000-8000-000000000001', :giulia_rossi, 'cliente@tyrecare.test',
  public.impronta_codice('prova-t258-scollega'), now() + interval '14 days', now(), :giulia
);

create temp table partenza as
select count(*)::int as prenotazioni
from public.prenotazioni
where cliente_id = 'a0000000-0000-4000-8000-000000000004';

select is(
  (select profile_id from public.clienti_officina where id = :giulia_rossi),
  :giulia::uuid,
  'partenza: Giulia è collegata al cliente di Gomme Rossi'
);
select is(
  (select profile_id from public.clienti_officina where id = :franco_rossi),
  null,
  'partenza: Franco non è collegato'
);

select pg_temp.come(:giulia);
select is(
  (select count(*)::int from public.veicoli where cliente_officina_id = :giulia_rossi),
  1,
  'partenza: Giulia vede la Panda di Gomme Rossi'
);

-- ---------------------------------------------------------------- permessi negati
select pg_temp.come('a0000000-0000-4000-8000-000000000003'); -- operatore di Gomme Rossi
select throws_ok(
  format('select public.scollega_cliente(%L)', :giulia_rossi),
  '42501', null,
  'l''operatore non può scollegare'
);

select pg_temp.come('a0000000-0000-4000-8000-000000000005'); -- titolare di Pneus Express
select throws_ok(
  format('select public.scollega_cliente(%L)', :giulia_rossi),
  '42501', null,
  'il titolare di un''altra officina non può scollegare'
);

select pg_temp.come(:giulia);
select throws_ok(
  format('select public.scollega_cliente(%L)', :giulia_rossi),
  '42501', null,
  'il cliente non può scollegarsi da solo'
);

select pg_temp.come('a0000000-0000-4000-8000-000000000002'); -- titolare di Gomme Rossi
select throws_ok(
  format('select public.scollega_cliente(%L)', :giulia_express),
  '42501', null,
  'il titolare non può scollegare un cliente di un''altra officina'
);
select throws_ok(
  'select public.scollega_cliente(''c0000000-0000-4000-8000-0000000000ff'')',
  '42501', null,
  'per il titolare un cliente inesistente è 42501, come uno di un''altra officina'
);
select throws_ok(
  format('update public.clienti_officina set profile_id = null where id = %L', :giulia_rossi),
  '42501', null,
  'l''update diretto di profile_id resta vietato anche al titolare'
);

reset role;
select is(
  (select profile_id from public.clienti_officina where id = :giulia_rossi),
  :giulia::uuid,
  'dopo i tentativi negati Giulia è ancora collegata'
);

-- ---------------------------------------------------------------- titolare
select pg_temp.come('a0000000-0000-4000-8000-000000000002');
select throws_ok(
  format('select public.scollega_cliente(%L)', :franco_rossi),
  'P0001', 'CLIENTE_NON_COLLEGATO',
  'cliente senza account: CLIENTE_NON_COLLEGATO'
);
select lives_ok(
  format('select public.scollega_cliente(%L)', :giulia_rossi),
  'il titolare scollega Giulia'
);

reset role;
select is(
  (select profile_id from public.clienti_officina where id = :giulia_rossi),
  null,
  'profile_id ora è vuoto'
);

select pg_temp.come(:giulia);
select is(
  (select count(*)::int from public.veicoli where cliente_officina_id = :giulia_rossi),
  0,
  'Giulia non vede più la Panda di Gomme Rossi'
);
select is(
  (select count(*)::int from public.veicoli where id = 'd0000000-0000-4000-8000-000000000003'),
  1,
  'Giulia vede ancora la Panda di Pneus Express'
);

reset role;
select is(
  (select usato_da from public.inviti_cliente
   where codice_hash = public.impronta_codice('prova-t258-scollega') and usato_il is not null),
  :giulia::uuid,
  'l''invito già usato non cambia'
);
select is(
  (select count(*)::int from public.prenotazioni
   where cliente_id = 'a0000000-0000-4000-8000-000000000004'),
  (select prenotazioni from partenza),
  'le prenotazioni di Giulia non cambiano'
);

select pg_temp.come('a0000000-0000-4000-8000-000000000002');
select throws_ok(
  format('select public.scollega_cliente(%L)', :giulia_rossi),
  'P0001', 'CLIENTE_NON_COLLEGATO',
  'una seconda volta: CLIENTE_NON_COLLEGATO'
);

-- ---------------------------------------------------------------- admin
select pg_temp.come('a0000000-0000-4000-8000-000000000001');
select throws_ok(
  'select public.scollega_cliente(''c0000000-0000-4000-8000-0000000000ff'')',
  'P0001', 'CLIENTE_NON_TROVATO',
  'per l''admin un cliente inesistente è CLIENTE_NON_TROVATO'
);
select lives_ok(
  format('select public.scollega_cliente(%L)', :giulia_express),
  'l''admin scollega il cliente di un''officina qualsiasi'
);

reset role;
select is(
  (select profile_id from public.clienti_officina where id = :giulia_express),
  null,
  'profile_id del cliente di Pneus Express ora è vuoto'
);

select ok(
  not has_function_privilege('anon', 'public.scollega_cliente(uuid)', 'execute'),
  'anon non può eseguire scollega_cliente'
);

select * from finish();
rollback;

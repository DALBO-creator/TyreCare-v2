-- Test di scollega_cliente sugli inviti ancora aperti (T277, R42). Richiede seed.sql.
-- Eseguire con: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(18);

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

-- Gomme Rossi: C0001 Giulia (collegata a …0004), C0002 Franco (senza account).
-- Pneus Express: c…0003 Giulia (collegata a …0004).
\set rossi '''b0000000-0000-4000-8000-000000000001'''
\set express '''b0000000-0000-4000-8000-000000000002'''
\set giulia_rossi '''c0000000-0000-4000-8000-000000000001'''
\set franco_rossi '''c0000000-0000-4000-8000-000000000002'''
\set giulia_express '''c0000000-0000-4000-8000-000000000003'''
\set giulia '''a0000000-0000-4000-8000-000000000004'''

-- ---------------------------------------------------------------- stato di partenza (dritta T100)
-- Come proprietario (senza utente): il trigger di protezione lascia scrivere profile_id.
update public.clienti_officina set profile_id = :giulia where id in (:giulia_rossi, :giulia_express);
update public.clienti_officina set profile_id = null where id = :franco_rossi;

-- Giulia di Gomme Rossi: un invito già usato da lei e uno ancora aperto con la sua email (quello che,
-- senza T277, la ricollegherebbe dopo lo scollegamento). Un invito aperto anche per Franco (non
-- collegato) e uno per la Giulia di Pneus Express (un altro cliente, che non si scollega).
insert into public.inviti_cliente (
  officina_id, cliente_officina_id, email, codice_hash, scade_il, usato_il, usato_da
) values
  (:rossi, :giulia_rossi, 'cliente@tyrecare.test', public.impronta_codice('prova-t277-usato'),
   now() + interval '14 days', now() - interval '1 day', :giulia),
  (:rossi, :giulia_rossi, 'cliente@tyrecare.test', public.impronta_codice('prova-t277-aperto'),
   now() + interval '14 days', null, null),
  (:rossi, :franco_rossi, 'franco@esempio.it', public.impronta_codice('prova-t277-franco'),
   now() + interval '14 days', null, null),
  (:express, :giulia_express, 'cliente@tyrecare.test', public.impronta_codice('prova-t277-express'),
   now() + interval '14 days', null, null);

create function pg_temp.invito(p_codice text) returns public.inviti_cliente language sql as $$
  select * from public.inviti_cliente where codice_hash = public.impronta_codice(p_codice);
$$;

select is(
  (select profile_id from public.clienti_officina where id = :giulia_rossi),
  :giulia::uuid,
  'partenza: Giulia è collegata al cliente di Gomme Rossi'
);
select is(
  (pg_temp.invito('prova-t277-aperto')).annullato_il,
  null,
  'partenza: l''invito aperto di Giulia non è annullato'
);
select is(
  (select profile_id from public.clienti_officina where id = :franco_rossi),
  null,
  'partenza: Franco non è collegato'
);
select is(
  (pg_temp.invito('prova-t277-franco')).annullato_il,
  null,
  'partenza: l''invito aperto di Franco non è annullato'
);

-- ---------------------------------------------------------------- cliente non collegato
select pg_temp.come('a0000000-0000-4000-8000-000000000002'); -- titolare di Gomme Rossi
select throws_ok(
  format('select public.scollega_cliente(%L)', :franco_rossi),
  'P0001', 'CLIENTE_NON_COLLEGATO',
  'cliente senza account: CLIENTE_NON_COLLEGATO'
);

reset role;
select is(
  (pg_temp.invito('prova-t277-franco')).annullato_il,
  null,
  'CLIENTE_NON_COLLEGATO non annulla l''invito aperto di Franco'
);

-- ---------------------------------------------------------------- scollegamento
select pg_temp.come('a0000000-0000-4000-8000-000000000002');
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
select ok(
  (pg_temp.invito('prova-t277-aperto')).annullato_il is not null,
  'l''invito aperto di Giulia ora è annullato'
);
select is(
  (pg_temp.invito('prova-t277-usato')).annullato_il,
  null,
  'l''invito già usato non viene annullato'
);
select is(
  (pg_temp.invito('prova-t277-usato')).usato_il,
  now() - interval '1 day',
  'l''invito già usato conserva la sua data d''uso'
);
select is(
  (pg_temp.invito('prova-t277-usato')).usato_da,
  :giulia::uuid,
  'l''invito già usato conserva chi l''ha usato'
);
select is(
  (pg_temp.invito('prova-t277-express')).annullato_il,
  null,
  'l''invito aperto di un altro cliente (Pneus Express) non cambia'
);

-- ---------------------------------------------------------------- il vecchio invito non ricollega
select pg_temp.come(:giulia);
select throws_ok(
  'select public.accetta_invito(''prova-t277-aperto'')',
  'P0001', 'INVITO_ANNULLATO',
  'il vecchio invito aperto ora dà INVITO_ANNULLATO'
);

reset role;
select is(
  (select profile_id from public.clienti_officina where id = :giulia_rossi),
  null,
  'dopo il tentativo il cliente resta scollegato'
);

-- ---------------------------------------------------------------- un invito nuovo funziona
insert into public.inviti_cliente (
  officina_id, cliente_officina_id, email, codice_hash, scade_il
) values (
  :rossi, :giulia_rossi, 'cliente@tyrecare.test', public.impronta_codice('prova-t277-nuovo'),
  now() + interval '14 days'
);

select pg_temp.come(:giulia);
select lives_ok(
  'select public.accetta_invito(''prova-t277-nuovo'')',
  'un invito creato dopo lo scollegamento si accetta'
);

reset role;
select is(
  (select profile_id from public.clienti_officina where id = :giulia_rossi),
  :giulia::uuid,
  'con l''invito nuovo Giulia è di nuovo collegata'
);
select is(
  (pg_temp.invito('prova-t277-nuovo')).usato_da,
  :giulia::uuid,
  'l''invito nuovo risulta usato da Giulia'
);

select * from finish();
rollback;

-- Test di unisci_clienti (T031). Richiede seed.sql.
-- Eseguire con: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(19);

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

\set rossi '''b0000000-0000-4000-8000-000000000001'''
\set express '''b0000000-0000-4000-8000-000000000002'''

-- Gomme Rossi: A (da) con account, codice, telefono, 2 veicoli, un invito; B (in) con telefono proprio
-- e senza email. C ed E: due clienti con account diversi; D (senza account) ha il telefono che a C manca.
-- Express: X.
insert into public.clienti_officina
  (id, officina_id, profile_id, codice_gestionale, nome, cognome, telefono, email, note, consenso_marketing)
values
  ('c3100000-0000-4000-8000-00000000000a', :rossi, 'a0000000-0000-4000-8000-000000000004', 'T31A',
   'Anna', 'Da', '+39 333 0000001', 'anna@esempio.it', 'nota da', true),
  ('c3100000-0000-4000-8000-00000000000b', :rossi, null, null,
   'Anna', 'In', '+39 333 0000002', null, 'nota in', false),
  ('c3100000-0000-4000-8000-00000000000c', :rossi, 'a0000000-0000-4000-8000-000000000004', null,
   'Carlo', 'Uno', null, null, '', false),
  ('c3100000-0000-4000-8000-00000000000e', :rossi, 'a0000000-0000-4000-8000-000000000005', null,
   'Elia', 'Due', null, null, '', false),
  ('c3100000-0000-4000-8000-00000000000d', :rossi, null, null,
   'Carlo', 'Doppio', '+39 333 0000003', null, '', false),
  ('c3100000-0000-4000-8000-00000000000f', :express, null, null, 'Xavier', 'Altro', null, null, '', false);
insert into public.veicoli (id, officina_id, cliente_officina_id, targa, marca, modello) values
  ('c3100000-0000-4000-8000-0000000000a1', :rossi, 'c3100000-0000-4000-8000-00000000000a', 'ZZ001AA', 'Fiat', 'Panda'),
  ('c3100000-0000-4000-8000-0000000000a2', :rossi, 'c3100000-0000-4000-8000-00000000000a', 'ZZ002AA', 'Fiat', '500');
insert into public.inviti_cliente (officina_id, cliente_officina_id, email, codice_hash, scade_il)
values (:rossi, 'c3100000-0000-4000-8000-00000000000a', 'anna@esempio.it', '\x31', now() + interval '1 day');

-- ---------------------------------------------------------------- permessi (casi negati)
select pg_temp.come('a0000000-0000-4000-8000-000000000003'); -- operatore di Gomme Rossi
select throws_ok(
  $$select public.unisci_clienti('c3100000-0000-4000-8000-00000000000a', 'c3100000-0000-4000-8000-00000000000b')$$,
  '42501', null,
  'l''operatore non può unire'
);
select pg_temp.come('a0000000-0000-4000-8000-000000000005'); -- titolare di Pneus Express
select throws_ok(
  $$select public.unisci_clienti('c3100000-0000-4000-8000-00000000000a', 'c3100000-0000-4000-8000-00000000000b')$$,
  '42501', null,
  'il titolare di un''altra officina non può unire'
);
select pg_temp.come('a0000000-0000-4000-8000-000000000004'); -- cliente
select throws_ok(
  $$select public.unisci_clienti('c3100000-0000-4000-8000-00000000000a', 'c3100000-0000-4000-8000-00000000000b')$$,
  '42501', null,
  'un cliente non può unire'
);
reset role;
select set_config('request.jwt.claims', '', true);
select throws_ok(
  $$select public.unisci_clienti('c3100000-0000-4000-8000-00000000000a', 'c3100000-0000-4000-8000-00000000000b')$$,
  '42501', null,
  'senza utente non si può unire'
);

-- ---------------------------------------------------------------- clienti non validi
select pg_temp.come('a0000000-0000-4000-8000-000000000002'); -- titolare di Gomme Rossi
select throws_ok(
  $$select public.unisci_clienti('c3100000-0000-4000-8000-00000000000a', 'c3100000-0000-4000-8000-00000000000f')$$,
  'P0001', 'CLIENTI_NON_VALIDI',
  'clienti di officine diverse'
);
select throws_ok(
  $$select public.unisci_clienti('c3100000-0000-4000-8000-00000000000a', 'c3100000-0000-4000-8000-00000000000a')$$,
  'P0001', 'CLIENTI_NON_VALIDI',
  'stesso cliente due volte'
);
select throws_ok(
  $$select public.unisci_clienti('c3100000-0000-4000-8000-00000000000a', gen_random_uuid())$$,
  'P0001', 'CLIENTI_NON_VALIDI',
  'cliente inesistente'
);
select throws_ok(
  $$select public.unisci_clienti('c3100000-0000-4000-8000-00000000000c', 'c3100000-0000-4000-8000-00000000000e')$$,
  'P0001', 'ACCOUNT_DIVERSI',
  'due clienti con account diversi'
);

-- ---------------------------------------------------------------- unione riuscita
select lives_ok(
  $$select public.unisci_clienti('c3100000-0000-4000-8000-00000000000a', 'c3100000-0000-4000-8000-00000000000b')$$,
  'il titolare unisce A in B'
);
select is(
  (select count(*)::int from public.veicoli
    where cliente_officina_id = 'c3100000-0000-4000-8000-00000000000b'
      and id in ('c3100000-0000-4000-8000-0000000000a1', 'c3100000-0000-4000-8000-0000000000a2')),
  2,
  'i veicoli di A ora sono di B'
);
select is(
  (select count(*)::int from public.inviti_cliente
    where cliente_officina_id = 'c3100000-0000-4000-8000-00000000000b'),
  1,
  'l''invito di A ora è di B'
);
select is(
  (select count(*)::int from public.clienti_officina where id = 'c3100000-0000-4000-8000-00000000000a'),
  0,
  'A non esiste più'
);
select is(
  (select telefono from public.clienti_officina where id = 'c3100000-0000-4000-8000-00000000000b'),
  '+39 333 0000002',
  'il telefono già presente in B non cambia'
);
select is(
  (select email from public.clienti_officina where id = 'c3100000-0000-4000-8000-00000000000b'),
  'anna@esempio.it',
  'l''email vuota di B è presa da A'
);
select is(
  (select codice_gestionale from public.clienti_officina where id = 'c3100000-0000-4000-8000-00000000000b'),
  'T31A',
  'il codice gestionale di A passa a B senza errore di unicità'
);
select is(
  (select profile_id from public.clienti_officina where id = 'c3100000-0000-4000-8000-00000000000b'),
  'a0000000-0000-4000-8000-000000000004'::uuid,
  'l''account collegato di A passa a B'
);
select is(
  (select note || '|' || consenso_marketing::text from public.clienti_officina
    where id = 'c3100000-0000-4000-8000-00000000000b'),
  E'nota in\nnota da|true',
  'le note si accodano e il consenso marketing è l''or dei due'
);

-- ---------------------------------------------------------------- telefono vuoto di p_in
select lives_ok(
  $$select public.unisci_clienti('c3100000-0000-4000-8000-00000000000d', 'c3100000-0000-4000-8000-00000000000c')$$,
  'il titolare unisce D in C'
);
select is(
  (select telefono from public.clienti_officina where id = 'c3100000-0000-4000-8000-00000000000c'),
  '+39 333 0000003',
  'il telefono vuoto (null) di C è preso da D'
);

select * from finish();
rollback;

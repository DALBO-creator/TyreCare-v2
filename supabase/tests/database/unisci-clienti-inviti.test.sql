-- Test di unisci_clienti sugli inviti aperti (T073). Richiede seed.sql.
-- Eseguire con: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

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

-- Gomme Rossi. Caso 1: P1 (da, senza account) in Q1 (in, collegato al cliente …0004), un invito aperto
-- per parte. Caso 2: P2 in Q2, nessuno collegato: un invito aperto per parte (quello di P2 più recente),
-- più un invito già usato e uno scaduto, entrambi più recenti degli aperti.
insert into public.clienti_officina (id, officina_id, profile_id, nome, cognome) values
  ('c7300000-0000-4000-8000-0000000000a1', :rossi, null, 'Paolo', 'Da'),
  ('c7300000-0000-4000-8000-0000000000b1', :rossi, 'a0000000-0000-4000-8000-000000000004', 'Paolo', 'In'),
  ('c7300000-0000-4000-8000-0000000000a2', :rossi, null, 'Rita', 'Da'),
  ('c7300000-0000-4000-8000-0000000000b2', :rossi, null, 'Rita', 'In');
insert into public.inviti_cliente
  (id, officina_id, cliente_officina_id, email, codice_hash, created_at, scade_il, usato_il)
values
  ('c7300000-0000-4000-8000-000000000011', :rossi, 'c7300000-0000-4000-8000-0000000000a1',
   'paolo@esempio.it', '\x7301', now() - interval '2 hours', now() + interval '1 day', null),
  ('c7300000-0000-4000-8000-000000000012', :rossi, 'c7300000-0000-4000-8000-0000000000b1',
   'paolo@esempio.it', '\x7302', now() - interval '1 hour', now() + interval '1 day', null),
  ('c7300000-0000-4000-8000-000000000021', :rossi, 'c7300000-0000-4000-8000-0000000000a2',
   'rita@esempio.it', '\x7303', now() - interval '1 hour', now() + interval '1 day', null),
  ('c7300000-0000-4000-8000-000000000022', :rossi, 'c7300000-0000-4000-8000-0000000000b2',
   'rita@esempio.it', '\x7304', now() - interval '2 hours', now() + interval '1 day', null),
  ('c7300000-0000-4000-8000-000000000023', :rossi, 'c7300000-0000-4000-8000-0000000000b2',
   'rita@esempio.it', '\x7305', now() - interval '30 minutes', now() + interval '1 day',
   now() - interval '10 minutes'),
  ('c7300000-0000-4000-8000-000000000024', :rossi, 'c7300000-0000-4000-8000-0000000000a2',
   'rita@esempio.it', '\x7306', now() - interval '20 minutes', now() - interval '1 minute', null);

-- ---------------------------------------------------------------- stato di partenza
select is(
  (select count(*)::int from public.inviti_cliente
    where cliente_officina_id in ('c7300000-0000-4000-8000-0000000000a1', 'c7300000-0000-4000-8000-0000000000b1')
      and usato_il is null and annullato_il is null and scade_il > now()),
  2,
  'caso 1: prima dell''unione ci sono 2 inviti aperti'
);
select is(
  (select count(*)::int from public.inviti_cliente
    where cliente_officina_id in ('c7300000-0000-4000-8000-0000000000a2', 'c7300000-0000-4000-8000-0000000000b2')
      and usato_il is null and annullato_il is null and scade_il > now()),
  2,
  'caso 2: prima dell''unione ci sono 2 inviti aperti'
);

-- ---------------------------------------------------------------- permessi (caso negato)
select pg_temp.come('a0000000-0000-4000-8000-000000000003'); -- operatore di Gomme Rossi
select throws_ok(
  $$select public.unisci_clienti('c7300000-0000-4000-8000-0000000000a1', 'c7300000-0000-4000-8000-0000000000b1')$$,
  '42501', null,
  'l''operatore non può unire (e non annulla inviti)'
);

-- ---------------------------------------------------------------- caso 1: scheda collegata
select pg_temp.come('a0000000-0000-4000-8000-000000000002'); -- titolare di Gomme Rossi
select lives_ok(
  $$select public.unisci_clienti('c7300000-0000-4000-8000-0000000000a1', 'c7300000-0000-4000-8000-0000000000b1')$$,
  'caso 1: il titolare unisce'
);
reset role;
select is(
  (select count(*)::int from public.inviti_cliente
    where cliente_officina_id = 'c7300000-0000-4000-8000-0000000000b1'
      and usato_il is null and annullato_il is null and scade_il > now()),
  0,
  'caso 1: con l''account collegato non resta nessun invito aperto'
);
select is(
  (select count(*)::int from public.inviti_cliente
    where cliente_officina_id = 'c7300000-0000-4000-8000-0000000000b1' and annullato_il is not null),
  2,
  'caso 1: entrambi gli inviti (anche quello arrivato da P1) sono annullati'
);

-- ---------------------------------------------------------------- caso 2: nessun account
select pg_temp.come('a0000000-0000-4000-8000-000000000002');
select lives_ok(
  $$select public.unisci_clienti('c7300000-0000-4000-8000-0000000000a2', 'c7300000-0000-4000-8000-0000000000b2')$$,
  'caso 2: il titolare unisce'
);
reset role;
select is(
  (select count(*)::int from public.inviti_cliente
    where cliente_officina_id = 'c7300000-0000-4000-8000-0000000000b2'
      and usato_il is null and annullato_il is null and scade_il > now()),
  1,
  'caso 2: resta aperto un solo invito'
);
select is(
  (select id from public.inviti_cliente
    where cliente_officina_id = 'c7300000-0000-4000-8000-0000000000b2'
      and usato_il is null and annullato_il is null and scade_il > now()),
  'c7300000-0000-4000-8000-000000000021'::uuid,
  'caso 2: resta aperto il più recente (arrivato da P2)'
);
select ok(
  (select annullato_il is not null from public.inviti_cliente
    where id = 'c7300000-0000-4000-8000-000000000022'),
  'caso 2: l''invito più vecchio è annullato'
);
select ok(
  (select annullato_il is null from public.inviti_cliente
    where id = 'c7300000-0000-4000-8000-000000000023'),
  'l''invito già usato non cambia'
);
select ok(
  (select annullato_il is null from public.inviti_cliente
    where id = 'c7300000-0000-4000-8000-000000000024'),
  'l''invito scaduto non cambia'
);

select * from finish();
rollback;

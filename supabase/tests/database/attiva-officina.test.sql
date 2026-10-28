-- Test di attiva_officina e sospendi_officina (T100). Richiede seed.sql.
-- Eseguire con: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(27);

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
      json_build_object('sub', p_utente, 'role', 'authenticated')::text,
      true
    );
  end if;
end;
$$;

-- Torna all'utente dei test (salta l'RLS) per leggere lo stato senza filtri.
create function pg_temp.stato(p_officina_id uuid) returns text language sql as $$
  select stato_affiliazione::text from public.officine where id = p_officina_id;
$$;
create function pg_temp.ruolo(p_profile_id uuid) returns text language sql as $$
  select ruolo::text from public.profiles where id = p_profile_id;
$$;

\set rossi '''b0000000-0000-4000-8000-000000000001'''
\set express '''b0000000-0000-4000-8000-000000000002'''
\set admin '''a0000000-0000-4000-8000-000000000001'''
\set titolare '''a0000000-0000-4000-8000-000000000002'''
\set cliente '''a0000000-0000-4000-8000-000000000004'''
\set titolare2 '''a0000000-0000-4000-8000-000000000005'''

-- ---------------------------------------------------------------- preparazione (senza utente)
-- Nel seed titolare2 è già OFFICINA: lo rimetto CLIENTE, altrimenti la promozione non si vede.
-- L'admin diventa anche titolare di Pneus Express: deve restare ADMIN.
update public.profiles set ruolo = 'CLIENTE' where id = :titolare2;
insert into public.officina_utenti (officina_id, profile_id, ruolo) values (:express, :admin, 'TITOLARE');

select is(pg_temp.ruolo(:titolare2), 'CLIENTE', 'preparazione: titolare2 parte CLIENTE');
select is(pg_temp.stato(:express), 'IN_ATTESA', 'preparazione: Pneus Express parte IN_ATTESA');

-- ---------------------------------------------------------------- accessi negati
select pg_temp.come(:titolare); -- titolare di Gomme Rossi
select throws_ok(
  format('select public.attiva_officina(%L)', :express),
  '42501', null,
  'il titolare di Gomme Rossi non può attivare Pneus Express'
);
select throws_ok(
  format('select public.sospendi_officina(%L)', :rossi),
  '42501', null,
  'il titolare di Gomme Rossi non può sospendere la sua officina'
);

select pg_temp.come(:titolare2); -- titolare di Pneus Express (ora CLIENTE)
select throws_ok(
  format('select public.attiva_officina(%L)', :express),
  '42501', null,
  'il titolare di Pneus Express non può attivare la sua officina'
);

select pg_temp.come(:cliente);
select throws_ok(
  format('select public.attiva_officina(%L)', :express),
  '42501', null,
  'il cliente non può attivare un''officina'
);
select throws_ok(
  format('select public.sospendi_officina(%L)', :rossi),
  '42501', null,
  'il cliente non può sospendere un''officina'
);
select throws_ok(
  format('select public.attiva_officina(%L)', gen_random_uuid()),
  '42501', null,
  'il cliente su un''officina inesistente riceve 42501 (il controllo admin viene prima)'
);

select pg_temp.come(null); -- anon
select throws_ok(
  format('select public.attiva_officina(%L)', :express),
  '42501', null,
  'anon non può attivare un''officina'
);
select throws_ok(
  format('select public.sospendi_officina(%L)', :rossi),
  '42501', null,
  'anon non può sospendere un''officina'
);

reset role;
select ok(
  not has_function_privilege('anon', 'public.attiva_officina(uuid)', 'execute')
    and not has_function_privilege('anon', 'public.sospendi_officina(uuid)', 'execute'),
  'anon non ha EXECUTE sulle due funzioni'
);
select is(pg_temp.stato(:express), 'IN_ATTESA', 'dopo i tentativi negati Pneus Express è ancora IN_ATTESA');
select is(pg_temp.stato(:rossi), 'ATTIVA', 'dopo i tentativi negati Gomme Rossi è ancora ATTIVA');
select is(pg_temp.ruolo(:titolare2), 'CLIENTE', 'dopo i tentativi negati titolare2 è ancora CLIENTE');

-- ---------------------------------------------------------------- admin: attiva
select pg_temp.come(:admin);
select lives_ok(
  format('select public.attiva_officina(%L)', :express),
  'l''admin attiva Pneus Express'
);
reset role;
select is(pg_temp.stato(:express), 'ATTIVA', 'Pneus Express è ATTIVA');
select is(pg_temp.ruolo(:titolare2), 'OFFICINA', 'il titolare di Pneus Express è passato a OFFICINA');
select is(pg_temp.ruolo(:admin), 'ADMIN', 'l''admin titolare di Pneus Express resta ADMIN');

select pg_temp.come(:admin);
select lives_ok(
  format('select public.attiva_officina(%L)', :express),
  'seconda attivazione senza errori'
);
reset role;
select is(pg_temp.stato(:express), 'ATTIVA', 'dopo la seconda attivazione Pneus Express è ancora ATTIVA');

-- ---------------------------------------------------------------- admin: officina inesistente
select pg_temp.come(:admin);
select throws_ok(
  format('select public.attiva_officina(%L)', gen_random_uuid()),
  'P0001', 'OFFICINA_NON_TROVATA',
  'attiva_officina su un uuid casuale: OFFICINA_NON_TROVATA'
);
select throws_ok(
  format('select public.sospendi_officina(%L)', gen_random_uuid()),
  'P0001', 'OFFICINA_NON_TROVATA',
  'sospendi_officina su un uuid casuale: OFFICINA_NON_TROVATA'
);

-- ---------------------------------------------------------------- admin: sospendi
select lives_ok(
  format('select public.sospendi_officina(%L)', :express),
  'l''admin sospende Pneus Express'
);
reset role;
select is(pg_temp.stato(:express), 'SOSPESA', 'Pneus Express è SOSPESA');
select is(pg_temp.ruolo(:titolare2), 'OFFICINA', 'dopo la sospensione il titolare resta OFFICINA (R14)');

select pg_temp.come(:admin);
select lives_ok(
  format('select public.sospendi_officina(%L)', :express),
  'seconda sospensione senza errori'
);
reset role;
select is(pg_temp.stato(:express), 'SOSPESA', 'dopo la seconda sospensione Pneus Express è ancora SOSPESA');

select * from finish();
rollback;

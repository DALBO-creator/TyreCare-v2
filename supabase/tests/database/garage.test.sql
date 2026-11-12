-- Test della migrazione "garage_cliente": il cliente vede le officine che hanno i suoi veicoli.
-- Richiede i dati di seed.sql. Eseguire con: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(6);

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
      json_build_object('sub', p_utente, 'role', 'authenticated', 'aal', 'aal2')::text,
      true
    );
  end if;
end;
$$;

-- ---------------------------------------------------------------- cliente (Giulia)
select pg_temp.come('a0000000-0000-4000-8000-000000000004');

select results_eq(
  'select ragione_sociale from public.officine order by 1',
  $$values ('Gomme Rossi S.n.c.'::text), ('Pneus Express S.r.l.'::text)$$,
  'cliente: vede anche l''officina in attesa di cui è cliente'
);

-- Il garage: i veicoli collegati al suo account con il nome dell'officina
select results_eq(
  $$select v.targa, o.ragione_sociale from public.veicoli v
    join public.officine o on o.id = v.officina_id order by 2$$,
  $$values ('AB123CD', 'Gomme Rossi S.n.c.'::text), ('AB123CD', 'Pneus Express S.r.l.'::text)$$,
  'cliente: i suoi veicoli in entrambe le officine'
);

-- La RLS non dà errore: l'aggiornamento semplicemente non tocca nessuna riga
update public.officine set telefono = '000' where id = 'b0000000-0000-4000-8000-000000000002';
reset role;
select is(
  (select telefono from public.officine where id = 'b0000000-0000-4000-8000-000000000002'),
  '+39 011 7654321',
  'cliente: non può modificare l''officina'
);

-- ---------------------------------------------------------------- non clienti
select pg_temp.come(null);
select is_empty(
  $$select 1 from public.officine where id = 'b0000000-0000-4000-8000-000000000002'$$,
  'anonimo: l''officina in attesa resta nascosta'
);

-- Titolare di Gomme Rossi: non è cliente di Pneus Express
select pg_temp.come('a0000000-0000-4000-8000-000000000002');
select is_empty(
  $$select 1 from public.officine where id = 'b0000000-0000-4000-8000-000000000002'$$,
  'altra officina: l''officina in attesa resta nascosta'
);

-- Scollegato dall'account, il cliente non vede più l'officina in attesa
-- (come service role, senza JWT: solo TyreCare può cambiare il collegamento)
reset role;
select set_config('request.jwt.claims', '', true);
update public.clienti_officina set profile_id = null where id = 'c0000000-0000-4000-8000-000000000003';
select pg_temp.come('a0000000-0000-4000-8000-000000000004');
select is_empty(
  $$select 1 from public.officine where id = 'b0000000-0000-4000-8000-000000000002'$$,
  'cliente scollegato: non vede più l''officina in attesa'
);

select * from finish();
rollback;

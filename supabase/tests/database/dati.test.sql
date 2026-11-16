-- Test delle policy RLS, dei vincoli e dei trigger della migrazione "dati". Richiede i dati di seed.sql.
-- Eseguire con: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(20);

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

-- ---------------------------------------------------------------- anonimo e admin
select pg_temp.come(null);
select is_empty('select * from public.veicoli', 'anonimo: nessun veicolo visibile');

-- ADMIN (Ada): i dati dei clienti delle officine non sono suoi (GDPR)
select pg_temp.come('a0000000-0000-4000-8000-000000000001');
select is_empty('select * from public.clienti_officina', 'admin: non vede i clienti delle officine');

-- ---------------------------------------------------------------- cliente (Giulia)
select pg_temp.come('a0000000-0000-4000-8000-000000000004');

select results_eq(
  'select targa, officina_id from public.veicoli order by officina_id',
  $$values ('AB123CD', 'b0000000-0000-4000-8000-000000000001'::uuid),
           ('AB123CD', 'b0000000-0000-4000-8000-000000000002'::uuid)$$,
  'cliente: vede la sua Panda in entrambe le officine, non la Golf di un altro'
);
select is(
  (select count(*) from public.misure_pneumatico)::int, 4,
  'cliente: vede le misure del controllo della sua auto'
);
select is(
  (select count(*) from public.clienti_officina)::int, 2,
  'cliente: vede solo le proprie schede cliente'
);
select throws_ok(
  $$insert into public.controlli (officina_id, veicolo_id)
    values ('b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001')$$,
  '42501', null,
  'cliente: non può inserire controlli'
);
update public.veicoli set modello = 'Modificata' where id = 'd0000000-0000-4000-8000-000000000001';
select is(
  (select modello from public.veicoli where id = 'd0000000-0000-4000-8000-000000000001'), 'Panda',
  'cliente: non può modificare il veicolo'
);

-- ---------------------------------------------------------------- operatore di Gomme Rossi (Luca)
select pg_temp.come('a0000000-0000-4000-8000-000000000003');

-- Senza contare i veicoli: i test end-to-end (`npm run test:e2e`) ne aggiungono altri a Gomme Rossi
select results_eq(
  'select distinct officina_id from public.veicoli',
  $$values ('b0000000-0000-4000-8000-000000000001'::uuid)$$,
  'operatore: vede solo i veicoli della propria officina'
);
select lives_ok(
  $$insert into public.controlli (id, officina_id, veicolo_id, km)
    values ('f0000000-0000-4000-8000-000000000099', 'b0000000-0000-4000-8000-000000000001',
            'd0000000-0000-4000-8000-000000000001', 43000)$$,
  'operatore: inserisce un controllo'
);
select is(
  (select eseguito_da from public.controlli where id = 'f0000000-0000-4000-8000-000000000099'),
  'a0000000-0000-4000-8000-000000000003'::uuid,
  'operatore: il controllo risulta eseguito da lui'
);
select lives_ok(
  $$insert into public.misure_pneumatico
      (controllo_id, pneumatico_id, veicolo_id, officina_id, battistrada_mm)
    values ('f0000000-0000-4000-8000-000000000099', 'e0000000-0000-4000-8000-000000000001',
            'd0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 6.0)$$,
  'operatore: inserisce una misura'
);
select throws_ok(
  $$insert into public.misure_pneumatico
      (controllo_id, pneumatico_id, veicolo_id, officina_id, battistrada_mm)
    values ('f0000000-0000-4000-8000-000000000099', 'e0000000-0000-4000-8000-000000000002',
            'd0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 6.0)$$,
  '23503', null,
  'operatore: una misura non può mischiare veicoli diversi'
);
select throws_ok(
  $$insert into public.veicoli (officina_id, targa)
    values ('b0000000-0000-4000-8000-000000000002', 'ZZ999ZZ')$$,
  '42501', null,
  'operatore: non può inserire veicoli in un''altra officina'
);
select throws_ok(
  $$insert into public.veicoli (officina_id, targa) values ('b0000000-0000-4000-8000-000000000001', 'ef 456-gh')$$,
  '23505', null,
  'operatore: targa normalizzata, il duplicato viene riconosciuto'
);
select throws_ok(
  $$insert into public.pneumatici (officina_id, veicolo_id, posizione, stagione)
    values ('b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001',
            'ANT_SX', 'ESTIVO')$$,
  '23505', null,
  'operatore: un solo pneumatico montato per posizione'
);
select throws_ok(
  $$update public.clienti_officina set profile_id = 'a0000000-0000-4000-8000-000000000001'
    where id = 'c0000000-0000-4000-8000-000000000002'$$,
  '42501', null,
  'operatore: non può collegare un cliente a un account'
);
delete from public.veicoli where id = 'd0000000-0000-4000-8000-000000000002';
select isnt_empty(
  $$select 1 from public.veicoli where id = 'd0000000-0000-4000-8000-000000000002'$$,
  'operatore: non può eliminare veicoli (solo il titolare)'
);

-- ---------------------------------------------------------------- titolare di Gomme Rossi (Mario)
select pg_temp.come('a0000000-0000-4000-8000-000000000002');

delete from public.veicoli where id = 'd0000000-0000-4000-8000-000000000002';
select is_empty(
  $$select 1 from public.veicoli where id = 'd0000000-0000-4000-8000-000000000002'$$,
  'titolare: elimina un veicolo della propria officina'
);

-- ---------------------------------------------------------------- titolare di Pneus Express (Paolo)
select pg_temp.come('a0000000-0000-4000-8000-000000000005');

select is_empty('select * from public.controlli', 'altra officina: non vede i controlli di Gomme Rossi');
select results_eq(
  'select nome from public.clienti_officina',
  $$values ('Giulia')$$,
  'altra officina: vede solo i propri clienti'
);

select * from finish();
rollback;

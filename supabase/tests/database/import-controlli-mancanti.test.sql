-- Test di T074: nell'import dei controlli un valore mancante nel database (DOT nullo, marca o misura
-- vuote) conta come uguale nella ricerca "stessa gomma". Richiede seed.sql.
-- Eseguire con: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

create function pg_temp.come(p_utente uuid) returns void language plpgsql as $$
begin
  reset role;
  set local role authenticated;
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_utente, 'role', 'authenticated')::text,
    true
  );
end;
$$;

-- Una riga del file già pulita (formato di T044), sempre in ANT_SX con DOT 3823
create function pg_temp.r(p_doc text, p_targa text, p_data date, p_misura text, p_marca text)
returns jsonb language sql as $$
  select jsonb_build_object(
    'codice_documento', p_doc, 'targa', p_targa, 'data', p_data, 'km', null, 'posizione', 'ANT_SX',
    'battistrada_mm', 6.5, 'pressione_bar', null, 'usura', null, 'danni', '', 'stagione', null,
    'misura', p_misura, 'marca', p_marca, 'modello', 'Prova', 'dot', '3823', 'note', ''
  );
$$;

\set rossi '''b0000000-0000-4000-8000-000000000001'''

-- Tre veicoli di Gomme Rossi, ognuno con una gomma ANT_SX montata dall'app il 2026-01-01:
-- ZZ741AA senza DOT; ZZ742AA con marca vuota; ZZ743AA con un'altra misura e senza DOT.
insert into public.veicoli (id, officina_id, cliente_officina_id, targa, marca, modello)
select ('d7400000-0000-4000-8000-00000000000' || n)::uuid, :rossi, 'c0000000-0000-4000-8000-000000000001',
  'ZZ74' || n || 'AA', 'Fiat', 'Panda'
from generate_series(1, 3) n;

insert into public.pneumatici (id, officina_id, veicolo_id, posizione, stagione, misura, marca, modello, dot, montato_il)
values
  ('e7400000-0000-4000-8000-000000000001', :rossi, 'd7400000-0000-4000-8000-000000000001', 'ANT_SX',
   'INVERNALE', '205/55 R16', 'Michelin', 'Alpin 6', null, '2026-01-01'),
  ('e7400000-0000-4000-8000-000000000002', :rossi, 'd7400000-0000-4000-8000-000000000002', 'ANT_SX',
   'INVERNALE', '205/55 R16', '', 'Alpin 6', '3823', '2026-01-01'),
  ('e7400000-0000-4000-8000-000000000003', :rossi, 'd7400000-0000-4000-8000-000000000003', 'ANT_SX',
   'INVERNALE', '195/65 R15', 'Michelin', 'Alpin 6', null, '2026-01-01');

-- ---------------------------------------------------------------- (1) DOT nullo nel database
select pg_temp.come('a0000000-0000-4000-8000-000000000002'); -- titolare di Gomme Rossi
select is(
  (public.importa_controlli(:rossi, jsonb_build_array(
    pg_temp.r('T74A1', 'ZZ741AA', '2026-03-10', '205/55 R16', 'Michelin')
  ))->>'pneumatici_nuovi')::int,
  0,
  'DOT nullo nel database e DOT nel file: stessa gomma, nessun pneumatico nuovo'
);
reset role;
select ok(
  (select smontato_il is null from public.pneumatici where id = 'e7400000-0000-4000-8000-000000000001'),
  'la gomma senza DOT resta montata'
);
select is(
  (select count(*)::int from public.pneumatici where veicolo_id = 'd7400000-0000-4000-8000-000000000001'),
  1,
  'nessun doppione della gomma senza DOT'
);
select is(
  (select count(*)::int from public.misure_pneumatico m
   join public.controlli c on c.id = m.controllo_id
   where c.codice_documento = 'T74A1' and m.pneumatico_id = 'e7400000-0000-4000-8000-000000000001'),
  1,
  'la misura del file è agganciata alla gomma senza DOT'
);

-- ---------------------------------------------------------------- (2) marca vuota nel database
select pg_temp.come('a0000000-0000-4000-8000-000000000002');
select is(
  (public.importa_controlli(:rossi, jsonb_build_array(
    pg_temp.r('T74B1', 'ZZ742AA', '2026-03-10', '205/55 R16', 'Michelin')
  ))->>'pneumatici_nuovi')::int,
  0,
  'marca vuota nel database e marca nel file: stessa gomma, nessun pneumatico nuovo'
);
reset role;
select results_eq(
  $$select m.pneumatico_id, p.smontato_il::text from public.misure_pneumatico m
    join public.controlli c on c.id = m.controllo_id
    join public.pneumatici p on p.id = m.pneumatico_id
    where c.codice_documento = 'T74B1'$$,
  $$values ('e7400000-0000-4000-8000-000000000002'::uuid, null::text)$$,
  'la misura è agganciata alla gomma con marca vuota, che resta montata'
);

-- ---------------------------------------------------------------- (3) misura diversa: comportamento invariato
select pg_temp.come('a0000000-0000-4000-8000-000000000002');
select is(
  (public.importa_controlli(:rossi, jsonb_build_array(
    pg_temp.r('T74C1', 'ZZ743AA', '2026-03-10', '205/55 R16', 'Michelin')
  ))->>'pneumatici_nuovi')::int,
  1,
  'misura diversa (anche con DOT nullo nel database): nasce un pneumatico nuovo'
);
reset role;
select results_eq(
  $$select misura, montato_il::text, smontato_il::text, origine::text from public.pneumatici
    where veicolo_id = 'd7400000-0000-4000-8000-000000000003' order by montato_il$$,
  $$values ('195/65 R15', '2026-01-01', '2026-03-10', 'APP'),
           ('205/55 R16', '2026-03-10', null, 'IMPORT')$$,
  'la gomma vecchia è smontata alla data della riga e quella nuova è montata'
);

-- ---------------------------------------------------------------- (4) anon (caso negato)
reset role;
set local role anon;
select throws_ok(
  format('select public.importa_controlli(%L, %L)', :rossi,
    jsonb_build_array(pg_temp.r('T74D1', 'ZZ741AA', '2026-04-10', '205/55 R16', 'Michelin'))),
  '42501', null,
  'anon non può chiamare importa_controlli'
);
reset role;

select * from finish();
rollback;

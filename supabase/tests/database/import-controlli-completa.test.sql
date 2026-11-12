-- Test di T203: nell'import dei controlli la "stessa gomma" (R15) si completa con i valori del file: DOT,
-- marca e misura vuoti nel database prendono quelli del file; i campi già pieni non cambiano (R27).
-- Richiede seed.sql. Eseguire con: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(30);

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

-- Una riga del file già pulita (formato di T044), sempre in ANT_SX
create function pg_temp.r(
  p_doc text, p_targa text, p_data date, p_misura text, p_marca text, p_dot text
)
returns jsonb language sql as $$
  select jsonb_build_object(
    'codice_documento', p_doc, 'targa', p_targa, 'data', p_data, 'km', null, 'posizione', 'ANT_SX',
    'battistrada_mm', 6.5, 'pressione_bar', null, 'usura', null, 'danni', '', 'stagione', null,
    'misura', p_misura, 'marca', p_marca, 'modello', 'Prova', 'dot', p_dot, 'note', ''
  );
$$;

\set rossi '''b0000000-0000-4000-8000-000000000001'''

-- Cinque veicoli di Gomme Rossi, ognuno con una gomma ANT_SX montata dall'app il 2026-01-01:
-- ZZ201AA senza DOT; ZZ202AA Michelin senza misura né DOT; ZZ203AA con i tre campi vuoti;
-- ZZ204AA con DOT 3823 e marca vuota; ZZ205AA senza DOT (per la simulazione).
insert into public.veicoli (id, officina_id, cliente_officina_id, targa, marca, modello)
select ('d2030000-0000-4000-8000-00000000000' || n)::uuid, :rossi, 'c0000000-0000-4000-8000-000000000001',
  'ZZ20' || n || 'AA', 'Fiat', 'Panda'
from generate_series(1, 5) n;

insert into public.pneumatici (id, officina_id, veicolo_id, posizione, stagione, misura, marca, modello, dot, montato_il)
values
  ('e2030000-0000-4000-8000-000000000001', :rossi, 'd2030000-0000-4000-8000-000000000001', 'ANT_SX',
   'INVERNALE', '205/55 R16', 'Michelin', 'Alpin 6', null, '2026-01-01'),
  ('e2030000-0000-4000-8000-000000000002', :rossi, 'd2030000-0000-4000-8000-000000000002', 'ANT_SX',
   'INVERNALE', '', 'Michelin', 'Alpin 6', null, '2026-01-01'),
  ('e2030000-0000-4000-8000-000000000003', :rossi, 'd2030000-0000-4000-8000-000000000003', 'ANT_SX',
   'INVERNALE', '', '', '', null, '2026-01-01'),
  ('e2030000-0000-4000-8000-000000000004', :rossi, 'd2030000-0000-4000-8000-000000000004', 'ANT_SX',
   'INVERNALE', '205/55 R16', '', 'Alpin 6', '3823', '2026-01-01'),
  ('e2030000-0000-4000-8000-000000000005', :rossi, 'd2030000-0000-4000-8000-000000000005', 'ANT_SX',
   'INVERNALE', '205/55 R16', 'Michelin', 'Alpin 6', null, '2026-01-01');

-- ---------------------------------------------------------------- stato di partenza (dritta T100)
select ok(
  (select dot is null from public.pneumatici where id = 'e2030000-0000-4000-8000-000000000001'),
  'prima: la gomma di ZZ201AA non ha DOT'
);
select is(
  (select marca from public.pneumatici where id = 'e2030000-0000-4000-8000-000000000002'),
  'Michelin',
  'prima: la gomma di ZZ202AA è Michelin'
);
select is(
  (select misura from public.pneumatici where id = 'e2030000-0000-4000-8000-000000000002'),
  '',
  'prima: la gomma di ZZ202AA non ha misura'
);
select ok(
  (select misura = '' and marca = '' and dot is null
   from public.pneumatici where id = 'e2030000-0000-4000-8000-000000000003'),
  'prima: la gomma di ZZ203AA ha misura, marca e DOT vuoti'
);

-- ---------------------------------------------------------------- caso negato: un'altra officina
select pg_temp.come('a0000000-0000-4000-8000-000000000005'); -- titolare di Pneus Express
select throws_ok(
  format('select public.importa_controlli(%L, %L)', :rossi,
    jsonb_build_array(pg_temp.r('T203N1', 'ZZ201AA', '2026-03-10', '205/55 R16', 'Michelin', '3823'))),
  '42501', null,
  'il titolare di un''altra officina non può importare (e quindi completare) le gomme di Gomme Rossi'
);
reset role;
select ok(
  (select dot is null from public.pneumatici where id = 'e2030000-0000-4000-8000-000000000001'),
  'dopo il tentativo negato la gomma di ZZ201AA è ancora senza DOT'
);

-- ---------------------------------------------------------------- simulazione: nessun completamento
select pg_temp.come('a0000000-0000-4000-8000-000000000002'); -- titolare di Gomme Rossi
select is(
  (public.importa_controlli(:rossi, jsonb_build_array(
    pg_temp.r('T203S1', 'ZZ205AA', '2026-03-10', '205/55 R16', 'Michelin', '3823')
  ), 'simula.csv', 0, true)->>'pneumatici_nuovi')::int,
  0,
  'simulazione: stessa gomma, nessun pneumatico nuovo'
);
reset role;
select ok(
  (select dot is null from public.pneumatici where id = 'e2030000-0000-4000-8000-000000000005'),
  'la simulazione non completa il DOT'
);

-- ---------------------------------------------------------------- (a) DOT nullo nel database, 3823 nel file
select pg_temp.come('a0000000-0000-4000-8000-000000000002');
select is(
  (public.importa_controlli(:rossi, jsonb_build_array(
    pg_temp.r('T203A1', 'ZZ201AA', '2026-03-10', '205/55 R16', 'Michelin', '3823')
  ))->>'pneumatici_nuovi')::int,
  0,
  '(a) DOT nullo nel database: stessa gomma, nessun pneumatico nuovo'
);
reset role;
select is(
  (select count(*)::int from public.pneumatici where veicolo_id = 'd2030000-0000-4000-8000-000000000001'),
  1,
  '(a) nessuna riga nuova in pneumatici'
);
select is(
  (select dot from public.pneumatici where id = 'e2030000-0000-4000-8000-000000000001'),
  '3823',
  '(a) la stessa riga prende il DOT del file'
);
select results_eq(
  $$select misura, marca, modello, smontato_il::text, origine::text from public.pneumatici
    where id = 'e2030000-0000-4000-8000-000000000001'$$,
  $$values ('205/55 R16', 'Michelin', 'Alpin 6', null::text, 'APP')$$,
  '(a) gli altri campi della gomma non cambiano e resta montata'
);
select is(
  (select count(*)::int from public.misure_pneumatico m
   join public.controlli c on c.id = m.controllo_id
   where c.codice_documento = 'T203A1' and m.pneumatico_id = 'e2030000-0000-4000-8000-000000000001'),
  1,
  '(a) la misura del file è agganciata alla stessa gomma'
);

-- ---------------------------------------------------------------- (b) marca piena nel database, vuota nel file
select pg_temp.come('a0000000-0000-4000-8000-000000000002');
select is(
  (public.importa_controlli(:rossi, jsonb_build_array(
    pg_temp.r('T203B1', 'ZZ202AA', '2026-03-10', '205/55 R16', '', '3823')
  ))->>'pneumatici_nuovi')::int,
  0,
  '(b) marca vuota nel file: stessa gomma, nessun pneumatico nuovo'
);
reset role;
select is(
  (select marca from public.pneumatici where id = 'e2030000-0000-4000-8000-000000000002'),
  'Michelin',
  '(b) la marca resta Michelin'
);
select is(
  (select misura from public.pneumatici where id = 'e2030000-0000-4000-8000-000000000002'),
  '205/55 R16',
  '(b) la misura vuota prende quella del file'
);
select is(
  (select dot from public.pneumatici where id = 'e2030000-0000-4000-8000-000000000002'),
  '3823',
  '(b) il DOT nullo prende quello del file'
);

-- ---------------------------------------------------------------- (c) due righe, DOT diversi, date diverse
-- Il file le porta in ordine inverso: conta l'ordine di data, la prima (marzo) completa la gomma vuota.
select pg_temp.come('a0000000-0000-4000-8000-000000000002');
select is(
  (public.importa_controlli(:rossi, jsonb_build_array(
    pg_temp.r('T203C2', 'ZZ203AA', '2026-06-10', '205/55 R16', 'Michelin', '2124'),
    pg_temp.r('T203C1', 'ZZ203AA', '2026-03-10', '205/55 R16', 'Michelin', '3823')
  ))->>'pneumatici_nuovi')::int,
  1,
  '(c) la seconda riga, con un altro DOT, monta un pneumatico nuovo'
);
reset role;
select results_eq(
  $$select misura, marca, dot, montato_il::text, smontato_il::text, origine::text
    from public.pneumatici where veicolo_id = 'd2030000-0000-4000-8000-000000000003'
    order by montato_il$$,
  $$values ('205/55 R16', 'Michelin', '3823', '2026-01-01', '2026-06-10', 'APP'),
           ('205/55 R16', 'Michelin', '2124', '2026-06-10', null::text, 'IMPORT')$$,
  '(c) la prima riga completa la gomma vuota, la seconda la smonta e monta la sua (R1)'
);
select is(
  (select id from public.pneumatici
   where veicolo_id = 'd2030000-0000-4000-8000-000000000003' and dot = '3823'),
  'e2030000-0000-4000-8000-000000000003'::uuid,
  '(c) la gomma completata è la riga creata in app'
);

-- ---------------------------------------------------------------- (e) campo pieno e diverso: altra gomma
select pg_temp.come('a0000000-0000-4000-8000-000000000002');
select is(
  (public.importa_controlli(:rossi, jsonb_build_array(
    pg_temp.r('T203E1', 'ZZ204AA', '2026-03-10', '205/55 R16', 'Pirelli', '2124')
  ))->>'pneumatici_nuovi')::int,
  1,
  '(e) DOT pieno e diverso dal file: è un''altra gomma, ne nasce una nuova'
);
reset role;
select is(
  (select dot from public.pneumatici where id = 'e2030000-0000-4000-8000-000000000004'),
  '3823',
  '(e) il DOT già pieno non viene sovrascritto'
);
select is(
  (select marca from public.pneumatici where id = 'e2030000-0000-4000-8000-000000000004'),
  '',
  '(e) la gomma che non corrisponde non viene completata (marca resta vuota)'
);
select is(
  (select smontato_il::text from public.pneumatici where id = 'e2030000-0000-4000-8000-000000000004'),
  '2026-03-10',
  '(e) la gomma vecchia è smontata alla data della riga'
);

-- ---------------------------------------------------------------- (d) reimport: nessun cambio
reset role;
create temp table prima as
select id, misura, marca, modello, dot, montato_il, smontato_il, stagione, origine
from public.pneumatici where veicolo_id::text like 'd2030000-%';

select pg_temp.come('a0000000-0000-4000-8000-000000000002');
select is(
  public.importa_controlli(:rossi, jsonb_build_array(
    pg_temp.r('T203A1', 'ZZ201AA', '2026-03-10', '205/55 R16', 'Michelin', '3823'),
    pg_temp.r('T203B1', 'ZZ202AA', '2026-03-10', '205/55 R16', '', '3823'),
    pg_temp.r('T203C2', 'ZZ203AA', '2026-06-10', '205/55 R16', 'Michelin', '2124'),
    pg_temp.r('T203C1', 'ZZ203AA', '2026-03-10', '205/55 R16', 'Michelin', '3823'),
    pg_temp.r('T203E1', 'ZZ204AA', '2026-03-10', '205/55 R16', 'Pirelli', '2124')
  )) - 'targhe_non_trovate',
  '{"controlli_nuovi": 0, "controlli_gia_presenti": 5, "pneumatici_nuovi": 0, "misure_nuove": 0,
    "misure_saltate": 0}'::jsonb,
  '(d) reimport dello stesso file: 5 controlli già presenti e nulla di nuovo'
);
reset role;
select results_eq(
  $$select id, misura, marca, modello, dot, montato_il, smontato_il, stagione::text, origine::text
    from public.pneumatici where veicolo_id::text like 'd2030000-%' order by id$$,
  $$select id, misura, marca, modello, dot, montato_il, smontato_il, stagione::text, origine::text
    from prima order by id$$,
  '(d) dopo il reimport gli pneumatici sono identici (stesse righe, stessi valori)'
);
select is(
  (select count(*)::int from public.pneumatici where veicolo_id::text like 'd2030000-%'),
  7,
  '(d) restano 7 pneumatici (5 di partenza + 2 nuovi)'
);

-- Un documento nuovo con gli stessi valori della gomma completata: stessa gomma, niente da cambiare
select pg_temp.come('a0000000-0000-4000-8000-000000000002');
select is(
  (public.importa_controlli(:rossi, jsonb_build_array(
    pg_temp.r('T203A2', 'ZZ201AA', '2026-04-10', '205/55 R16', 'michelin', '3823')
  ))->>'pneumatici_nuovi')::int,
  0,
  'documento nuovo con i valori della gomma completata: stessa gomma, nessun pneumatico nuovo'
);
reset role;
select results_eq(
  $$select misura, marca, dot, smontato_il::text from public.pneumatici
    where veicolo_id = 'd2030000-0000-4000-8000-000000000001'$$,
  $$values ('205/55 R16', 'Michelin', '3823', null::text)$$,
  'la gomma completata non cambia (marca non riscritta in minuscolo) e resta montata'
);
select is(
  (select count(*)::int from public.misure_pneumatico m
   where m.pneumatico_id = 'e2030000-0000-4000-8000-000000000001'),
  2,
  'la gomma completata ha le misure dei due documenti'
);

select * from finish();
rollback;

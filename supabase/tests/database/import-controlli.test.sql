-- Test dell'import dei controlli (importa_controlli, import_log tipo CONTROLLI). Richiede seed.sql.
-- Eseguire con: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(20);

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

-- Una riga del file già pulita (formato di T044); la misura è sempre 205/55 R16
create function pg_temp.r(
  p_doc text, p_targa text, p_data date, p_pos text, p_marca text,
  p_stagione text default null, p_dot text default '3823'
) returns jsonb language sql as $$
  select jsonb_build_object(
    'codice_documento', p_doc, 'targa', p_targa, 'data', p_data, 'km', null, 'posizione', p_pos,
    'battistrada_mm', 6.5, 'pressione_bar', null, 'usura', null, 'danni', '', 'stagione', p_stagione,
    'misura', '205/55 R16', 'marca', p_marca, 'modello', 'Prova', 'dot', p_dot, 'note', ''
  );
$$;

\set rossi '''b0000000-0000-4000-8000-000000000001'''
\set express '''b0000000-0000-4000-8000-000000000002'''

-- Cinque veicoli di Gomme Rossi, tutti della cliente Giulia (che ha un account: se l'import mandasse
-- notifiche le riceverebbe lei). ZZ431AA e ZZ432AA ricevono le stesse righe in ordine diverso.
insert into public.veicoli (id, officina_id, cliente_officina_id, targa, marca, modello)
select ('d4300000-0000-4000-8000-00000000000' || n)::uuid, :rossi, 'c0000000-0000-4000-8000-000000000001',
  'ZZ43' || n || 'AA', 'Fiat', 'Panda'
from generate_series(1, 5) n;

-- Set A (ZZ431AA): tre documenti, stessa gomma nei primi due (maiuscole, spazi e DOT vuoto diversi),
-- Pirelli nel terzo; un documento di una targa sconosciuta. Gennaio con stagione nulla.
create temp table righe_a as
select jsonb_agg(pg_temp.r(d, t, dt::date, pos, m, st, dot) order by o) as righe
from (values
  (1, 'T43A1', 'ZZ431AA', '2026-01-10', 'ANT_SX', 'Michelin', null, '3823'),
  (2, 'T43A1', 'ZZ431AA', '2026-01-10', 'ANT_DX', 'Michelin', null, '3823'),
  (3, 'T43A2', 'ZZ431AA', '2026-03-15', 'ANT_SX', ' michelin ', null, ''),
  (4, 'T43A2', 'ZZ431AA', '2026-03-15', 'ANT_DX', ' michelin ', null, null),
  (5, 'T43A3', 'ZZ431AA', '2026-06-20', 'ANT_SX', 'Pirelli', 'ESTIVO', null),
  (6, 'T43A3', 'ZZ431AA', '2026-06-20', 'ANT_DX', 'Pirelli', 'ESTIVO', null),
  (7, 'T43A9', 'zz 999 zz', '2026-06-21', 'ANT_SX', 'Pirelli', 'ESTIVO', null)
) as x (o, d, t, dt, pos, m, st, dot);

-- Set B (ZZ432AA): le stesse righe di A (senza la targa sconosciuta), in ordine inverso
create temp table righe_b as
select jsonb_agg(pg_temp.r(replace(d, 'T43A', 'T43B'), 'ZZ432AA', dt::date, pos, m, st, dot) order by o desc) as righe
from (values
  (1, 'T43A1', '2026-01-10', 'ANT_SX', 'Michelin', null, '3823'),
  (2, 'T43A1', '2026-01-10', 'ANT_DX', 'Michelin', null, '3823'),
  (3, 'T43A2', '2026-03-15', 'ANT_SX', ' michelin ', null, ''),
  (4, 'T43A2', '2026-03-15', 'ANT_DX', ' michelin ', null, null),
  (5, 'T43A3', '2026-06-20', 'ANT_SX', 'Pirelli', 'ESTIVO', null),
  (6, 'T43A3', '2026-06-20', 'ANT_DX', 'Pirelli', 'ESTIVO', null)
) as x (o, d, dt, pos, m, st, dot);

grant select on righe_a, righe_b to authenticated;

create temp table prima as
select (select count(*) from public.notifiche) as notifiche;

-- ---------------------------------------------------------------- permessi (casi negati)
select pg_temp.come('a0000000-0000-4000-8000-000000000003'); -- operatore di Gomme Rossi
select throws_ok(
  format('select public.importa_controlli(%L, %L)', :rossi, (select righe from righe_a)),
  '42501', null,
  'l''operatore non può importare i controlli'
);
select pg_temp.come('a0000000-0000-4000-8000-000000000005'); -- titolare di Pneus Express
select throws_ok(
  format('select public.importa_controlli(%L, %L)', :rossi, (select righe from righe_a)),
  '42501', null,
  'il titolare di un''altra officina non può importare'
);

-- ---------------------------------------------------------------- simulazione e import
select pg_temp.come('a0000000-0000-4000-8000-000000000002'); -- titolare di Gomme Rossi
select is(
  public.importa_controlli(:rossi, (select righe from righe_a), 'controlli.csv', 0, true),
  '{"controlli_nuovi": 3, "controlli_gia_presenti": 0, "pneumatici_nuovi": 4, "misure_nuove": 6,
    "misure_saltate": 0, "targhe_non_trovate": ["ZZ999ZZ"]}'::jsonb,
  'simulazione: conteggi giusti e targa sconosciuta elencata'
);

reset role;
select is(
  (select count(*)::int from public.controlli where codice_documento like 'T43%')
    + (select count(*)::int from public.pneumatici where veicolo_id = 'd4300000-0000-4000-8000-000000000001')
    + (select count(*)::int from public.import_log where nome_file = 'controlli.csv'),
  0,
  'la simulazione non scrive nulla (né controlli, né pneumatici, né registro)'
);

select pg_temp.come('a0000000-0000-4000-8000-000000000002');
select is(
  public.importa_controlli(:rossi, (select righe from righe_a), 'controlli.csv', 2, false),
  '{"controlli_nuovi": 3, "controlli_gia_presenti": 0, "pneumatici_nuovi": 4, "misure_nuove": 6,
    "misure_saltate": 0, "targhe_non_trovate": ["ZZ999ZZ"]}'::jsonb,
  'import: gli stessi conteggi della simulazione'
);

-- Due documenti con la stessa gomma = 1 pneumatico; il terzo (Pirelli) smonta il vecchio in quella data
select results_eq(
  $$select marca, montato_il::text, smontato_il::text, stagione::text, origine::text
    from public.pneumatici
    where veicolo_id = 'd4300000-0000-4000-8000-000000000001' and posizione = 'ANT_SX'
    order by montato_il$$,
  $$values ('Michelin', '2026-01-10', '2026-06-20', 'INVERNALE', 'IMPORT'),
           ('Pirelli', '2026-06-20', null, 'ESTIVO', 'IMPORT')$$,
  'stessa gomma in due documenti: un solo pneumatico (stagione nulla a gennaio = INVERNALE); poi la Pirelli lo smonta'
);
select is(
  (select count(*)::int from public.misure_pneumatico m
   join public.pneumatici p on p.id = m.pneumatico_id
   where p.veicolo_id = 'd4300000-0000-4000-8000-000000000001' and p.posizione = 'ANT_SX'
     and p.marca = 'Michelin'),
  2,
  'la gomma Michelin ha le misure dei due documenti'
);
select results_eq(
  $$select tipo, righe_importate, righe_scartate, controlli_nuovi, controlli_gia_presenti,
      pneumatici_nuovi, misure_nuove
    from public.import_log where nome_file = 'controlli.csv'$$,
  $$values ('CONTROLLI', 7, 2, 3, 0, 4, 6)$$,
  'import_log: tipo CONTROLLI e i contatori'
);

-- ---------------------------------------------------------------- reimport
select is(
  public.importa_controlli(:rossi, (select righe from righe_a)) - 'targhe_non_trovate',
  '{"controlli_nuovi": 0, "controlli_gia_presenti": 3, "pneumatici_nuovi": 0, "misure_nuove": 0,
    "misure_saltate": 0}'::jsonb,
  'reimportare lo stesso file: 3 controlli già presenti e nulla di nuovo'
);
reset role;
select is(
  (select count(*)::int from public.controlli where veicolo_id = 'd4300000-0000-4000-8000-000000000001')
    + (select count(*)::int from public.pneumatici where veicolo_id = 'd4300000-0000-4000-8000-000000000001'),
  7,
  'dopo il reimport restano 3 controlli e 4 pneumatici'
);

-- ---------------------------------------------------------------- ordine del file
select pg_temp.come('a0000000-0000-4000-8000-000000000002');
select is(
  public.importa_controlli(:rossi, (select righe from righe_b)),
  '{"controlli_nuovi": 3, "controlli_gia_presenti": 0, "pneumatici_nuovi": 4, "misure_nuove": 6,
    "misure_saltate": 0, "targhe_non_trovate": []}'::jsonb,
  'le stesse righe in ordine inverso: stessi conteggi'
);
reset role;
select results_eq(
  $$select posizione::text, marca, montato_il::text, smontato_il::text, stagione::text
    from public.pneumatici where veicolo_id = 'd4300000-0000-4000-8000-000000000002'
    order by posizione, montato_il$$,
  $$select posizione::text, marca, montato_il::text, smontato_il::text, stagione::text
    from public.pneumatici where veicolo_id = 'd4300000-0000-4000-8000-000000000001'
    order by posizione, montato_il$$,
  'le stesse righe in ordine inverso danno gli stessi pneumatici'
);

-- ---------------------------------------------------------------- documento più vecchio del primo pneumatico
select pg_temp.come('a0000000-0000-4000-8000-000000000002');
select is(
  (public.importa_controlli(:rossi, jsonb_build_array(
    pg_temp.r('T43C2', 'ZZ433AA', '2026-06-01', 'POST_SX', 'Pirelli', 'ESTIVO')
  ))->>'pneumatici_nuovi')::int,
  1,
  'caso storico: il documento recente crea il pneumatico montato'
);
select is(
  (public.importa_controlli(:rossi, jsonb_build_array(
    pg_temp.r('T43C1', 'ZZ433AA', '2026-02-01', 'POST_SX', 'Michelin', 'INVERNALE')
  ))->>'pneumatici_nuovi')::int,
  1,
  'caso storico: il documento più vecchio crea un pneumatico storico'
);
reset role;
select results_eq(
  $$select marca, montato_il::text, smontato_il::text from public.pneumatici
    where veicolo_id = 'd4300000-0000-4000-8000-000000000003' order by montato_il$$,
  $$values ('Michelin', '2026-02-01', '2026-06-01'), ('Pirelli', '2026-06-01', null)$$,
  'il pneumatico storico finisce quando comincia quello successivo'
);

-- ---------------------------------------------------------------- stagione ereditata
select pg_temp.come('a0000000-0000-4000-8000-000000000002');
select is(
  (public.importa_controlli(:rossi, jsonb_build_array(
    pg_temp.r('T43D1', 'ZZ434AA', '2026-01-10', 'ANT_SX', 'Michelin', 'QUATTRO_STAGIONI')
  ))->>'pneumatici_nuovi')::int,
  1,
  'stagione: primo pneumatico con la stagione del file'
);
select is(
  (public.importa_controlli(:rossi, jsonb_build_array(
    pg_temp.r('T43D2', 'ZZ434AA', '2026-07-15', 'ANT_SX', 'Pirelli', null)
  ))->>'pneumatici_nuovi')::int,
  1,
  'stagione: cambio di gomma a luglio senza stagione nel file'
);
reset role;
select is(
  (select stagione::text from public.pneumatici
   where veicolo_id = 'd4300000-0000-4000-8000-000000000004' and marca = 'Pirelli'),
  'QUATTRO_STAGIONI',
  'senza stagione nel file si prende quella della gomma precedente (non quella del mese)'
);

-- ---------------------------------------------------------------- misura doppia
select pg_temp.come('a0000000-0000-4000-8000-000000000002');
select is(
  public.importa_controlli(:rossi, jsonb_build_array(
    pg_temp.r('T43E1', 'ZZ435AA', '2026-05-05', 'ANT_SX', 'Michelin', 'ESTIVO'),
    pg_temp.r('T43E1', 'ZZ435AA', '2026-05-05', 'ANT_SX', 'Michelin', 'ESTIVO')
  )),
  '{"controlli_nuovi": 1, "controlli_gia_presenti": 0, "pneumatici_nuovi": 1, "misure_nuove": 1,
    "misure_saltate": 1, "targhe_non_trovate": []}'::jsonb,
  'la stessa posizione due volte nel documento: la seconda misura è saltata'
);

-- ---------------------------------------------------------------- nessuna notifica
reset role;
select is(
  (select count(*) from public.notifiche),
  (select notifiche from prima),
  'l''import non manda notifiche alla cliente'
);

select * from finish();
rollback;

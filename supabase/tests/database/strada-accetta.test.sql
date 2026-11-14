-- Test dell'intervento su strada, parte 2 (T140, R18): richieste_strada_vicine, accetta_richiesta_strada,
-- chiudi_richiesta_strada. Richiede seed.sql.
-- Eseguire con: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(52);

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

-- Gomme Rossi (ATTIVA, Torino 45.070312 / 7.686856, telefono +39 011 1234567): titolare …0002,
-- operatore …0003. Pneus Express (IN_ATTESA, a 3,7 km): titolare2 …0005. Cliente Giulia …0004.
-- Richieste usate: r1 del cliente (45.1 / 7.7, a 3,46 km da Gomme Rossi); "vecchia" (45.08 / 7.69, a
-- 1,1 km, creata 10 minuti prima); "scaduta" (APERTA ma scade_il passato); "lontana" (45.4 / 7.686856, a
-- 36,7 km, oltre il raggio di 30 km). Le ultime tre si inseriscono come postgres con clienti diversi
-- (una sola richiesta in corso per cliente).
\set rossi '''b0000000-0000-4000-8000-000000000001'''
\set express '''b0000000-0000-4000-8000-000000000002'''
\set admin '''a0000000-0000-4000-8000-000000000001'''
\set titolare '''a0000000-0000-4000-8000-000000000002'''
\set operatore '''a0000000-0000-4000-8000-000000000003'''
\set cliente '''a0000000-0000-4000-8000-000000000004'''
\set titolare2 '''a0000000-0000-4000-8000-000000000005'''
\set vecchia '''c7400000-0000-4000-8000-000000000001'''
\set scaduta '''c7400000-0000-4000-8000-000000000002'''
\set lontana '''c7400000-0000-4000-8000-000000000003'''

-- ---------------------------------------------------------------- preparazione (come postgres)
select is(
  (select count(*) from public.officine where id in (:rossi, :express) and intervento_strada), 0::bigint,
  'partenza: né Gomme Rossi né Pneus Express offrono l''aiuto su strada'
);
select is((select count(*) from public.richieste_strada), 0::bigint, 'partenza: nessuna richiesta');
-- Tutte e due lo offrono: a Pneus Express manca solo lo stato ATTIVA
update public.officine set intervento_strada = true where id in (:rossi, :express);

select pg_temp.come(:cliente);
select lives_ok(
  $$select public.crea_richiesta_strada(45.1, 7.7, 'Gomma a terra in tangenziale', '+39 333 1112223',
    'AB123CD')$$,
  'cliente: richiesta vicino a Gomme Rossi'
);

reset role;
create temp table r1 as select id from public.richieste_strada where cliente_id = :cliente;
grant select on r1 to authenticated, anon;

insert into public.richieste_strada (
  id, cliente_id, latitudine, longitudine, descrizione, telefono, created_at, scade_il
)
values
  (:vecchia, :titolare2, 45.08, 7.69, 'Vecchia', '+39 333 4445556', now() - interval '10 minutes',
    now() + interval '110 minutes'),
  (:scaduta, :admin, 45.1, 7.7, 'Scaduta', '+39 333 4445556', now() - interval '3 hours',
    now() - interval '1 minute'),
  (:lontana, :operatore, 45.4, 7.686856, 'Lontana', '+39 333 4445556', now(), now() + interval '2 hours');

-- ---------------------------------------------------------------- colonne del risultato
select is(
  pg_get_function_result('public.richieste_strada_vicine(uuid)'::regprocedure),
  'TABLE(id uuid, descrizione text, targa text, distanza_km numeric, created_at timestamp with time zone, '
    || 'scade_il timestamp with time zone)',
  'l''elenco ha solo id, descrizione, targa, distanza, creazione e scadenza: niente posizione, telefono, cliente'
);

-- ---------------------------------------------------------------- elenco: permesso
select pg_temp.come(:titolare);
select is(
  (select array_agg(id order by ord) from public.richieste_strada_vicine(:rossi) with ordinality as v (
    id, descrizione, targa, distanza_km, created_at, scade_il, ord)),
  array[(select id from r1), :vecchia::uuid],
  'titolare: le richieste aperte nel raggio dalla più recente; non la scaduta né la lontana'
);
select is(
  (select descrizione || '|' || targa || '|' || distanza_km || '|' || (scade_il = now() + interval '2 hours')
   from public.richieste_strada_vicine(:rossi) where id = (select id from r1)),
  'Gomma a terra in tangenziale|AB123CD|3.5|true',
  'titolare: descrizione, targa, distanza arrotondata a 1 decimale e scadenza'
);
select is(
  (select distanza_km from public.richieste_strada_vicine(:rossi) where id = :vecchia), 1.1,
  'distanza della vecchia: 1,1 km'
);
select pg_temp.come(:operatore);
select is(
  (select count(*) from public.richieste_strada_vicine(:rossi)), 2::bigint,
  'operatore: vede anche lui le due richieste'
);
select pg_temp.come(:titolare);
select is((select count(*) from public.richieste_strada), 0::bigint,
  'titolare: prima dell''accettazione non legge la tabella (niente telefono né posizione)');

-- ---------------------------------------------------------------- elenco: vuoto senza requisiti
reset role;
update public.officine set intervento_strada = false where id = :rossi;
select pg_temp.come(:titolare);
select is((select count(*) from public.richieste_strada_vicine(:rossi)), 0::bigint,
  'officina senza intervento_strada: elenco vuoto');
reset role;
update public.officine set intervento_strada = true, latitudine = null, longitudine = null where id = :rossi;
select pg_temp.come(:titolare);
select is((select count(*) from public.richieste_strada_vicine(:rossi)), 0::bigint,
  'officina senza posizione: elenco vuoto');
reset role;
update public.officine set latitudine = 45.070312, longitudine = 7.686856 where id = :rossi;

select pg_temp.come(:titolare2);
select is((select count(*) from public.richieste_strada_vicine(:express)), 0::bigint,
  'titolare2 con la sua Pneus Express (IN_ATTESA): elenco vuoto');

-- ---------------------------------------------------------------- elenco: negato
select throws_ok(
  format('select * from public.richieste_strada_vicine(%L)', :rossi),
  '42501', null,
  'titolare2: l''elenco di Gomme Rossi (non è membro) è negato'
);
select pg_temp.come(:cliente);
select throws_ok(
  format('select * from public.richieste_strada_vicine(%L)', :rossi),
  '42501', null,
  'cliente: l''elenco di un''officina è negato'
);
reset role;
set local role anon;
select set_config('request.jwt.claims', '', true);
select throws_ok(
  format('select * from public.richieste_strada_vicine(%L)', :rossi),
  '42501', null,
  'anon: elenco negato'
);
select throws_ok(
  format('select public.accetta_richiesta_strada(%L, %L)', (select id from r1), :rossi),
  '42501', null,
  'anon: accettazione negata'
);
select throws_ok(
  format('select public.chiudi_richiesta_strada(%L)', (select id from r1)),
  '42501', null,
  'anon: chiusura negata'
);

-- ---------------------------------------------------------------- accettazione: negata
select pg_temp.come(:titolare2);
select throws_ok(
  format('select public.accetta_richiesta_strada(%L, %L)', (select id from r1), :rossi),
  '42501', null,
  'titolare2: non accetta per Gomme Rossi (non è membro)'
);
select throws_ok(
  format('select public.accetta_richiesta_strada(%L, %L)', (select id from r1), :express),
  '42501', null,
  'titolare2: non accetta per Pneus Express (IN_ATTESA)'
);
select pg_temp.come(:cliente);
select throws_ok(
  format('select public.accetta_richiesta_strada(%L, %L)', (select id from r1), :rossi),
  '42501', null,
  'cliente: non accetta (non è membro)'
);
select pg_temp.come(:titolare);
select throws_ok(
  format('select public.accetta_richiesta_strada(%L, %L)', :lontana, :rossi),
  '42501', null,
  'titolare: la richiesta oltre il raggio non si accetta'
);
select throws_ok(
  format('select public.accetta_richiesta_strada(%L, %L)', :scaduta, :rossi),
  'P0001', 'RICHIESTA_NON_DISPONIBILE',
  'titolare: la richiesta scaduta non si accetta'
);
select throws_ok(
  format('select public.accetta_richiesta_strada(%L, %L)', 'c7400000-0000-4000-8000-0000000000ff', :rossi),
  'P0001', 'RICHIESTA_NON_DISPONIBILE',
  'titolare: una richiesta che non esiste non si accetta'
);
reset role;
select is(
  (select string_agg(descrizione || '=' || stato || '=' || coalesce(officina_id::text, '-'), ' '
     order by descrizione)
   from public.richieste_strada
   where id in ((select id from r1), :lontana, :scaduta)),
  'Gomma a terra in tangenziale=APERTA=- Lontana=APERTA=- Scaduta=APERTA=-',
  'dopo i tentativi negati le richieste sono ancora APERTE e senza officina'
);
select is((select count(*) from public.notifiche where tipo = 'STRADA_ACCETTATA'), 0::bigint,
  'dopo i tentativi negati nessuna notifica STRADA_ACCETTATA');

-- ---------------------------------------------------------------- accettazione: riuscita
select pg_temp.come(:titolare);
select lives_ok(
  format('select public.accetta_richiesta_strada(%L, %L)', (select id from r1), :rossi),
  'titolare: accetta la richiesta del cliente'
);
select is(
  (select stato || '|' || officina_id || '|' || (accettata_il = now())
   from public.richieste_strada where id = (select id from r1)),
  'ACCETTATA|b0000000-0000-4000-8000-000000000001|true',
  'la richiesta è ACCETTATA da Gomme Rossi, adesso'
);

reset role;
select is(
  (select titolo || '|' || testo || '|' || link from public.notifiche
   where destinatario_id = :cliente and tipo = 'STRADA_ACCETTATA'),
  'Un''officina sta arrivando|Gomme Rossi S.n.c. ha accettato la tua richiesta di aiuto su strada. '
    || 'Telefono dell''officina: +39 011 1234567.|/strada',
  'notifica al cliente con nome e telefono dell''officina'
);
select is((select count(*) from public.notifiche where tipo = 'STRADA_ACCETTATA'), 1::bigint,
  'una sola notifica STRADA_ACCETTATA (al cliente)');

-- ---------------------------------------------------------------- dopo l'accettazione
select pg_temp.come(:titolare);
select is(
  (select telefono || '|' || latitudine || '|' || longitudine
   from public.richieste_strada where id = (select id from r1)),
  '+39 333 1112223|45.100000|7.700000',
  'titolare: dopo l''accettazione legge telefono e posizione'
);
select is(
  (select array_agg(id) from public.richieste_strada_vicine(:rossi)),
  array[:vecchia::uuid],
  'la richiesta accettata non compare più nell''elenco'
);
select pg_temp.come(:operatore);
select is(
  (select telefono || '|' || latitudine || '|' || longitudine
   from public.richieste_strada where id = (select id from r1)),
  '+39 333 1112223|45.100000|7.700000',
  'operatore: dopo l''accettazione legge telefono e posizione'
);
select throws_ok(
  format('select public.accetta_richiesta_strada(%L, %L)', (select id from r1), :rossi),
  'P0001', 'RICHIESTA_NON_DISPONIBILE',
  'seconda accettazione: RICHIESTA_NON_DISPONIBILE'
);
select pg_temp.come(:titolare2);
select is((select count(*) from public.richieste_strada where id = (select id from r1)), 0::bigint,
  'titolare2: la richiesta accettata da Gomme Rossi resta nascosta');

-- ---------------------------------------------------------------- chiusura: negata
select throws_ok(
  format('select public.chiudi_richiesta_strada(%L)', (select id from r1)),
  'P0001', 'RICHIESTA_NON_DISPONIBILE',
  'titolare2 (un''altra officina): non chiude la richiesta'
);
select pg_temp.come(:cliente);
select throws_ok(
  format('select public.chiudi_richiesta_strada(%L)', (select id from r1)),
  'P0001', 'RICHIESTA_NON_DISPONIBILE',
  'cliente: non chiude la richiesta (la annulla)'
);
select pg_temp.come(:titolare);
select throws_ok(
  format('select public.chiudi_richiesta_strada(%L)', :vecchia),
  'P0001', 'RICHIESTA_NON_DISPONIBILE',
  'titolare: una richiesta ancora APERTA non si chiude'
);
reset role;
select is((select stato from public.richieste_strada where id = (select id from r1)), 'ACCETTATA',
  'dopo i tentativi negati la richiesta è ancora ACCETTATA');

-- ---------------------------------------------------------------- annullamento dopo l'accettazione
select pg_temp.come(:cliente);
select lives_ok(
  format('select public.annulla_richiesta_strada(%L)', (select id from r1)),
  'cliente: annulla la richiesta accettata'
);
reset role;
select is(
  (select array_agg(destinatario_id::text order by destinatario_id) from public.notifiche
   where tipo = 'STRADA_ANNULLATA'),
  array[:titolare, :operatore]::text[],
  'notifica STRADA_ANNULLATA a titolare e operatore di Gomme Rossi'
);
select pg_temp.come(:titolare);
select throws_ok(
  format('select public.chiudi_richiesta_strada(%L)', (select id from r1)),
  'P0001', 'RICHIESTA_NON_DISPONIBILE',
  'titolare: una richiesta annullata non si chiude'
);
select throws_ok(
  format('select public.accetta_richiesta_strada(%L, %L)', (select id from r1), :rossi),
  'P0001', 'RICHIESTA_NON_DISPONIBILE',
  'titolare: una richiesta annullata non si accetta'
);

-- ---------------------------------------------------------------- chiusura: riuscita
select pg_temp.come(:operatore);
select lives_ok(
  format('select public.accetta_richiesta_strada(%L, %L)', :vecchia, :rossi),
  'operatore: accetta la vecchia'
);
select is((select stato from public.richieste_strada where id = :vecchia), 'ACCETTATA',
  'la vecchia è ACCETTATA');
select pg_temp.come(:titolare);
select lives_ok(
  format('select public.chiudi_richiesta_strada(%L)', :vecchia),
  'titolare: chiude la richiesta accettata dall''operatore della sua officina'
);
select is((select stato from public.richieste_strada where id = :vecchia), 'CHIUSA',
  'la vecchia è CHIUSA');
select throws_ok(
  format('select public.chiudi_richiesta_strada(%L)', :vecchia),
  'P0001', 'RICHIESTA_NON_DISPONIBILE',
  'una richiesta già chiusa non si chiude di nuovo'
);
select is((select count(*) from public.richieste_strada_vicine(:rossi)), 0::bigint,
  'dopo accettazioni e chiusure l''elenco è vuoto');

-- ---------------------------------------------------------------- officina senza telefono
-- Il cliente (con la r1 annullata) fa una nuova richiesta; Gomme Rossi non ha il telefono
select pg_temp.come(:cliente);
select lives_ok(
  $$select public.crea_richiesta_strada(45.1, 7.7, 'Seconda gomma a terra', '+39 333 1112223')$$,
  'cliente: nuova richiesta'
);
reset role;
create temp table r2 as
  select id from public.richieste_strada where cliente_id = :cliente and stato = 'APERTA';
grant select on r2 to authenticated;
update public.officine set telefono = null where id = :rossi;
select is((select telefono from public.officine where id = :rossi), null,
  'Gomme Rossi senza telefono');

select pg_temp.come(:operatore);
select lives_ok(
  format('select public.accetta_richiesta_strada(%L, %L)', (select id from r2), :rossi),
  'operatore: accetta la nuova richiesta'
);
reset role;
select is(
  (select count(*) from public.notifiche
   where destinatario_id = :cliente and tipo = 'STRADA_ACCETTATA'
     and testo = 'Gomme Rossi S.n.c. ha accettato la tua richiesta di aiuto su strada. Resta dove sei: '
       || 'ti chiamerà al numero che hai indicato.'),
  1::bigint,
  'officina senza telefono: la notifica dice al cliente che lo chiamerà l''officina'
);

select * from finish();
rollback;

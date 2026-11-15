-- Test dell'intervento su strada, limiti (T173, R23): chi lavora in un'officina non vede né accetta la
-- propria richiesta; al massimo 3 richieste per cliente nell'ultima ora. Richiede seed.sql.
-- Eseguire con: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(23);

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

-- Gomme Rossi (ATTIVA, Torino 45.070312 / 7.686856): titolare …0002, operatore …0003. Cliente Giulia
-- …0004. Titolare2 …0005 (Pneus Express, IN_ATTESA: non riceve richieste). Le richieste sono tutte a
-- 45.1 / 7.7, a 3,46 km da Gomme Rossi (raggio di 30 km). `now()` è fisso nella transazione: le
-- richieste create qui hanno tutte lo stesso `created_at`.
\set rossi '''b0000000-0000-4000-8000-000000000001'''
\set admin '''a0000000-0000-4000-8000-000000000001'''
\set titolare '''a0000000-0000-4000-8000-000000000002'''
\set operatore '''a0000000-0000-4000-8000-000000000003'''
\set cliente '''a0000000-0000-4000-8000-000000000004'''
\set titolare2 '''a0000000-0000-4000-8000-000000000005'''

-- ---------------------------------------------------------------- preparazione (come postgres)
select is(
  (select count(*) from public.officine where id = :rossi and intervento_strada), 0::bigint,
  'partenza: Gomme Rossi non offre l''aiuto su strada'
);
select is((select count(*) from public.richieste_strada), 0::bigint, 'partenza: nessuna richiesta');
update public.officine set intervento_strada = true where id = :rossi;

-- ---------------------------------------------------------------- richiesta del titolare (anche cliente)
select pg_temp.come(:titolare);
select lives_ok(
  $$select public.crea_richiesta_strada(45.1, 7.7, 'Gomma a terra del titolare', '+39 333 1112223')$$,
  'titolare: chiede aiuto come cliente vicino a Gomme Rossi'
);

reset role;
create temp table rt as select id from public.richieste_strada where cliente_id = :titolare;
grant select on rt to authenticated, anon;

-- La richiesta è nel raggio: l'operatore della stessa officina la vede, il titolare no
select pg_temp.come(:operatore);
select is(
  (select count(*) from public.richieste_strada_vicine(:rossi) where id = (select id from rt)), 1::bigint,
  'operatore: vede la richiesta del titolare (è nel raggio di Gomme Rossi)'
);
select pg_temp.come(:titolare);
select is(
  (select count(*) from public.richieste_strada_vicine(:rossi)), 0::bigint,
  'titolare: la propria richiesta non compare nell''elenco della sua officina'
);

-- ---------------------------------------------------------------- propria richiesta: accettazione negata
select throws_ok(
  format('select public.accetta_richiesta_strada(%L, %L)', (select id from rt), :rossi),
  'P0001', 'RICHIESTA_NON_DISPONIBILE',
  'titolare: non accetta la propria richiesta (stesso errore di una richiesta già presa)'
);
reset role;
select is(
  (select stato || '|' || coalesce(officina_id::text, '-') from public.richieste_strada
   where id = (select id from rt)),
  'APERTA|-',
  'dopo il rifiuto la richiesta resta APERTA e senza officina'
);

-- ---------------------------------------------------------------- accettazione dell'operatore: permessa
select pg_temp.come(:operatore);
select lives_ok(
  format('select public.accetta_richiesta_strada(%L, %L)', (select id from rt), :rossi),
  'operatore: accetta la richiesta del titolare'
);
reset role;
select is(
  (select stato || '|' || officina_id from public.richieste_strada where id = (select id from rt)),
  'ACCETTATA|' || :rossi,
  'la richiesta del titolare è ACCETTATA da Gomme Rossi'
);

-- ---------------------------------------------------------------- limite: 3 richieste all'ora
-- Il cliente crea e annulla 3 richieste: nessuna resta in corso, quindi la quarta non trova
-- RICHIESTA_GIA_APERTA e senza il limite andrebbe a buon fine.
select pg_temp.come(:cliente);
select lives_ok(
  $$select public.crea_richiesta_strada(45.1, 7.7, 'Prima', '+39 333 1112223')$$,
  'cliente: prima richiesta'
);
select lives_ok(
  format('select public.annulla_richiesta_strada(%L)',
    (select id from public.richieste_strada where cliente_id = :cliente and stato = 'APERTA')),
  'cliente: annulla la prima'
);
select lives_ok(
  $$select public.crea_richiesta_strada(45.1, 7.7, 'Seconda', '+39 333 1112223')$$,
  'cliente: seconda richiesta'
);
select lives_ok(
  format('select public.annulla_richiesta_strada(%L)',
    (select id from public.richieste_strada where cliente_id = :cliente and stato = 'APERTA')),
  'cliente: annulla la seconda'
);
select lives_ok(
  $$select public.crea_richiesta_strada(45.1, 7.7, 'Terza', '+39 333 1112223')$$,
  'cliente: terza richiesta'
);
select lives_ok(
  format('select public.annulla_richiesta_strada(%L)',
    (select id from public.richieste_strada where cliente_id = :cliente and stato = 'APERTA')),
  'cliente: annulla la terza'
);
select is(
  (select string_agg(descrizione || '=' || stato, ' ' order by descrizione)
   from public.richieste_strada where cliente_id = :cliente),
  'Prima=ANNULLATA Seconda=ANNULLATA Terza=ANNULLATA',
  'cliente: 3 richieste nell''ultima ora, tutte annullate (nessuna in corso)'
);
select throws_ok(
  $$select public.crea_richiesta_strada(45.1, 7.7, 'Quarta', '+39 333 1112223')$$,
  'P0001', 'TROPPE_RICHIESTE',
  'cliente: la quarta richiesta nell''ora è rifiutata con TROPPE_RICHIESTE'
);
select is(
  (select count(*) from public.richieste_strada where cliente_id = :cliente), 3::bigint,
  'cliente: la quarta non è stata salvata'
);

-- ---------------------------------------------------------------- limite: per cliente, nell'ultima ora
select pg_temp.come(:titolare2);
select lives_ok(
  $$select public.crea_richiesta_strada(45.1, 7.7, 'Altro cliente', '+39 333 4445556')$$,
  'un altro cliente nello stesso momento crea la sua richiesta'
);
select is(
  (select count(*) from public.richieste_strada where cliente_id = :titolare2 and stato = 'APERTA'),
  1::bigint,
  'la richiesta dell''altro cliente è APERTA'
);

-- Tre richieste di più di un'ora fa non contano
reset role;
insert into public.richieste_strada (
  cliente_id, latitudine, longitudine, descrizione, telefono, stato, created_at
)
select :admin, 45.1, 7.7, 'Vecchia ' || n, '+39 333 1112223', 'ANNULLATA', now() - interval '61 minutes'
from generate_series(1, 3) as n;
select pg_temp.come(:admin);
select lives_ok(
  $$select public.crea_richiesta_strada(45.1, 7.7, 'Nuova', '+39 333 1112223')$$,
  'tre richieste di più di un''ora fa non bloccano una nuova'
);
select is(
  (select count(*) from public.richieste_strada where cliente_id = :admin and stato = 'APERTA'), 1::bigint,
  'la nuova richiesta dell''admin è APERTA'
);

-- T206: indice per il conteggio delle richieste dell'ultima ora
reset role;
select has_index(
  'public', 'richieste_strada', 'richieste_strada_cliente_id_created_at_idx',
  array['cliente_id', 'created_at'],
  'richieste_strada ha l''indice (cliente_id, created_at) per il limite orario'
);

select * from finish();
rollback;

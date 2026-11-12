-- Test delle date italiane nel database (T175, dritta T138). Richiede seed.sql.
-- Eseguire con: npm run db:test
--
-- `current_date` è la data UTC: tra mezzanotte e le 2 in Italia è ancora "ieri". I test "oggi/domani"
-- qui sotto fallirebbero senza la migrazione solo vicino a mezzanotte; quelli sulle definizioni
-- (default delle colonne e corpi delle funzioni) falliscono senza la migrazione a qualsiasi ora.
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

-- Default di una colonna, come lo scrive Postgres
create function pg_temp.default_di(p_tabella regclass, p_colonna text) returns text
language sql as $$
  select pg_get_expr(d.adbin, d.adrelid)
  from pg_catalog.pg_attrdef d
  join pg_catalog.pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
  where d.adrelid = p_tabella and a.attname = p_colonna;
$$;

\set admin '''a0000000-0000-4000-8000-000000000001'''
\set operatore '''a0000000-0000-4000-8000-000000000003'''
-- Panda di Giulia da Gomme Rossi (4 invernali montati) e Golf di Franco (nessuno pneumatico)
\set panda '''d0000000-0000-4000-8000-000000000001'''
\set golf '''d0000000-0000-4000-8000-000000000002'''
\set nuova '''b1750000-0000-4000-8000-000000000001'''
\set controllo '''f1750000-0000-4000-8000-000000000001'''
\set controllo_default '''f1750000-0000-4000-8000-000000000002'''

-- ---------------------------------------------------------------- definizioni (a qualsiasi ora)
select ok(
  pg_temp.default_di('public.abbonamenti', 'prova_fino_al') like '%Europe/Rome%'
    and pg_temp.default_di('public.abbonamenti', 'prova_fino_al') like '%29%',
  'abbonamenti.prova_fino_al: default con la data italiana + 29'
);
select ok(
  pg_temp.default_di('public.controlli', 'eseguito_il') like '%Europe/Rome%',
  'controlli.eseguito_il: default con la data italiana'
);
select ok(
  pg_temp.default_di('public.pneumatici', 'montato_il') like '%Europe/Rome%',
  'pneumatici.montato_il: default con la data italiana'
);
select ok(
  pg_get_functiondef('public.registra_controllo(uuid, jsonb, date, integer, text, uuid)'::regprocedure)
    not ilike '%current_date%'
  and pg_get_functiondef('public.registra_controllo(uuid, jsonb, date, integer, text, uuid)'::regprocedure)
    like '%Europe/Rome%',
  'registra_controllo: niente current_date, usa la data italiana'
);
select ok(
  pg_get_functiondef('public.monta_pneumatici(uuid, jsonb, date)'::regprocedure)
    not ilike '%current_date%'
  and pg_get_functiondef('public.monta_pneumatici(uuid, jsonb, date)'::regprocedure)
    like '%Europe/Rome%',
  'monta_pneumatici: niente current_date, usa la data italiana'
);
select ok(
  pg_get_functiondef('public.modifica_controllo(uuid, jsonb, date, integer, text)'::regprocedure)
    not ilike '%current_date%'
  and pg_get_functiondef('public.modifica_controllo(uuid, jsonb, date, integer, text)'::regprocedure)
    like '%Europe/Rome%',
  'modifica_controllo: niente current_date, usa la data italiana'
);

-- Permessi invariati: l'anonimo non chiama le funzioni
select ok(
  not has_function_privilege('anon', 'public.registra_controllo(uuid, jsonb, date, integer, text, uuid)', 'execute')
  and not has_function_privilege('anon', 'public.monta_pneumatici(uuid, jsonb, date)', 'execute')
  and not has_function_privilege('anon', 'public.modifica_controllo(uuid, jsonb, date, integer, text)', 'execute'),
  'anon non può eseguire le tre funzioni (permessi invariati)'
);

-- ---------------------------------------------------------------- prova di un'officina nuova
select pg_temp.come(:admin);
select lives_ok(
  format(
    $$insert into public.officine (id, ragione_sociale, partita_iva, citta)
      values (%L, 'Gomme Date T175', '17517517501', 'Bologna')$$,
    :nuova
  ),
  'l''admin crea un''officina'
);
reset role;
select is(
  (select prova_fino_al from public.abbonamenti where officina_id = :nuova),
  (now() at time zone 'Europe/Rome')::date + 29,
  'officina nuova: ultimo giorno di prova = oggi in Italia + 29'
);

-- ---------------------------------------------------------------- registra_controllo
select pg_temp.come(:operatore); -- operatore di Gomme Rossi
select lives_ok(
  format($$select public.registra_controllo(%L, '[{"posizione": "ANT_SX", "battistrada_mm": 6}]',
    (now() at time zone 'Europe/Rome')::date, 43175, '', %L)$$, :panda, :controllo),
  'controllo con la data di oggi in Italia: accettato'
);
select is(
  (select eseguito_il from public.controlli where id = :controllo),
  (now() at time zone 'Europe/Rome')::date,
  'la data salvata è quella di oggi in Italia'
);
select throws_ok(
  format($$select public.registra_controllo(%L, '[{"posizione": "ANT_SX", "battistrada_mm": 6}]',
    (now() at time zone 'Europe/Rome')::date + 1)$$, :panda),
  '22023', null,
  'controllo con la data di domani in Italia: errore'
);
select lives_ok(
  format($$select public.registra_controllo(p_veicolo_id => %L,
    p_misure => '[{"posizione": "ANT_SX", "battistrada_mm": 6}]', p_id => %L)$$,
    :panda, :controllo_default),
  'controllo senza data: accettato'
);
select is(
  (select eseguito_il from public.controlli where id = :controllo_default),
  (now() at time zone 'Europe/Rome')::date,
  'senza data il controllo prende oggi in Italia'
);

-- ---------------------------------------------------------------- modifica_controllo
select lives_ok(
  format($$select public.modifica_controllo(%L, '[{"posizione": "ANT_SX", "battistrada_mm": 5.5}]',
    (now() at time zone 'Europe/Rome')::date, 43176)$$, :controllo),
  'correzione con la data di oggi in Italia: accettata'
);
select is(
  (select km from public.controlli where id = :controllo),
  43176,
  'la correzione è stata salvata'
);
select throws_ok(
  format($$select public.modifica_controllo(%L, '[{"posizione": "ANT_SX", "battistrada_mm": 5.5}]',
    (now() at time zone 'Europe/Rome')::date + 1)$$, :controllo),
  '22023', null,
  'correzione con la data di domani in Italia: errore'
);

-- ---------------------------------------------------------------- monta_pneumatici
select lives_ok(
  format($$select public.monta_pneumatici(%L, '[{"posizione": "ANT_SX", "stagione": "ESTIVO"}]')$$,
    :golf),
  'montaggio senza data sulla Golf: accettato'
);
select is(
  (select montato_il from public.pneumatici
    where veicolo_id = :golf and posizione = 'ANT_SX' and smontato_il is null),
  (now() at time zone 'Europe/Rome')::date,
  'senza data il montaggio prende oggi in Italia'
);
select throws_ok(
  format($$select public.monta_pneumatici(%L, '[{"posizione": "ANT_DX", "stagione": "ESTIVO"}]',
    (now() at time zone 'Europe/Rome')::date + 1)$$, :golf),
  '22023', null,
  'montaggio con la data di domani in Italia: errore'
);

select * from finish();
rollback;

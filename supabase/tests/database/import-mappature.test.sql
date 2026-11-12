-- Test delle associazioni di colonne salvate (import_mappature, mappatura_import_valida).
-- Richiede seed.sql. Eseguire con: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(24);

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

\set rossi '''b0000000-0000-4000-8000-000000000001'''
\set express '''b0000000-0000-4000-8000-000000000002'''
\set titolare '''a0000000-0000-4000-8000-000000000002'''
\set operatore '''a0000000-0000-4000-8000-000000000003'''
\set cliente '''a0000000-0000-4000-8000-000000000004'''
\set titolare2 '''a0000000-0000-4000-8000-000000000005'''

-- ---------------------------------------------------------------- funzione di controllo
select ok(
  public.mappatura_import_valida('{"targa": "Targa", "nome": "Nome cliente"}'),
  'mappatura valida: targa e nome'
);
select ok(
  not public.mappatura_import_valida('["targa"]'),
  'mappatura non valida: non è un oggetto'
);
select ok(
  not public.mappatura_import_valida(jsonb_build_object('targa', repeat('x', 201))),
  'mappatura non valida: intestazione di più di 200 caratteri'
);

-- ---------------------------------------------------------------- titolare: inserisce e legge
select pg_temp.come(:titolare);
select lives_ok(
  format(
    'insert into public.import_mappature (officina_id, nome, colonne) values (%L, %L, %L)',
    :rossi, 'GESTITYRE', '{"codice_cliente": "Cod.", "targa": "Targa veicolo"}'
  ),
  'il titolare salva un''associazione'
);
select results_eq(
  'select nome, creata_da from public.import_mappature',
  format('values (''GESTITYRE'', %L::uuid)', :titolare),
  'il titolare la rilegge, con sé stesso come autore'
);

-- ---------------------------------------------------------------- vincoli
select throws_ok(
  format(
    'insert into public.import_mappature (officina_id, nome, colonne) values (%L, %L, %L)',
    :rossi, 'GESTITYRE', '{"targa": "Targa"}'
  ),
  '23505', null,
  'nome doppio nella stessa officina: rifiutato'
);
select throws_ok(
  format(
    'insert into public.import_mappature (officina_id, nome, colonne) values (%L, %L, %L)',
    :rossi, 'Chiave sconosciuta', '{"targa": "Targa", "colore": "Colore"}'
  ),
  '23514', null,
  'chiave sconosciuta: rifiutata'
);
select throws_ok(
  format(
    'insert into public.import_mappature (officina_id, nome, colonne) values (%L, %L, %L)',
    :rossi, 'Valore vuoto', '{"targa": ""}'
  ),
  '23514', null,
  'intestazione vuota: rifiutata'
);
select throws_ok(
  format(
    'insert into public.import_mappature (officina_id, nome, colonne) values (%L, %L, %L)',
    :rossi, 'Senza targa', '{"nome": "Nome", "cognome": "Cognome"}'
  ),
  '23514', null,
  'né targa né codice cliente: rifiutata'
);
select throws_ok(
  format(
    'insert into public.import_mappature (officina_id, nome, colonne) values (%L, %L, %L)',
    :rossi, 'Numero', '{"targa": 3}'
  ),
  '23514', null,
  'intestazione non di testo: rifiutata'
);
select throws_ok(
  format(
    'insert into public.import_mappature (officina_id, nome, colonne) values (%L, %L, %L)',
    :rossi, '   ', '{"targa": "Targa"}'
  ),
  '23514', null,
  'nome vuoto: rifiutato'
);

-- ---------------------------------------------------------------- operatore della stessa officina
select pg_temp.come(:operatore);
select is_empty('select 1 from public.import_mappature', 'l''operatore non vede le associazioni');
select throws_ok(
  format(
    'insert into public.import_mappature (officina_id, nome, colonne) values (%L, %L, %L)',
    :rossi, 'Operatore', '{"targa": "Targa"}'
  ),
  '42501', null,
  'l''operatore non può salvare un''associazione'
);
update public.import_mappature set nome = 'Cambiata dall''operatore';
delete from public.import_mappature;

-- ---------------------------------------------------------------- titolare di un'altra officina
select pg_temp.come(:titolare2);
select is_empty(
  'select 1 from public.import_mappature',
  'il titolare di un''altra officina non vede le associazioni di Gomme Rossi'
);
select throws_ok(
  format(
    'insert into public.import_mappature (officina_id, nome, colonne) values (%L, %L, %L)',
    :rossi, 'Intruso', '{"targa": "Targa"}'
  ),
  '42501', null,
  'il titolare di un''altra officina non può salvare per Gomme Rossi'
);
update public.import_mappature set nome = 'Cambiata da Pneus Express';
delete from public.import_mappature;

-- ---------------------------------------------------------------- cliente e anonimo
select pg_temp.come(:cliente);
select is_empty('select 1 from public.import_mappature', 'il cliente non vede le associazioni');
select pg_temp.come(null);
select is_empty('select 1 from public.import_mappature', 'l''anonimo non vede le associazioni');

-- ---------------------------------------------------------------- dopo i tentativi degli altri
select pg_temp.come(:titolare);
select results_eq(
  'select nome from public.import_mappature',
  $$values ('GESTITYRE')$$,
  'operatore e altra officina non hanno modificato né eliminato nulla'
);

-- ---------------------------------------------------------------- titolare: modifica ed elimina
select lives_ok(
  $$update public.import_mappature
    set nome = 'Gestionale', colonne = '{"targa": "Targa", "marca": "Marca"}'
    where nome = 'GESTITYRE'$$,
  'il titolare modifica la sua associazione'
);
select results_eq(
  'select nome, colonne from public.import_mappature',
  $$values ('Gestionale', '{"targa": "Targa", "marca": "Marca"}'::jsonb)$$,
  'la modifica è salvata'
);
select throws_ok(
  $$update public.import_mappature set colonne = '{"marca": "Marca"}'$$,
  '23514', null,
  'la modifica non può togliere targa e codice cliente'
);
select throws_ok(
  format('update public.import_mappature set officina_id = %L', :express),
  '42501', null,
  'il titolare non può spostare l''associazione in un''altra officina'
);
select lives_ok(
  'delete from public.import_mappature',
  'il titolare elimina la sua associazione'
);
select is_empty('select 1 from public.import_mappature', 'dopo l''eliminazione non resta nulla');

select * from finish();
rollback;

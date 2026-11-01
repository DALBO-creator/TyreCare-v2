-- Test della tabella abbonamenti (T067). Richiede seed.sql.
-- Eseguire con: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(26);

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

create temp table esito (id uuid);
grant all on esito to authenticated;

\set rossi '''b0000000-0000-4000-8000-000000000001'''
\set express '''b0000000-0000-4000-8000-000000000002'''
\set nuova '''b0670000-0000-4000-8000-000000000001'''
\set admin '''a0000000-0000-4000-8000-000000000001'''
\set titolare '''a0000000-0000-4000-8000-000000000002'''
\set operatore '''a0000000-0000-4000-8000-000000000003'''
\set cliente '''a0000000-0000-4000-8000-000000000004'''
\set titolare2 '''a0000000-0000-4000-8000-000000000005'''
\set gommista '''a0670000-0000-4000-8000-0000000000f1'''

-- ---------------------------------------------------------------- officine del seed
select is(
  (select count(*)::int from public.abbonamenti where officina_id in (:rossi, :express)),
  2,
  'Gomme Rossi e Pneus Express hanno il loro abbonamento'
);
select is(
  (select count(*)::int from public.officine o
    where not exists (select 1 from public.abbonamenti a where a.officina_id = o.id)),
  0,
  'nessuna officina è senza abbonamento'
);

-- ---------------------------------------------------------------- officina creata dall'admin
-- Stato di partenza: l'officina e il suo abbonamento non esistono.
select is(
  (select count(*)::int from public.abbonamenti where officina_id = :nuova),
  0,
  'preparazione: l''officina nuova non ha ancora un abbonamento'
);

select pg_temp.come(:admin);
select lives_ok(
  format(
    $$insert into public.officine (id, ragione_sociale, partita_iva, citta)
      values (%L, 'Gomme Test T067', '67067067067', 'Bologna')$$,
    :nuova
  ),
  'l''admin crea un''officina'
);

reset role;
select is(
  (select stato from public.abbonamenti where officina_id = :nuova),
  'PROVA',
  'l''officina nuova ha l''abbonamento in PROVA'
);
select is(
  (select piano from public.abbonamenti where officina_id = :nuova),
  'STARTER',
  'il piano di partenza è STARTER'
);
select is(
  (select prova_fino_al from public.abbonamenti where officina_id = :nuova),
  (now() at time zone 'Europe/Rome')::date + 29,
  'la prova dura 30 giorni contando oggi'
);

-- ---------------------------------------------------------------- lettura
select pg_temp.come(:titolare); -- titolare di Gomme Rossi
select is(
  (select count(*)::int from public.abbonamenti where officina_id = :rossi),
  1,
  'il titolare legge l''abbonamento della sua officina'
);
select is(
  (select count(*)::int from public.abbonamenti),
  1,
  'il titolare legge solo quello della sua officina'
);

select pg_temp.come(:operatore); -- operatore di Gomme Rossi
select is(
  (select count(*)::int from public.abbonamenti),
  0,
  'l''operatore non legge nessun abbonamento, nemmeno della sua officina'
);

select pg_temp.come(:titolare2); -- titolare di Pneus Express
select is(
  (select count(*)::int from public.abbonamenti where officina_id = :rossi),
  0,
  'il titolare di Pneus Express non legge l''abbonamento di Gomme Rossi'
);

select pg_temp.come(:cliente);
select is(
  (select count(*)::int from public.abbonamenti),
  0,
  'il cliente non legge nessun abbonamento'
);

select pg_temp.come(null);
select throws_ok(
  'select count(*) from public.abbonamenti',
  '42501', null,
  'anon non ha accesso alla tabella'
);

select pg_temp.come(:admin);
select ok(
  (select count(*) from public.abbonamenti) >= 3,
  'l''admin legge tutti gli abbonamenti'
);

-- ---------------------------------------------------------------- scritture negate al titolare
select pg_temp.come(:titolare);
select lives_ok(
  format($$update public.abbonamenti set piano = 'PILOTA', stato = 'ATTIVO' where officina_id = %L$$, :rossi),
  'l''update del titolare non dà errore (RLS: 0 righe)'
);
reset role;
select is(
  (select piano || '/' || stato from public.abbonamenti where officina_id = :rossi),
  'STARTER/PROVA',
  'l''update del titolare non ha cambiato niente'
);

select pg_temp.come(:titolare);
select lives_ok(
  format('delete from public.abbonamenti where officina_id = %L', :rossi),
  'il delete del titolare non dà errore (RLS: 0 righe)'
);
reset role;
select is(
  (select count(*)::int from public.abbonamenti where officina_id = :rossi),
  1,
  'il delete del titolare non ha tolto la riga'
);

-- Per l'insert negato serve un'officina senza riga: tolgo (senza utente) quella dell'officina nuova.
delete from public.abbonamenti where officina_id = :nuova;
insert into public.officina_utenti (officina_id, profile_id, ruolo) values (:nuova, :titolare, 'TITOLARE');
select pg_temp.come(:titolare); -- ora anche titolare dell'officina nuova
select throws_ok(
  format('insert into public.abbonamenti (officina_id) values (%L)', :nuova),
  '42501', null,
  'il titolare non può creare l''abbonamento della sua officina'
);

select pg_temp.come(:operatore);
select lives_ok(
  format($$update public.abbonamenti set piano = 'PRO' where officina_id = %L$$, :rossi),
  'l''update dell''operatore non dà errore (RLS: 0 righe)'
);
reset role;
select is(
  (select piano from public.abbonamenti where officina_id = :rossi),
  'STARTER',
  'l''update dell''operatore non ha cambiato niente'
);

-- ---------------------------------------------------------------- scrittura dell'admin
select pg_temp.come(:admin);
select lives_ok(
  format($$update public.abbonamenti set piano = 'PILOTA' where officina_id = %L$$, :rossi),
  'l''admin mette Gomme Rossi sul piano PILOTA'
);
select is(
  (select piano from public.abbonamenti where officina_id = :rossi),
  'PILOTA',
  'Gomme Rossi è sul piano PILOTA'
);

-- ---------------------------------------------------------------- richiesta di affiliazione
reset role;
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_user_meta_data)
values (
  '00000000-0000-0000-0000-000000000000', :gommista,
  'authenticated', 'authenticated', 'gommista.t067@tyrecare.test', now(),
  '{"nome": "Sara", "cognome": "Cerchi"}'
);

select pg_temp.come(:gommista);
select lives_ok(
  $$insert into esito select public.richiedi_affiliazione('Gomme Affiliate T067', '67167167167', 'Parma')$$,
  'un account nuovo chiede l''affiliazione'
);
select is(
  (select a.stato from public.abbonamenti a join esito e on e.id = a.officina_id),
  'PROVA',
  'il richiedente (titolare) legge l''abbonamento in PROVA dell''officina richiesta'
);

reset role;
select is(
  (select a.prova_fino_al from public.abbonamenti a join esito e on e.id = a.officina_id),
  (now() at time zone 'Europe/Rome')::date + 29,
  'l''officina richiesta ha la prova di 30 giorni contando oggi'
);

select * from finish();
rollback;

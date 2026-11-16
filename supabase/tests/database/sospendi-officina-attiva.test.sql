-- Test di sospendi_officina: l'avviso ai titolari solo se l'officina era ATTIVA (T290, R43).
-- Richiede seed.sql. Eseguire con: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(18);

-- Simula una richiesta dal client con il JWT dell'utente indicato.
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

-- Notifiche già presenti prima delle azioni: i controlli guardano solo quelle nuove.
create temp table prima as select id from public.notifiche;

-- Letture senza RLS (utente dei test, dopo reset role).
create function pg_temp.stato(p_officina_id uuid) returns text language sql as $$
  select stato_affiliazione::text from public.officine where id = p_officina_id;
$$;
-- Tutte le notifiche di un utente, di qualunque tipo.
create function pg_temp.notifiche_di(p_destinatario uuid) returns int language sql as $$
  select count(*)::int from public.notifiche where destinatario_id = p_destinatario;
$$;
-- Notifiche nuove di qualunque tipo e destinatario.
create function pg_temp.nuove_totali() returns int language sql as $$
  select count(*)::int from public.notifiche n where n.id not in (select id from pg_temp.prima);
$$;
create function pg_temp.nuovi_avvisi(p_destinatario uuid) returns int language sql as $$
  select count(*)::int from public.notifiche n
  where n.destinatario_id = p_destinatario
    and n.tipo = 'AFFILIAZIONE_SOSPESA'
    and n.id not in (select id from pg_temp.prima);
$$;
create function pg_temp.titolari(p_officina_id uuid) returns int language sql as $$
  select count(*)::int from public.officina_utenti
  where officina_id = p_officina_id and ruolo = 'TITOLARE';
$$;

\set rossi '''b0000000-0000-4000-8000-000000000001'''
\set express '''b0000000-0000-4000-8000-000000000002'''
\set admin '''a0000000-0000-4000-8000-000000000001'''
\set titolare '''a0000000-0000-4000-8000-000000000002'''
\set titolare2 '''a0000000-0000-4000-8000-000000000005'''

-- ---------------------------------------------------------------- da IN_ATTESA, con un titolare
select is(pg_temp.stato(:express), 'IN_ATTESA', 'preparazione: Pneus Express parte IN_ATTESA');
select is(
  (select ruolo::text from public.officina_utenti
   where officina_id = :express and profile_id = :titolare2),
  'TITOLARE',
  'preparazione: titolare2 è TITOLARE di Pneus Express'
);
create temp table conteggio as select pg_temp.notifiche_di(:titolare2) as n;

select pg_temp.come(:admin);
select lives_ok(
  format('select public.sospendi_officina(%L)', :express),
  'l''admin sospende Pneus Express (IN_ATTESA)'
);
reset role;
select is(pg_temp.stato(:express), 'SOSPESA', 'Pneus Express è SOSPESA');
select is(
  pg_temp.notifiche_di(:titolare2),
  (select n from pg_temp.conteggio),
  'da IN_ATTESA il titolare di Pneus Express non riceve notifiche (conteggio prima e dopo)'
);
select is(pg_temp.nuove_totali(), 0, 'da IN_ATTESA nessuna notifica nuova per nessuno');
select is(
  (select ruolo::text from public.profiles where id = :titolare2),
  'OFFICINA',
  'R14: il ruolo globale di titolare2 non cambia'
);
select is(
  (select ruolo::text from public.officina_utenti
   where officina_id = :express and profile_id = :titolare2),
  'TITOLARE',
  'R14: titolare2 resta TITOLARE di Pneus Express'
);

-- ---------------------------------------------------------------- da ATTIVA
select is(pg_temp.stato(:rossi), 'ATTIVA', 'preparazione: Gomme Rossi parte ATTIVA nel seed');

select pg_temp.come(:admin);
select lives_ok(format('select public.sospendi_officina(%L)', :rossi), 'l''admin sospende Gomme Rossi');
reset role;
select is(pg_temp.stato(:rossi), 'SOSPESA', 'Gomme Rossi è SOSPESA');
select is(pg_temp.nuovi_avvisi(:titolare), 1, 'da ATTIVA il titolare di Gomme Rossi riceve un avviso');
select is(
  pg_temp.nuove_totali(),
  pg_temp.titolari(:rossi),
  'da ATTIVA un avviso per ogni titolare di Gomme Rossi e niente altro'
);
select is(
  (select ruolo::text from public.profiles where id = :titolare),
  'OFFICINA',
  'R14: il ruolo globale del titolare di Gomme Rossi non cambia'
);

-- ---------------------------------------------------------------- da SOSPESA
select is(pg_temp.stato(:rossi), 'SOSPESA', 'preparazione: Gomme Rossi ora è SOSPESA');

select pg_temp.come(:admin);
select lives_ok(
  format('select public.sospendi_officina(%L)', :rossi),
  'seconda sospensione di Gomme Rossi senza errori'
);
reset role;
select is(
  pg_temp.nuove_totali(),
  pg_temp.titolari(:rossi),
  'da SOSPESA nessuna notifica in più'
);
select is(pg_temp.stato(:rossi), 'SOSPESA', 'Gomme Rossi resta SOSPESA');

select * from finish();
rollback;

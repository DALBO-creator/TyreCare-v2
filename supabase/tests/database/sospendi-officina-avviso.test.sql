-- Test dell'avviso di sospensione di sospendi_officina (T242). Richiede seed.sql.
-- Eseguire con: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(18);

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

-- Notifiche già presenti prima delle azioni: i controlli guardano solo quelle nuove.
create temp table prima as select id from public.notifiche;

-- Letture senza RLS (utente dei test, dopo reset role).
create function pg_temp.nuovi(p_destinatario uuid) returns int language sql as $$
  select count(*)::int from public.notifiche n
  where n.destinatario_id = p_destinatario
    and n.tipo = 'AFFILIAZIONE_SOSPESA'
    and n.id not in (select id from pg_temp.prima);
$$;
create function pg_temp.nuovi_totali() returns int language sql as $$
  select count(*)::int from public.notifiche n
  where n.tipo = 'AFFILIAZIONE_SOSPESA'
    and n.id not in (select id from pg_temp.prima);
$$;
-- Con più di un avviso nuovo i valori vengono uniti da " | " e il confronto fallisce in chiaro.
create function pg_temp.nuovo_titolo(p_destinatario uuid) returns text language sql as $$
  select string_agg(n.titolo, ' | ') from public.notifiche n
  where n.destinatario_id = p_destinatario
    and n.tipo = 'AFFILIAZIONE_SOSPESA'
    and n.id not in (select id from pg_temp.prima);
$$;
create function pg_temp.nuovo_testo(p_destinatario uuid) returns text language sql as $$
  select string_agg(n.testo, ' | ') from public.notifiche n
  where n.destinatario_id = p_destinatario
    and n.tipo = 'AFFILIAZIONE_SOSPESA'
    and n.id not in (select id from pg_temp.prima);
$$;
create function pg_temp.nuovo_link(p_destinatario uuid) returns text language sql as $$
  select string_agg(n.link, ' | ') from public.notifiche n
  where n.destinatario_id = p_destinatario
    and n.tipo = 'AFFILIAZIONE_SOSPESA'
    and n.id not in (select id from pg_temp.prima);
$$;
create function pg_temp.stato(p_officina_id uuid) returns text language sql as $$
  select stato_affiliazione::text from public.officine where id = p_officina_id;
$$;

\set rossi '''b0000000-0000-4000-8000-000000000001'''
\set express '''b0000000-0000-4000-8000-000000000002'''
\set admin '''a0000000-0000-4000-8000-000000000001'''
\set titolare '''a0000000-0000-4000-8000-000000000002'''
\set operatore '''a0000000-0000-4000-8000-000000000003'''
\set cliente '''a0000000-0000-4000-8000-000000000004'''
\set titolare2 '''a0000000-0000-4000-8000-000000000005'''

-- ---------------------------------------------------------------- preparazione (dritta T100)
select is(pg_temp.stato(:rossi), 'ATTIVA', 'preparazione: Gomme Rossi parte ATTIVA nel seed');
select is(pg_temp.stato(:express), 'IN_ATTESA', 'preparazione: Pneus Express parte IN_ATTESA');

-- ---------------------------------------------------------------- accesso negato
select pg_temp.come(:cliente);
select throws_ok(
  format('select public.sospendi_officina(%L)', :rossi),
  '42501', 'Accesso riservato',
  'il cliente non può sospendere Gomme Rossi'
);
select pg_temp.come(:titolare);
select throws_ok(
  format('select public.sospendi_officina(%L)', :rossi),
  '42501', 'Accesso riservato',
  'il titolare (non admin) non può sospendere la sua officina'
);
reset role;
select is(pg_temp.stato(:rossi), 'ATTIVA', 'dopo i tentativi negati Gomme Rossi resta ATTIVA');
select is(pg_temp.nuovi_totali(), 0, 'i tentativi negati non mandano avvisi');

-- ---------------------------------------------------------------- sospensione da ATTIVA (admin)
select pg_temp.come(:admin);
select lives_ok(format('select public.sospendi_officina(%L)', :rossi), 'l''admin sospende Gomme Rossi');
reset role;
select is(pg_temp.stato(:rossi), 'SOSPESA', 'Gomme Rossi è SOSPESA');
select is(pg_temp.nuovi(:titolare), 1, 'il titolare di Gomme Rossi riceve un solo avviso');
select is(
  pg_temp.nuovo_titolo(:titolare),
  'La tua officina è sospesa',
  'sospensione: titolo'
);
select is(
  pg_temp.nuovo_testo(:titolare),
  (select ragione_sociale
     || ' non è più visibile ai clienti. Per sapere perché scrivici con «Invia un commento».'
   from public.officine where id = :rossi),
  'sospensione: testo con l''invito a scrivere un commento'
);
select is(pg_temp.nuovo_link(:titolare), '/commento', 'sospensione: link /commento');
select is(pg_temp.nuovi(:operatore), 0, 'l''operatore (non titolare) non riceve l''avviso');
select is(
  pg_temp.nuovi_totali(),
  (select count(*)::int from public.officina_utenti
   where officina_id = :rossi and ruolo = 'TITOLARE'),
  'un avviso per ogni titolare di Gomme Rossi e per nessun altro'
);

-- ---------------------------------------------------------------- officina già SOSPESA
select pg_temp.come(:admin);
select lives_ok(
  format('select public.sospendi_officina(%L)', :rossi),
  'seconda sospensione di Gomme Rossi senza errori'
);
reset role;
select is(pg_temp.nuovi(:titolare), 1, 'su un''officina già SOSPESA nessun avviso in più');

-- ---------------------------------------------------------------- da IN_ATTESA, senza utente
select lives_ok(
  format('select public.sospendi_officina(%L)', :express),
  'senza utente si sospende Pneus Express'
);
-- T290 (R43): da IN_ATTESA l'officina non era visibile ai clienti, quindi nessun avviso.
select is(pg_temp.nuovi(:titolare2), 0, 'da IN_ATTESA il titolare di Pneus Express non riceve avvisi');

select * from finish();
rollback;

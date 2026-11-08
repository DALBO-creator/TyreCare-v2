-- Test dell'avviso di riattivazione di attiva_officina (T219). Richiede seed.sql.
-- Eseguire con: npm run db:test
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
    and n.tipo = 'AFFILIAZIONE_ATTIVATA'
    and n.id not in (select id from pg_temp.prima);
$$;
-- Con più di un avviso nuovo i valori vengono uniti da " | " e il confronto fallisce in chiaro.
create function pg_temp.nuovo_titolo(p_destinatario uuid) returns text language sql as $$
  select string_agg(n.titolo, ' | ') from public.notifiche n
  where n.destinatario_id = p_destinatario
    and n.tipo = 'AFFILIAZIONE_ATTIVATA'
    and n.id not in (select id from pg_temp.prima);
$$;
create function pg_temp.nuovo_testo(p_destinatario uuid) returns text language sql as $$
  select string_agg(n.testo, ' | ') from public.notifiche n
  where n.destinatario_id = p_destinatario
    and n.tipo = 'AFFILIAZIONE_ATTIVATA'
    and n.id not in (select id from pg_temp.prima);
$$;
create function pg_temp.nuovo_link(p_destinatario uuid) returns text language sql as $$
  select string_agg(n.link, ' | ') from public.notifiche n
  where n.destinatario_id = p_destinatario
    and n.tipo = 'AFFILIAZIONE_ATTIVATA'
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

-- ---------------------------------------------------------------- preparazione (senza utente)
-- Gomme Rossi è ATTIVA nel seed: la metto SOSPESA, come farebbe sospendi_officina (dritta T100).
select is(pg_temp.stato(:rossi), 'ATTIVA', 'preparazione: Gomme Rossi parte ATTIVA nel seed');
update public.officine set stato_affiliazione = 'SOSPESA' where id = :rossi;
select is(pg_temp.stato(:rossi), 'SOSPESA', 'preparazione: Gomme Rossi ora è SOSPESA');
select is(pg_temp.stato(:express), 'IN_ATTESA', 'preparazione: Pneus Express parte IN_ATTESA');

-- ---------------------------------------------------------------- accesso negato
select pg_temp.come(:cliente);
select throws_ok(
  format('select public.attiva_officina(%L)', :rossi),
  '42501', 'Accesso riservato',
  'il cliente non può riattivare Gomme Rossi'
);
reset role;
select is(pg_temp.stato(:rossi), 'SOSPESA', 'dopo il tentativo del cliente Gomme Rossi resta SOSPESA');
select is(pg_temp.nuovi(:titolare), 0, 'il tentativo del cliente non avvisa il titolare');

-- ---------------------------------------------------------------- riattivazione da SOSPESA (admin)
select pg_temp.come(:admin);
select lives_ok(format('select public.attiva_officina(%L)', :rossi), 'l''admin riattiva Gomme Rossi');
reset role;
select is(pg_temp.stato(:rossi), 'ATTIVA', 'Gomme Rossi è di nuovo ATTIVA');
select is(pg_temp.nuovi(:titolare), 1, 'il titolare di Gomme Rossi riceve un solo avviso');
select is(
  pg_temp.nuovo_titolo(:titolare),
  'La tua officina è di nuovo attiva',
  'riattivazione: titolo "di nuovo attiva"'
);
select is(
  pg_temp.nuovo_testo(:titolare),
  (select ragione_sociale || ' è di nuovo visibile ai clienti.' from public.officine where id = :rossi),
  'riattivazione: testo senza l''invito a caricare i dati'
);
select is(pg_temp.nuovo_link(:titolare), '/clienti', 'riattivazione: link /clienti');
select is(pg_temp.nuovi(:operatore), 0, 'l''operatore (non titolare) non riceve l''avviso');

-- ---------------------------------------------------------------- prima attivazione da IN_ATTESA (senza utente)
select lives_ok(
  format('select public.attiva_officina(%L)', :express),
  'senza utente si attiva Pneus Express'
);
select is(pg_temp.nuovi(:titolare2), 1, 'il titolare di Pneus Express riceve un solo avviso');
select is(
  pg_temp.nuovo_titolo(:titolare2),
  'La tua officina è attiva',
  'prima attivazione: titolo invariato'
);
select is(
  pg_temp.nuovo_testo(:titolare2),
  (select ragione_sociale || ' ora è visibile ai clienti: puoi caricare i tuoi dati.'
   from public.officine where id = :express),
  'prima attivazione: testo invariato'
);
select is(pg_temp.nuovo_link(:titolare2), '/clienti/importa', 'prima attivazione: link invariato');

-- ---------------------------------------------------------------- officina già ATTIVA
select pg_temp.come(:admin);
select lives_ok(
  format('select public.attiva_officina(%L)', :rossi),
  'seconda chiamata su Gomme Rossi già ATTIVA senza errori'
);
reset role;
select is(pg_temp.nuovi(:titolare), 1, 'su un''officina già ATTIVA nessun avviso in più');

select * from finish();
rollback;

-- Test di crea_officina_con_titolare (T027). Richiede seed.sql.
-- Eseguire con: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

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

create temp table esito (id uuid);
grant all on esito to authenticated;

-- ---------------------------------------------------------------- permessi (casi negati)
select pg_temp.come('a0000000-0000-4000-8000-000000000004'); -- cliente
select throws_ok(
  $$select public.crea_officina_con_titolare('Officina Prova', '11111111111', 'cliente@tyrecare.test')$$,
  '42501', null,
  'un cliente non può creare officine'
);
select pg_temp.come('a0000000-0000-4000-8000-000000000002'); -- titolare di Gomme Rossi
select throws_ok(
  $$select public.crea_officina_con_titolare('Officina Prova', '11111111111', 'cliente@tyrecare.test')$$,
  '42501', null,
  'un titolare non può creare officine'
);
select pg_temp.come('a0000000-0000-4000-8000-000000000003'); -- operatore
select throws_ok(
  $$select public.crea_officina_con_titolare('Officina Prova', '11111111111', 'cliente@tyrecare.test')$$,
  '42501', null,
  'un operatore non può creare officine'
);

-- ---------------------------------------------------------------- amministratore
select pg_temp.come('a0000000-0000-4000-8000-000000000001'); -- admin
select lives_ok(
  $$insert into esito select public.crea_officina_con_titolare(
      '  Officina Prova  ', ' 11111111111 ', '  CLIENTE@Tyrecare.TEST ')$$,
  'l''admin crea l''officina; email in maiuscolo e con spazi trovata lo stesso'
);
select is(
  (select count(*)::int from public.officine o join esito e on e.id = o.id
    where o.ragione_sociale = 'Officina Prova' and o.partita_iva = '11111111111'
      and o.stato_affiliazione = 'IN_ATTESA'),
  1,
  'l''officina è IN_ATTESA e i dati sono ripuliti con trim'
);
select is(
  (select ruolo::text from public.profiles where id = 'a0000000-0000-4000-8000-000000000004'),
  'OFFICINA',
  'il profilo del cliente è diventato OFFICINA'
);
select is(
  (select ruolo::text from public.officina_utenti ou join esito e on e.id = ou.officina_id
    where ou.profile_id = 'a0000000-0000-4000-8000-000000000004'),
  'TITOLARE',
  'officina_utenti ha la riga TITOLARE'
);
select throws_ok(
  $$select public.crea_officina_con_titolare('Altra', '22222222222', 'nessuno@tyrecare.test')$$,
  'ACCOUNT_NON_TROVATO', null,
  'email inesistente'
);
select throws_ok(
  $$select public.crea_officina_con_titolare('Altra', '01234567890', 'titolare2@tyrecare.test')$$,
  'PARTITA_IVA_GIA_PRESENTE', null,
  'partita IVA di Gomme Rossi già presente'
);
select throws_ok(
  $$select public.crea_officina_con_titolare('Altra', '11111111111', 'titolare2@tyrecare.test')$$,
  'PARTITA_IVA_GIA_PRESENTE', null,
  'partita IVA appena creata già presente'
);
select lives_ok(
  $$select public.crea_officina_con_titolare('Officina Admin', '33333333333', 'admin@tyrecare.test')$$,
  'si può nominare titolare un admin'
);
select is(
  (select ruolo::text from public.profiles where id = 'a0000000-0000-4000-8000-000000000001'),
  'ADMIN',
  'un ADMIN resta ADMIN'
);

-- ---------------------------------------------------------------- senza utente (editor SQL)
reset role;
select set_config('request.jwt.claims', '', true);
select lives_ok(
  $$select public.crea_officina_con_titolare('Officina Editor', '44444444444', 'operatore@tyrecare.test')$$,
  'senza utente (editor SQL / service role) riesce'
);
select is(
  (select count(*)::int from public.officine where partita_iva = '44444444444'),
  1,
  'l''officina creata dall''editor esiste'
);

select * from finish();
rollback;

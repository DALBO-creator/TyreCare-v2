-- Test di richiedi_affiliazione (T059). Richiede seed.sql.
-- Eseguire con: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

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

-- Un gommista appena registrato (il trigger gli crea il profilo CLIENTE).
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_user_meta_data)
values (
  '00000000-0000-0000-0000-000000000000', 'a0590000-0000-4000-8000-0000000000f1',
  'authenticated', 'authenticated', 'gommista.nuovo@tyrecare.test', now(),
  '{"nome": "Marco", "cognome": "Gomma"}'
);

select is(
  (select ruolo::text from public.profiles where id = 'a0590000-0000-4000-8000-0000000000f1'),
  'CLIENTE',
  'il nuovo account ha il profilo CLIENTE'
);

-- ---------------------------------------------------------------- senza utente (anon)
reset role;
set local role anon;
select throws_ok(
  $$select public.richiedi_affiliazione('Officina Anon', '55555555555', 'Roma')$$,
  '42501', null,
  'anon non può chiedere l''affiliazione'
);

-- ---------------------------------------------------------------- richiesta riuscita
select pg_temp.come('a0590000-0000-4000-8000-0000000000f1');
select lives_ok(
  $$insert into esito select public.richiedi_affiliazione(
      '  Gomme Nuove  ', ' 11111111111 ', '  Torino ', ' 011 1234567 ')$$,
  'il nuovo account chiede l''affiliazione'
);
select is(
  (select count(*)::int from public.officine o join esito e on e.id = o.id),
  1,
  'il titolare vede già la sua officina'
);

reset role;
select is(
  (select count(*)::int from public.officine o join esito e on e.id = o.id
    where o.ragione_sociale = 'Gomme Nuove' and o.partita_iva = '11111111111'
      and o.citta = 'Torino' and o.telefono = '011 1234567'
      and o.email = 'gommista.nuovo@tyrecare.test' and o.stato_affiliazione = 'IN_ATTESA'),
  1,
  'l''officina è IN_ATTESA, con i dati ripuliti e l''email dell''account'
);
select is(
  (select ruolo::text from public.officina_utenti ou join esito e on e.id = ou.officina_id
    where ou.profile_id = 'a0590000-0000-4000-8000-0000000000f1'),
  'TITOLARE',
  'officina_utenti ha la riga TITOLARE'
);
select is(
  (select ruolo::text from public.profiles where id = 'a0590000-0000-4000-8000-0000000000f1'),
  'CLIENTE',
  'il ruolo globale resta CLIENTE (lo cambia l''admin all''attivazione)'
);

-- ---------------------------------------------------------------- visibilità (caso negato)
select pg_temp.come('a0000000-0000-4000-8000-000000000004'); -- cliente di Gomme Rossi
select is(
  (select count(*) from public.officine o join esito e on e.id = o.id),
  0::bigint,
  'un altro cliente non vede l''officina in attesa'
);

-- ---------------------------------------------------------------- già in un'officina
select pg_temp.come('a0590000-0000-4000-8000-0000000000f1');
select throws_ok(
  $$select public.richiedi_affiliazione('Seconda Officina', '22222222222', 'Torino')$$,
  'P0001', 'GIA_IN_OFFICINA',
  'una seconda richiesta dello stesso account è rifiutata'
);
select pg_temp.come('a0000000-0000-4000-8000-000000000003'); -- operatore di Gomme Rossi
select throws_ok(
  $$select public.richiedi_affiliazione('Officina Operatore', '22222222222', 'Milano')$$,
  'P0001', 'GIA_IN_OFFICINA',
  'un operatore di Gomme Rossi non può chiedere un''altra officina'
);

-- ---------------------------------------------------------------- validazione dei campi
select pg_temp.come('a0000000-0000-4000-8000-000000000004'); -- cliente, in nessuna officina
select throws_ok(
  $$select public.richiedi_affiliazione('Altra Officina', '01234567890', 'Milano')$$,
  'P0001', 'PARTITA_IVA_GIA_PRESENTE',
  'partita IVA di Gomme Rossi già presente'
);
select throws_ok(
  $$select public.richiedi_affiliazione('Altra Officina', '123', 'Milano')$$,
  'P0001', 'PARTITA_IVA_NON_VALIDA',
  'partita IVA di 3 cifre non valida'
);
select throws_ok(
  $$select public.richiedi_affiliazione('   A   ', '22222222222', 'Milano')$$,
  'P0001', 'RAGIONE_SOCIALE_NON_VALIDA',
  'ragione sociale di un solo carattere dopo il btrim'
);
select throws_ok(
  $$select public.richiedi_affiliazione('Altra Officina', '22222222222', '   ')$$,
  'P0001', 'CITTA_MANCANTE',
  'città vuota'
);

-- ---------------------------------------------------------------- telefono vuoto
select lives_ok(
  $$select public.richiedi_affiliazione('Officina Cliente', '22222222222', 'Milano', '   ')$$,
  'il cliente chiede l''affiliazione con il telefono vuoto'
);
reset role;
select ok(
  (select telefono is null from public.officine where partita_iva = '22222222222'),
  'telefono vuoto salvato come null'
);

select * from finish();
rollback;

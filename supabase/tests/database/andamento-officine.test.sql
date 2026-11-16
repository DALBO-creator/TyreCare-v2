-- Test di andamento_officine (migrazione 20261116000200): numeri del pilota per officina, solo admin con
-- aal2; periodo in giorni italiani. Date esplicite nel 2020 (mai current_date: dritta T138).
-- Richiede seed.sql. Eseguire con: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(24);

create function pg_temp.come(p_utente uuid, p_aal text default 'aal2') returns void language plpgsql as $$
begin
  reset role;
  set local role authenticated;
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_utente, 'role', 'authenticated', 'aal', p_aal)::text,
    true
  );
end;
$$;

\set rossi '''b0000000-0000-4000-8000-000000000001'''
\set admin '''a0000000-0000-4000-8000-000000000001'''
\set titolare '''a0000000-0000-4000-8000-000000000002'''
\set cliente '''a0000000-0000-4000-8000-000000000004'''

-- Dati del test (da postgres, prima di qualsiasi ruolo): un dispositivo push di Giulia (collegata a
-- Gomme Rossi), un invito, due controlli dall'app e uno importato, una richiesta su strada chiusa.
-- Il secondo controllo dall'app: 10 marzo 23:30 UTC = 11 marzo 00:30 in Italia.
insert into public.iscrizioni_push (profile_id, endpoint, p256dh, auth)
values (:cliente, 'https://fcm.googleapis.com/fcm/send/t255', 'k', 'a');

insert into public.inviti_cliente (officina_id, cliente_officina_id, email, codice_hash, scade_il, created_at)
values (:rossi, 'c0000000-0000-4000-8000-000000000002', 'franco@esempio.it', '\x7255'::bytea,
        '2020-03-17 12:00+01', '2020-03-10 12:00+01');

insert into public.controlli (officina_id, veicolo_id, eseguito_il, origine, codice_documento, eseguito_da, created_at)
values
  (:rossi, 'd0000000-0000-4000-8000-000000000001', '2020-03-10', 'APP', null, null, '2020-03-10 12:00+01'),
  (:rossi, 'd0000000-0000-4000-8000-000000000001', '2020-03-10', 'APP', null, null, '2020-03-10 23:30+00'),
  (:rossi, 'd0000000-0000-4000-8000-000000000001', '2020-03-10', 'IMPORT', 'T255-1', null,
   '2020-03-10 12:00+01');

insert into public.richieste_strada (
  cliente_id, latitudine, longitudine, descrizione, telefono, stato, officina_id, accettata_il, created_at
)
values (:cliente, 45.07, 7.68, 'Foratura', '+39 333 1112223', 'CHIUSA', :rossi,
        '2020-03-10 12:10+01', '2020-03-10 12:00+01');

-- I risultati dell'admin finiscono in tabelle temporanee: i conteggi attesi si calcolano da postgres,
-- senza RLS, sulle stesse tabelle.
create temp table tutto (
  officina_id uuid, ragione_sociale text, stato_affiliazione text, clienti integer,
  clienti_collegati integer, clienti_con_push integer, inviti_creati integer, controlli_app integer,
  controlli_importati integer, richieste_appuntamento integer, richieste_strada_accettate integer
);
create temp table giorno10 (like tutto);
create temp table giorno9 (like tutto);
create temp table giorno11 (like tutto);
grant insert, select on tutto, giorno10, giorno9, giorno11 to authenticated;

select pg_temp.come(:admin);
insert into tutto select * from public.andamento_officine('2000-01-01', '2100-12-31');
insert into giorno10 select * from public.andamento_officine('2020-03-10', '2020-03-10');
insert into giorno9 select * from public.andamento_officine('2020-03-09', '2020-03-09');
insert into giorno11 select * from public.andamento_officine('2020-03-11', '2020-03-11');

select throws_ok(
  $$select * from public.andamento_officine('2020-03-11', '2020-03-10')$$,
  'P0001', 'PERIODO_NON_VALIDO', 'admin, periodo invertito: PERIODO_NON_VALIDO'
);
select throws_ok(
  $$select * from public.andamento_officine(null, '2020-03-10')$$,
  'P0001', 'PERIODO_NON_VALIDO', 'admin, data mancante: PERIODO_NON_VALIDO'
);

reset role;

-- Tutto il periodo: uguale ai conteggi sulle tabelle
select is(
  (select ragione_sociale || ' ' || stato_affiliazione from tutto where officina_id = :rossi),
  'Gomme Rossi S.n.c. ATTIVA',
  'admin: nome e stato dell''officina'
);
select is(
  (select count(*)::integer from tutto), (select count(*)::integer from public.officine),
  'admin: una riga per ogni officina, anche senza attività'
);
select is(
  (select clienti from tutto where officina_id = :rossi),
  (select count(*)::integer from public.clienti_officina where officina_id = :rossi),
  'clienti = righe di clienti_officina'
);
select is(
  (select clienti_collegati from tutto where officina_id = :rossi),
  (select count(*)::integer from public.clienti_officina where officina_id = :rossi and profile_id is not null),
  'clienti_collegati = clienti con account collegato'
);
select is(
  (select clienti_con_push from tutto where officina_id = :rossi),
  (
    select count(*)::integer from public.clienti_officina c
    where c.officina_id = :rossi and c.profile_id is not null
      and exists (select 1 from public.iscrizioni_push ip where ip.profile_id = c.profile_id)
  ),
  'clienti_con_push = collegati con almeno un dispositivo'
);
select ok(
  (select clienti_con_push from tutto where officina_id = :rossi) >= 1,
  'clienti_con_push: il dispositivo di Giulia conta'
);
select is(
  (select inviti_creati from tutto where officina_id = :rossi),
  (select count(*)::integer from public.inviti_cliente where officina_id = :rossi),
  'inviti_creati = inviti dell''officina'
);
select is(
  (select controlli_app from tutto where officina_id = :rossi),
  (select count(*)::integer from public.controlli where officina_id = :rossi and origine = 'APP'),
  'controlli_app = controlli con origine APP'
);
select is(
  (select controlli_importati from tutto where officina_id = :rossi),
  (select count(*)::integer from public.controlli where officina_id = :rossi and origine = 'IMPORT'),
  'controlli_importati = controlli con origine IMPORT'
);
select is(
  (select richieste_appuntamento from tutto where officina_id = :rossi),
  (select count(*)::integer from public.prenotazioni where officina_id = :rossi),
  'richieste_appuntamento = prenotazioni dell''officina'
);
select is(
  (select richieste_strada_accettate from tutto where officina_id = :rossi),
  (select count(*)::integer from public.richieste_strada where officina_id = :rossi),
  'richieste_strada_accettate = richieste con l''officina che ha accettato'
);

-- Giorni italiani
select is(
  (select controlli_app from giorno10 where officina_id = :rossi), 1,
  '10 marzo: solo il controllo delle 12:00 (quello delle 23:30 UTC è l''11 in Italia)'
);
select is(
  (select controlli_importati from giorno10 where officina_id = :rossi), 1,
  '10 marzo: il controllo importato'
);
select is(
  (select inviti_creati from giorno10 where officina_id = :rossi), 1, '10 marzo: l''invito'
);
select is(
  (select richieste_strada_accettate from giorno10 where officina_id = :rossi), 1,
  '10 marzo: la richiesta su strada'
);
select is(
  (select controlli_app + controlli_importati + inviti_creati + richieste_strada_accettate
   from giorno9 where officina_id = :rossi), 0,
  '9 marzo: niente'
);
select is(
  (select controlli_app from giorno11 where officina_id = :rossi), 1,
  '11 marzo: il controllo delle 23:30 UTC del 10'
);

-- Accessi negati
select pg_temp.come(:admin, 'aal1');
select throws_ok(
  $$select * from public.andamento_officine('2020-03-10', '2020-03-10')$$, '42501', null,
  'admin con la sola password: rifiutato'
);

select pg_temp.come(:titolare);
select throws_ok(
  $$select * from public.andamento_officine('2020-03-10', '2020-03-10')$$, '42501', null,
  'titolare: rifiutato'
);
select throws_ok(
  $$select * from public.andamento_officine('2020-03-11', '2020-03-10')$$, '42501', null,
  'titolare con periodo invertito: rifiutato prima del controllo del periodo'
);

select pg_temp.come(:cliente);
select throws_ok(
  $$select * from public.andamento_officine('2020-03-10', '2020-03-10')$$, '42501', null,
  'cliente: rifiutato'
);

reset role;
set local role anon;
select throws_ok(
  $$select * from public.andamento_officine('2020-03-10', '2020-03-10')$$, '42501', null,
  'anonimo: rifiutato'
);

select * from finish();
rollback;

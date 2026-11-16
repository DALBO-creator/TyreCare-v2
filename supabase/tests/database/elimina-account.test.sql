-- Test di elimina_account (T038). Richiede seed.sql.
-- Eseguire con: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(17);

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

-- Utenti del seed: …01 admin, …02 titolare e …03 operatore di Gomme Rossi, …04 cliente Giulia,
-- …05 titolare di Pneus Express
\set rossi '''b0000000-0000-4000-8000-000000000001'''

-- Due clienti nuovi (il profilo lo crea il trigger): Elena ha una prenotazione RICHIESTA, Marta una
-- COMPLETATA, un'anagrafica da Gomme Rossi con un veicolo e una notifica.
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000000', 'a3800000-0000-4000-8000-0000000000e1',
   'authenticated', 'authenticated', 'elena.elimina@tyrecare.test', now(), '{"nome": "Elena", "cognome": "Neri"}'),
  ('00000000-0000-0000-0000-000000000000', 'a3800000-0000-4000-8000-0000000000e2',
   'authenticated', 'authenticated', 'marta.elimina@tyrecare.test', now(), '{"nome": "Marta", "cognome": "Gialli"}');

insert into public.prenotazioni
  (id, officina_id, servizio, cliente_id, nome_cliente, telefono_cliente, targa, giorno, fascia, stato, appuntamento)
values
  ('a3800000-0000-4000-8000-0000000000f1', :rossi, 'Cambio gomme', 'a3800000-0000-4000-8000-0000000000e1',
   'Elena Neri', '333 0000001', 'ZZ381AA', current_date + 10, 'MATTINA', 'RICHIESTA', null),
  ('a3800000-0000-4000-8000-0000000000f2', :rossi, 'Cambio gomme', 'a3800000-0000-4000-8000-0000000000e2',
   'Marta Gialli', '333 0000002', 'ZZ382AA', current_date - 10, 'MATTINA', 'COMPLETATA',
   now() - interval '10 days');

insert into public.clienti_officina (id, officina_id, profile_id, nome, cognome)
values ('c3800000-0000-4000-8000-0000000000c2', :rossi, 'a3800000-0000-4000-8000-0000000000e2', 'Marta', 'Gialli');
insert into public.veicoli (id, officina_id, cliente_officina_id, targa, marca, modello)
values ('d3800000-0000-4000-8000-0000000000d2', :rossi, 'c3800000-0000-4000-8000-0000000000c2', 'ZZ382AA', 'Fiat', 'Panda');
insert into public.notifiche (id, destinatario_id, tipo, titolo, link)
values ('e3800000-0000-4000-8000-0000000000b2', 'a3800000-0000-4000-8000-0000000000e2', 'CONFERMATA', 'Prova', '/notifiche');

-- ---------------------------------------------------------------- casi negati
select pg_temp.come(null); -- anon
select throws_ok(
  $$select public.elimina_account()$$,
  '42501', null,
  'senza accesso non si può eliminare un account'
);

select pg_temp.come('a0000000-0000-4000-8000-000000000001'); -- admin
select throws_ok(
  $$select public.elimina_account()$$,
  'P0001', 'ACCOUNT_AMMINISTRATORE',
  'l''amministratore non può eliminarsi'
);

select pg_temp.come('a0000000-0000-4000-8000-000000000002'); -- titolare di Gomme Rossi
select throws_ok(
  $$select public.elimina_account()$$,
  'P0001', 'TITOLARE_DI_OFFICINA',
  'il titolare di un''officina non può eliminarsi'
);

select pg_temp.come('a3800000-0000-4000-8000-0000000000e1'); -- Elena: prenotazione RICHIESTA
select throws_ok(
  $$select public.elimina_account()$$,
  'P0001', 'PRENOTAZIONI_IN_CORSO',
  'con una prenotazione richiesta non si può eliminare l''account'
);

reset role;
select is(
  (select count(*)::int from auth.users where id = 'a3800000-0000-4000-8000-0000000000e1'),
  1,
  'dopo il rifiuto l''account di Elena esiste ancora'
);

-- Con la prenotazione annullata Elena può eliminarsi (le prenotazioni passate non bloccano)
update public.prenotazioni set stato = 'ANNULLATA' where id = 'a3800000-0000-4000-8000-0000000000f1';
select pg_temp.come('a3800000-0000-4000-8000-0000000000e1');
select lives_ok(
  $$select public.elimina_account()$$,
  'con la prenotazione annullata Elena può eliminarsi'
);

-- ---------------------------------------------------------------- Marta: cliente con dati dell'officina
select pg_temp.come('a3800000-0000-4000-8000-0000000000e2');
select lives_ok(
  $$select public.elimina_account()$$,
  'Marta (prenotazione completata) elimina il suo account'
);

reset role;
select is(
  (select count(*)::int from auth.users where id = 'a3800000-0000-4000-8000-0000000000e2'),
  0,
  'l''account di Marta non c''è più in auth.users'
);
select is(
  (select count(*)::int from public.profiles where id = 'a3800000-0000-4000-8000-0000000000e2'),
  0,
  'il profilo di Marta non c''è più'
);
select is(
  (select count(*)::int from public.notifiche where destinatario_id = 'a3800000-0000-4000-8000-0000000000e2'),
  0,
  'le notifiche di Marta sono sparite'
);
select is(
  (select count(*)::int from public.prenotazioni where cliente_id = 'a3800000-0000-4000-8000-0000000000e2'),
  0,
  'le prenotazioni di Marta (anche passate) sono sparite'
);
select results_eq(
  $$select profile_id is null, nome from public.clienti_officina where id = 'c3800000-0000-4000-8000-0000000000c2'$$,
  $$values (true, 'Marta')$$,
  'l''anagrafica di Marta resta all''officina, senza account collegato'
);
select is(
  (select count(*)::int from public.veicoli where id = 'd3800000-0000-4000-8000-0000000000d2'),
  1,
  'il veicolo di Marta resta all''officina'
);

-- ---------------------------------------------------------------- operatore
select pg_temp.come('a0000000-0000-4000-8000-000000000003'); -- operatore di Gomme Rossi
select lives_ok(
  $$select public.elimina_account()$$,
  'l''operatore di Gomme Rossi può eliminarsi'
);

reset role;
select is(
  (select count(*)::int from public.officina_utenti where profile_id = 'a0000000-0000-4000-8000-000000000003'),
  0,
  'la riga di officina_utenti dell''operatore è sparita'
);
select is(
  (select eseguito_da from public.controlli where id = 'f0000000-0000-4000-8000-000000000001'),
  null,
  'il controllo eseguito dall''operatore resta, senza autore'
);
select is(
  (select count(*)::int from public.officina_utenti where officina_id = :rossi and ruolo = 'TITOLARE'),
  1,
  'il titolare di Gomme Rossi non è toccato'
);

select * from finish();
rollback;

-- Test della pulizia delle notifiche vecchie (migrazione "pulizia_notifiche"). Richiede i dati di
-- seed.sql (Mario, titolare di Gomme Rossi). Eseguire con: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

-- Cinque notifiche per Mario, inserite come postgres con le date esplicite (adesso = 2026-12-01)
insert into public.notifiche (id, destinatario_id, tipo, titolo, link, created_at, letta_il)
values
  -- A: letta 200 giorni prima -> cancellata
  ('a9000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-000000000002', 'CONFERMATA',
   'A', '/x', '2026-05-01 10:00+00', '2026-05-15 10:00+00'),
  -- B: letta 100 giorni prima -> resta
  ('a9000000-0000-4000-8000-00000000000b', 'a0000000-0000-4000-8000-000000000002', 'CONFERMATA',
   'B', '/x', '2026-08-01 10:00+00', '2026-08-23 10:00+00'),
  -- C: non letta di 200 giorni -> resta
  ('a9000000-0000-4000-8000-00000000000c', 'a0000000-0000-4000-8000-000000000002', 'CONFERMATA',
   'C', '/x', '2026-05-15 10:00+00', null),
  -- D: non letta di 400 giorni -> cancellata
  ('a9000000-0000-4000-8000-00000000000d', 'a0000000-0000-4000-8000-000000000002', 'CONFERMATA',
   'D', '/x', '2025-10-27 10:00+00', null),
  -- E: letta da poco ma creata 400 giorni prima -> cancellata (limite dei 365 giorni)
  ('a9000000-0000-4000-8000-00000000000e', 'a0000000-0000-4000-8000-000000000002', 'CONFERMATA',
   'E', '/x', '2025-10-27 10:00+00', '2026-11-20 10:00+00');

create temp table esito as
select public.pulisci_notifiche('2026-12-01 12:00+00') as quante;

select is(
  (select count(*) from public.notifiche where id = 'a9000000-0000-4000-8000-00000000000a'),
  0::bigint, 'letta 200 giorni prima: cancellata'
);
select is(
  (select count(*) from public.notifiche where id = 'a9000000-0000-4000-8000-00000000000b'),
  1::bigint, 'letta 100 giorni prima: resta'
);
select is(
  (select count(*) from public.notifiche where id = 'a9000000-0000-4000-8000-00000000000c'),
  1::bigint, 'non letta di 200 giorni: resta'
);
select is(
  (select count(*) from public.notifiche where id = 'a9000000-0000-4000-8000-00000000000d'),
  0::bigint, 'non letta di 400 giorni: cancellata'
);
select is(
  (select count(*) from public.notifiche where id = 'a9000000-0000-4000-8000-00000000000e'),
  0::bigint, 'creata 400 giorni prima anche se letta da poco: cancellata'
);
select is((select quante from esito), 3, 'restituisce quante ne ha cancellate');

-- Un utente non può lanciarla
set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'a0000000-0000-4000-8000-000000000002', 'role', 'authenticated', 'aal', 'aal2')::text,
  true
);
select throws_ok(
  $$select public.pulisci_notifiche()$$,
  '42501', null,
  'un utente non può lanciare la pulizia'
);
reset role;

select is(
  (select schedule from cron.job where jobname = 'pulizia-notifiche'),
  '40 1 * * *',
  'il job gira ogni notte all''1:40'
);
select is(
  (select command from cron.job where jobname = 'pulizia-notifiche'),
  'select public.pulisci_notifiche()',
  'il job chiama la funzione'
);

select * from finish();
rollback;

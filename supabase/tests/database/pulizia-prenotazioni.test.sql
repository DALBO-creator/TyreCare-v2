-- Test della pulizia delle prenotazioni vecchie (migrazione "pulizia_prenotazioni"). Richiede i dati di
-- seed.sql (Gomme Rossi, Mario titolare, Giulia cliente). Eseguire con: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

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

-- Il seed non ha prenotazioni prima del limite (oggi = 2026-12-01 -> limite 2024-12-01): il numero
-- restituito conta solo le righe di questo test
select is(
  (select count(*) from public.prenotazioni where giorno < '2024-12-01'),
  0::bigint, 'nessuna prenotazione del seed prima del limite'
);

-- Quattro prenotazioni di Giulia a Gomme Rossi, inserite come postgres con le date esplicite
insert into public.prenotazioni (
  id, officina_id, servizio, cliente_id, nome_cliente, telefono_cliente, targa, giorno, fascia, stato
)
values
  -- A: 2024-10-15, oltre 25 mesi prima -> cancellata
  ('a9100000-0000-4000-8000-00000000000a', 'b0000000-0000-4000-8000-000000000001', 'Cambio gomme',
   'a0000000-0000-4000-8000-000000000004', 'Giulia Verdi', '+39 347 1112223', 'AB123CD',
   '2024-10-15', 'MATTINA', 'RICHIESTA'),
  -- B: 2025-01-15, 23 mesi prima -> resta
  ('a9100000-0000-4000-8000-00000000000b', 'b0000000-0000-4000-8000-000000000001', 'Cambio gomme',
   'a0000000-0000-4000-8000-000000000004', 'Giulia Verdi', '+39 347 1112223', 'AB123CD',
   '2025-01-15', 'MATTINA', 'RICHIESTA'),
  -- C: 2024-12-01, esattamente 24 mesi prima -> resta (il confronto è stretto)
  ('a9100000-0000-4000-8000-00000000000c', 'b0000000-0000-4000-8000-000000000001', 'Cambio gomme',
   'a0000000-0000-4000-8000-000000000004', 'Giulia Verdi', '+39 347 1112223', 'AB123CD',
   '2024-12-01', 'POMERIGGIO', 'RICHIESTA'),
  -- D: 2024-11-30, un giorno oltre il limite e in un altro stato -> cancellata (qualsiasi stato)
  ('a9100000-0000-4000-8000-00000000000d', 'b0000000-0000-4000-8000-000000000001', 'Cambio gomme',
   'a0000000-0000-4000-8000-000000000004', 'Giulia Verdi', '+39 347 1112223', 'AB123CD',
   '2024-11-30', 'POMERIGGIO', 'RIFIUTATA');

-- Una notifica collegata alla prenotazione A: deve sparire con lei (on delete cascade)
insert into public.notifiche (id, destinatario_id, tipo, titolo, link, prenotazione_id)
values
  ('a9100000-0000-4000-8000-0000000000e1', 'a0000000-0000-4000-8000-000000000004', 'RIFIUTATA',
   'Vecchia', '/x', 'a9100000-0000-4000-8000-00000000000a');

select is(
  (select count(*) from public.notifiche where id = 'a9100000-0000-4000-8000-0000000000e1'),
  1::bigint, 'la notifica collegata esiste prima della pulizia'
);

create temp table esito as
select public.pulisci_prenotazioni('2026-12-01') as quante;

select is(
  (select count(*) from public.prenotazioni where id = 'a9100000-0000-4000-8000-00000000000a'),
  0::bigint, 'di oltre 25 mesi prima: cancellata'
);
select is(
  (select count(*) from public.prenotazioni where id = 'a9100000-0000-4000-8000-00000000000b'),
  1::bigint, 'di 23 mesi prima: resta'
);
select is(
  (select count(*) from public.prenotazioni where id = 'a9100000-0000-4000-8000-00000000000c'),
  1::bigint, 'di esattamente 24 mesi prima: resta'
);
select is(
  (select count(*) from public.prenotazioni where id = 'a9100000-0000-4000-8000-00000000000d'),
  0::bigint, 'rifiutata di un giorno oltre il limite: cancellata'
);
select is((select quante from esito), 2, 'restituisce quante ne ha cancellate');
select is(
  (select count(*) from public.notifiche where id = 'a9100000-0000-4000-8000-0000000000e1'),
  0::bigint, 'la notifica collegata sparisce con la prenotazione'
);

-- Né un utente né anon possono lanciarla
select pg_temp.come('a0000000-0000-4000-8000-000000000002'); -- titolare di Gomme Rossi
select throws_ok(
  $$select public.pulisci_prenotazioni('2026-12-01')$$,
  '42501', null,
  'il titolare non può lanciare la pulizia'
);
reset role;
set local role anon;
select throws_ok(
  $$select public.pulisci_prenotazioni('2026-12-01')$$,
  '42501', null,
  'anon non può lanciare la pulizia'
);
reset role;

select is(
  (select schedule from cron.job where jobname = 'pulizia-prenotazioni'),
  '45 0 * * *',
  'il job gira ogni notte alle 00:45 UTC'
);
select is(
  (select command from cron.job where jobname = 'pulizia-prenotazioni'),
  'select public.pulisci_prenotazioni()',
  'il job chiama la funzione'
);

select * from finish();
rollback;

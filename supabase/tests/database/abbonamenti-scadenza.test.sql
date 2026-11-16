-- Test delle scadenze degli abbonamenti (job `scadenza-abbonamenti`, funzione `scadi_abbonamenti`).
-- Richiede seed.sql. Eseguire con: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

\set rossi '''b0000000-0000-4000-8000-000000000001'''
\set express '''b0000000-0000-4000-8000-000000000002'''
\set attesa '''b0680000-0000-4000-8000-000000000001'''
\set admin '''a0000000-0000-4000-8000-000000000001'''
\set titolare '''a0000000-0000-4000-8000-000000000002'''
\set titolare2 '''a0000000-0000-4000-8000-000000000005'''

-- Permessi
select is(has_function_privilege('authenticated', 'public.scadi_abbonamenti(date)', 'execute'), false,
  'authenticated non esegue scadi_abbonamenti');
select is(has_function_privilege('anon', 'public.scadi_abbonamenti(date)', 'execute'), false,
  'anon non esegue scadi_abbonamenti');

-- Stato dalle date
select is(public.stato_abbonamento_da_date('2026-12-01', '2026-01-01', '2026-12-01'), 'ATTIVO',
  'scadenza oggi: ancora ATTIVO (ultimo giorno incluso)');
select is(public.stato_abbonamento_da_date('2026-11-30', '2027-01-01', '2026-12-01'), 'SCADUTO',
  'scadenza ieri: SCADUTO anche con la prova nel futuro');
select is(public.stato_abbonamento_da_date(null, '2026-12-01', '2026-12-01'), 'PROVA',
  'senza scadenza vale la prova');
select is(public.stato_abbonamento_da_date(null, '2026-11-30', '2026-12-01'), 'SCADUTO',
  'prova finita ieri: SCADUTO');
select is(public.data_italiana('2026-11-01'), '1 novembre 2026', 'data in italiano');

-- Preparazione: Rossi in prova fino al 10 dicembre; Express attivo fino al 10 dicembre
update public.abbonamenti set stato = 'PROVA', prova_fino_al = '2026-12-10', scade_il = null, iniziato_il = null
  where officina_id = :rossi;
update public.abbonamenti set stato = 'ATTIVO', iniziato_il = '2026-11-11', scade_il = '2026-12-10'
  where officina_id = :express;
update public.abbonamenti set prova_fino_al = '2099-01-01' where officina_id not in (:rossi, :express);
delete from public.notifiche;

-- Sette giorni prima: solo avvisi ai titolari
select is(public.scadi_abbonamenti('2026-12-03'), 0, 'sette giorni prima non scade niente');
select results_eq(
  $$select destinatario_id, titolo from public.notifiche order by destinatario_id$$,
  $$values
    ('a0000000-0000-4000-8000-000000000002'::uuid, 'La prova sta per finire'),
    ('a0000000-0000-4000-8000-000000000005'::uuid, 'Abbonamento in scadenza')$$,
  'i due titolari ricevono l''avviso, ognuno il suo'
);
select is(
  (select testo from public.notifiche where destinatario_id = :titolare2),
  'L''abbonamento di Pneus Express S.r.l. scade il 10 dicembre 2026. Scrivici per rinnovarlo.',
  'testo dell''avviso con la data in italiano'
);

-- L'ultimo giorno è incluso
delete from public.notifiche;
select is(public.scadi_abbonamenti('2026-12-10'), 0, 'l''ultimo giorno non scade ancora');
select is((select count(*)::int from public.notifiche), 0, 'e non parte nessun avviso');

-- Il giorno dopo
select is(public.scadi_abbonamenti('2026-12-11'), 2, 'il giorno dopo scadono tutti e due');
select results_eq(
  format('select officina_id, stato from public.abbonamenti where officina_id in (%L, %L) order by officina_id', :rossi, :express),
  format($$values (%L::uuid, 'SCADUTO'), (%L::uuid, 'SCADUTO')$$, :rossi, :express),
  'prova e abbonamento sono SCADUTO'
);
select results_eq(
  $$select destinatario_id, titolo, link from public.notifiche order by destinatario_id, titolo$$,
  $$values
    ('a0000000-0000-4000-8000-000000000001'::uuid, 'Abbonamento scaduto', '/admin/officina?id=b0000000-0000-4000-8000-000000000002'),
    ('a0000000-0000-4000-8000-000000000001'::uuid, 'Prova finita', '/admin/officina?id=b0000000-0000-4000-8000-000000000001'),
    ('a0000000-0000-4000-8000-000000000002'::uuid, 'La prova è finita', '/officina/abbonamento'),
    ('a0000000-0000-4000-8000-000000000005'::uuid, 'Abbonamento scaduto', '/officina/abbonamento')$$,
  'avvisi ai titolari e all''amministratore, con il link alla scheda'
);

-- Una seconda esecuzione non ripete niente
delete from public.notifiche;
select is(public.scadi_abbonamenti('2026-12-12'), 0, 'una seconda esecuzione non trova più niente');

select * from finish();
rollback;

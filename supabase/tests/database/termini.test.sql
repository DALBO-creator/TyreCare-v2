-- Test dell'accettazione di privacy e termini (migrazione "termini_accettati"). Richiede i dati di
-- seed.sql (Mario, titolare di Gomme Rossi). Eseguire con: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(10);

insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-0000000000e1',
   'authenticated', 'authenticated', 'con.termini@tyrecare.test', now(),
   '{"nome": "T", "termini_versione": "2026-10-bozza"}'),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-0000000000e2',
   'authenticated', 'authenticated', 'senza.termini@tyrecare.test', now(),
   '{"nome": "S"}'),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-0000000000e3',
   'authenticated', 'authenticated', 'admin.finto@tyrecare.test', now(),
   '{"nome": "A", "ruolo": "ADMIN", "termini_versione": "   "}');

select is(
  (select termini_versione from public.profiles where id = 'a0000000-0000-4000-8000-0000000000e1'),
  '2026-10-bozza', 'registrazione con i termini: versione salvata'
);
select isnt(
  (select termini_accettati_il from public.profiles where id = 'a0000000-0000-4000-8000-0000000000e1'),
  null, 'registrazione con i termini: data salvata'
);
select is(
  (select termini_versione || coalesce(termini_accettati_il::text, '-')
   from public.profiles where id = 'a0000000-0000-4000-8000-0000000000e2'),
  null, 'registrazione senza metadato: entrambi nulli'
);
select is(
  (select ruolo::text from public.profiles where id = 'a0000000-0000-4000-8000-0000000000e3'),
  'CLIENTE', 'il ruolo è CLIENTE anche con ADMIN nei metadati'
);
select is(
  (select termini_versione from public.profiles where id = 'a0000000-0000-4000-8000-0000000000e3'),
  null, 'versione fatta di soli spazi: ignorata'
);

-- Il cliente accetta una versione nuova
set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'a0000000-0000-4000-8000-0000000000e2', 'role', 'authenticated')::text,
  true
);
select lives_ok($$select public.accetta_termini('2026-11')$$, 'il cliente accetta i termini');
reset role;
select is(
  (select termini_versione from public.profiles where id = 'a0000000-0000-4000-8000-0000000000e2'),
  '2026-11', 'il suo profilo è aggiornato'
);
select is(
  (select termini_versione from public.profiles where id = 'a0000000-0000-4000-8000-000000000002'),
  null, 'il profilo del titolare non è toccato'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'a0000000-0000-4000-8000-0000000000e2', 'role', 'authenticated')::text,
  true
);
select throws_ok(
  $$select public.accetta_termini('   ')$$,
  '22023', 'VERSIONE_NON_VALIDA',
  'versione vuota rifiutata'
);

-- Senza accesso
reset role;
set local role anon;
select throws_ok(
  $$select public.accetta_termini('2026-11')$$,
  '42501', null,
  'anon non può accettare i termini'
);
reset role;

select * from finish();
rollback;

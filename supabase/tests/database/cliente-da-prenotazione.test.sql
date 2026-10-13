-- Test di `registra_cliente_da_prenotazione` (migrazione "cliente_da_prenotazione"). Richiede i dati di
-- seed.sql: Gomme Rossi con il titolare Mario e l'operatore Luca; Giulia è già sua cliente (collegata
-- all'account) con la Panda AB123CD; Paolo è titolare di Pneus Express.
-- Eseguire con: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(19);

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

-- Elena: account nuovo, non ancora cliente di nessuna officina. Il profilo lo crea il trigger.
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_user_meta_data)
values (
  '00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-0000000000f1',
  'authenticated', 'authenticated', 'Elena.Neri@tyrecare.test', now(),
  '{"nome": "Elena", "cognome": "Neri"}'
);
-- Due account senza nome nel profilo (come quelli creati dalla dashboard): Bruno con l'email
-- confermata, Carla senza
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-0000000000f2',
   'authenticated', 'authenticated', 'bruno.sanna@tyrecare.test', now(), '{}'),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-0000000000f3',
   'authenticated', 'authenticated', 'carla@tyrecare.test', null, '{}');

-- Richieste scritte direttamente (le regole della richiesta le provano gli altri test):
-- f1 Elena con una targa nuova, f2 Giulia con una seconda auto, f3 Giulia con la Panda già registrata,
-- f4 Elena rifiutata
insert into public.prenotazioni (
  id, officina_id, servizio, cliente_id, nome_cliente, telefono_cliente, targa, veicolo, giorno, fascia,
  stato
) values
  ('a4000000-0000-4000-8000-0000000000f1', 'b0000000-0000-4000-8000-000000000001', 'Controllo',
   'a0000000-0000-4000-8000-0000000000f1', 'Elena Neri', '+39 333 9998887', 'ZZ999ZZ',
   'Alfa Romeo Giulietta', current_date + 3, 'MATTINA', 'RICHIESTA'),
  ('a4000000-0000-4000-8000-0000000000f2', 'b0000000-0000-4000-8000-000000000001', 'Controllo',
   'a0000000-0000-4000-8000-000000000004', 'Giulia Verdi', '+39 347 1112223', 'GG111GG',
   'Fiat 500', current_date + 3, 'MATTINA', 'RICHIESTA'),
  ('a4000000-0000-4000-8000-0000000000f3', 'b0000000-0000-4000-8000-000000000001', 'Controllo',
   'a0000000-0000-4000-8000-000000000004', 'Giulia Verdi', '+39 347 1112223', 'AB123CD',
   'Fiat Panda', current_date + 3, 'MATTINA', 'RICHIESTA'),
  ('a4000000-0000-4000-8000-0000000000f4', 'b0000000-0000-4000-8000-000000000001', 'Controllo',
   'a0000000-0000-4000-8000-0000000000f1', 'Elena Neri', '+39 333 9998887', 'YY888YY',
   '', current_date + 3, 'MATTINA', 'RIFIUTATA'),
  ('a4000000-0000-4000-8000-0000000000f5', 'b0000000-0000-4000-8000-000000000001', 'Controllo',
   'a0000000-0000-4000-8000-0000000000f2', '', '+39 333 1110001', 'BB111BB',
   '', current_date + 3, 'MATTINA', 'RICHIESTA'),
  ('a4000000-0000-4000-8000-0000000000f6', 'b0000000-0000-4000-8000-000000000001', 'Controllo',
   'a0000000-0000-4000-8000-0000000000f3', '', '+39 333 1110002', 'CC222CC',
   '', current_date + 3, 'MATTINA', 'RICHIESTA');

-- ---------------------------------------------------------------- permessi
select pg_temp.come('a0000000-0000-4000-8000-0000000000f1');
select throws_ok(
  $$select public.registra_cliente_da_prenotazione('a4000000-0000-4000-8000-0000000000f1',
    gen_random_uuid(), gen_random_uuid(), 'Alfa Romeo', 'Giulietta')$$,
  'P0001', 'PRENOTAZIONE_NON_TROVATA',
  'chi ha prenotato: non registra da solo il proprio veicolo'
);
select pg_temp.come('a0000000-0000-4000-8000-000000000005');
select throws_ok(
  $$select public.registra_cliente_da_prenotazione('a4000000-0000-4000-8000-0000000000f1',
    gen_random_uuid(), gen_random_uuid(), 'Alfa Romeo', 'Giulietta')$$,
  'P0001', 'PRENOTAZIONE_NON_TROVATA',
  'titolare di un''altra officina: non registra'
);
select pg_temp.come(null);
select throws_ok(
  $$select public.registra_cliente_da_prenotazione('a4000000-0000-4000-8000-0000000000f1',
    gen_random_uuid(), gen_random_uuid(), 'Alfa Romeo', 'Giulietta')$$,
  '42501', null,
  'anonimo: non può chiamare la funzione'
);

-- ---------------------------------------------------------------- cliente nuovo (Elena)
select pg_temp.come('a0000000-0000-4000-8000-000000000003');
select is(
  public.registra_cliente_da_prenotazione('a4000000-0000-4000-8000-0000000000f1',
    'a5000000-0000-4000-8000-0000000000c1', 'a5000000-0000-4000-8000-0000000000d1',
    'Alfa Romeo', 'Giulietta'),
  'a5000000-0000-4000-8000-0000000000d1'::uuid,
  'operatore: registra cliente e veicolo, restituisce l''id del veicolo'
);
select results_eq(
  $$select profile_id, nome, cognome, telefono, email from public.clienti_officina
    where id = 'a5000000-0000-4000-8000-0000000000c1'$$,
  $$values ('a0000000-0000-4000-8000-0000000000f1'::uuid, 'Elena', 'Neri', '+39 333 9998887',
    'elena.neri@tyrecare.test')$$,
  'il cliente nasce collegato all''account, con profilo, telefono della richiesta ed email minuscola'
);
select results_eq(
  $$select officina_id, cliente_officina_id, targa, marca, modello from public.veicoli
    where id = 'a5000000-0000-4000-8000-0000000000d1'$$,
  $$values ('b0000000-0000-4000-8000-000000000001'::uuid,
    'a5000000-0000-4000-8000-0000000000c1'::uuid, 'ZZ999ZZ', 'Alfa Romeo', 'Giulietta')$$,
  'il veicolo è dell''officina della richiesta, con la targa della richiesta'
);
select is(
  public.registra_cliente_da_prenotazione('a4000000-0000-4000-8000-0000000000f1',
    'a5000000-0000-4000-8000-0000000000c1', 'a5000000-0000-4000-8000-0000000000d1',
    'Alfa Romeo', 'Giulietta'),
  'a5000000-0000-4000-8000-0000000000d1'::uuid,
  'ripetizione dopo un errore di rete: riconosce il veicolo già creato'
);
select is(
  (select count(*)::int from public.clienti_officina
   where profile_id = 'a0000000-0000-4000-8000-0000000000f1'),
  1,
  'la ripetizione non crea un secondo cliente'
);
select throws_ok(
  $$select public.registra_cliente_da_prenotazione('a4000000-0000-4000-8000-0000000000f1',
    gen_random_uuid(), gen_random_uuid(), '', '')$$,
  'P0001', 'VEICOLO_GIA_REGISTRATO',
  'con altri id la stessa targa è già registrata'
);

-- Elena ora trova il veicolo nel suo garage
select pg_temp.come('a0000000-0000-4000-8000-0000000000f1');
select is(
  (select v.targa from public.veicoli v
   join public.clienti_officina c on c.id = v.cliente_officina_id
   where c.profile_id = 'a0000000-0000-4000-8000-0000000000f1'),
  'ZZ999ZZ',
  'chi ha prenotato: vede il veicolo nel garage'
);

-- ---------------------------------------------------------------- cliente già collegato (Giulia)
select pg_temp.come('a0000000-0000-4000-8000-000000000002');
select lives_ok(
  $$select public.registra_cliente_da_prenotazione('a4000000-0000-4000-8000-0000000000f2',
    'a5000000-0000-4000-8000-0000000000c2', 'a5000000-0000-4000-8000-0000000000d2', 'Fiat', '500')$$,
  'titolare: registra la seconda auto di una cliente già collegata'
);
select is(
  (select cliente_officina_id from public.veicoli where id = 'a5000000-0000-4000-8000-0000000000d2'),
  'c0000000-0000-4000-8000-000000000001'::uuid,
  'il veicolo va alla scheda cliente già collegata all''account'
);
select is(
  (select count(*)::int from public.clienti_officina where id = 'a5000000-0000-4000-8000-0000000000c2'),
  0,
  'nessun cliente doppio'
);

-- ---------------------------------------------------------------- casi che si fermano
select throws_ok(
  $$select public.registra_cliente_da_prenotazione('a4000000-0000-4000-8000-0000000000f3',
    gen_random_uuid(), gen_random_uuid(), 'Fiat', 'Panda')$$,
  'P0001', 'VEICOLO_GIA_REGISTRATO',
  'targa già registrata in officina: si ferma'
);
select throws_ok(
  $$select public.registra_cliente_da_prenotazione('a4000000-0000-4000-8000-0000000000f4',
    gen_random_uuid(), gen_random_uuid(), '', '')$$,
  'P0001', 'PRENOTAZIONE_CHIUSA',
  'richiesta rifiutata: niente cliente'
);
select is(
  (select count(*)::int from public.veicoli where targa = 'YY888YY'),
  0,
  'richiesta rifiutata: nessun veicolo creato'
);

-- ---------------------------------------------------------------- profilo senza nome
select pg_temp.come('a0000000-0000-4000-8000-000000000002');
select public.registra_cliente_da_prenotazione('a4000000-0000-4000-8000-0000000000f5',
  'a5000000-0000-4000-8000-0000000000c5', 'a5000000-0000-4000-8000-0000000000d5', '', '');
select public.registra_cliente_da_prenotazione('a4000000-0000-4000-8000-0000000000f6',
  'a5000000-0000-4000-8000-0000000000c6', 'a5000000-0000-4000-8000-0000000000d6', '', '');
select results_eq(
  $$select nome, cognome, email from public.clienti_officina
    where id = 'a5000000-0000-4000-8000-0000000000c5'$$,
  $$values ('bruno.sanna', '', 'bruno.sanna@tyrecare.test')$$,
  'profilo senza nome: il nome è la parte dell''email prima della @'
);
select results_eq(
  $$select nome, email from public.clienti_officina where id = 'a5000000-0000-4000-8000-0000000000c6'$$,
  $$values ('Cliente', null::text)$$,
  'profilo senza nome ed email non confermata: "Cliente", senza email'
);

-- Il collegamento resta vietato fuori dalla funzione
select throws_ok(
  $$insert into public.clienti_officina (officina_id, profile_id, nome)
    values ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000f1', 'Elena')$$,
  '42501', null,
  'titolare: non collega a mano un cliente a un account'
);

select * from finish();
rollback;

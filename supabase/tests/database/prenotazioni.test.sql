-- Test del catalogo dei servizi e delle prenotazioni (migrazione "prenotazioni"). Richiede i dati di
-- seed.sql: Gomme Rossi (ATTIVA) apre dal lunedì al venerdì mattina e pomeriggio, il sabato solo la
-- mattina, la domenica è chiusa; Pneus Express è IN_ATTESA.
-- Eseguire con: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(50);

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
      json_build_object('sub', p_utente, 'role', 'authenticated', 'aal', 'aal2')::text,
      true
    );
  end if;
end;
$$;

-- Primo giorno dopo oggi (in Italia) con quel giorno della settimana (1 = lunedì … 7 = domenica)
create function pg_temp.prossimo(p_isodow int) returns date language sql as $$
  select d::date
  from generate_series(public.oggi_in_italia() + 1, public.oggi_in_italia() + 7, interval '1 day') d
  where extract(isodow from d) = p_isodow;
$$;

-- Ora italiana di un giorno, come timestamptz
create function pg_temp.alle(p_giorno date, p_ora time) returns timestamptz language sql as $$
  select (p_giorno + p_ora) at time zone 'Europe/Rome';
$$;

-- Due clienti nuovi (non ancora clienti di nessuna officina). Il profilo lo crea il trigger.
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-0000000000e1',
   'authenticated', 'authenticated', 'elena@tyrecare.test', now(),
   '{"nome": "Elena", "cognome": "Neri"}'),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-0000000000e2',
   'authenticated', 'authenticated', 'piero@tyrecare.test', now(),
   '{"nome": "Piero", "cognome": "Rosa"}');

-- Un servizio di Pneus Express (officina non attiva)
insert into public.servizi_officina (id, officina_id, nome) values
  ('a1000000-0000-4000-8000-0000000000e9', 'b0000000-0000-4000-8000-000000000002', 'Cambio gomme');

-- ---------------------------------------------------------------- fasce di apertura
select is(
  public.fasce_aperte('{"lun": [["08:30", "12:30"], ["14:30", "19:00"]]}', '2026-10-12'),
  array['MATTINA', 'POMERIGGIO']::public.fascia_oraria[],
  'fasce: lunedì con due intervalli → mattina e pomeriggio'
);
select is(
  public.fasce_aperte('{"sab": [["08:30", "12:30"]]}', '2026-10-17'),
  array['MATTINA']::public.fascia_oraria[],
  'fasce: sabato solo mattina'
);
select is(
  public.fasce_aperte('{"dom": []}', '2026-10-18'),
  array[]::public.fascia_oraria[],
  'fasce: domenica chiusa'
);
select is(
  public.fasce_aperte('{"mar": [["09:00", "18:00"]]}', '2026-10-13'),
  array['MATTINA', 'POMERIGGIO']::public.fascia_oraria[],
  'fasce: orario continuato → mattina e pomeriggio'
);
select is(
  public.fasce_aperte('{"mer": [["14:00", "18:00"]]}', '2026-10-14'),
  array['POMERIGGIO']::public.fascia_oraria[],
  'fasce: aperto solo il pomeriggio'
);
select is(
  public.fasce_aperte('{}', '2026-10-12'),
  array[]::public.fascia_oraria[],
  'fasce: orari non indicati → chiuso'
);

-- ---------------------------------------------------------------- catalogo dei servizi
-- Senza contare i servizi: un test end-to-end interrotto può lasciarne uno di prova
select pg_temp.come(null);
select is(
  (select count(*) filter (where not prenotabile or officina_id <> 'b0000000-0000-4000-8000-000000000001')
   from public.servizi_officina)::int, 0,
  'anonimo: vede solo i servizi prenotabili delle officine attive'
);
select pg_temp.come('a0000000-0000-4000-8000-000000000004');
select results_eq(
  'select nome from public.servizi_officina where id::text like ''a1000000-%'' order by nome',
  $$values ('Cambio gomme stagionale'), ('Controllo pneumatici'), ('Convergenza')$$,
  'cliente: vede i servizi prenotabili del seed, non il deposito né quelli di officine non attive'
);
select pg_temp.come('a0000000-0000-4000-8000-000000000003');
select ok(
  exists (select 1 from public.servizi_officina where id = 'a1000000-0000-4000-8000-000000000004'),
  'operatore: vede tutto il catalogo della sua officina, anche i servizi non prenotabili'
);
select throws_ok(
  $$insert into public.servizi_officina (officina_id, nome)
    values ('b0000000-0000-4000-8000-000000000001', 'Lavaggio')$$,
  '42501', null,
  'operatore: non modifica il catalogo'
);
select pg_temp.come('a0000000-0000-4000-8000-000000000002');
select lives_ok(
  $$insert into public.servizi_officina (officina_id, nome, prezzo_da)
    values ('b0000000-0000-4000-8000-000000000001', 'Equilibratura', 10)$$,
  'titolare: aggiunge un servizio al catalogo'
);
select pg_temp.come('a0000000-0000-4000-8000-000000000005');
update public.servizi_officina set nome = 'Rubato' where id = 'a1000000-0000-4000-8000-000000000001';
select pg_temp.come('a0000000-0000-4000-8000-000000000002');
select is(
  (select nome from public.servizi_officina where id = 'a1000000-0000-4000-8000-000000000001'),
  'Cambio gomme stagionale',
  'titolare di un''altra officina: non modifica il catalogo'
);

-- ---------------------------------------------------------------- lettura delle prenotazioni
select pg_temp.come('a0000000-0000-4000-8000-000000000004');
select is(
  (select count(*) from public.prenotazioni)::int, 1,
  'cliente: vede la sua prenotazione'
);
select throws_ok(
  $$insert into public.prenotazioni (officina_id, servizio, cliente_id, nome_cliente,
      telefono_cliente, targa, giorno, fascia)
    values ('b0000000-0000-4000-8000-000000000001', 'X', 'a0000000-0000-4000-8000-000000000004',
      'G', '3331234567', 'AB123CD', current_date + 3, 'MATTINA')$$,
  '42501', null,
  'cliente: non scrive direttamente nella tabella'
);
select pg_temp.come('a0000000-0000-4000-8000-000000000003');
-- Senza contare: i test end-to-end aggiungono prenotazioni a Gomme Rossi
select results_eq(
  'select distinct officina_id from public.prenotazioni',
  $$values ('b0000000-0000-4000-8000-000000000001'::uuid)$$,
  'operatore: vede le prenotazioni della sua officina, solo quelle'
);
select pg_temp.come('a0000000-0000-4000-8000-000000000005');
select is(
  (select count(*) from public.prenotazioni)::int, 0,
  'titolare di un''altra officina: non vede le prenotazioni di Gomme Rossi'
);

-- ---------------------------------------------------------------- richiesta del cliente
select pg_temp.come(null);
select throws_ok(
  $$select public.richiedi_prenotazione('b0000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000001', pg_temp.prossimo(1), 'MATTINA', 'AB123CD', '',
    '3331234567')$$,
  '42501', null,
  'anonimo: non può prenotare'
);

select pg_temp.come('a0000000-0000-4000-8000-0000000000e1');
select is(
  public.richiedi_prenotazione('b0000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000001', pg_temp.prossimo(2), 'MATTINA', ' xy 987-zt ',
    'Ford Fiesta', '+39 340 1234567', 'Ho fretta', 'a2000000-0000-4000-8000-0000000000e1'),
  'a2000000-0000-4000-8000-0000000000e1'::uuid,
  'cliente nuovo: chiede un appuntamento a un''officina di cui non è cliente'
);
select results_eq(
  $$select stato::text, servizio, nome_cliente, targa, veicolo
    from public.prenotazioni where id = 'a2000000-0000-4000-8000-0000000000e1'$$,
  $$values ('RICHIESTA', 'Cambio gomme stagionale', 'Elena Neri', 'XY987ZT', 'Ford Fiesta')$$,
  'richiesta: stato, servizio e nome copiati, targa normalizzata'
);
select is(
  public.richiedi_prenotazione('b0000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000001', pg_temp.prossimo(2), 'MATTINA', 'XY987ZT', '',
    '+39 340 1234567', '', 'a2000000-0000-4000-8000-0000000000e1'),
  'a2000000-0000-4000-8000-0000000000e1'::uuid,
  'richiesta: ripetuta con lo stesso id dopo un errore di rete non crea doppioni'
);
select is(
  (select count(*) from public.prenotazioni)::int, 1,
  'cliente nuovo: vede solo la sua prenotazione'
);

select throws_ok(
  $$select public.richiedi_prenotazione('b0000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000001', public.oggi_in_italia(), 'MATTINA', 'XY987ZT', '',
    '3331234567')$$,
  'P0001', 'GIORNO_NON_VALIDO',
  'richiesta: non per oggi'
);
select throws_ok(
  $$select public.richiedi_prenotazione('b0000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000001', public.oggi_in_italia() + 61, 'MATTINA', 'XY987ZT', '',
    '3331234567')$$,
  'P0001', 'GIORNO_NON_VALIDO',
  'richiesta: non oltre 60 giorni'
);
select throws_ok(
  $$select public.richiedi_prenotazione('b0000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000001', pg_temp.prossimo(7), 'MATTINA', 'XY987ZT', '',
    '3331234567')$$,
  'P0001', 'OFFICINA_CHIUSA',
  'richiesta: non la domenica (officina chiusa)'
);
select throws_ok(
  $$select public.richiedi_prenotazione('b0000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000001', pg_temp.prossimo(6), 'POMERIGGIO', 'XY987ZT', '',
    '3331234567')$$,
  'P0001', 'OFFICINA_CHIUSA',
  'richiesta: non il sabato pomeriggio'
);
select throws_ok(
  $$select public.richiedi_prenotazione('b0000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000004', pg_temp.prossimo(2), 'MATTINA', 'XY987ZT', '',
    '3331234567')$$,
  'P0001', 'SERVIZIO_NON_DISPONIBILE',
  'richiesta: non per un servizio non prenotabile'
);
select throws_ok(
  $$select public.richiedi_prenotazione('b0000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-0000000000e9', pg_temp.prossimo(2), 'MATTINA', 'XY987ZT', '',
    '3331234567')$$,
  'P0001', 'SERVIZIO_NON_DISPONIBILE',
  'richiesta: non per un servizio di un''altra officina'
);
select throws_ok(
  $$select public.richiedi_prenotazione('b0000000-0000-4000-8000-000000000002',
    'a1000000-0000-4000-8000-0000000000e9', pg_temp.prossimo(2), 'MATTINA', 'XY987ZT', '',
    '3331234567')$$,
  'P0001', 'OFFICINA_NON_DISPONIBILE',
  'richiesta: non a un''officina non attiva'
);
select throws_ok(
  $$select public.richiedi_prenotazione('b0000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000001', pg_temp.prossimo(2), 'MATTINA', 'X', '',
    '3331234567')$$,
  'P0001', 'TARGA_NON_VALIDA',
  'richiesta: targa troppo corta'
);
select throws_ok(
  $$select public.richiedi_prenotazione('b0000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000001', pg_temp.prossimo(2), 'MATTINA', 'XY987ZT', '',
    'chiamami')$$,
  'P0001', 'TELEFONO_NON_VALIDO',
  'richiesta: telefono non valido'
);

-- Al massimo 3 richieste in attesa per officina (Piero)
select pg_temp.come('a0000000-0000-4000-8000-0000000000e2');
select public.richiedi_prenotazione('b0000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000002', pg_temp.prossimo(n), 'MATTINA', 'PI123RO', '', '3331234567')
from generate_series(1, 3) as n;
select throws_ok(
  $$select public.richiedi_prenotazione('b0000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000002', pg_temp.prossimo(4), 'MATTINA', 'PI123RO', '',
    '3331234567')$$,
  'P0001', 'TROPPE_RICHIESTE',
  'richiesta: la quarta in attesa presso la stessa officina è rifiutata'
);

-- ---------------------------------------------------------------- risposta dell'officina
select pg_temp.come('a0000000-0000-4000-8000-0000000000e1');
select throws_ok(
  $$select public.rispondi_prenotazione('a2000000-0000-4000-8000-0000000000e1', 'CONFERMA',
    pg_temp.alle(pg_temp.prossimo(2), '09:30'))$$,
  '42501', null,
  'cliente: non conferma da solo la sua richiesta'
);
select pg_temp.come('a0000000-0000-4000-8000-000000000005');
select throws_ok(
  $$select public.rispondi_prenotazione('a2000000-0000-4000-8000-0000000000e1', 'CONFERMA',
    pg_temp.alle(pg_temp.prossimo(2), '09:30'))$$,
  '42501', null,
  'titolare di un''altra officina: non risponde'
);

select pg_temp.come('a0000000-0000-4000-8000-000000000003');
select throws_ok(
  $$select public.rispondi_prenotazione('a2000000-0000-4000-8000-0000000000e1', 'CONFERMA',
    pg_temp.alle(pg_temp.prossimo(3), '09:30'))$$,
  'P0001', 'ORARIO_NON_VALIDO',
  'operatore: conferma solo nel giorno chiesto (per un altro giorno si propone)'
);
select throws_ok(
  $$select public.rispondi_prenotazione('a2000000-0000-4000-8000-0000000000e1', 'BOH')$$,
  '22023', null,
  'operatore: azione sconosciuta'
);
select lives_ok(
  $$select public.rispondi_prenotazione('a2000000-0000-4000-8000-0000000000e1', 'CONFERMA',
    pg_temp.alle(pg_temp.prossimo(2), '09:30'), 'Ti aspettiamo')$$,
  'operatore: conferma con l''ora'
);
select lives_ok(
  $$select public.rispondi_prenotazione('a2000000-0000-4000-8000-0000000000e1', 'CONFERMA',
    pg_temp.alle(pg_temp.prossimo(2), '09:30'), 'Ti aspettiamo')$$,
  'operatore: la stessa conferma ripetuta non è un errore'
);
select results_eq(
  $$select stato::text, appuntamento, messaggio_officina, gestita_da
    from public.prenotazioni where id = 'a2000000-0000-4000-8000-0000000000e1'$$,
  $$select 'CONFERMATA', pg_temp.alle(pg_temp.prossimo(2), '09:30'), 'Ti aspettiamo',
    'a0000000-0000-4000-8000-000000000003'::uuid$$,
  'conferma: stato, ora, messaggio e chi l''ha gestita'
);

-- L'officina sposta l'appuntamento: propone il pomeriggio di un altro giorno
select lives_ok(
  $$select public.rispondi_prenotazione('a2000000-0000-4000-8000-0000000000e1', 'PROPONI',
    pg_temp.alle(pg_temp.prossimo(3), '15:00'), 'Possiamo solo nel pomeriggio')$$,
  'operatore: propone un altro orario per un appuntamento confermato'
);

-- ---------------------------------------------------------------- risposta del cliente
select pg_temp.come('a0000000-0000-4000-8000-000000000004');
select throws_ok(
  $$select public.rispondi_proposta('a2000000-0000-4000-8000-0000000000e1', true)$$,
  '42501', null,
  'un altro cliente: non risponde alla proposta'
);
select pg_temp.come('a0000000-0000-4000-8000-0000000000e1');
select lives_ok(
  $$select public.rispondi_proposta('a2000000-0000-4000-8000-0000000000e1', true)$$,
  'cliente: accetta l''orario proposto'
);
select results_eq(
  $$select stato::text, giorno, fascia::text
    from public.prenotazioni where id = 'a2000000-0000-4000-8000-0000000000e1'$$,
  $$select 'CONFERMATA', pg_temp.prossimo(3), 'POMERIGGIO'$$,
  'proposta accettata: confermata con giorno e fascia del nuovo orario'
);
select lives_ok(
  $$select public.rispondi_proposta('a2000000-0000-4000-8000-0000000000e1', true)$$,
  'cliente: accettare di nuovo non è un errore'
);

-- Dopo l'appuntamento
select pg_temp.come('a0000000-0000-4000-8000-000000000003');
select lives_ok(
  $$select public.rispondi_prenotazione('a2000000-0000-4000-8000-0000000000e1', 'COMPLETATA')$$,
  'operatore: segna l''appuntamento come completato'
);
select pg_temp.come('a0000000-0000-4000-8000-0000000000e1');
select throws_ok(
  $$select public.annulla_prenotazione('a2000000-0000-4000-8000-0000000000e1')$$,
  'P0001', 'STATO_NON_VALIDO',
  'cliente: non annulla un appuntamento completato'
);

-- Rifiuto e annullamento
select is(
  public.richiedi_prenotazione('b0000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000003', pg_temp.prossimo(4), 'POMERIGGIO', 'XY987ZT', '',
    '3401234567', '', 'a2000000-0000-4000-8000-0000000000e2'),
  'a2000000-0000-4000-8000-0000000000e2'::uuid,
  'cliente: seconda richiesta'
);
select lives_ok(
  $$select public.annulla_prenotazione('a2000000-0000-4000-8000-0000000000e2')$$,
  'cliente: annulla la sua richiesta'
);
select pg_temp.come('a0000000-0000-4000-8000-000000000003');
select throws_ok(
  $$select public.rispondi_prenotazione('a2000000-0000-4000-8000-0000000000e2', 'CONFERMA',
    pg_temp.alle(pg_temp.prossimo(4), '15:00'))$$,
  'P0001', 'STATO_NON_VALIDO',
  'operatore: non conferma una richiesta annullata dal cliente'
);
select lives_ok(
  $$select public.rispondi_prenotazione('a2000000-0000-4000-8000-000000000001', 'RIFIUTA',
    null, 'Quel giorno siamo al completo')$$,
  'operatore: rifiuta la richiesta di Giulia con un messaggio'
);
select results_eq(
  $$select stato::text, messaggio_officina
    from public.prenotazioni where id = 'a2000000-0000-4000-8000-000000000001'$$,
  $$values ('RIFIUTATA', 'Quel giorno siamo al completo')$$,
  'rifiuto: stato e messaggio per il cliente'
);

select * from finish();
rollback;

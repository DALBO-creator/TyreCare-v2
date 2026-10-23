-- Test della capienza per fascia (migrazione "capienza_fasce", compito T020): `officine.capienza_fascia`,
-- `occupazione_fascia`, `fasce_piene` e il controllo FASCIA_PIENA di `richiedi_prenotazione`.
-- Richiede i dati di seed.sql: Gomme Rossi (ATTIVA) apre dal lunedì al venerdì mattina e pomeriggio,
-- il sabato solo la mattina; Pneus Express è IN_ATTESA. I giorni usati sono tra 8 e 14 giorni da oggi,
-- lontani dalla richiesta del seed (entro 7 giorni) e dalla chiusura del seed (tra 20 e 22 giorni).
-- Ogni cliente fa al massimo 2 richieste in attesa, sotto il limite di TROPPE_RICHIESTE.
-- Eseguire con: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(29);

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

-- Il giorno della settimana indicato (1 = lunedì … 7 = domenica) tra 8 e 14 giorni da oggi in Italia
create function pg_temp.giorno(p_isodow int) returns date language sql as $$
  select d::date
  from generate_series(public.oggi_in_italia() + 8, public.oggi_in_italia() + 14, interval '1 day') d
  where extract(isodow from d) = p_isodow;
$$;

-- Ora italiana di un giorno, come timestamptz
create function pg_temp.alle(p_giorno date, p_ora time) returns timestamptz language sql as $$
  select (p_giorno + p_ora) at time zone 'Europe/Rome';
$$;

-- Una richiesta di "Cambio gomme stagionale" a Gomme Rossi con l'id indicato
create function pg_temp.chiedi(p_giorno date, p_fascia public.fascia_oraria, p_id uuid)
returns uuid language sql as $$
  select public.richiedi_prenotazione('b0000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000001', p_giorno, p_fascia, 'AB123CD', '', '3401234567', '',
    p_id);
$$;

-- Cinque clienti nuovi (il profilo lo crea il trigger)
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_user_meta_data)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email, now(),
  jsonb_build_object('nome', u.nome, 'cognome', 'Capienza')
from (values
  ('a0000000-0000-4000-8000-0000000000f1'::uuid, 'capienza1@tyrecare.test', 'Anna'),
  ('a0000000-0000-4000-8000-0000000000f2'::uuid, 'capienza2@tyrecare.test', 'Bruno'),
  ('a0000000-0000-4000-8000-0000000000f3'::uuid, 'capienza3@tyrecare.test', 'Carla'),
  ('a0000000-0000-4000-8000-0000000000f4'::uuid, 'capienza4@tyrecare.test', 'Dario'),
  ('a0000000-0000-4000-8000-0000000000f5'::uuid, 'capienza5@tyrecare.test', 'Ezio')
) as u (id, email, nome);

-- ---------------------------------------------------------------- senza capienza
select pg_temp.come('a0000000-0000-4000-8000-0000000000f1');
select is(
  pg_temp.chiedi(pg_temp.giorno(2), 'MATTINA', 'a2000000-0000-4000-8000-0000000000f1'),
  'a2000000-0000-4000-8000-0000000000f1'::uuid,
  'senza capienza: prima richiesta del martedì mattina'
);
select pg_temp.come('a0000000-0000-4000-8000-0000000000f2');
select is(
  pg_temp.chiedi(pg_temp.giorno(2), 'MATTINA', 'a2000000-0000-4000-8000-0000000000f2'),
  'a2000000-0000-4000-8000-0000000000f2'::uuid,
  'senza capienza: seconda richiesta nella stessa fascia, nessun limite'
);
select pg_temp.come(null);
select is_empty(
  $$select * from public.fasce_piene('b0000000-0000-4000-8000-000000000001')$$,
  'senza capienza: nessuna fascia piena'
);

-- ---------------------------------------------------------------- chi imposta la capienza
select pg_temp.come('a0000000-0000-4000-8000-000000000003'); -- operatore di Gomme Rossi
update public.officine set capienza_fascia = 1 where id = 'b0000000-0000-4000-8000-000000000001';
select is(
  (select capienza_fascia from public.officine where id = 'b0000000-0000-4000-8000-000000000001'),
  null::smallint,
  'operatore: non imposta la capienza'
);
select pg_temp.come('a0000000-0000-4000-8000-000000000002'); -- titolare di Gomme Rossi
select throws_ok(
  $$update public.officine set capienza_fascia = 0
    where id = 'b0000000-0000-4000-8000-000000000001'$$,
  '23514', null,
  'titolare: capienza 0 rifiutata'
);
select throws_ok(
  $$update public.officine set capienza_fascia = 100
    where id = 'b0000000-0000-4000-8000-000000000001'$$,
  '23514', null,
  'titolare: capienza 100 rifiutata'
);
select lives_ok(
  $$update public.officine set capienza_fascia = 1
    where id = 'b0000000-0000-4000-8000-000000000001'$$,
  'titolare: imposta la capienza a 1'
);
select is(
  (select capienza_fascia from public.officine where id = 'b0000000-0000-4000-8000-000000000001'),
  1::smallint,
  'titolare: capienza salvata'
);

-- ---------------------------------------------------------------- capienza 1
select pg_temp.come('a0000000-0000-4000-8000-0000000000f1');
select is(
  pg_temp.chiedi(pg_temp.giorno(3), 'POMERIGGIO', 'a2000000-0000-4000-8000-0000000000f3'),
  'a2000000-0000-4000-8000-0000000000f3'::uuid,
  'capienza 1: la prima richiesta del mercoledì pomeriggio riesce'
);
select pg_temp.come('a0000000-0000-4000-8000-0000000000f2');
select throws_ok(
  $$select pg_temp.chiedi(pg_temp.giorno(3), 'POMERIGGIO', 'a2000000-0000-4000-8000-0000000000f4')$$,
  'P0001', 'FASCIA_PIENA',
  'capienza 1: la seconda richiesta (altro cliente) nella stessa fascia → FASCIA_PIENA'
);
select is(
  pg_temp.chiedi(pg_temp.giorno(3), 'MATTINA', 'a2000000-0000-4000-8000-0000000000f5'),
  'a2000000-0000-4000-8000-0000000000f5'::uuid,
  'capienza 1: nell''altra fascia dello stesso giorno riesce'
);
select pg_temp.come('a0000000-0000-4000-8000-0000000000f1');
select is(
  pg_temp.chiedi(pg_temp.giorno(3), 'POMERIGGIO', 'a2000000-0000-4000-8000-0000000000f3'),
  'a2000000-0000-4000-8000-0000000000f3'::uuid,
  'fascia piena: ripetere una richiesta già riuscita (stesso id) non è un errore'
);
select pg_temp.come(null);
select results_eq(
  $$select giorno, fascia::text from public.fasce_piene('b0000000-0000-4000-8000-000000000001')
    where giorno in (pg_temp.giorno(2), pg_temp.giorno(3)) order by 1, 2$$,
  $$select g, f from (values
      (pg_temp.giorno(2), 'MATTINA'), (pg_temp.giorno(3), 'MATTINA'), (pg_temp.giorno(3), 'POMERIGGIO')
    ) as v (g, f) order by 1, 2$$,
  'fasce_piene: anon vede le fasce piene (anche quella oltre la capienza)'
);

-- ---------------------------------------------------------------- annullate e rifiutate
select pg_temp.come('a0000000-0000-4000-8000-0000000000f2');
select lives_ok(
  $$select public.annulla_prenotazione('a2000000-0000-4000-8000-0000000000f5')$$,
  'cliente: annulla la richiesta del mercoledì mattina'
);
select pg_temp.come('a0000000-0000-4000-8000-0000000000f3');
select is(
  pg_temp.chiedi(pg_temp.giorno(3), 'MATTINA', 'a2000000-0000-4000-8000-0000000000f6'),
  'a2000000-0000-4000-8000-0000000000f6'::uuid,
  'una richiesta ANNULLATA non occupa la fascia'
);
select pg_temp.come('a0000000-0000-4000-8000-000000000002');
select lives_ok(
  $$select public.rispondi_prenotazione('a2000000-0000-4000-8000-0000000000f6', 'RIFIUTA', null,
    'Siamo al completo')$$,
  'titolare: rifiuta la richiesta del mercoledì mattina'
);
select pg_temp.come('a0000000-0000-4000-8000-0000000000f4');
select is(
  pg_temp.chiedi(pg_temp.giorno(3), 'MATTINA', 'a2000000-0000-4000-8000-0000000000f7'),
  'a2000000-0000-4000-8000-0000000000f7'::uuid,
  'una richiesta RIFIUTATA non occupa la fascia'
);

-- ---------------------------------------------------------------- appuntamento spostato
-- L'officina propone a chi aveva chiesto mercoledì pomeriggio il giovedì alle 13:00 (= pomeriggio)
select pg_temp.come('a0000000-0000-4000-8000-000000000002');
select lives_ok(
  $$select public.rispondi_prenotazione('a2000000-0000-4000-8000-0000000000f3', 'PROPONI',
    pg_temp.alle(pg_temp.giorno(4), '13:00'))$$,
  'titolare: propone un altro giorno anche se la fascia è piena'
);
select pg_temp.come('a0000000-0000-4000-8000-0000000000f2');
select is(
  pg_temp.chiedi(pg_temp.giorno(3), 'POMERIGGIO', 'a2000000-0000-4000-8000-0000000000f4'),
  'a2000000-0000-4000-8000-0000000000f4'::uuid,
  'proposta per un altro giorno: la fascia chiesta si libera'
);
select pg_temp.come('a0000000-0000-4000-8000-0000000000f3');
select throws_ok(
  $$select pg_temp.chiedi(pg_temp.giorno(4), 'POMERIGGIO', 'a2000000-0000-4000-8000-0000000000f8')$$,
  'P0001', 'FASCIA_PIENA',
  'proposta: occupa la fascia dell''ora proposta (le 13:00 sono pomeriggio)'
);
select pg_temp.come('a0000000-0000-4000-8000-0000000000f1');
select lives_ok(
  $$select public.rispondi_proposta('a2000000-0000-4000-8000-0000000000f3', true)$$,
  'cliente: accetta l''orario proposto'
);
select pg_temp.come('a0000000-0000-4000-8000-0000000000f5');
select throws_ok(
  $$select pg_temp.chiedi(pg_temp.giorno(4), 'POMERIGGIO', 'a2000000-0000-4000-8000-0000000000f9')$$,
  'P0001', 'FASCIA_PIENA',
  'confermata: occupa la fascia dell''appuntamento'
);
select is(
  pg_temp.chiedi(pg_temp.giorno(4), 'MATTINA', 'a2000000-0000-4000-8000-0000000000fa'),
  'a2000000-0000-4000-8000-0000000000fa'::uuid,
  'confermata alle 13:00: la mattina dello stesso giorno resta libera'
);

-- Una CONFERMATA con l'ora in un giorno diverso da quello chiesto (scritta direttamente): conta nel
-- giorno dell'appuntamento, non in quello chiesto
reset role;
insert into public.prenotazioni (
  id, officina_id, servizio, cliente_id, nome_cliente, telefono_cliente, targa, giorno, fascia, stato,
  appuntamento
) values (
  'a2000000-0000-4000-8000-0000000000fb', 'b0000000-0000-4000-8000-000000000001', 'Convergenza',
  'a0000000-0000-4000-8000-0000000000f4', 'Dario Capienza', '3401234567', 'CD456EF', pg_temp.giorno(5),
  'MATTINA', 'CONFERMATA', pg_temp.alle(pg_temp.giorno(6), '09:00')
);
select is(
  public.occupazione_fascia('b0000000-0000-4000-8000-000000000001', pg_temp.giorno(5), 'MATTINA'),
  0,
  'confermata spostata: non conta nel giorno chiesto'
);
select is(
  public.occupazione_fascia('b0000000-0000-4000-8000-000000000001', pg_temp.giorno(6), 'MATTINA'),
  1,
  'confermata spostata: conta nel giorno dell''appuntamento'
);

-- ---------------------------------------------------------------- officina non attiva
update public.officine set capienza_fascia = 1 where id = 'b0000000-0000-4000-8000-000000000002';
insert into public.prenotazioni (
  officina_id, servizio, cliente_id, nome_cliente, telefono_cliente, targa, giorno, fascia
) values (
  'b0000000-0000-4000-8000-000000000002', 'Cambio gomme', 'a0000000-0000-4000-8000-0000000000f5',
  'Ezio Capienza', '3401234567', 'GH789IJ', pg_temp.giorno(2), 'MATTINA'
);
select pg_temp.come(null);
select is_empty(
  $$select * from public.fasce_piene('b0000000-0000-4000-8000-000000000002')$$,
  'officina non ATTIVA: fasce_piene non restituisce righe'
);

-- ---------------------------------------------------------------- permessi
select throws_ok(
  $$select public.occupazione_fascia('b0000000-0000-4000-8000-000000000001',
    public.oggi_in_italia() + 8, 'MATTINA')$$,
  '42501', null,
  'anon: non può chiamare occupazione_fascia'
);
select pg_temp.come('a0000000-0000-4000-8000-000000000002');
select throws_ok(
  $$select public.occupazione_fascia('b0000000-0000-4000-8000-000000000001',
    public.oggi_in_italia() + 8, 'MATTINA')$$,
  '42501', null,
  'authenticated (anche il titolare): non può chiamare occupazione_fascia'
);
reset role;
select ok(
  has_function_privilege('authenticated',
    'public.richiedi_prenotazione(uuid, uuid, date, public.fascia_oraria, text, text, text, text, uuid)',
    'execute')
  and not has_function_privilege('anon',
    'public.richiedi_prenotazione(uuid, uuid, date, public.fascia_oraria, text, text, text, text, uuid)',
    'execute'),
  'richiedi_prenotazione: resta solo per authenticated'
);

select * from finish();
rollback;

-- Test dei promemoria del giorno prima (migrazione "promemoria_appuntamenti"). Richiede i dati di
-- seed.sql: Gomme Rossi (ATTIVA, aperta dal lunedì al venerdì) con Mario (TITOLARE) e Luca (OPERATORE).
-- Eseguire con: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(13);

-- Simula una richiesta dal client con il JWT dell'utente indicato.
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

-- Primo giorno dopo oggi (in Italia) con quel giorno della settimana (1 = lunedì … 7 = domenica)
create function pg_temp.prossimo(p_isodow int) returns date language sql as $$
  select d::date
  from generate_series(public.oggi_in_italia() + 1, public.oggi_in_italia() + 7, interval '1 day') d
  where extract(isodow from d) = p_isodow;
$$;

create function pg_temp.alle(p_giorno date, p_ora time) returns timestamptz language sql as $$
  select (p_giorno + p_ora) at time zone 'Europe/Rome';
$$;

-- Promemoria ricevuti da un utente per le prenotazioni di prova
create function pg_temp.promemoria(p_utente uuid) returns bigint language sql as $$
  select count(*)
  from public.notifiche
  where destinatario_id = p_utente and tipo = 'PROMEMORIA'
    and prenotazione_id::text like 'a4000000-%';
$$;

insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-0000000000f2',
   'authenticated', 'authenticated', 'paola.promemoria@tyrecare.test', now(),
   '{"nome": "Paola", "cognome": "Galli"}');

-- Martedì: richiesta confermata alle 9:30. Mercoledì: richiesta lasciata in attesa.
select pg_temp.come('a0000000-0000-4000-8000-0000000000f2');
select public.richiedi_prenotazione(
  'b0000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001',
  pg_temp.prossimo(2), 'MATTINA', 'PR123OM', 'Fiat Tipo', '+39 333 1234567', '',
  'a4000000-0000-4000-8000-000000000001'
);
select public.richiedi_prenotazione(
  'b0000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001',
  pg_temp.prossimo(3), 'MATTINA', 'PR123OM', 'Fiat Tipo', '+39 333 1234567', '',
  'a4000000-0000-4000-8000-000000000002'
);
select pg_temp.come('a0000000-0000-4000-8000-000000000002');
select public.rispondi_prenotazione('a4000000-0000-4000-8000-000000000001', 'CONFERMA',
  pg_temp.alle(pg_temp.prossimo(2), '09:30'));
reset role;

-- Le altre prenotazioni del seed (o di prove nel browser) non devono disturbare i conteggi
update public.prenotazioni set promemoria_per = appuntamento
where id::text not like 'a4000000-%' and appuntamento is not null;

-- ---------------------------------------------------------------- quando parte
select is(
  public.crea_promemoria_appuntamenti(pg_temp.alle(pg_temp.prossimo(2) - 1, '17:59')),
  0,
  'prima delle 18 del giorno prima non parte nulla'
);
select is(
  public.crea_promemoria_appuntamenti(pg_temp.alle(pg_temp.prossimo(2) - 2, '18:30')),
  0,
  'due giorni prima non parte nulla'
);
select is(
  public.crea_promemoria_appuntamenti(pg_temp.alle(pg_temp.prossimo(2) - 1, '18:05')),
  1,
  'dalle 18 del giorno prima parte il promemoria'
);
select is(pg_temp.promemoria('a0000000-0000-4000-8000-0000000000f2'), 1::bigint,
  'il promemoria arriva al cliente');
select is(
  (select titolo || ' | ' || testo || ' | ' || link from public.notifiche
   where prenotazione_id = 'a4000000-0000-4000-8000-000000000001' and tipo = 'PROMEMORIA'),
  'Domani hai un appuntamento | Gomme Rossi S.n.c. ti aspetta '
    || public.testo_quando(pg_temp.prossimo(2), 'MATTINA', pg_temp.alle(pg_temp.prossimo(2), '09:30'))
    || ' · ' || (select servizio from public.prenotazioni
                 where id = 'a4000000-0000-4000-8000-000000000001')
    || ' | /appuntamento?id=a4000000-0000-4000-8000-000000000001',
  'titolo, testo con officina, ora e servizio, link all''appuntamento'
);
select is(
  pg_temp.promemoria('a0000000-0000-4000-8000-000000000002')
    + pg_temp.promemoria('a0000000-0000-4000-8000-000000000003'),
  0::bigint,
  'chi lavora in officina non riceve il promemoria'
);

-- ---------------------------------------------------------------- una volta sola
select is(
  public.crea_promemoria_appuntamenti(pg_temp.alle(pg_temp.prossimo(2) - 1, '19:05')),
  0,
  'il giro dell''ora dopo non ripete il promemoria'
);
select is(
  public.crea_promemoria_appuntamenti(pg_temp.alle(pg_temp.prossimo(3) - 1, '18:05')),
  0,
  'una richiesta non ancora confermata non ha promemoria'
);

-- ---------------------------------------------------------------- appuntamento spostato
select pg_temp.come('a0000000-0000-4000-8000-000000000002');
select public.rispondi_prenotazione('a4000000-0000-4000-8000-000000000001', 'PROPONI',
  pg_temp.alle(pg_temp.prossimo(3), '15:00'), 'Martedì siamo pieni');
select pg_temp.come('a0000000-0000-4000-8000-0000000000f2');
select public.rispondi_proposta('a4000000-0000-4000-8000-000000000001', true);
reset role;

select is(
  public.crea_promemoria_appuntamenti(pg_temp.alle(pg_temp.prossimo(3) - 1, '18:05')),
  1,
  'spostato a un altro giorno: parte il promemoria per il nuovo orario'
);
select is(pg_temp.promemoria('a0000000-0000-4000-8000-0000000000f2'), 2::bigint,
  'il cliente ha due promemoria, uno per orario');

-- ---------------------------------------------------------------- annullato
select pg_temp.come('a0000000-0000-4000-8000-000000000002');
select public.rispondi_prenotazione('a4000000-0000-4000-8000-000000000002', 'CONFERMA',
  pg_temp.alle(pg_temp.prossimo(3), '10:00'));
select pg_temp.come('a0000000-0000-4000-8000-0000000000f2');
select public.annulla_prenotazione('a4000000-0000-4000-8000-000000000002');
reset role;
select is(
  public.crea_promemoria_appuntamenti(pg_temp.alle(pg_temp.prossimo(3) - 1, '20:05')),
  0,
  'un appuntamento annullato non ha promemoria'
);

-- ---------------------------------------------------------------- permessi e job
select pg_temp.come('a0000000-0000-4000-8000-0000000000f2');
select throws_ok(
  $$select public.crea_promemoria_appuntamenti()$$,
  '42501',
  null,
  'un utente non può lanciare i promemoria'
);
reset role;
select is(
  (select schedule from cron.job where jobname = 'promemoria-appuntamenti'),
  '5 * * * *',
  'il job gira ogni ora'
);

select * from finish();
rollback;

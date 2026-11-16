-- Test delle notifiche nell'app (migrazione "notifiche"). Richiede i dati di seed.sql: Gomme Rossi
-- (ATTIVA, aperta dal lunedì al venerdì) con Mario (TITOLARE) e Luca (OPERATORE).
-- Eseguire con: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(31);

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

create function pg_temp.alle(p_giorno date, p_ora time) returns timestamptz language sql as $$
  select (p_giorno + p_ora) at time zone 'Europe/Rome';
$$;

-- Tipi delle notifiche di un utente per le prenotazioni di prova (senza RLS), in ordine alfabetico:
-- nella stessa transazione `created_at` è uguale per tutte
create function pg_temp.tipi(p_utente uuid) returns text language sql as $$
  select coalesce(string_agg(tipo::text, ',' order by tipo), '')
  from public.notifiche
  where destinatario_id = p_utente and prenotazione_id::text like 'a3000000-%';
$$;

-- Una cliente nuova (il profilo lo crea il trigger)
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-0000000000f1',
   'authenticated', 'authenticated', 'elena.notifiche@tyrecare.test', now(),
   '{"nome": "Elena", "cognome": "Neri"}');

-- ---------------------------------------------------------------- testo del momento
select is(
  public.testo_quando('2026-10-13', 'MATTINA', null),
  'martedì 13 ottobre, mattina',
  'testo: giorno e fascia'
);
select is(
  public.testo_quando('2026-10-13', 'MATTINA', '2026-10-13 09:30 Europe/Rome'),
  'martedì 13 ottobre, ore 9:30',
  'testo: con l''ora italiana, senza lo zero davanti'
);
select is(
  public.testo_quando('2026-03-01', 'POMERIGGIO', '2026-03-29 14:05 Europe/Rome'),
  'domenica 29 marzo, ore 14:05',
  'testo: il giorno viene dall''appuntamento, anche col cambio dell''ora legale'
);

-- ---------------------------------------------------------------- nuova richiesta → officina
select pg_temp.come('a0000000-0000-4000-8000-0000000000f1');
select public.richiedi_prenotazione(
  'b0000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001',
  pg_temp.prossimo(2), 'MATTINA', 'NO123TF', 'Fiat Tipo', '+39 333 1234567', '',
  'a3000000-0000-4000-8000-000000000001'
);
reset role;
select is(pg_temp.tipi('a0000000-0000-4000-8000-000000000002'), 'NUOVA_RICHIESTA',
  'richiesta: avvisato il titolare');
select is(pg_temp.tipi('a0000000-0000-4000-8000-000000000003'), 'NUOVA_RICHIESTA',
  'richiesta: avvisato l''operatore');
select is(pg_temp.tipi('a0000000-0000-4000-8000-0000000000f1'), '',
  'richiesta: chi la manda non riceve nulla');
select is(
  (select testo from public.notifiche
   where destinatario_id = 'a0000000-0000-4000-8000-000000000002'
     and prenotazione_id = 'a3000000-0000-4000-8000-000000000001'),
  'Elena Neri · Cambio gomme stagionale · '
    || public.testo_quando(pg_temp.prossimo(2), 'MATTINA', null),
  'richiesta: testo con cliente, servizio e quando'
);
select is(
  (select link from public.notifiche
   where destinatario_id = 'a0000000-0000-4000-8000-000000000002'
     and prenotazione_id = 'a3000000-0000-4000-8000-000000000001'),
  '/appuntamento?id=a3000000-0000-4000-8000-000000000001',
  'richiesta: il link apre l''appuntamento'
);
select is(
  (select count(*)::int from public.notifiche
   where destinatario_id = 'a0000000-0000-4000-8000-000000000005'
     and prenotazione_id = 'a3000000-0000-4000-8000-000000000001'),
  0,
  'richiesta: il titolare di un''altra officina non riceve nulla'
);

-- ---------------------------------------------------------------- risposte dell'officina → cliente
select pg_temp.come('a0000000-0000-4000-8000-000000000003');
select public.rispondi_prenotazione('a3000000-0000-4000-8000-000000000001', 'PROPONI',
  pg_temp.alle(pg_temp.prossimo(2), '10:00'), 'Alle 9 siamo pieni');
-- La stessa risposta ripetuta (rete instabile) non crea una seconda notifica
select public.rispondi_prenotazione('a3000000-0000-4000-8000-000000000001', 'PROPONI',
  pg_temp.alle(pg_temp.prossimo(2), '10:00'), 'Alle 9 siamo pieni');
reset role;
select is(pg_temp.tipi('a0000000-0000-4000-8000-0000000000f1'), 'PROPOSTA',
  'proposta: avvisata la cliente, una volta sola anche se la risposta si ripete');
select is(pg_temp.tipi('a0000000-0000-4000-8000-000000000002'), 'NUOVA_RICHIESTA',
  'proposta: i colleghi non ricevono nulla');
select is(
  (select testo from public.notifiche
   where destinatario_id = 'a0000000-0000-4000-8000-0000000000f1' and tipo = 'PROPOSTA'),
  'Gomme Rossi S.n.c. propone ' || public.testo_quando(pg_temp.prossimo(2), 'MATTINA',
    pg_temp.alle(pg_temp.prossimo(2), '10:00'))
    || ' per Cambio gomme stagionale. Accetta o annulla dall''app.' || E'\n«Alle 9 siamo pieni»',
  'proposta: testo con l''officina, l''ora proposta e il messaggio'
);

select pg_temp.come('a0000000-0000-4000-8000-000000000003');
select public.rispondi_prenotazione('a3000000-0000-4000-8000-000000000001', 'PROPONI',
  pg_temp.alle(pg_temp.prossimo(2) + 1, '09:30'));
reset role;
select is(pg_temp.tipi('a0000000-0000-4000-8000-0000000000f1'), 'PROPOSTA,PROPOSTA',
  'proposta: un altro orario proposto avvisa di nuovo');

-- ---------------------------------------------------------------- risposte della cliente → officina
select pg_temp.come('a0000000-0000-4000-8000-0000000000f1');
select public.rispondi_proposta('a3000000-0000-4000-8000-000000000001', true);
reset role;
select is(pg_temp.tipi('a0000000-0000-4000-8000-000000000002'), 'NUOVA_RICHIESTA,PROPOSTA_ACCETTATA',
  'accettata: avvisato il titolare');
select is(pg_temp.tipi('a0000000-0000-4000-8000-000000000003'), 'NUOVA_RICHIESTA,PROPOSTA_ACCETTATA',
  'accettata: avvisato anche l''operatore che aveva proposto');
select is(pg_temp.tipi('a0000000-0000-4000-8000-0000000000f1'), 'PROPOSTA,PROPOSTA',
  'accettata: la cliente non riceve nulla');

-- Spostamento (proposta) e poi conferma dell'officina stessa
select pg_temp.come('a0000000-0000-4000-8000-000000000002');
select public.rispondi_prenotazione('a3000000-0000-4000-8000-000000000001', 'PROPONI',
  pg_temp.alle(pg_temp.prossimo(2) + 1, '15:00'));
select public.rispondi_prenotazione('a3000000-0000-4000-8000-000000000001', 'CONFERMA',
  pg_temp.alle(pg_temp.prossimo(2) + 1, '15:00'));
reset role;
select is(pg_temp.tipi('a0000000-0000-4000-8000-0000000000f1'),
  'CONFERMATA,PROPOSTA,PROPOSTA,PROPOSTA',
  'conferma dopo una proposta, fatta dall''officina: avvisata la cliente');
select is(
  (select titolo from public.notifiche
   where destinatario_id = 'a0000000-0000-4000-8000-0000000000f1' and tipo = 'CONFERMATA'),
  'Appuntamento confermato',
  'conferma: titolo'
);

select pg_temp.come('a0000000-0000-4000-8000-000000000002');
select public.rispondi_prenotazione('a3000000-0000-4000-8000-000000000001', 'COMPLETATA');
reset role;
select is(
  (select count(*)::int from public.notifiche
   where prenotazione_id = 'a3000000-0000-4000-8000-000000000001'),
  8,
  'completata: nessuna notifica nuova'
);

-- Rifiuto con il messaggio; annullamento della cliente
select pg_temp.come('a0000000-0000-4000-8000-0000000000f1');
select public.richiedi_prenotazione(
  'b0000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000003',
  pg_temp.prossimo(3), 'POMERIGGIO', 'NO123TF', '', '+39 333 1234567', '',
  'a3000000-0000-4000-8000-000000000002'
);
select public.richiedi_prenotazione(
  'b0000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002',
  pg_temp.prossimo(4), 'MATTINA', 'NO123TF', '', '+39 333 1234567', '',
  'a3000000-0000-4000-8000-000000000003'
);
select public.annulla_prenotazione('a3000000-0000-4000-8000-000000000003');
select pg_temp.come('a0000000-0000-4000-8000-000000000002');
select public.rispondi_prenotazione('a3000000-0000-4000-8000-000000000002', 'RIFIUTA', null,
  'Il ponte è in manutenzione');
reset role;
select is(
  (select testo from public.notifiche
   where destinatario_id = 'a0000000-0000-4000-8000-0000000000f1' and tipo = 'RIFIUTATA'),
  'Gomme Rossi S.n.c. · Convergenza · ' || public.testo_quando(pg_temp.prossimo(3), 'POMERIGGIO', null)
    || E'\n«Il ponte è in manutenzione»',
  'rifiuto: avvisata la cliente con il messaggio dell''officina'
);
select is(
  (select string_agg(destinatario_id::text, ',' order by destinatario_id) from public.notifiche
   where prenotazione_id = 'a3000000-0000-4000-8000-000000000003' and tipo = 'ANNULLATA'),
  'a0000000-0000-4000-8000-000000000002,a0000000-0000-4000-8000-000000000003',
  'annullamento: avvisati titolare e operatore'
);

-- ---------------------------------------------------------------- accesso
select pg_temp.come('a0000000-0000-4000-8000-0000000000f1');
select is(
  (select count(*)::int from public.notifiche
   where destinatario_id <> 'a0000000-0000-4000-8000-0000000000f1'),
  0,
  'cliente: vede solo le sue notifiche'
);
select is((select count(*)::int from public.notifiche), 5,
  'cliente: vede tutte le sue (4 sul primo appuntamento, 1 sul rifiuto)');
select lives_ok(
  $$update public.notifiche set letta_il = now() where tipo = 'RIFIUTATA'$$,
  'cliente: segna una notifica come letta'
);
select is(
  (select count(*)::int from public.notifiche where letta_il is null), 4,
  'cliente: le altre restano da leggere'
);
select throws_ok(
  $$update public.notifiche set titolo = 'Altro'$$,
  '42501', null,
  'cliente: non cambia il testo delle notifiche'
);
select throws_ok(
  $$insert into public.notifiche (destinatario_id, tipo, titolo, link)
    values ('a0000000-0000-4000-8000-000000000002', 'ANNULLATA', 'Falsa', '/appuntamenti')$$,
  '42501', null,
  'cliente: non crea notifiche (nemmeno per altri)'
);
select throws_ok(
  $$delete from public.notifiche$$,
  '42501', null,
  'cliente: non elimina le notifiche'
);

select pg_temp.come('a0000000-0000-4000-8000-000000000003');
update public.notifiche set letta_il = now()
where destinatario_id = 'a0000000-0000-4000-8000-0000000000f1';
reset role;
select is(
  (select count(*)::int from public.notifiche
   where destinatario_id = 'a0000000-0000-4000-8000-0000000000f1' and letta_il is null),
  4,
  'operatore: non segna come lette le notifiche della cliente'
);

select pg_temp.come(null);
select is((select count(*)::int from public.notifiche), 0, 'anonimo: nessuna notifica');

select pg_temp.come('a0000000-0000-4000-8000-000000000002');
select throws_ok(
  $$select public.notifica_prenotazione()$$,
  '42501', null,
  'la funzione del trigger non si chiama dall''app'
);

select * from finish();
rollback;

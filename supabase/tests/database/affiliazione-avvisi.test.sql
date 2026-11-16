-- Test degli avvisi dell'affiliazione e di rifiuta_affiliazione (T191, R24). Richiede seed.sql.
-- Eseguire con: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(32);

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

-- Letture senza RLS (utente dei test, dopo reset role).
create function pg_temp.avvisi(p_destinatario uuid, p_tipo text) returns int language sql as $$
  select count(*)::int from public.notifiche
  where destinatario_id = p_destinatario and tipo::text = p_tipo;
$$;
create function pg_temp.ruolo(p_profile_id uuid) returns text language sql as $$
  select ruolo::text from public.profiles where id = p_profile_id;
$$;

create temp table esito (id uuid);
grant all on esito to authenticated, anon;

\set rossi '''b0000000-0000-4000-8000-000000000001'''
\set express '''b0000000-0000-4000-8000-000000000002'''
\set admin '''a0000000-0000-4000-8000-000000000001'''
\set cliente '''a0000000-0000-4000-8000-000000000004'''
\set titolare2 '''a0000000-0000-4000-8000-000000000005'''
\set nuovo '''a1910000-0000-4000-8000-0000000000f1'''

-- ---------------------------------------------------------------- preparazione (senza utente)
-- Un gommista appena registrato (il trigger gli crea il profilo CLIENTE). Lo porto a OFFICINA, come
-- titolare2 nel seed, per vedere che il rifiuto non toglie il ruolo (R14).
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_user_meta_data)
values (
  '00000000-0000-0000-0000-000000000000', 'a1910000-0000-4000-8000-0000000000f1',
  'authenticated', 'authenticated', 'gommista.t191@tyrecare.test', now(),
  '{"nome": "Marco", "cognome": "Gomma"}'
);
update public.profiles set ruolo = 'OFFICINA' where id = :nuovo;

select is(pg_temp.ruolo(:nuovo), 'OFFICINA', 'preparazione: il nuovo gommista è OFFICINA');
select is(
  (select stato_affiliazione::text from public.officine where id = :express),
  'IN_ATTESA',
  'preparazione: Pneus Express parte IN_ATTESA'
);
select is(pg_temp.avvisi(:admin, 'AFFILIAZIONE_RICHIESTA'), 0, 'preparazione: l''admin non ha avvisi di richiesta');
select is(pg_temp.avvisi(:titolare2, 'AFFILIAZIONE_ATTIVATA'), 0, 'preparazione: titolare2 non ha avvisi di attivazione');

-- ---------------------------------------------------------------- richiesta: avviso all'admin
select pg_temp.come(:nuovo);
select lives_ok(
  $$insert into esito select public.richiedi_affiliazione('  Gomme T191  ', '19119119119', '  Asti ')$$,
  'il nuovo gommista chiede l''affiliazione'
);
reset role;
select is(
  (select count(*)::int from public.notifiche
    where destinatario_id = :admin and tipo = 'AFFILIAZIONE_RICHIESTA'
      and titolo = 'Nuova officina da attivare'
      and testo = 'Gomme T191 (Asti) chiede di usare TyreCare.'
      and link = '/admin/officine'),
  1,
  'l''admin riceve un avviso con ragione sociale e città'
);
select is(pg_temp.avvisi(:cliente, 'AFFILIAZIONE_RICHIESTA'), 0, 'il cliente non riceve l''avviso di richiesta');
select is(pg_temp.avvisi(:nuovo, 'AFFILIAZIONE_RICHIESTA'), 0, 'chi chiede (non admin) non riceve l''avviso');

-- ---------------------------------------------------------------- attivazione: avviso al titolare
select pg_temp.come(:admin);
select lives_ok(format('select public.attiva_officina(%L)', :express), 'l''admin attiva Pneus Express');
reset role;
select is(
  (select count(*)::int from public.notifiche
    where destinatario_id = :titolare2 and tipo = 'AFFILIAZIONE_ATTIVATA'
      and titolo = 'La tua officina è attiva'
      and testo = 'Pneus Express S.r.l. ora è visibile ai clienti: puoi caricare i tuoi dati.'
      and link = '/clienti/importa'),
  1,
  'titolare2 riceve un avviso di attivazione'
);
select is(pg_temp.avvisi(:cliente, 'AFFILIAZIONE_ATTIVATA'), 0, 'il cliente non riceve l''avviso di attivazione');

select pg_temp.come(:admin);
select lives_ok(format('select public.attiva_officina(%L)', :express), 'seconda attivazione senza errori');
reset role;
select is(pg_temp.avvisi(:titolare2, 'AFFILIAZIONE_ATTIVATA'), 1, 'la seconda attivazione non aggiunge avvisi');

-- ---------------------------------------------------------------- rifiuto: accessi negati
select pg_temp.come(:titolare2);
select throws_ok(
  format('select public.rifiuta_affiliazione(%L)', (select id from esito)),
  '42501', null,
  'il titolare di Pneus Express non può rifiutare una richiesta'
);
select pg_temp.come(:cliente);
select throws_ok(
  format('select public.rifiuta_affiliazione(%L)', (select id from esito)),
  '42501', null,
  'il cliente non può rifiutare una richiesta'
);
select pg_temp.come(:nuovo);
select throws_ok(
  format('select public.rifiuta_affiliazione(%L)', (select id from esito)),
  '42501', null,
  'chi ha chiesto non può rifiutare la propria richiesta'
);
select pg_temp.come(null);
select throws_ok(
  format('select public.rifiuta_affiliazione(%L)', (select id from esito)),
  '42501', null,
  'anon non può rifiutare una richiesta'
);

-- ---------------------------------------------------------------- rifiuto: errori con chiave (admin)
select pg_temp.come(:admin);
select throws_ok(
  format('select public.rifiuta_affiliazione(%L)', :rossi),
  'P0001', 'OFFICINA_NON_IN_ATTESA',
  'Gomme Rossi è ATTIVA: non si può rifiutare'
);
select throws_ok(
  format('select public.rifiuta_affiliazione(%L)', gen_random_uuid()),
  'P0001', 'OFFICINA_NON_TROVATA',
  'officina inesistente: OFFICINA_NON_TROVATA'
);
select throws_ok(
  format('select public.rifiuta_affiliazione(%L, %L)', (select id from esito), repeat('x', 301)),
  'P0001', 'MOTIVO_TROPPO_LUNGO',
  'motivo di 301 caratteri: MOTIVO_TROPPO_LUNGO'
);

reset role;
select is(
  (select stato_affiliazione::text from public.officine o join esito e on e.id = o.id),
  'IN_ATTESA',
  'dopo i tentativi negati Gomme T191 c''è ancora, IN_ATTESA'
);
select is(pg_temp.avvisi(:nuovo, 'AFFILIAZIONE_RIFIUTATA'), 0, 'dopo i tentativi negati nessun avviso di rifiuto');

-- ---------------------------------------------------------------- rifiuto riuscito (con motivo)
select pg_temp.come(:admin);
select lives_ok(
  format('select public.rifiuta_affiliazione(%L, %L)', (select id from esito), '  Dati da verificare  '),
  'l''admin rifiuta la richiesta di Gomme T191'
);
reset role;
select is(
  (select count(*)::int from public.officine o join esito e on e.id = o.id),
  0,
  'l''officina rifiutata non esiste più'
);
select is(
  (select count(*)::int from public.officina_utenti m join esito e on e.id = m.officina_id),
  0,
  'i membri dell''officina rifiutata non esistono più'
);
select is(
  (select count(*)::int from public.notifiche
    where destinatario_id = :nuovo and tipo = 'AFFILIAZIONE_RIFIUTATA'
      and titolo = 'Richiesta non accettata'
      and testo = 'La richiesta per Gomme T191 non è stata accettata. Motivo: Dati da verificare'
      and link = '/officina/registra'),
  1,
  'chi ha chiesto riceve l''avviso di rifiuto con il motivo'
);
select is(pg_temp.ruolo(:nuovo), 'OFFICINA', 'dopo il rifiuto il ruolo OFFICINA resta (R14)');

-- ---------------------------------------------------------------- stessa partita IVA, di nuovo
delete from esito;
select pg_temp.come(:nuovo);
select lives_ok(
  $$insert into esito select public.richiedi_affiliazione('Gomme T191', '19119119119', 'Asti')$$,
  'la stessa partita IVA si può richiedere di nuovo'
);
reset role;
select is(
  (select count(*)::int from public.officine o
    join esito e on e.id = o.id
    join public.officina_utenti m on m.officina_id = o.id
    where o.partita_iva = '19119119119' and o.stato_affiliazione = 'IN_ATTESA'
      and m.profile_id = :nuovo and m.ruolo = 'TITOLARE'),
  1,
  'la nuova richiesta è IN_ATTESA con lo stesso titolare'
);
select is(pg_temp.avvisi(:admin, 'AFFILIAZIONE_RICHIESTA'), 2, 'la nuova richiesta avvisa di nuovo l''admin');

-- ---------------------------------------------------------------- rifiuto senza motivo
select pg_temp.come(:admin);
select lives_ok(
  format('select public.rifiuta_affiliazione(%L, %L)', (select id from esito), '   '),
  'l''admin rifiuta la seconda richiesta con il motivo vuoto'
);
reset role;
select is(
  (select count(*)::int from public.notifiche
    where destinatario_id = :nuovo and tipo = 'AFFILIAZIONE_RIFIUTATA'
      and testo = 'La richiesta per Gomme T191 non è stata accettata.'),
  1,
  'senza motivo il testo non ha la parte "Motivo:"'
);

select * from finish();
rollback;

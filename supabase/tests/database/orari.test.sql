-- Test degli orari validati e delle chiusure straordinarie (migrazione "orari_chiusure"). Richiede i
-- dati di seed.sql (Gomme Rossi ATTIVA, aperta dal lunedì al venerdì).
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

-- Primo giorno dopo oggi (in Italia) con quel giorno della settimana (1 = lunedì … 7 = domenica)
create function pg_temp.prossimo(p_isodow int) returns date language sql as $$
  select d::date
  from generate_series(public.oggi_in_italia() + 1, public.oggi_in_italia() + 7, interval '1 day') d
  where extract(isodow from d) = p_isodow;
$$;

-- ---------------------------------------------------------------- formato degli orari
select ok(public.orari_validi('{}'), 'orari: nessun giorno indicato è valido');
select ok(
  public.orari_validi('{"lun": [["08:30", "12:30"], ["14:30", "19:00"]], "sab": [["08:30", "12:30"]], "dom": []}'),
  'orari: due turni, mezza giornata e giorno chiuso'
);
select ok(not public.orari_validi('{"lun": [["8.30", "12:30"]]}'), 'orari: "8.30" non è un''ora');
select ok(not public.orari_validi('{"lun": [["8:30", "12:30"]]}'), 'orari: le ore hanno due cifre');
select ok(not public.orari_validi('{"lun": [["12:30", "08:30"]]}'), 'orari: apre prima di chiudere');
select ok(
  not public.orari_validi('{"lun": [["08:30", "13:00"], ["12:30", "19:00"]]}'),
  'orari: turni sovrapposti'
);
select ok(
  not public.orari_validi('{"lun": [["14:30", "19:00"], ["08:30", "12:30"]]}'),
  'orari: turni in ordine'
);
select ok(not public.orari_validi('{"lunedi": []}'), 'orari: solo le chiavi lun … dom');
select ok(
  not public.orari_validi('{"lun": [["06:00","07:00"],["08:00","09:00"],["10:00","11:00"],["12:00","13:00"]]}'),
  'orari: al massimo 3 turni al giorno'
);
select ok(not public.orari_validi('{"lun": "08:30-12:30"}'), 'orari: un giorno è un elenco di turni');

-- ---------------------------------------------------------------- chi modifica gli orari
select pg_temp.come('a0000000-0000-4000-8000-000000000002');
select throws_ok(
  $$update public.officine set orari = '{"lun": [["8.30", "12"]]}'
    where id = 'b0000000-0000-4000-8000-000000000001'$$,
  '23514', null,
  'titolare: un orario scritto male non si salva'
);
select lives_ok(
  $$update public.officine set orari = orari || '{"sab": [["09:00", "12:00"]]}'
    where id = 'b0000000-0000-4000-8000-000000000001'$$,
  'titolare: cambia gli orari della sua officina'
);
select pg_temp.come('a0000000-0000-4000-8000-000000000003');
update public.officine set orari = '{}' where id = 'b0000000-0000-4000-8000-000000000001';
select pg_temp.come('a0000000-0000-4000-8000-000000000002');
select is(
  (select orari -> 'sab' from public.officine where id = 'b0000000-0000-4000-8000-000000000001'),
  '[["09:00", "12:00"]]'::jsonb,
  'operatore: non cambia gli orari (solo il titolare)'
);

-- ---------------------------------------------------------------- chiusure straordinarie
select lives_ok(
  $$insert into public.chiusure_officina (id, officina_id, dal, al, motivo)
    values ('a3000000-0000-4000-8000-0000000000c1', 'b0000000-0000-4000-8000-000000000001',
      pg_temp.prossimo(2), pg_temp.prossimo(2), 'Ferie')$$,
  'titolare: aggiunge una chiusura'
);
select throws_ok(
  $$insert into public.chiusure_officina (officina_id, dal, al)
    values ('b0000000-0000-4000-8000-000000000001', pg_temp.prossimo(3), pg_temp.prossimo(2))$$,
  '23514', null,
  'chiusura: la fine non può venire prima dell''inizio'
);
select pg_temp.come('a0000000-0000-4000-8000-000000000003');
select throws_ok(
  $$insert into public.chiusure_officina (officina_id, dal, al)
    values ('b0000000-0000-4000-8000-000000000001', pg_temp.prossimo(3), pg_temp.prossimo(3))$$,
  '42501', null,
  'operatore: non aggiunge chiusure'
);
select pg_temp.come(null);
select ok(
  exists (select 1 from public.chiusure_officina where id = 'a3000000-0000-4000-8000-0000000000c1'),
  'anonimo: vede le chiusure delle officine attive (per prenotare)'
);

-- Il cliente non può chiedere un appuntamento in un giorno di chiusura, il giorno dopo sì
select pg_temp.come('a0000000-0000-4000-8000-000000000004');
select throws_ok(
  $$select public.richiedi_prenotazione('b0000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000001', pg_temp.prossimo(2), 'MATTINA', 'AB123CD', '',
    '3471112223')$$,
  'P0001', 'OFFICINA_CHIUSA',
  'richiesta: non in un giorno di chiusura straordinaria'
);
select lives_ok(
  $$select public.richiedi_prenotazione('b0000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000001', pg_temp.prossimo(3), 'MATTINA', 'AB123CD', '',
    '3471112223')$$,
  'richiesta: il giorno dopo la chiusura sì'
);

select * from finish();
rollback;

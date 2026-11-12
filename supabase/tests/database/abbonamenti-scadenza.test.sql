-- Test della prova di 30 giorni e della scadenza automatica (T138, R19). Richiede seed.sql.
-- Eseguire con: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(18);

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

\set admin '''a0000000-0000-4000-8000-000000000001'''
\set titolare '''a0000000-0000-4000-8000-000000000002'''
-- Quattro officine del test: prova finita ieri, prova che finisce oggi, PILOTA finito, ATTIVO finito.
\set ieri '''b1380000-0000-4000-8000-000000000001'''
\set oggi '''b1380000-0000-4000-8000-000000000002'''
\set pilota '''b1380000-0000-4000-8000-000000000003'''
\set attivo '''b1380000-0000-4000-8000-000000000004'''

-- ---------------------------------------------------------------- prova di 30 giorni contando oggi
select pg_temp.come(:admin);
select lives_ok(
  format(
    $$insert into public.officine (id, ragione_sociale, partita_iva, citta)
      values (%L, 'Gomme Scadenza T138', '13813813801', 'Bologna')$$,
    :ieri
  ),
  'l''admin crea un''officina'
);

reset role;
select is(
  (select prova_fino_al from public.abbonamenti where officina_id = :ieri),
  (now() at time zone 'Europe/Rome')::date + 29,
  'l''officina nuova ha la prova di 30 giorni contando oggi (ultimo giorno: oggi + 29)'
);

-- ---------------------------------------------------------------- preparazione
insert into public.officine (id, ragione_sociale, partita_iva, citta) values
  (:oggi, 'Gomme Oggi T138', '13813813802', 'Bologna'),
  (:pilota, 'Gomme Pilota T138', '13813813803', 'Bologna'),
  (:attivo, 'Gomme Attive T138', '13813813804', 'Bologna');

update public.abbonamenti set prova_fino_al = current_date - 1 where officina_id = :ieri;
update public.abbonamenti set prova_fino_al = current_date where officina_id = :oggi;
update public.abbonamenti set piano = 'PILOTA', prova_fino_al = current_date - 10
  where officina_id = :pilota;
update public.abbonamenti set stato = 'ATTIVO', prova_fino_al = current_date - 10
  where officina_id = :attivo;
-- Le altre officine (seed): fine della prova lontana, così il conteggio dipende solo da queste quattro.
update public.abbonamenti set prova_fino_al = current_date + 100
  where officina_id not in (:ieri, :oggi, :pilota, :attivo);

-- Stato di partenza (dritta T100): nessuna riga è già SCADUTO.
select is(
  (select stato || '/' || piano || '/' || (prova_fino_al - current_date)
    from public.abbonamenti where officina_id = :ieri),
  'PROVA/STARTER/-1',
  'preparazione: prova finita ieri, ancora in PROVA'
);
select is(
  (select stato || '/' || piano || '/' || (prova_fino_al - current_date)
    from public.abbonamenti where officina_id = :oggi),
  'PROVA/STARTER/0',
  'preparazione: prova che finisce oggi, in PROVA'
);
select is(
  (select stato || '/' || piano || '/' || (prova_fino_al - current_date)
    from public.abbonamenti where officina_id = :pilota),
  'PROVA/PILOTA/-10',
  'preparazione: piano PILOTA con la prova finita, in PROVA'
);
select is(
  (select stato || '/' || piano || '/' || (prova_fino_al - current_date)
    from public.abbonamenti where officina_id = :attivo),
  'ATTIVO/STARTER/-10',
  'preparazione: abbonamento ATTIVO con la prova finita'
);
select is(
  (select count(*)::int from public.abbonamenti
    where stato = 'PROVA' and piano <> 'PILOTA' and prova_fino_al < current_date),
  1,
  'preparazione: c''è una sola prova da far scadere'
);

-- ---------------------------------------------------------------- negato: la chiama solo il job
select pg_temp.come(:titolare); -- titolare di Gomme Rossi
select throws_ok(
  'select public.scadi_prove_abbonamento()',
  '42501', null,
  'il titolare non può far scadere le prove'
);
select throws_ok(
  format('select public.scadi_prove_abbonamento(%L)', current_date),
  '42501', null,
  'il titolare non può far scadere le prove nemmeno passando la data'
);

select pg_temp.come(:admin);
select throws_ok(
  'select public.scadi_prove_abbonamento()',
  '42501', null,
  'nemmeno l''admin la chiama dall''app'
);

select pg_temp.come(null);
select throws_ok(
  'select public.scadi_prove_abbonamento()',
  '42501', null,
  'anon non può far scadere le prove'
);

reset role;
select is(
  (select stato from public.abbonamenti where officina_id = :ieri),
  'PROVA',
  'dopo i tentativi negati la prova finita è ancora in PROVA'
);

-- ---------------------------------------------------------------- scadenza (come il job)
select is(
  public.scadi_prove_abbonamento(p_oggi => current_date),
  1,
  'il job mette SCADUTO una sola prova'
);
select is(
  (select stato from public.abbonamenti where officina_id = :ieri),
  'SCADUTO',
  'la prova finita ieri è SCADUTO'
);
select is(
  (select stato from public.abbonamenti where officina_id = :oggi),
  'PROVA',
  'la prova che finisce oggi resta in PROVA (oggi è l''ultimo giorno incluso)'
);
select is(
  (select stato from public.abbonamenti where officina_id = :pilota),
  'PROVA',
  'il piano PILOTA non scade'
);
select is(
  (select stato from public.abbonamenti where officina_id = :attivo),
  'ATTIVO',
  'un abbonamento ATTIVO non diventa SCADUTO'
);
select is(
  public.scadi_prove_abbonamento(p_oggi => current_date),
  0,
  'una seconda esecuzione nello stesso giorno non cambia niente'
);

select * from finish();
rollback;

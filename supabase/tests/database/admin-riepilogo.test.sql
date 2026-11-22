-- Test del riepilogo del pannello admin con i numeri degli abbonamenti (migrazione
-- "riepilogo_abbonamenti"). Richiede seed.sql. Eseguire con: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(18);

-- p_aal: 'aal2' = sessione con la verifica in due passaggi, 'aal1' = solo password.
create function pg_temp.come(p_utente uuid, p_aal text default 'aal2') returns void language plpgsql as $$
begin
  reset role;
  set local role authenticated;
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_utente, 'role', 'authenticated', 'aal', p_aal)::text,
    true
  );
end;
$$;

-- Torna a postgres, senza utente: le modifiche ai dati di prova non passano dal registro admin.
create function pg_temp.come_postgres() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Giorno italiano (non `current_date`, UTC: la CI gira spesso tra le 00 e le 02 ora italiana).
create function pg_temp.oggi() returns date language sql as
  $$select (now() at time zone 'Europe/Rome')::date$$;

create function pg_temp.riepilogo(p_chiave text) returns numeric language sql as
  $$select (public.admin_riepilogo() ->> p_chiave)::numeric$$;

-- Utenti del seed: …01 admin, …02 titolare di Gomme Rossi
\set admin '''a0000000-0000-4000-8000-000000000001'''
\set titolare '''a0000000-0000-4000-8000-000000000002'''
\set rossi '''b0000000-0000-4000-8000-000000000001'''
\set express '''b0000000-0000-4000-8000-000000000002'''

-- ---------------------------------------------------------------- stato di partenza del seed
-- Due officine, ciascuna con il suo abbonamento in prova (creato dal trigger), nessuno ATTIVO.
select is(
  (select count(*) from public.abbonamenti where stato = 'ATTIVO')::int, 0,
  'seed: nessun abbonamento ATTIVO'
);
select is(
  (select count(*) from public.abbonamenti where stato = 'PROVA')::int, 2,
  'seed: due abbonamenti in prova (Gomme Rossi e Pneus Express)'
);

-- ---------------------------------------------------------------- prove in scadenza
-- Solo `abbonamenti` (nessun cambio di `officine`): il trigger sincronizza_abbonamento_officina non scatta.
update public.abbonamenti set prova_fino_al = pg_temp.oggi() + 7 where officina_id = :rossi;
update public.abbonamenti set prova_fino_al = pg_temp.oggi() + 8 where officina_id = :express;
select ok(
  (select prova_fino_al = pg_temp.oggi() + 7 and stato = 'PROVA' from public.abbonamenti where officina_id = :rossi)
  and (select prova_fino_al = pg_temp.oggi() + 8 and stato = 'PROVA' from public.abbonamenti where officina_id = :express),
  'prove scritte: Gomme Rossi a oggi + 7, Pneus Express a oggi + 8, entrambe in PROVA'
);

select pg_temp.come(:admin);
select is(pg_temp.riepilogo('prove_in_scadenza'), 1::numeric, 'prove in scadenza: conta oggi + 7, non oggi + 8');
select is(pg_temp.riepilogo('prove_in_corso'), 2::numeric, 'prove in corso: le due in PROVA');
select is(pg_temp.riepilogo('abbonamenti_attivi'), 0::numeric, 'abbonamenti attivi: nessuno');
select is(pg_temp.riepilogo('ricavo_mensile'), 0::numeric, 'ricavo mensile: 0 senza abbonamenti ATTIVO');

-- Pneus Express passa da oggi + 8 a oggi + 7: ora conta anche lei.
select pg_temp.come_postgres();
update public.abbonamenti set prova_fino_al = pg_temp.oggi() + 7 where officina_id = :express;
select is(
  (select prova_fino_al from public.abbonamenti where officina_id = :express), pg_temp.oggi() + 7,
  'prova di Pneus Express spostata a oggi + 7'
);
select pg_temp.come(:admin);
select is(pg_temp.riepilogo('prove_in_scadenza'), 2::numeric, 'prove in scadenza: tutte e due a oggi + 7');

-- ---------------------------------------------------------------- abbonamenti ATTIVO e ricavo
-- Gomme Rossi MENSILE a listino (100 €/mese), Pneus Express ANNUALE a 900 €/anno concordati (75 €/mese).
-- `abbonamenti_attivo_con_scadenza`: un ATTIVO ha sempre `scade_il`.
select pg_temp.come_postgres();
update public.abbonamenti
set stato = 'ATTIVO', piano = 'MENSILE', importo_concordato = null,
    iniziato_il = pg_temp.oggi(), scade_il = pg_temp.oggi() + 30
where officina_id = :rossi;
update public.abbonamenti
set stato = 'ATTIVO', piano = 'ANNUALE', importo_concordato = 900,
    iniziato_il = pg_temp.oggi(), scade_il = pg_temp.oggi() + 364
where officina_id = :express;
select ok(
  (select stato = 'ATTIVO' and piano = 'MENSILE' and importo_concordato is null
   from public.abbonamenti where officina_id = :rossi),
  'Gomme Rossi: ATTIVO MENSILE senza importo concordato'
);
select ok(
  (select stato = 'ATTIVO' and piano = 'ANNUALE' and importo_concordato = 900
   from public.abbonamenti where officina_id = :express),
  'Pneus Express: ATTIVO ANNUALE con 900 € concordati'
);

select pg_temp.come(:admin);
select is(pg_temp.riepilogo('abbonamenti_attivi'), 2::numeric, 'abbonamenti attivi: 2');
select is(pg_temp.riepilogo('ricavo_mensile'), 175::numeric, 'ricavo mensile: 100 + 900 / 12 = 175');
select is(pg_temp.riepilogo('prove_in_corso'), 0::numeric, 'prove in corso: nessuna');
select is(
  pg_temp.riepilogo('prove_in_scadenza'), 0::numeric,
  'prove in scadenza: un ATTIVO con la prova a oggi + 7 non conta'
);
select is(
  (select count(*) from jsonb_object_keys(public.admin_riepilogo()))::int, 21,
  'riepilogo: le 18 chiavi di prima più le 3 nuove'
);

-- ---------------------------------------------------------------- casi negati
select pg_temp.come(:admin, 'aal1');
select throws_ok($$select public.admin_riepilogo()$$, '42501', null, 'admin aal1: niente riepilogo');

select pg_temp.come(:titolare);
select throws_ok($$select public.admin_riepilogo()$$, '42501', null, 'titolare: niente riepilogo');

select * from finish();
rollback;

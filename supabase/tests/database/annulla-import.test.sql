-- Test dell'annullo dell'ultimo import di clienti e veicoli (annulla_import, import_id). Richiede seed.sql.
-- Eseguire con: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(25);

create function pg_temp.come(p_utente uuid) returns void language plpgsql as $$
begin
  reset role;
  set local role authenticated;
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_utente, 'role', 'authenticated', 'aal', 'aal2')::text,
    true
  );
end;
$$;

-- Gomme Rossi: C0002 Franco Gialli (+39 348 4445556) nel seed
\set rossi '''b0000000-0000-4000-8000-000000000001'''

-- Due clienti nuovi con un veicolo ciascuno; Franco (già presente) con il telefono cambiato.
create temp table dati as select '[
  {"cliente": {"codice_gestionale": "C0300", "nome": "Anna", "cognome": "Neri", "telefono": null, "email": null},
   "veicolo": {"targa": "TT100AA", "marca": "Fiat", "modello": "Punto", "anno": null, "telaio": null}},
  {"cliente": {"codice_gestionale": "C0301", "nome": "Bruno", "cognome": "Blu", "telefono": null, "email": null},
   "veicolo": {"targa": "TT101BB", "marca": "Opel", "modello": "Corsa", "anno": null, "telaio": null}},
  {"cliente": {"codice_gestionale": "C0002", "nome": "Franco", "cognome": "Gialli", "telefono": "+39 348 9999999", "email": null},
   "veicolo": null}
]'::jsonb as righe;
grant select on dati to authenticated;

select pg_temp.come('a0000000-0000-4000-8000-000000000002'); -- titolare di Gomme Rossi

-- ---------------------------------------------------------------- simulazione
select is(
  public.importa_clienti_veicoli(:rossi, (select righe from dati), 'simula.csv', 0, true),
  '{"clienti_nuovi": 2, "clienti_aggiornati": 1, "veicoli_nuovi": 2, "veicoli_aggiornati": 0}'::jsonb,
  'simulazione: conteggi invariati'
);
select is_empty(
  $$select 1 from public.clienti_officina where import_id is not null
    union all select 1 from public.veicoli where import_id is not null$$,
  'simulazione: nessuna riga con import_id'
);

-- ---------------------------------------------------------------- import vero
select is(
  public.importa_clienti_veicoli(:rossi, (select righe from dati), 'annulla.csv'),
  '{"clienti_nuovi": 2, "clienti_aggiornati": 1, "veicoli_nuovi": 2, "veicoli_aggiornati": 0}'::jsonb,
  'import: risposta invariata'
);
-- Le FK rimandate (clienti/veicoli -> import_log) si controllano qui: con la riga mancante fallirebbe con 23503
set constraints all immediate;
select is(
  (select count(*)::int from public.import_log where nome_file = 'annulla.csv'),
  1,
  'la riga di import_log puntata da clienti e veicoli esiste'
);
set constraints all deferred;
select results_eq(
  $$select c.codice_gestionale from public.clienti_officina c
    join public.import_log l on l.id = c.import_id
    where l.nome_file = 'annulla.csv' order by 1$$,
  $$values ('C0300'), ('C0301')$$,
  'i clienti creati hanno l''id della riga di import_log'
);
select results_eq(
  $$select v.targa from public.veicoli v
    join public.import_log l on l.id = v.import_id
    where l.nome_file = 'annulla.csv' order by 1$$,
  $$values ('TT100AA'), ('TT101BB')$$,
  'i veicoli creati hanno l''id della riga di import_log'
);
select results_eq(
  $$select telefono, import_id from public.clienti_officina where codice_gestionale = 'C0002'$$,
  $$values ('+39 348 9999999', null::uuid)$$,
  'il cliente aggiornato non ha import_id'
);

create temp table imp as select id from public.import_log where nome_file = 'annulla.csv';
grant select on imp to authenticated;

-- Un controllo sul veicolo di Bruno (come postgres): veicolo e cliente devono restare
reset role;
insert into public.controlli (officina_id, veicolo_id, km)
select officina_id, id, 1000 from public.veicoli where targa = 'TT101BB' and officina_id = :rossi;

-- ---------------------------------------------------------------- permessi
select pg_temp.come('a0000000-0000-4000-8000-000000000003'); -- operatore di Gomme Rossi
select throws_ok(
  format('select public.annulla_import(%L)', (select id from imp)),
  '42501', null,
  'l''operatore non può annullare'
);
select pg_temp.come('a0000000-0000-4000-8000-000000000005'); -- titolare di Pneus Express
select throws_ok(
  format('select public.annulla_import(%L)', (select id from imp)),
  '42501', null,
  'il titolare di un''altra officina non può annullare'
);
select pg_temp.come('a0000000-0000-4000-8000-000000000001'); -- admin
select throws_ok(
  format('select public.annulla_import(%L)', (select id from imp)),
  '42501', null,
  'nemmeno l''admin può annullare'
);
select pg_temp.come('a0000000-0000-4000-8000-000000000002'); -- titolare di Gomme Rossi
select throws_ok(
  'select public.annulla_import(''e0000000-0000-4000-8000-0000000000ff'')',
  '42501', null,
  'import inesistente: stesso errore dei permessi'
);

-- ---------------------------------------------------------------- non ultimo e scaduto
-- Un import CONTROLLI successivo non conta; un CLIENTI_VEICOLI successivo sì
reset role;
insert into public.import_log (officina_id, tipo, righe_importate, eseguito_da, created_at)
values (:rossi, 'CONTROLLI', 1, null, now() + interval '1 minute');
insert into public.import_log (id, officina_id, tipo, righe_importate, eseguito_da, created_at)
values ('e0000000-0000-4000-8000-000000000001', :rossi, 'CLIENTI_VEICOLI', 1, null,
        now() + interval '2 minutes');
select pg_temp.come('a0000000-0000-4000-8000-000000000002');
select throws_ok(
  format('select public.annulla_import(%L)', (select id from imp)),
  'P0001', 'IMPORT_NON_ULTIMO',
  'c''è un import di clienti più recente'
);
reset role;
delete from public.import_log where id = 'e0000000-0000-4000-8000-000000000001';
update public.import_log set created_at = now() - interval '7 days' where id = (select id from imp);
select pg_temp.come('a0000000-0000-4000-8000-000000000002');
select throws_ok(
  format('select public.annulla_import(%L)', (select id from imp)),
  'P0001', 'IMPORT_SCADUTO',
  'import di 7 giorni fa: scaduto'
);
reset role;
update public.import_log set created_at = now() - interval '6 days 23 hours'
where id = (select id from imp);

-- ---------------------------------------------------------------- annullo
select pg_temp.come('a0000000-0000-4000-8000-000000000002');
-- Stato di partenza: le quattro righe dell'import ci sono ancora
select is(
  (select count(*)::int from public.clienti_officina where import_id = (select id from imp))
  + (select count(*)::int from public.veicoli where import_id = (select id from imp)),
  4,
  'prima dell''annullo: 2 clienti e 2 veicoli dell''import'
);
select is(
  public.annulla_import((select id from imp)),
  '{"veicoli_tolti": 1, "clienti_tolti": 1, "veicoli_tenuti": 1, "clienti_tenuti": 1}'::jsonb,
  'annullo: tolti il veicolo e il cliente non usati, tenuti quelli con il controllo'
);
select results_eq(
  $$select codice_gestionale from public.clienti_officina
    where officina_id = 'b0000000-0000-4000-8000-000000000001' and codice_gestionale in ('C0300', 'C0301')$$,
  $$values ('C0301')$$,
  'resta solo il cliente con un veicolo'
);
select results_eq(
  $$select targa from public.veicoli
    where officina_id = 'b0000000-0000-4000-8000-000000000001' and targa in ('TT100AA', 'TT101BB')$$,
  $$values ('TT101BB')$$,
  'resta solo il veicolo con il controllo'
);
select is(
  (select count(*)::int from public.controlli c join public.veicoli v on v.id = c.veicolo_id
   where v.targa = 'TT101BB'),
  1,
  'il controllo non è stato toccato'
);
select results_eq(
  $$select telefono from public.clienti_officina
    where officina_id = 'b0000000-0000-4000-8000-000000000001' and codice_gestionale = 'C0002'$$,
  $$values ('+39 348 9999999')$$,
  'il cliente aggiornato dall''import resta com''è'
);
select isnt(
  (select annullato_il from public.import_log where id = (select id from imp)),
  null,
  'l''import risulta annullato'
);
select throws_ok(
  format('select public.annulla_import(%L)', (select id from imp)),
  'P0001', 'IMPORT_GIA_ANNULLATO',
  'secondo annullo: errore'
);

-- ---------------------------------------------------------------- prenotazione e invito
-- Un secondo import: il veicolo ha una prenotazione (stessa officina e targa), un cliente ha un invito
select is(
  public.importa_clienti_veicoli(:rossi, '[
    {"cliente": {"codice_gestionale": "C0302", "nome": "Carla", "cognome": "Viola"},
     "veicolo": {"targa": "TT102CC", "marca": "Kia", "modello": "Picanto"}},
    {"cliente": {"codice_gestionale": "C0303", "nome": "Dario", "cognome": "Rosa"}, "veicolo": null}
  ]'::jsonb, 'annulla2.csv'),
  '{"clienti_nuovi": 2, "clienti_aggiornati": 0, "veicoli_nuovi": 1, "veicoli_aggiornati": 0}'::jsonb,
  'secondo import'
);
reset role;
insert into public.prenotazioni (
  officina_id, servizio, cliente_id, nome_cliente, telefono_cliente, targa, giorno, fascia, stato
) values (
  :rossi, 'Cambio gomme', 'a0000000-0000-4000-8000-000000000004', 'Carla Viola', '+39 347 1112223',
  'TT102CC', current_date + 10, 'MATTINA', 'RICHIESTA'
);
insert into public.inviti_cliente (officina_id, cliente_officina_id, email, codice_hash, scade_il)
select officina_id, id, 'dario@esempio.it', '\x0102'::bytea, now() + interval '7 days'
from public.clienti_officina where officina_id = :rossi and codice_gestionale = 'C0303';
select pg_temp.come('a0000000-0000-4000-8000-000000000002');
select is(
  public.annulla_import((select id from public.import_log where nome_file = 'annulla2.csv')),
  '{"veicoli_tolti": 0, "clienti_tolti": 0, "veicoli_tenuti": 1, "clienti_tenuti": 2}'::jsonb,
  'prenotazione e invito tengono veicolo e clienti'
);
select is(
  (select count(*)::int from public.clienti_officina
   where officina_id = 'b0000000-0000-4000-8000-000000000001' and codice_gestionale in ('C0302', 'C0303'))
  + (select count(*)::int from public.veicoli
     where officina_id = 'b0000000-0000-4000-8000-000000000001' and targa = 'TT102CC'),
  3,
  'dopo l''annullo restano tutte e tre le righe'
);

-- ---------------------------------------------------------------- permessi della funzione
reset role;
select ok(
  not has_function_privilege('anon', 'public.annulla_import(uuid)', 'execute'),
  'anon non può eseguire annulla_import'
);

select * from finish();
rollback;

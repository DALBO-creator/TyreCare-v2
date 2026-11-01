-- Test delle correzioni lato officina: modifica_controllo ed eliminazioni. Richiede i dati di seed.sql.
-- Eseguire con: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

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

-- Controllo del 14 settembre sulla Panda di Gomme Rossi (quattro misure)
\set controllo '''f0000000-0000-4000-8000-000000000001'''

-- Misura di una posizione del controllo, come testo "mm|bar|usura|danni"
create function pg_temp.misura(p_posizione text) returns text language sql as $$
  select concat_ws('|', m.battistrada_mm, m.pressione_bar, m.usura, m.danni)
  from public.misure_pneumatico m join public.pneumatici p on p.id = m.pneumatico_id
  where m.controllo_id = 'f0000000-0000-4000-8000-000000000001'
    and p.posizione = p_posizione::public.posizione_pneumatico;
$$;

-- ---------------------------------------------------------------- modifica_controllo
select pg_temp.come('a0000000-0000-4000-8000-000000000003'); -- operatore di Gomme Rossi

-- Errori: nulla deve cambiare
select throws_ok(
  format($$select public.modifica_controllo(%L, '[
    {"posizione": "ANT_SX", "battistrada_mm": 9}, {"posizione": "SCORTA", "battistrada_mm": 7}
  ]', '2026-09-14')$$, :controllo),
  '22023', null,
  'posizione non misurata nel controllo: errore'
);
select is(pg_temp.misura('ANT_SX'), '6.2|2.3|REGOLARE|', 'dopo l''errore la misura è quella di prima');
select throws_ok(
  format($$select public.modifica_controllo(%L, '[
    {"posizione": "ANT_SX", "battistrada_mm": 5}, {"posizione": "ANT_SX", "battistrada_mm": 4}
  ]', '2026-09-14')$$, :controllo),
  '22023', null,
  'posizione ripetuta: errore'
);
select throws_ok(
  format($$select public.modifica_controllo(%L, '[]', '2026-09-14')$$, :controllo),
  '22023', null,
  'nessuna misura: errore'
);
select throws_ok(
  format($$select public.modifica_controllo(%L, '[{"posizione": "ANT_SX", "battistrada_mm": 5}]',
    (now() at time zone 'Europe/Rome')::date + 1)$$, :controllo),
  '22023', null,
  'data nel futuro: errore'
);

-- Correzione riuscita: dati del controllo, POST_SX cambiata, POST_DX non più indicata
select lives_ok(
  format($$select public.modifica_controllo(%L, '[
    {"posizione": "ANT_SX", "battistrada_mm": 6.2, "pressione_bar": 2.3, "usura": "REGOLARE"},
    {"posizione": "ANT_DX", "battistrada_mm": 3.4, "pressione_bar": 2.3, "usura": "REGOLARE"},
    {"posizione": "POST_SX", "battistrada_mm": 2.1, "pressione_bar": 2.0, "usura": "ESTERNA",
     "danni": "Bolla"}
  ]', '2026-09-13', 41205, 'Corretto')$$, :controllo),
  'operatore: corregge un controllo'
);
select results_eq(
  format('select eseguito_il, km, note from public.controlli where id = %L', :controllo),
  $$values ('2026-09-13'::date, 41205, 'Corretto')$$,
  'data, km e note corretti'
);
select is(pg_temp.misura('POST_SX'), '2.1|2.0|ESTERNA|Bolla', 'misura corretta');
select is(pg_temp.misura('POST_DX'), null, 'la posizione non più indicata perde la misura');

-- Ripetere la stessa chiamata (errore di rete) non cambia nulla
select lives_ok(
  format($$select public.modifica_controllo(%L, '[
    {"posizione": "ANT_SX", "battistrada_mm": 6.2, "pressione_bar": 2.3, "usura": "REGOLARE"},
    {"posizione": "ANT_DX", "battistrada_mm": 3.4, "pressione_bar": 2.3, "usura": "REGOLARE"},
    {"posizione": "POST_SX", "battistrada_mm": 2.1, "pressione_bar": 2.0, "usura": "ESTERNA",
     "danni": "Bolla"}
  ]', '2026-09-13', 41205, 'Corretto')$$, :controllo),
  'la stessa correzione si può ripetere'
);

-- Altre officine e clienti non possono
select pg_temp.come('a0000000-0000-4000-8000-000000000005'); -- titolare di Pneus Express
select throws_ok(
  format($$select public.modifica_controllo(%L, '[{"posizione": "ANT_SX", "battistrada_mm": 1}]',
    '2026-09-14')$$, :controllo),
  '42501', null,
  'titolare di un''altra officina: non può correggere il controllo'
);
select pg_temp.come('a0000000-0000-4000-8000-000000000004'); -- Giulia, proprietaria della Panda
select throws_ok(
  format($$select public.modifica_controllo(%L, '[{"posizione": "ANT_SX", "battistrada_mm": 9}]',
    '2026-09-14')$$, :controllo),
  '42501', null,
  'cliente: vede il controllo ma non può correggerlo'
);

-- ---------------------------------------------------------------- eliminazioni
select pg_temp.come('a0000000-0000-4000-8000-000000000003'); -- operatore
delete from public.clienti_officina where id = 'c0000000-0000-4000-8000-000000000002';
select isnt_empty(
  $$select 1 from public.clienti_officina where id = 'c0000000-0000-4000-8000-000000000002'$$,
  'operatore: non può eliminare un cliente'
);
delete from public.controlli where id = 'f0000000-0000-4000-8000-000000000001';
select is_empty(
  $$select 1 from public.misure_pneumatico where controllo_id = 'f0000000-0000-4000-8000-000000000001'$$,
  'operatore: elimina un controllo, e con lui le sue misure'
);

select pg_temp.come('a0000000-0000-4000-8000-000000000002'); -- titolare di Gomme Rossi
delete from public.clienti_officina where id = 'c0000000-0000-4000-8000-000000000002';
select is_empty(
  $$select 1 from public.clienti_officina where id = 'c0000000-0000-4000-8000-000000000002'$$,
  'titolare: elimina un cliente'
);
select is(
  (select cliente_officina_id from public.veicoli where id = 'd0000000-0000-4000-8000-000000000002'),
  null,
  'il veicolo del cliente eliminato resta, senza cliente'
);

select * from finish();
rollback;

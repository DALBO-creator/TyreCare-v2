-- Test dell'import di clienti e veicoli (importa_clienti_veicoli, import_log). Richiede seed.sql.
-- Eseguire con: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(17);

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

-- Gomme Rossi: C0001 Giulia Verdi (Panda AB123CD), C0002 Franco Gialli (Golf EF456GH)
\set rossi '''b0000000-0000-4000-8000-000000000001'''
\set express '''b0000000-0000-4000-8000-000000000002'''

-- Un cliente nuovo con due veicoli; Franco con il telefono cambiato e l'email vuota; la Panda di
-- Giulia passa a Franco; un veicolo senza cliente.
create temp table dati as select '[
  {"cliente": {"codice_gestionale": "C0100", "nome": "Mario", "cognome": "Rossi", "ragione_sociale": null, "telefono": "333 1234567", "email": "mario@esempio.it"},
   "veicolo": {"targa": "GH789IJ", "marca": "Fiat", "modello": "500", "anno": 2020, "telaio": null}},
  {"cliente": {"codice_gestionale": "C0100", "nome": "Mario", "cognome": "Rossi", "ragione_sociale": null, "telefono": "333 1234567", "email": "mario@esempio.it"},
   "veicolo": {"targa": "KL012MN", "marca": "Lancia", "modello": "Ypsilon", "anno": null, "telaio": null}},
  {"cliente": {"codice_gestionale": "C0002", "nome": "Franco", "cognome": "Gialli", "ragione_sociale": null, "telefono": "+39 348 0000000", "email": null},
   "veicolo": {"targa": "AB123CD", "marca": "", "modello": "", "anno": null, "telaio": null}},
  {"cliente": null,
   "veicolo": {"targa": "OP345QR", "marca": "Ford", "modello": "", "anno": null, "telaio": null}}
]'::jsonb as righe;
grant select on dati to authenticated;

-- ---------------------------------------------------------------- permessi
select pg_temp.come('a0000000-0000-4000-8000-000000000003'); -- operatore di Gomme Rossi
select throws_ok(
  format('select public.importa_clienti_veicoli(%L, %L)', :rossi, (select righe from dati)),
  '42501', null,
  'l''operatore non può importare'
);
select pg_temp.come('a0000000-0000-4000-8000-000000000002'); -- titolare di Gomme Rossi
select throws_ok(
  format('select public.importa_clienti_veicoli(%L, %L)', :express, (select righe from dati)),
  '42501', null,
  'il titolare non può importare in un''altra officina'
);
select throws_ok(
  format('select public.importa_clienti_veicoli(%L, %L)', :rossi, '[]'),
  '22023', null,
  'senza righe: errore'
);

-- ---------------------------------------------------------------- simulazione
select is(
  public.importa_clienti_veicoli(:rossi, (select righe from dati), 'prova.csv', 0, true),
  '{"clienti_nuovi": 1, "clienti_aggiornati": 1, "veicoli_nuovi": 3, "veicoli_aggiornati": 1}'::jsonb,
  'simulazione: conta nuovi e aggiornati'
);
select is_empty(
  'select 1 from public.clienti_officina where codice_gestionale = ''C0100''',
  'simulazione: nessun cliente scritto'
);
select is_empty(
  'select 1 from public.import_log where nome_file = ''prova.csv''',
  'simulazione: nessuna riga nel registro'
);

-- ---------------------------------------------------------------- import vero
select is(
  public.importa_clienti_veicoli(:rossi, (select righe from dati), 'clienti.csv', 2),
  '{"clienti_nuovi": 1, "clienti_aggiornati": 1, "veicoli_nuovi": 3, "veicoli_aggiornati": 1}'::jsonb,
  'import: stessi conteggi della simulazione'
);
select results_eq(
  $$select c.codice_gestionale, c.origine::text, count(v.*)::int
    from public.clienti_officina c join public.veicoli v on v.cliente_officina_id = c.id
    where c.codice_gestionale = 'C0100' group by c.id$$,
  $$values ('C0100', 'IMPORT', 2)$$,
  'il cliente nuovo ha i suoi due veicoli, con origine IMPORT'
);
select results_eq(
  $$select telefono, email from public.clienti_officina where codice_gestionale = 'C0002'$$,
  $$values ('+39 348 0000000', null::text)$$,
  'Franco: telefono aggiornato'
);
select results_eq(
  $$select v.marca, v.modello, v.origine::text, c.codice_gestionale
    from public.veicoli v join public.clienti_officina c on c.id = v.cliente_officina_id
    where v.targa = 'AB123CD' and v.officina_id = 'b0000000-0000-4000-8000-000000000001'$$,
  $$values ('Fiat', 'Panda', 'APP', 'C0002')$$,
  'la Panda passa a Franco; marca e modello vuoti non cancellano quelli presenti'
);
select is(
  (select cliente_officina_id from public.veicoli where targa = 'OP345QR'),
  null,
  'veicolo senza cliente'
);
select results_eq(
  $$select nome_file, righe_importate, righe_scartate, clienti_nuovi, veicoli_nuovi, eseguito_da
    from public.import_log where nome_file = 'clienti.csv'$$,
  $$values ('clienti.csv', 4, 2, 1, 3, 'a0000000-0000-4000-8000-000000000002'::uuid)$$,
  'il registro ricorda file, righe, conteggi e autore'
);

-- ---------------------------------------------------------------- idempotenza
select is(
  public.importa_clienti_veicoli(:rossi, (select righe from dati), 'clienti.csv'),
  '{"clienti_nuovi": 0, "clienti_aggiornati": 0, "veicoli_nuovi": 0, "veicoli_aggiornati": 0}'::jsonb,
  'reimportare lo stesso file non cambia nulla'
);
select is(
  (select count(*)::int from public.veicoli
   where officina_id = :rossi and targa in ('GH789IJ', 'KL012MN', 'AB123CD', 'OP345QR')),
  4,
  'nessun veicolo doppio'
);

-- Tutto o niente: una riga non valida per il database annulla l'intero import
select throws_ok(
  format('select public.importa_clienti_veicoli(%L, %L)', :rossi, '[
    {"cliente": {"codice_gestionale": "C0200", "nome": "Anna", "cognome": "Neri"}, "veicolo": null},
    {"cliente": null, "veicolo": {"targa": "X", "marca": ""}}
  ]'),
  '23514', null,
  'targa non valida: errore'
);
select is_empty(
  'select 1 from public.clienti_officina where codice_gestionale = ''C0200''',
  'dopo l''errore non resta nulla dell''import'
);

-- Il registro lo leggono i membri dell'officina, non le altre officine
select pg_temp.come('a0000000-0000-4000-8000-000000000005'); -- titolare di Pneus Express
select is_empty('select 1 from public.import_log', 'un''altra officina non vede il registro');

select * from finish();
rollback;

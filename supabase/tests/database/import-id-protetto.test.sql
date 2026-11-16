-- Test di proteggi_import_id (T286): import_id di clienti e veicoli lo scrive solo l'import.
-- Richiede seed.sql. Eseguire con: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(31);

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

-- Nessun utente (migrazioni, seed, funzioni lato server): postgres senza claim.
create function pg_temp.senza_utente() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Gomme Rossi: C0002 Franco Gialli (c…0002) e la sua Golf EF456GH (d…0002), creati dall'app nel seed
\set rossi '''b0000000-0000-4000-8000-000000000001'''
\set franco '''c0000000-0000-4000-8000-000000000002'''
\set golf '''d0000000-0000-4000-8000-000000000002'''
\set finto '''e0000000-0000-4000-8000-0000000000ff'''

create temp table dati as select '[
  {"cliente": {"codice_gestionale": "C0410", "nome": "Luca", "cognome": "Viola", "telefono": null, "email": null},
   "veicolo": {"targa": "TT410AA", "marca": "Fiat", "modello": "Panda", "anno": null, "telaio": null}}
]'::jsonb as righe;
grant select on dati to authenticated;

-- ---------------------------------------------------------------- prima di ogni import
select pg_temp.come('a0000000-0000-4000-8000-000000000003'); -- operatore di Gomme Rossi
select throws_ok(
  format(
    'insert into public.clienti_officina (officina_id, codice_gestionale, nome, import_id) values (%L, %L, %L, %L)',
    :rossi, 'C0400', 'Prova', :finto
  ),
  '42501', 'Solo l''import può segnare una riga come importata',
  'operatore: insert di un cliente con import_id vietato'
);
-- Controllo: lo stesso insert senza import_id passa (l'errore sopra non viene dall'RLS)
select lives_ok(
  format(
    'insert into public.clienti_officina (officina_id, codice_gestionale, nome) values (%L, %L, %L)',
    :rossi, 'C0400', 'Prova'
  ),
  'operatore: insert di un cliente senza import_id ammesso'
);
select is(
  (select count(*)::int from public.clienti_officina
   where officina_id = :rossi and codice_gestionale = 'C0400' and import_id is null),
  1,
  'il cliente inserito dall''operatore c''è e non ha import_id'
);

-- ---------------------------------------------------------------- import vero del titolare
select pg_temp.come('a0000000-0000-4000-8000-000000000002'); -- titolare di Gomme Rossi
select is(
  public.importa_clienti_veicoli(:rossi, (select righe from dati), 'protetto.csv'),
  '{"clienti_nuovi": 1, "clienti_aggiornati": 0, "veicoli_nuovi": 1, "veicoli_aggiornati": 0}'::jsonb,
  'import: risposta invariata'
);

create temp table imp as select id from public.import_log where nome_file = 'protetto.csv';
grant select on imp to authenticated;

select results_eq(
  $$select c.codice_gestionale from public.clienti_officina c
    where c.import_id = (select id from imp) order by 1$$,
  $$values ('C0410')$$,
  'il cliente creato dall''import ha l''id della riga di import_log'
);
select results_eq(
  $$select v.targa from public.veicoli v
    where v.import_id = (select id from imp) order by 1$$,
  $$values ('TT410AA')$$,
  'il veicolo creato dall''import ha l''id della riga di import_log'
);
select is(
  current_setting('tyrecare.import_id', true),
  '',
  'dopo l''import il permesso è richiuso'
);

-- ---------------------------------------------------------------- scritture dirette dopo l'import (T078)
select throws_ok(
  format(
    'insert into public.clienti_officina (officina_id, codice_gestionale, nome, import_id) values (%L, %L, %L, %L)',
    :rossi, 'C0420', 'Prova', (select id from imp)
  ),
  '42501', 'Solo l''import può segnare una riga come importata',
  'titolare: insert di un cliente con l''import_id appena creato vietato'
);
select throws_ok(
  format(
    'insert into public.veicoli (officina_id, targa, import_id) values (%L, %L, %L)',
    :rossi, 'TT420AA', (select id from imp)
  ),
  '42501', 'Solo l''import può segnare una riga come importata',
  'titolare: insert di un veicolo con import_id vietato'
);
select throws_ok(
  format('update public.clienti_officina set import_id = %L where id = %L', (select id from imp), :franco),
  '42501', 'Solo l''import può segnare una riga come importata',
  'titolare: segnare come importato un cliente creato dall''app vietato'
);

select pg_temp.come('a0000000-0000-4000-8000-000000000003'); -- operatore di Gomme Rossi
select throws_ok(
  format('update public.veicoli set import_id = %L where id = %L', (select id from imp), :golf),
  '42501', 'Solo l''import può segnare una riga come importata',
  'operatore: segnare come importato un veicolo creato dall''app vietato'
);
select throws_ok(
  format(
    'insert into public.veicoli (officina_id, targa, import_id) values (%L, %L, %L)',
    :rossi, 'TT421AA', (select id from imp)
  ),
  '42501', 'Solo l''import può segnare una riga come importata',
  'operatore: insert di un veicolo con import_id vietato'
);
select throws_ok(
  format(
    'update public.clienti_officina set import_id = %L where officina_id = %L and codice_gestionale = %L',
    :finto, :rossi, 'C0410'
  ),
  '42501', 'Solo l''import può segnare una riga come importata',
  'operatore: spostare un cliente su un altro import vietato'
);
select is(
  (select count(*)::int from public.clienti_officina where id = :franco and import_id is null)
  + (select count(*)::int from public.veicoli where id = :golf and import_id is null),
  2,
  'Franco e la Golf restano senza import_id'
);

-- ---------------------------------------------------------------- update che non toccano import_id
select lives_ok(
  format(
    'update public.clienti_officina set telefono = %L where officina_id = %L and codice_gestionale = %L',
    '+39 333 0000001', :rossi, 'C0410'
  ),
  'operatore: modificare un cliente importato senza toccare import_id ammesso'
);
select is(
  (select telefono from public.clienti_officina where officina_id = :rossi and codice_gestionale = 'C0410'),
  '+39 333 0000001',
  'il telefono è stato scritto'
);
select is(
  (select import_id from public.clienti_officina where officina_id = :rossi and codice_gestionale = 'C0410'),
  (select id from imp),
  'il cliente modificato resta dell''import'
);

select pg_temp.come('a0000000-0000-4000-8000-000000000002'); -- titolare di Gomme Rossi
select lives_ok(
  format('update public.veicoli set modello = %L where officina_id = %L and targa = %L', 'Panda Cross', :rossi, 'TT410AA'),
  'titolare: modificare un veicolo importato senza toccare import_id ammesso'
);
select is(
  (select modello || ' ' || import_id::text from public.veicoli where officina_id = :rossi and targa = 'TT410AA'),
  'Panda Cross ' || (select id from imp)::text,
  'il modello è stato scritto e il veicolo resta dell''import'
);

-- ---------------------------------------------------------------- tornare a null
select pg_temp.come('a0000000-0000-4000-8000-000000000003'); -- operatore di Gomme Rossi
select lives_ok(
  format('update public.veicoli set import_id = null where officina_id = %L and targa = %L', :rossi, 'TT410AA'),
  'operatore: togliere import_id ammesso'
);
select is(
  (select count(*)::int from public.veicoli where officina_id = :rossi and targa = 'TT410AA' and import_id is null),
  1,
  'il veicolo non è più dell''import'
);

-- ---------------------------------------------------------------- ADMIN
-- Come postgres con il claim dell'admin: l'ADMIN non è membro di Gomme Rossi e l'RLS gli nasconderebbe
-- le righe; qui si prova solo il trigger, che guarda auth.uid() e non il ruolo del database.
select pg_temp.come('a0000000-0000-4000-8000-000000000001');
reset role;
select is((select auth.uid()), 'a0000000-0000-4000-8000-000000000001'::uuid, 'il claim è dell''admin');
select lives_ok(
  format('update public.veicoli set import_id = %L where id = %L', (select id from imp), :golf),
  'admin: scrivere import_id ammesso'
);
select is(
  (select import_id from public.veicoli where id = :golf),
  (select id from imp),
  'la Golf ha l''import_id scritto dall''admin'
);

-- ---------------------------------------------------------------- nessun utente
select pg_temp.senza_utente();
select is((select auth.uid()), null::uuid, 'nessun utente');
select lives_ok(
  format('update public.clienti_officina set import_id = %L where id = %L', (select id from imp), :franco),
  'senza utente: scrivere import_id ammesso'
);
select is(
  (select import_id from public.clienti_officina where id = :franco),
  (select id from imp),
  'Franco ha l''import_id scritto senza utente'
);

-- ---------------------------------------------------------------- cancellazione della riga di import_log
-- Come postgres ma con il claim del titolare ancora impostato: l'update di `on delete set null` passa
-- dal trigger con auth.uid() non nullo, e va ammesso.
select pg_temp.come('a0000000-0000-4000-8000-000000000002');
reset role;
select lives_ok(
  'delete from public.import_log where id = (select id from imp)',
  'cancellare la riga di import_log non dà errori'
);
select is(
  (select count(*)::int from public.clienti_officina where import_id = (select id from imp))
  + (select count(*)::int from public.veicoli where import_id = (select id from imp)),
  0,
  'nessuna riga punta più all''import cancellato'
);
select is(
  (select count(*)::int from public.clienti_officina
   where officina_id = :rossi and codice_gestionale = 'C0410' and import_id is null),
  1,
  'il cliente dell''import resta, con import_id null'
);
select is(
  (select count(*)::int from public.clienti_officina where id = :franco and import_id is null)
  + (select count(*)::int from public.veicoli where id = :golf and import_id is null),
  2,
  'anche Franco e la Golf tornano a import_id null'
);

select * from finish();
rollback;

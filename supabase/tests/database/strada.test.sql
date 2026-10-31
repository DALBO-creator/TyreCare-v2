-- Test dell'intervento su strada, parte 1 (T139, R18): colonne di `officine`, distanza_km,
-- richieste_strada con la sua RLS, crea/annulla_richiesta_strada, manutenzione e job. Richiede seed.sql.
-- Eseguire con: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(57);

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

-- Gomme Rossi (ATTIVA, Torino 45.070312 / 7.686856): titolare …0002, operatore …0003.
-- Pneus Express (IN_ATTESA, 45.076 / 7.64, a 3,7 km da Gomme Rossi): titolare2 …0005.
-- Cliente Giulia …0004. Il punto della richiesta (45.1 / 7.7) è a 3,5 km da Gomme Rossi e a 5,4 km da
-- Pneus Express; il punto "a 25 km" (45.295 / 7.686856) è a 25,0 km da Gomme Rossi.
\set rossi '''b0000000-0000-4000-8000-000000000001'''
\set express '''b0000000-0000-4000-8000-000000000002'''
\set admin '''a0000000-0000-4000-8000-000000000001'''
\set titolare '''a0000000-0000-4000-8000-000000000002'''
\set operatore '''a0000000-0000-4000-8000-000000000003'''
\set cliente '''a0000000-0000-4000-8000-000000000004'''
\set titolare2 '''a0000000-0000-4000-8000-000000000005'''

-- ---------------------------------------------------------------- stato di partenza (come postgres)
select is(
  (select intervento_strada from public.officine where id = :rossi), false,
  'partenza: Gomme Rossi non offre l''aiuto su strada'
);
select is(
  (select raggio_strada_km from public.officine where id = :rossi), 30,
  'partenza: raggio di default 30 km'
);
select ok(
  (select latitudine is not null and longitudine is not null from public.officine where id = :rossi),
  'partenza: Gomme Rossi ha la posizione'
);
select is(
  (select stato_affiliazione::text || ' ' || (latitudine is not null)::text
   from public.officine where id = :express),
  'IN_ATTESA true',
  'partenza: Pneus Express è IN_ATTESA e ha la posizione'
);

-- ---------------------------------------------------------------- distanza_km
select is(public.distanza_km(45.070312, 7.686856, 45.070312, 7.686856), 0::numeric,
  'distanza_km: stesso punto, 0 km');
select is(round(public.distanza_km(45.070312, 7.686856, 45.076, 7.64), 2), 3.73,
  'distanza_km: Gomme Rossi → Pneus Express 3,73 km (come distanzaKm)');
select is(round(public.distanza_km(0, 0, 0, 180)), 20015::numeric,
  'distanza_km: agli antipodi mezzo giro della Terra, senza errori');

-- ---------------------------------------------------------------- nessuna officina che offre il servizio
-- Pneus Express offre il servizio ma è IN_ATTESA; Gomme Rossi è ATTIVA ma non lo offre
update public.officine set intervento_strada = true where id = :express;

select pg_temp.come(:cliente);
select throws_ok(
  $$select public.crea_richiesta_strada(45.1, 7.7, 'Gomma a terra', '+39 333 1112223')$$,
  'P0001', 'NESSUNA_OFFICINA',
  'nessuna officina ATTIVA con il servizio: NESSUNA_OFFICINA (anche se una IN_ATTESA lo offre)'
);
select is((select count(*) from public.richieste_strada), 0::bigint,
  'NESSUNA_OFFICINA: nessuna richiesta salvata');

-- ---------------------------------------------------------------- le colonne nuove di officine
select pg_temp.come(:admin);
select lives_ok(
  format('update public.officine set intervento_strada = true where id = %L', :rossi),
  'admin: attiva l''aiuto su strada di Gomme Rossi'
);
select is((select intervento_strada from public.officine where id = :rossi), true,
  'admin: intervento_strada scritto');

select pg_temp.come(:titolare);
select lives_ok(
  format('update public.officine set raggio_strada_km = 20 where id = %L', :rossi),
  'titolare: cambia il raggio'
);
select is((select raggio_strada_km from public.officine where id = :rossi), 20,
  'titolare: raggio scritto');
select throws_ok(
  format('update public.officine set raggio_strada_km = 101 where id = %L', :rossi),
  '23514', null,
  'titolare: raggio oltre 100 km rifiutato'
);
select throws_ok(
  format('update public.officine set raggio_strada_km = 4 where id = %L', :rossi),
  '23514', null,
  'titolare: raggio sotto 5 km rifiutato'
);

select pg_temp.come(:titolare2);
update public.officine set intervento_strada = false where id = :rossi;
select is(
  (select intervento_strada from public.officine where id = :rossi), true,
  'il titolare di un''altra officina non cambia l''aiuto su strada di Gomme Rossi'
);

-- ---------------------------------------------------------------- crea_richiesta_strada: errori
select pg_temp.come(:cliente);
select throws_ok(
  $$select public.crea_richiesta_strada(45.295, 7.686856, 'Gomma a terra', '+39 333 1112223')$$,
  'P0001', 'NESSUNA_OFFICINA',
  'a 25 km con il raggio di 20 km: NESSUNA_OFFICINA'
);
select throws_ok(
  $$select public.crea_richiesta_strada(0, 0, 'Gomma a terra', '+39 333 1112223')$$,
  'P0001', 'NESSUNA_OFFICINA',
  'lontano da tutte le officine: NESSUNA_OFFICINA'
);
select throws_ok(
  $$select public.crea_richiesta_strada(95, 7.7, 'Gomma a terra', '+39 333 1112223')$$,
  'P0001', 'POSIZIONE_NON_VALIDA',
  'latitudine fuori scala: POSIZIONE_NON_VALIDA'
);
select throws_ok(
  $$select public.crea_richiesta_strada(45.1, 7.7, '   ', '+39 333 1112223')$$,
  'P0001', 'DESCRIZIONE_NON_VALIDA',
  'descrizione vuota: DESCRIZIONE_NON_VALIDA'
);
select throws_ok(
  format('select public.crea_richiesta_strada(45.1, 7.7, %L, %L)', repeat('a', 501), '+39 333 1112223'),
  'P0001', 'DESCRIZIONE_NON_VALIDA',
  'descrizione oltre 500 caratteri: DESCRIZIONE_NON_VALIDA'
);
select throws_ok(
  $$select public.crea_richiesta_strada(45.1, 7.7, 'Gomma a terra', 'chiamami')$$,
  'P0001', 'TELEFONO_NON_VALIDO',
  'telefono non valido: TELEFONO_NON_VALIDO'
);
select throws_ok(
  $$select public.crea_richiesta_strada(45.1, 7.7, 'Gomma a terra', '+39 333 1112223', 'AB123CD4567')$$,
  'P0001', 'TARGA_NON_VALIDA',
  'targa oltre 10 caratteri: TARGA_NON_VALIDA'
);
select is((select count(*) from public.richieste_strada), 0::bigint,
  'dopo gli errori: nessuna richiesta salvata');

-- ---------------------------------------------------------------- crea_richiesta_strada: riuscita
select lives_ok(
  $$select public.crea_richiesta_strada(45.1, 7.7, ' Gomma a terra in tangenziale ', ' +39 333 1112223 ',
    'ab-123cd')$$,
  'cliente: richiesta vicino a Gomme Rossi'
);
select is(
  (select stato || '|' || descrizione || '|' || telefono || '|' || targa || '|' || latitudine || '|'
     || longitudine
   from public.richieste_strada where cliente_id = :cliente),
  'APERTA|Gomma a terra in tangenziale|+39 333 1112223|AB123CD|45.100000|7.700000',
  'la richiesta è APERTA con i dati puliti'
);
select ok(
  (select officina_id is null and accettata_il is null and scade_il = now() + interval '2 hours'
   from public.richieste_strada where cliente_id = :cliente),
  'nessuna officina finché non accetta; scade tra 2 ore'
);
select throws_ok(
  $$select public.crea_richiesta_strada(45.1, 7.7, 'Ancora', '+39 333 1112223')$$,
  'P0001', 'RICHIESTA_GIA_APERTA',
  'seconda richiesta con una già aperta: RICHIESTA_GIA_APERTA'
);

reset role;
create temp table r1 as select id from public.richieste_strada where cliente_id = :cliente;
grant select on r1 to authenticated, anon;

-- ---------------------------------------------------------------- notifiche (come postgres)
select is(
  (select count(*) from public.notifiche where destinatario_id = :titolare and tipo = 'STRADA_RICHIESTA'),
  1::bigint, 'notifica al titolare di Gomme Rossi'
);
select is(
  (select count(*) from public.notifiche where destinatario_id = :operatore and tipo = 'STRADA_RICHIESTA'),
  1::bigint, 'notifica all''operatore di Gomme Rossi'
);
select is(
  (select count(*) from public.notifiche where destinatario_id = :titolare2 and tipo = 'STRADA_RICHIESTA'),
  0::bigint, 'nessuna notifica a Pneus Express (IN_ATTESA, anche se vicina e con il servizio)'
);
select is(
  (select titolo || '|' || testo || '|' || link from public.notifiche
   where destinatario_id = :titolare and tipo = 'STRADA_RICHIESTA'),
  'Richiesta di aiuto su strada|Un automobilista fermo a 3 km da Gomme Rossi S.n.c. chiede aiuto per una '
    || 'gomma. Apri la pagina per i dettagli.|/officina/strada',
  'titolo, testo con la distanza arrotondata al km e link'
);

-- ---------------------------------------------------------------- letture negate e permesse
select pg_temp.come(:titolare2);
select is((select count(*) from public.richieste_strada), 0::bigint,
  'un altro utente (di un''officina vicina) non legge la richiesta');
select pg_temp.come(:operatore);
select is((select count(*) from public.richieste_strada), 0::bigint,
  'l''operatore di Gomme Rossi non la legge prima dell''accettazione');
select pg_temp.come(:titolare);
select is((select count(*) from public.richieste_strada), 0::bigint,
  'il titolare di Gomme Rossi non la legge prima dell''accettazione');
select pg_temp.come(:admin);
select is((select count(*) from public.richieste_strada), 1::bigint, 'l''admin la legge');

reset role;
set local role anon;
select set_config('request.jwt.claims', '', true);
select throws_ok(
  $$select count(*) from public.richieste_strada$$,
  '42501', null,
  'anon non legge la tabella'
);
select throws_ok(
  $$select public.crea_richiesta_strada(45.1, 7.7, 'Gomma a terra', '+39 333 1112223')$$,
  '42501', null,
  'anon non può chiedere aiuto'
);

-- ---------------------------------------------------------------- scritture dirette negate
select pg_temp.come(:cliente);
select throws_ok(
  format(
    'insert into public.richieste_strada (cliente_id, latitudine, longitudine, descrizione, telefono) '
      || 'values (%L, 45.1, 7.7, %L, %L)',
    :cliente, 'Diretta', '+39 333 1112223'
  ),
  '42501', null,
  'cliente: insert diretto negato'
);
select throws_ok(
  format('update public.richieste_strada set stato = %L where id = %L', 'CHIUSA', (select id from r1)),
  '42501', null,
  'cliente: update diretto negato'
);
select throws_ok(
  format('delete from public.richieste_strada where id = %L', (select id from r1)),
  '42501', null,
  'cliente: delete diretto negato'
);
select throws_ok(
  $$select public.manutenzione_richieste_strada()$$,
  '42501', null,
  'cliente: la manutenzione non si chiama dall''app'
);

-- ---------------------------------------------------------------- annulla_richiesta_strada
select pg_temp.come(:titolare2);
select throws_ok(
  format('select public.annulla_richiesta_strada(%L)', (select id from r1)),
  'P0001', 'RICHIESTA_NON_DISPONIBILE',
  'un altro utente non annulla la richiesta del cliente'
);

-- Accettazione simulata (la funzione arriva con T140)
reset role;
update public.richieste_strada
set stato = 'ACCETTATA', officina_id = :rossi, accettata_il = now()
where id = (select id from r1);

select pg_temp.come(:operatore);
select is(
  (select telefono from public.richieste_strada where id = (select id from r1)), '+39 333 1112223',
  'dopo l''accettazione l''operatore dell''officina legge la richiesta con il telefono'
);
select pg_temp.come(:titolare2);
select is((select count(*) from public.richieste_strada), 0::bigint,
  'dopo l''accettazione le altre officine continuano a non leggerla');

select pg_temp.come(:cliente);
select lives_ok(
  format('select public.annulla_richiesta_strada(%L)', (select id from r1)),
  'cliente: annulla la richiesta accettata'
);
select is((select stato from public.richieste_strada where id = (select id from r1)), 'ANNULLATA',
  'la richiesta è ANNULLATA');
select throws_ok(
  format('select public.annulla_richiesta_strada(%L)', (select id from r1)),
  'P0001', 'RICHIESTA_NON_DISPONIBILE',
  'una richiesta già annullata non si annulla di nuovo'
);

reset role;
select is(
  (select array_agg(destinatario_id::text order by destinatario_id) from public.notifiche
   where tipo = 'STRADA_ANNULLATA'),
  array[:titolare, :operatore]::text[],
  'notifica STRADA_ANNULLATA a titolare e operatore di Gomme Rossi, a nessun altro'
);

-- ---------------------------------------------------------------- richiesta propria scaduta, non ancora sistemata dal job
-- L'admin ha una richiesta APERTA già scaduta: ne può fare subito una nuova
insert into public.richieste_strada (id, cliente_id, latitudine, longitudine, descrizione, telefono, scade_il)
values ('c7000000-0000-4000-8000-000000000001', :admin, 45.1, 7.7, 'Vecchia', '+39 333 1112223',
  now() - interval '1 minute');
select pg_temp.come(:admin);
select lives_ok(
  $$select public.crea_richiesta_strada(45.1, 7.7, 'Nuova', '+39 333 1112223')$$,
  'una richiesta propria già scaduta non blocca la nuova'
);
select is(
  (select stato from public.richieste_strada where id = 'c7000000-0000-4000-8000-000000000001'),
  'SCADUTA', 'la vecchia è stata segnata SCADUTA'
);

-- ---------------------------------------------------------------- manutenzione (come postgres)
reset role;
-- s1 APERTA che scade tra 2 ore; s2 ACCETTATA 22 ore fa; s3 APERTA che scade tra 5 ore;
-- s4 ACCETTATA 20 ore fa. Prima chiamata 3 ore avanti: s1 scade, s2 si chiude (oltre 24 ore), s3 e s4
-- restano; la r1 ANNULLATA resta (non ha 90 giorni).
insert into public.richieste_strada (
  id, cliente_id, latitudine, longitudine, descrizione, telefono, stato, officina_id, accettata_il, scade_il
)
values
  ('c7000000-0000-4000-8000-0000000000a1', :cliente, 45.1, 7.7, 's1', '+39 333 1112223', 'APERTA',
    null, null, now() + interval '2 hours'),
  ('c7000000-0000-4000-8000-0000000000a2', :titolare2, 45.1, 7.7, 's2', '+39 333 1112223', 'ACCETTATA',
    :rossi, now() - interval '22 hours', now() - interval '20 hours'),
  ('c7000000-0000-4000-8000-0000000000a3', :operatore, 45.1, 7.7, 's3', '+39 333 1112223', 'APERTA',
    null, null, now() + interval '5 hours'),
  ('c7000000-0000-4000-8000-0000000000a4', :titolare, 45.1, 7.7, 's4', '+39 333 1112223', 'ACCETTATA',
    :rossi, now() - interval '20 hours', now() - interval '18 hours');

select public.manutenzione_richieste_strada(now() + interval '3 hours');
select is(
  (select string_agg(descrizione || '=' || stato, ' ' order by descrizione) from public.richieste_strada
   where id::text like 'c7000000-0000-4000-8000-0000000000a%'),
  's1=SCADUTA s2=CHIUSA s3=APERTA s4=ACCETTATA',
  'dopo 3 ore: scade la APERTA oltre le 2 ore, si chiude la ACCETTATA oltre le 24 ore, le altre restano'
);
select is((select stato from public.richieste_strada where id = (select id from r1)), 'ANNULLATA',
  'dopo 3 ore la richiesta annullata non è cancellata');

-- Seconda chiamata 91 giorni avanti: si cancellano le finite (r1, s1, s2, la vecchia dell'admin);
-- s3 e s4 diventano SCADUTA e CHIUSA in questa chiamata e restano.
select public.manutenzione_richieste_strada(now() + interval '91 days');
select is(
  (select count(*) from public.richieste_strada
   where id in ((select id from r1), 'c7000000-0000-4000-8000-000000000001',
     'c7000000-0000-4000-8000-0000000000a1', 'c7000000-0000-4000-8000-0000000000a2')),
  0::bigint,
  'dopo 91 giorni: cancellate le richieste annullate, scadute e chiuse'
);
select is(
  (select string_agg(descrizione || '=' || stato, ' ' order by descrizione) from public.richieste_strada
   where id::text like 'c7000000-0000-4000-8000-0000000000a%'),
  's3=SCADUTA s4=CHIUSA',
  'le richieste appena scadute o chiuse non si cancellano nella stessa chiamata'
);

-- ---------------------------------------------------------------- job
select is(
  (select schedule from cron.job where jobname = 'richieste-strada'),
  '*/10 * * * *',
  'job richieste-strada ogni 10 minuti'
);
select is(
  (select command from cron.job where jobname = 'richieste-strada'),
  'select public.manutenzione_richieste_strada()',
  'il job chiama manutenzione_richieste_strada'
);

select * from finish();
rollback;

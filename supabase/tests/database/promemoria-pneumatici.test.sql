-- Test dei promemoria degli pneumatici (migrazione "promemoria_pneumatici"). Richiede i dati di
-- seed.sql: la Panda AB123CD di Giulia in Gomme Rossi (4 gomme invernali montate) e Luca (OPERATORE).
-- Eseguire con: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(21);

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

-- Notifiche di quel tipo ricevute da un utente
create function pg_temp.quante(p_utente uuid, p_tipo text) returns bigint language sql as $$
  select count(*) from public.notifiche where destinatario_id = p_utente and tipo::text = p_tipo;
$$;

-- Controllo della Panda registrato da Luca (con le misure di ANT_SX, ANT_DX, POST_SX, POST_DX); il
-- trigger dell'esito scatta subito invece che alla fine della transazione
create function pg_temp.controllo(p_id uuid, p_mm numeric[], p_giorno date default current_date)
returns void language plpgsql as $$
begin
  perform pg_temp.come('a0000000-0000-4000-8000-000000000003');
  perform public.registra_controllo(
    'd0000000-0000-4000-8000-000000000001',
    jsonb_build_array(
      jsonb_build_object('posizione', 'ANT_SX', 'battistrada_mm', p_mm[1]),
      jsonb_build_object('posizione', 'ANT_DX', 'battistrada_mm', p_mm[2]),
      jsonb_build_object('posizione', 'POST_SX', 'battistrada_mm', p_mm[3]),
      jsonb_build_object('posizione', 'POST_DX', 'battistrada_mm', p_mm[4])
    ),
    p_giorno, null, '', p_id
  );
  set constraints public.controlli_notifica_esito immediate;
  set constraints public.controlli_notifica_esito deferred;
  reset role;
end;
$$;

-- ---------------------------------------------------------------- soglie (come packages/shared)
select is(public.stato_battistrada(1.5, 'ESTIVO'), 'ROSSO', 'soglie: sotto 1,6 mm è rosso');
select is(public.stato_battistrada(1.6, 'ESTIVO'), 'GIALLO', 'soglie: 1,6 mm estivo è giallo');
select is(public.stato_battistrada(3.0, 'ESTIVO'), 'VERDE', 'soglie: 3 mm estivo è verde');
select is(public.stato_battistrada(3.9, 'INVERNALE'), 'GIALLO', 'soglie: 3,9 mm invernale è giallo');
select is(public.stato_battistrada(4.0, 'QUATTRO_STAGIONI'), 'VERDE',
  'soglie: 4 mm quattro stagioni è verde');

-- ---------------------------------------------------------------- esito del controllo
select pg_temp.controllo('f1000000-0000-4000-8000-000000000001', array[1.2, 3.5, 5.0, 6.0]);
select is(pg_temp.quante('a0000000-0000-4000-8000-000000000004', 'ESITO_CONTROLLO'), 1::bigint,
  'esito: gomme rosse e gialle → il cliente riceve una notifica');
select is(
  (select titolo || ' | ' || testo || ' | ' || link from public.notifiche
   where destinatario_id = 'a0000000-0000-4000-8000-000000000004' and tipo = 'ESITO_CONTROLLO'),
  'Gomme da sostituire | Gomme Rossi S.n.c. ha controllato AB123CD (Fiat Panda): 1 gomma sotto il '
    || 'limite di legge e 1 gomma sotto la soglia consigliata. Apri il report per i dettagli. | '
    || '/controllo?id=f1000000-0000-4000-8000-000000000001',
  'esito: titolo, testo con le gomme da guardare, link al report'
);
select is(
  pg_temp.quante('a0000000-0000-4000-8000-000000000002', 'ESITO_CONTROLLO')
    + pg_temp.quante('a0000000-0000-4000-8000-000000000003', 'ESITO_CONTROLLO'),
  0::bigint,
  'esito: l''officina non riceve nulla'
);

select pg_temp.come('a0000000-0000-4000-8000-000000000003');
select public.modifica_controllo(
  'f1000000-0000-4000-8000-000000000001',
  '[{"posizione": "ANT_SX", "battistrada_mm": 1.0}, {"posizione": "ANT_DX", "battistrada_mm": 1.1},
    {"posizione": "POST_SX", "battistrada_mm": 5}, {"posizione": "POST_DX", "battistrada_mm": 6}]',
  current_date
);
reset role;
select is(pg_temp.quante('a0000000-0000-4000-8000-000000000004', 'ESITO_CONTROLLO'), 1::bigint,
  'esito: correggere il controllo non manda un''altra notifica');

select pg_temp.controllo('f1000000-0000-4000-8000-000000000002', array[4.0, 5.5, 6.0, 6.0]);
select is(pg_temp.quante('a0000000-0000-4000-8000-000000000004', 'ESITO_CONTROLLO'), 1::bigint,
  'esito: tutte verdi → nessuna notifica');

select pg_temp.controllo('f1000000-0000-4000-8000-000000000003', array[1.0, 1.0, 1.0, 1.0],
  current_date - 10);
select is(pg_temp.quante('a0000000-0000-4000-8000-000000000004', 'ESITO_CONTROLLO'), 1::bigint,
  'esito: un controllo registrato più di 7 giorni dopo non avvisa');

select pg_temp.controllo('f1000000-0000-4000-8000-000000000004', array[3.5, 3.8, 6.0, 6.0]);
select is(
  (select titolo from public.notifiche
   where link = '/controllo?id=f1000000-0000-4000-8000-000000000004'),
  'Gomme da tenere d''occhio',
  'esito: solo gialle → "da tenere d''occhio"'
);

-- ---------------------------------------------------------------- cambio stagionale
-- La stessa Panda anche nell'altra officina di Giulia, con le invernali: un solo promemoria per targa
insert into public.pneumatici (officina_id, veicolo_id, posizione, stagione) values
  ('b0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000003', 'ANT_SX',
   'INVERNALE');

select is(public.crea_promemoria_pneumatici('2027-03-20 09:30 Europe/Rome'), 0,
  'stagione: prima delle 10 non parte nulla');
select public.crea_promemoria_pneumatici('2027-03-20 10:15 Europe/Rome');
select is(pg_temp.quante('a0000000-0000-4000-8000-000000000004', 'CAMBIO_STAGIONE'), 1::bigint,
  'stagione: dal 15 marzo, con le invernali montate → un promemoria (uno per targa)');
select is(
  (select titolo || ' | ' || testo || ' | ' || link from public.notifiche
   where destinatario_id = 'a0000000-0000-4000-8000-000000000004' and tipo = 'CAMBIO_STAGIONE'),
  'È ora delle gomme estive | Sul veicolo AB123CD (Fiat Panda) risultano montate gomme invernali: '
    || 'con il caldo si consumano prima e frenano peggio. Prenota il cambio dall''app. | '
    || '/garage/veicolo?targa=AB123CD',
  'stagione: titolo, testo e link al veicolo del garage'
);
select public.crea_promemoria_pneumatici('2027-05-30 11:15 Europe/Rome');
select is(pg_temp.quante('a0000000-0000-4000-8000-000000000004', 'CAMBIO_STAGIONE'), 1::bigint,
  'stagione: nella stessa stagione non si ripete');
select is(public.crea_promemoria_pneumatici('2027-07-01 10:15 Europe/Rome'), 0,
  'stagione: fuori dalle finestre non parte nulla');

update public.pneumatici set stagione = 'ESTIVO'
where veicolo_id in ('d0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000003');
select public.crea_promemoria_pneumatici('2027-10-15 10:15 Europe/Rome');
select is(
  (select titolo from public.notifiche
   where destinatario_id = 'a0000000-0000-4000-8000-000000000004' and tipo = 'CAMBIO_STAGIONE'
   order by chiave desc limit 1),
  'È ora delle gomme invernali',
  'stagione: dal 15 ottobre, con le estive montate → gomme invernali'
);

update public.pneumatici set stagione = 'QUATTRO_STAGIONI'
where veicolo_id in ('d0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000003');
select public.crea_promemoria_pneumatici('2028-10-20 10:15 Europe/Rome');
select is(pg_temp.quante('a0000000-0000-4000-8000-000000000004', 'CAMBIO_STAGIONE'), 2::bigint,
  'stagione: con le 4 stagioni nessun promemoria');

-- ---------------------------------------------------------------- permessi e job
select pg_temp.come('a0000000-0000-4000-8000-000000000004');
select throws_ok(
  $$select public.crea_promemoria_pneumatici()$$,
  '42501',
  null,
  'un utente non può lanciare i promemoria'
);
reset role;
select is(
  (select schedule from cron.job where jobname = 'promemoria-pneumatici'),
  '15 * * * *',
  'il job gira ogni ora'
);

select * from finish();
rollback;

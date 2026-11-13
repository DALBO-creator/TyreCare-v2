-- Test del database per Stripe (T180): stripe_eventi, collega_cliente_stripe, aggiorna_abbonamento_stripe,
-- registra_evento_stripe, pulizia notturna. Richiede seed.sql.
-- Eseguire con: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(49);

-- Simula una richiesta dal client con il JWT dell'utente indicato.
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

-- Simula le Edge Functions di Stripe: ruolo service_role, nessun utente.
create function pg_temp.come_servizio() returns void language plpgsql as $$
begin
  reset role;
  set local role service_role;
  perform set_config('request.jwt.claims', '{"role": "service_role"}', true);
end;
$$;

\set rossi '''b0000000-0000-4000-8000-000000000001'''
\set express '''b0000000-0000-4000-8000-000000000002'''
\set nuova '''b1800000-0000-4000-8000-000000000001'''
\set titolare '''a0000000-0000-4000-8000-000000000002'''

-- Un'officina senza abbonamento: creata (senza utente) e poi privata della sua riga.
insert into public.officine (id, ragione_sociale, partita_iva, citta)
values (:nuova, 'Gomme Test T180', '18018018018', 'Bologna');
delete from public.abbonamenti where officina_id = :nuova;

-- ---------------------------------------------------------------- utenti dell'app: niente accesso
select pg_temp.come(:titolare); -- titolare di Gomme Rossi
select throws_ok(
  format($$select public.collega_cliente_stripe(%L, 'cus_test_titolare')$$, :rossi),
  '42501', null,
  'il titolare non può collegare un cliente Stripe'
);
select throws_ok(
  format($$select public.aggiorna_abbonamento_stripe(%L, null, null, 'ATTIVO', 'PRO')$$, :rossi),
  '42501', null,
  'il titolare non può aggiornare il suo abbonamento come se fosse Stripe'
);
select throws_ok(
  $$select public.registra_evento_stripe('evt_test_titolare', 'checkout.session.completed')$$,
  '42501', null,
  'il titolare non può registrare eventi di Stripe'
);
-- Senza permessi sulla tabella la lettura dà errore (più forte di 0 righe sotto RLS).
select throws_ok(
  'select count(*) from public.stripe_eventi',
  '42501', null,
  'il titolare non legge stripe_eventi'
);

reset role;
select is(
  (select tipo from public.stripe_eventi where id = 'evt_test_titolare'),
  null,
  'il tentativo del titolare non ha registrato l''evento'
);
select ok(
  not has_function_privilege('anon', 'public.collega_cliente_stripe(uuid, text)', 'execute')
  and not has_function_privilege('anon',
    'public.aggiorna_abbonamento_stripe(uuid, text, text, text, text)', 'execute')
  and not has_function_privilege('anon', 'public.registra_evento_stripe(text, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.pulisci_eventi_stripe(timestamptz)', 'execute')
  and not has_table_privilege('anon', 'public.stripe_eventi', 'select'),
  'anon non chiama le funzioni di Stripe e non legge stripe_eventi; nessun utente lancia la pulizia'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.stripe_eventi'::regclass),
  'stripe_eventi ha l''RLS attiva'
);
select is(
  (select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'stripe_eventi'),
  0,
  'stripe_eventi non ha policy'
);

-- ---------------------------------------------------------------- stato di partenza
-- Gomme Rossi torna come appena creata: nessun riferimento Stripe, PROVA, STARTER.
update public.abbonamenti
set stripe_customer_id = null, stripe_subscription_id = null, stato = 'PROVA', piano = 'STARTER'
where officina_id = :rossi;
select ok(
  (select stripe_customer_id is null and stripe_subscription_id is null
     and stato = 'PROVA' and piano = 'STARTER'
   from public.abbonamenti where officina_id = :rossi),
  'preparazione: Gomme Rossi senza cliente Stripe, in PROVA, STARTER'
);

-- ---------------------------------------------------------------- collega_cliente_stripe
select pg_temp.come_servizio();
select lives_ok(
  format($$select public.collega_cliente_stripe(%L, 'cus_test_rossi')$$, :rossi),
  'service role: collega il cliente Stripe a Gomme Rossi'
);
reset role;
select is(
  (select stripe_customer_id from public.abbonamenti where officina_id = :rossi),
  'cus_test_rossi',
  'Gomme Rossi ha il cliente Stripe collegato'
);

select pg_temp.come_servizio();
select lives_ok(
  format($$select public.collega_cliente_stripe(%L, 'cus_test_rossi')$$, :rossi),
  'service role: ricollegare lo stesso cliente non dà errore'
);
select throws_ok(
  format($$select public.collega_cliente_stripe(%L, 'cus_test_altro')$$, :rossi),
  'P0001', 'CLIENTE_STRIPE_DIVERSO',
  'un secondo cliente diverso non sostituisce il primo'
);
select throws_ok(
  format($$select public.collega_cliente_stripe(%L, null)$$, :rossi),
  'P0001', 'CLIENTE_STRIPE_DIVERSO',
  'un cliente nullo non cancella quello collegato'
);
select throws_ok(
  format($$select public.collega_cliente_stripe(%L, 'cus_test_nuova')$$, :nuova),
  'P0001', 'ABBONAMENTO_NON_TROVATO',
  'officina senza abbonamento: errore'
);
reset role;
select is(
  (select stripe_customer_id from public.abbonamenti where officina_id = :rossi),
  'cus_test_rossi',
  'il cliente collegato è ancora il primo'
);

-- ---------------------------------------------------------------- aggiorna_abbonamento_stripe
select pg_temp.come_servizio();
select lives_ok(
  format(
    $$select public.aggiorna_abbonamento_stripe(%L, 'cus_test_rossi', 'sub_test_rossi', 'ATTIVO', 'PRO')$$,
    :rossi
  ),
  'service role: aggiorna l''abbonamento di Gomme Rossi per officina'
);
reset role;
select is(
  (select stato || '/' || piano || '/' || stripe_subscription_id
   from public.abbonamenti where officina_id = :rossi),
  'ATTIVO/PRO/sub_test_rossi',
  'Gomme Rossi: ATTIVO, PRO, abbonamento Stripe collegato'
);

-- Per abbonamento Stripe, senza officina e senza piano: il piano e il cliente restano.
select pg_temp.come_servizio();
select lives_ok(
  $$select public.aggiorna_abbonamento_stripe(null, null, 'sub_test_rossi', 'SCADUTO', null)$$,
  'service role: aggiorna per abbonamento Stripe, senza officina'
);
reset role;
select is(
  (select stato || '/' || piano || '/' || stripe_customer_id
   from public.abbonamenti where officina_id = :rossi),
  'SCADUTO/PRO/cus_test_rossi',
  'trovato per abbonamento Stripe: SCADUTO, piano e cliente invariati'
);

-- Abbonamento Stripe sconosciuto: si cerca per cliente (e si salva il nuovo abbonamento).
select pg_temp.come_servizio();
select lives_ok(
  $$select public.aggiorna_abbonamento_stripe(null, 'cus_test_rossi', 'sub_test_nuovo', 'ATTIVO', 'STARTER')$$,
  'service role: aggiorna per cliente Stripe'
);
reset role;
select is(
  (select stato || '/' || piano || '/' || stripe_subscription_id
   from public.abbonamenti where officina_id = :rossi),
  'ATTIVO/STARTER/sub_test_nuovo',
  'trovato per cliente: ATTIVO, STARTER, nuovo abbonamento Stripe'
);

select pg_temp.come_servizio();
select throws_ok(
  $$select public.aggiorna_abbonamento_stripe(null, 'cus_test_nessuno', 'sub_test_nessuno', 'ATTIVO', null)$$,
  'P0001', 'ABBONAMENTO_NON_TROVATO',
  'cliente e abbonamento Stripe sconosciuti: errore'
);
select throws_ok(
  format($$select public.aggiorna_abbonamento_stripe(%L, null, null, 'ATTIVO', null)$$, :nuova),
  'P0001', 'ABBONAMENTO_NON_TROVATO',
  'officina senza abbonamento: errore'
);
select throws_ok(
  format($$select public.aggiorna_abbonamento_stripe(%L, null, null, 'XYZ', null)$$, :rossi),
  'P0001', 'STATO_NON_VALIDO',
  'stato sconosciuto: errore'
);
select throws_ok(
  format($$select public.aggiorna_abbonamento_stripe(%L, null, null, 'PROVA', null)$$, :rossi),
  'P0001', 'STATO_NON_VALIDO',
  'la PROVA non la decide Stripe'
);
select throws_ok(
  format($$select public.aggiorna_abbonamento_stripe(%L, null, null, 'ATTIVO', 'PILOTA')$$, :rossi),
  'P0001', 'PIANO_NON_VALIDO',
  'il piano PILOTA non arriva da Stripe'
);

-- Stesso cliente su due abbonamenti: da T211 il database non lo permette più (indice unico), così la
-- ricerca per cliente non deve mai scegliere a caso.
reset role;
update public.abbonamenti set stripe_customer_id = 'cus_test_doppio' where officina_id = :express;
select throws_ok(
  format(
    $$update public.abbonamenti set stripe_customer_id = 'cus_test_doppio' where officina_id = %L$$,
    :rossi
  ),
  '23505', 'duplicate key value violates unique constraint "abbonamenti_stripe_customer_id_unico"',
  'cliente Stripe su due abbonamenti: il secondo è rifiutato (un cliente per officina)'
);
update public.abbonamenti set stripe_customer_id = 'cus_test_rossi' where officina_id = :rossi;
update public.abbonamenti set stripe_customer_id = null where officina_id = :express;

select is(
  (select stato || '/' || piano || '/' || stripe_customer_id || '/' || stripe_subscription_id
   from public.abbonamenti where officina_id = :rossi),
  'ATTIVO/STARTER/cus_test_rossi/sub_test_nuovo',
  'le chiamate con errore non hanno cambiato Gomme Rossi'
);

-- ---------------------------------------------------------------- la scadenza della prova non tocca ATTIVO
-- Gomme Rossi (ATTIVO) e Pneus Express (PROVA) con la prova finita il 2026-01-01.
update public.abbonamenti set prova_fino_al = '2026-01-01' where officina_id in (:rossi, :express);
update public.abbonamenti set stato = 'PROVA', piano = 'STARTER' where officina_id = :express;
select ok(
  public.scadi_prove_abbonamento('2026-01-02') >= 1,
  'la scadenza delle prove gira'
);
select is(
  (select stato from public.abbonamenti where officina_id = :express),
  'SCADUTO',
  'controllo: la prova finita di Pneus Express è scaduta'
);
select is(
  (select stato from public.abbonamenti where officina_id = :rossi),
  'ATTIVO',
  'l''abbonamento ATTIVO di Gomme Rossi non scade con la prova'
);

-- ---------------------------------------------------------------- registra_evento_stripe
select pg_temp.come_servizio();
select is(
  public.registra_evento_stripe('evt_test_1', 'checkout.session.completed'),
  true,
  'evento nuovo: true'
);
select is(
  public.registra_evento_stripe('evt_test_1', 'checkout.session.completed'),
  false,
  'stesso evento una seconda volta: false'
);
reset role;
select is(
  (select count(*)::int from public.stripe_eventi where id = 'evt_test_1'),
  1,
  'l''evento è registrato una volta sola'
);

-- ---------------------------------------------------------------- pulizia notturna
insert into public.stripe_eventi (id, tipo, ricevuto_il) values
  ('evt_test_vecchio', 'invoice.paid', now() - interval '31 days'),
  ('evt_test_recente', 'invoice.paid', now() - interval '29 days');
select is(
  public.pulisci_eventi_stripe(),
  1,
  'la pulizia cancella un evento'
);
select is(
  (select string_agg(id, ',' order by id) from public.stripe_eventi
   where id in ('evt_test_vecchio', 'evt_test_recente', 'evt_test_1')),
  'evt_test_1,evt_test_recente',
  'restano solo gli eventi degli ultimi 30 giorni'
);
select is(
  (select schedule from cron.job where jobname = 'pulizia-eventi-stripe'),
  '35 0 * * *',
  'il job gira ogni notte alle 0:35'
);
select is(
  (select command from cron.job where jobname = 'pulizia-eventi-stripe'),
  'select public.pulisci_eventi_stripe()',
  'il job chiama la funzione'
);

-- ---------------------------------------------------------------- motivo degli eventi scartati (T231)
select pg_temp.come_servizio();
select public.registra_evento_stripe('evt_test_motivo', 'customer.subscription.updated');
select is(
  public.annota_evento_stripe('evt_test_motivo', 'ABBONAMENTO_NON_TROVATO'),
  true,
  'annota_evento_stripe su un evento registrato: true'
);
select is(
  (select motivo from public.stripe_eventi where id = 'evt_test_motivo'),
  'ABBONAMENTO_NON_TROVATO',
  'il motivo è salvato sull''evento'
);
select is(
  public.annota_evento_stripe('evt_test_inesistente', 'ABBONAMENTO_NON_TROVATO'),
  false,
  'annota_evento_stripe su un evento mai registrato: false'
);

select pg_temp.come(:titolare); -- titolare di Gomme Rossi
select throws_ok(
  $$select public.annota_evento_stripe('evt_test_motivo', 'MOTIVO_DEL_TITOLARE')$$,
  '42501', null,
  'il titolare non può annotare eventi di Stripe'
);
select throws_ok(
  'select motivo from public.stripe_eventi',
  '42501', null,
  'il titolare non legge il motivo degli eventi'
);
reset role;
select is(
  (select motivo from public.stripe_eventi where id = 'evt_test_motivo'),
  'ABBONAMENTO_NON_TROVATO',
  'il tentativo del titolare non ha cambiato il motivo'
);
select ok(
  not has_function_privilege('authenticated', 'public.annota_evento_stripe(text, text)', 'execute')
  and not has_function_privilege('anon', 'public.annota_evento_stripe(text, text)', 'execute')
  and has_function_privilege('service_role', 'public.annota_evento_stripe(text, text)', 'execute'),
  'annota_evento_stripe: solo il service role la chiama'
);

select pg_temp.come_servizio();
select public.annota_evento_stripe('evt_test_motivo', repeat('x', 250));
select is(
  (select char_length(motivo) from public.stripe_eventi where id = 'evt_test_motivo'),
  200,
  'un motivo di 250 caratteri si salva troncato a 200'
);
select public.annota_evento_stripe('evt_test_motivo', null);
select is(
  (select motivo from public.stripe_eventi where id = 'evt_test_motivo'),
  null,
  'un motivo nullo cancella quello presente'
);
reset role;
select throws_ok(
  $$insert into public.stripe_eventi (id, tipo, motivo)
    values ('evt_test_lungo', 'invoice.paid', repeat('x', 201))$$,
  '23514', null,
  'la tabella rifiuta un motivo più lungo di 200 caratteri'
);

select * from finish();
rollback;

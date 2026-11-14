-- Test del database per T211 (R35): eventi di Stripe fuori ordine e un cliente Stripe per officina.
-- aggiorna_abbonamento_stripe_evento ignora gli eventi più vecchi dell'ultimo applicato, applica quelli
-- uguali, più nuovi o senza momento; il cliente Stripe di un'altra officina dà
-- CLIENTE_STRIPE_DI_ALTRA_OFFICINA sia lì sia in collega_cliente_stripe. Richiede seed.sql.
-- Eseguire con: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(40);

-- Simula una richiesta dal client con il JWT dell'utente indicato.
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

-- Simula le Edge Functions di Stripe: ruolo service_role, nessun utente.
create function pg_temp.come_servizio() returns void language plpgsql as $$
begin
  reset role;
  set local role service_role;
  perform set_config('request.jwt.claims', '{"role": "service_role"}', true);
end;
$$;

-- Letture senza RLS (utente dei test, dopo reset role).
create function pg_temp.abbonamento(p_officina uuid) returns text language sql as $$
  select stato || '/' || piano || '/' || coalesce(stripe_customer_id, '-') || '/'
    || coalesce(stripe_subscription_id, '-')
  from public.abbonamenti where officina_id = p_officina;
$$;

create function pg_temp.evento_il(p_officina uuid) returns timestamptz language sql as $$
  select stripe_evento_il from public.abbonamenti where officina_id = p_officina;
$$;

\set rossi '''b0000000-0000-4000-8000-000000000001'''
\set express '''b0000000-0000-4000-8000-000000000002'''
\set titolare '''a0000000-0000-4000-8000-000000000002'''
\set titolare2 '''a0000000-0000-4000-8000-000000000005'''

-- ---------------------------------------------------------------- schema
select has_column('public', 'abbonamenti', 'stripe_evento_il', 'abbonamenti ha stripe_evento_il');
select col_type_is(
  'public', 'abbonamenti', 'stripe_evento_il', 'timestamp with time zone',
  'stripe_evento_il è timestamptz'
);
select ok(
  (select indexdef like 'CREATE UNIQUE INDEX abbonamenti_stripe_customer_id_unico%'
     and indexdef like '%(stripe_customer_id) WHERE (stripe_customer_id IS NOT NULL)'
   from pg_indexes
   where schemaname = 'public' and indexname = 'abbonamenti_stripe_customer_id_unico'),
  'indice unico parziale su stripe_customer_id (solo i valori non nulli)'
);

-- ---------------------------------------------------------------- permessi: solo il service role
select pg_temp.come(:titolare); -- titolare di Gomme Rossi
select throws_ok(
  format(
    $$select public.aggiorna_abbonamento_stripe_evento(%L, null, null, 'ATTIVO', 'PRO', now())$$,
    :rossi
  ),
  '42501', null,
  'il titolare non può aggiornare il suo abbonamento come se fosse Stripe'
);
select pg_temp.come(:titolare2); -- titolare di Pneus Express
select throws_ok(
  format(
    $$select public.aggiorna_abbonamento_stripe_evento(%L, null, null, 'ATTIVO', 'PRO', null)$$,
    :rossi
  ),
  '42501', null,
  'il titolare di un''altra officina non può chiamarla'
);
reset role;
select ok(
  not has_function_privilege('anon',
    'public.aggiorna_abbonamento_stripe_evento(uuid, text, text, text, text, timestamptz)', 'execute')
  and not has_function_privilege('authenticated',
    'public.aggiorna_abbonamento_stripe_evento(uuid, text, text, text, text, timestamptz)', 'execute')
  and has_function_privilege('service_role',
    'public.aggiorna_abbonamento_stripe_evento(uuid, text, text, text, text, timestamptz)', 'execute'),
  'aggiorna_abbonamento_stripe_evento: solo il service role'
);
select ok(
  not has_function_privilege('anon', 'public.collega_cliente_stripe(uuid, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.collega_cliente_stripe(uuid, text)', 'execute')
  and has_function_privilege('service_role', 'public.collega_cliente_stripe(uuid, text)', 'execute'),
  'collega_cliente_stripe: ancora solo il service role'
);

-- ---------------------------------------------------------------- partenza
update public.abbonamenti
set stato = 'ATTIVO', piano = 'STARTER', stripe_customer_id = 'cus_t211_rossi',
    stripe_subscription_id = 'sub_t211_rossi', stripe_evento_il = null
where officina_id = :rossi;
update public.abbonamenti
set stato = 'PROVA', piano = 'STARTER', stripe_customer_id = null, stripe_subscription_id = null,
    stripe_evento_il = null
where officina_id = :express;
select is(
  pg_temp.abbonamento(:rossi),
  'ATTIVO/STARTER/cus_t211_rossi/sub_t211_rossi',
  'partenza: Gomme Rossi ATTIVO con la sua subscription'
);
select is(pg_temp.evento_il(:rossi), null, 'partenza: nessun evento applicato a Gomme Rossi');

-- ---------------------------------------------------------------- evento senza momento: si applica
select pg_temp.come_servizio();
select lives_ok(
  format(
    $$select public.aggiorna_abbonamento_stripe_evento(%L, null, 'sub_t211_rossi', 'SCADUTO', null, null)$$,
    :rossi
  ),
  'evento senza momento, nessun momento salvato'
);
reset role;
select is(
  pg_temp.abbonamento(:rossi),
  'SCADUTO/STARTER/cus_t211_rossi/sub_t211_rossi',
  'senza momento l''evento si applica'
);
select is(pg_temp.evento_il(:rossi), null, 'senza momento stripe_evento_il resta vuoto');

-- ---------------------------------------------------------------- primo evento con momento
select pg_temp.come_servizio();
select lives_ok(
  format(
    $$select public.aggiorna_abbonamento_stripe_evento(%L, null, 'sub_t211_rossi', 'ATTIVO', 'PRO',
      '2026-11-10 10:00:00+00')$$,
    :rossi
  ),
  'evento ATTIVO PRO delle 10:00'
);
reset role;
select is(
  pg_temp.abbonamento(:rossi),
  'ATTIVO/PRO/cus_t211_rossi/sub_t211_rossi',
  'l''evento delle 10:00 si applica'
);
select is(
  pg_temp.evento_il(:rossi),
  '2026-11-10 10:00:00+00'::timestamptz,
  'stripe_evento_il = 10:00'
);

-- ---------------------------------------------------------------- evento più vecchio: ignorato
select pg_temp.come_servizio();
select lives_ok(
  format(
    $$select public.aggiorna_abbonamento_stripe_evento(%L, 'cus_t211_rossi', 'sub_t211_rossi', 'ANNULLATO',
      'STARTER', '2026-11-10 09:59:59+00')$$,
    :rossi
  ),
  'evento ANNULLATO delle 9:59:59 arrivato in ritardo: nessun errore (il webhook risponde 200)'
);
reset role;
select is(
  pg_temp.abbonamento(:rossi),
  'ATTIVO/PRO/cus_t211_rossi/sub_t211_rossi',
  'l''evento più vecchio non riporta indietro stato e piano'
);
select is(
  pg_temp.evento_il(:rossi),
  '2026-11-10 10:00:00+00'::timestamptz,
  'l''evento ignorato non cambia stripe_evento_il'
);

-- Anche senza officina, trovato per subscription: lo stesso.
select pg_temp.come_servizio();
select lives_ok(
  $$select public.aggiorna_abbonamento_stripe_evento(null, null, 'sub_t211_rossi', 'SCADUTO', null,
    '2026-11-09 08:00:00+00')$$,
  'evento SCADUTO del giorno prima trovato per subscription: nessun errore'
);
reset role;
select is(
  pg_temp.abbonamento(:rossi),
  'ATTIVO/PRO/cus_t211_rossi/sub_t211_rossi',
  'trovato per subscription: l''evento più vecchio è ignorato'
);

-- ---------------------------------------------------------------- evento con lo stesso momento: si applica
select pg_temp.come_servizio();
select lives_ok(
  format(
    $$select public.aggiorna_abbonamento_stripe_evento(%L, null, 'sub_t211_rossi', 'SCADUTO', null,
      '2026-11-10 10:00:00+00')$$,
    :rossi
  ),
  'evento SCADUTO con lo stesso momento (10:00)'
);
reset role;
select is(
  pg_temp.abbonamento(:rossi),
  'SCADUTO/PRO/cus_t211_rossi/sub_t211_rossi',
  'lo stesso momento si applica (Stripe conta i secondi)'
);

-- ---------------------------------------------------------------- evento più nuovo: si applica
select pg_temp.come_servizio();
select lives_ok(
  $$select public.aggiorna_abbonamento_stripe_evento(null, 'cus_t211_rossi', null, 'ATTIVO', 'STARTER',
    '2026-11-10 11:00:00+00')$$,
  'evento ATTIVO delle 11:00 trovato per cliente Stripe'
);
reset role;
select is(
  pg_temp.abbonamento(:rossi),
  'ATTIVO/STARTER/cus_t211_rossi/sub_t211_rossi',
  'l''evento più nuovo si applica'
);
select is(
  pg_temp.evento_il(:rossi),
  '2026-11-10 11:00:00+00'::timestamptz,
  'stripe_evento_il avanza a 11:00'
);

-- Un evento senza momento dopo uno con momento: si applica, ma il momento salvato non si cancella.
select pg_temp.come_servizio();
select lives_ok(
  format(
    $$select public.aggiorna_abbonamento_stripe_evento(%L, null, null, 'SCADUTO', null, null)$$,
    :rossi
  ),
  'evento senza momento dopo quello delle 11:00'
);
reset role;
select is(
  pg_temp.abbonamento(:rossi),
  'SCADUTO/STARTER/cus_t211_rossi/sub_t211_rossi',
  'l''evento senza momento si applica'
);
select is(
  pg_temp.evento_il(:rossi),
  '2026-11-10 11:00:00+00'::timestamptz,
  'il momento salvato resta 11:00'
);

-- ---------------------------------------------------------------- cliente Stripe di un'altra officina
update public.abbonamenti set stripe_customer_id = 'cus_t211_express' where officina_id = :express;
select is(
  pg_temp.abbonamento(:express),
  'PROVA/STARTER/cus_t211_express/-',
  'partenza: Pneus Express con il suo cliente Stripe'
);

select pg_temp.come_servizio();
select throws_ok(
  format(
    $$select public.aggiorna_abbonamento_stripe_evento(%L, 'cus_t211_express', 'sub_t211_rossi', 'ATTIVO',
      null, '2026-11-10 12:00:00+00')$$,
    :rossi
  ),
  'P0001', 'CLIENTE_STRIPE_DI_ALTRA_OFFICINA',
  'il cliente Stripe di Pneus Express non si collega a Gomme Rossi'
);
reset role;
select is(
  pg_temp.abbonamento(:rossi),
  'SCADUTO/STARTER/cus_t211_rossi/sub_t211_rossi',
  'Gomme Rossi non è cambiata'
);
select is(
  pg_temp.evento_il(:rossi),
  '2026-11-10 11:00:00+00'::timestamptz,
  'l''evento rifiutato non sposta il momento'
);

-- collega_cliente_stripe: Gomme Rossi senza cliente prova a prendere quello di Pneus Express.
update public.abbonamenti set stripe_customer_id = null where officina_id = :rossi;
select is(
  pg_temp.abbonamento(:rossi),
  'SCADUTO/STARTER/-/sub_t211_rossi',
  'partenza: Gomme Rossi senza cliente Stripe'
);
select pg_temp.come_servizio();
select throws_ok(
  format($$select public.collega_cliente_stripe(%L, 'cus_t211_express')$$, :rossi),
  'P0001', 'CLIENTE_STRIPE_DI_ALTRA_OFFICINA',
  'collega_cliente_stripe: il cliente di un''altra officina dà la chiave'
);
select lives_ok(
  format($$select public.collega_cliente_stripe(%L, 'cus_t211_rossi')$$, :rossi),
  'collega_cliente_stripe: un cliente libero si collega ancora'
);
reset role;
select is(
  pg_temp.abbonamento(:express),
  'PROVA/STARTER/cus_t211_express/-',
  'Pneus Express tiene il suo cliente Stripe'
);

-- ---------------------------------------------------------------- subscription di un'altra officina
-- Gomme Rossi non ATTIVO (SCADUTO), altrimenti l'evento di un'altra subscription si ignora (R30).
update public.abbonamenti set stripe_subscription_id = 'sub_t211_express' where officina_id = :express;
select pg_temp.come_servizio();
select throws_ok(
  format(
    $$select public.aggiorna_abbonamento_stripe_evento(%L, null, 'sub_t211_express', 'ATTIVO', null,
      '2026-11-10 12:00:00+00')$$,
    :rossi
  ),
  'P0001', 'SUBSCRIPTION_DI_ALTRA_OFFICINA',
  'la subscription di Pneus Express non si collega a Gomme Rossi'
);
reset role;
select is(
  pg_temp.abbonamento(:rossi),
  'SCADUTO/STARTER/cus_t211_rossi/sub_t211_rossi',
  'Gomme Rossi non è cambiata dopo la subscription rifiutata'
);

-- ---------------------------------------------------------------- errori di validazione come prima
select pg_temp.come_servizio();
select throws_ok(
  format(
    $$select public.aggiorna_abbonamento_stripe_evento(%L, null, null, 'PROVA', null, now())$$,
    :rossi
  ),
  'P0001', 'STATO_NON_VALIDO',
  'la PROVA non la decide Stripe'
);
select throws_ok(
  $$select public.aggiorna_abbonamento_stripe_evento(null, 'cus_t211_nessuno', 'sub_t211_nessuno', 'ATTIVO',
    null, now())$$,
  'P0001', 'ABBONAMENTO_NON_TROVATO',
  'cliente e subscription sconosciuti: errore'
);
reset role;

select * from finish();
rollback;

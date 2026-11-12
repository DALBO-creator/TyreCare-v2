-- Test del database per T224 (R30, dritta T189): una sola subscription Stripe per officina.
-- aggiorna_abbonamento_stripe ignora gli eventi di una subscription vecchia quando l'abbonamento è ATTIVO
-- con un'altra, rifiuta la subscription di un'altra officina; rifiuta_affiliazione non cancella
-- un'officina con una subscription. Richiede seed.sql.
-- Eseguire con: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(31);

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
  select stato || '/' || coalesce(stripe_subscription_id, '-')
  from public.abbonamenti where officina_id = p_officina;
$$;

\set rossi '''b0000000-0000-4000-8000-000000000001'''
\set express '''b0000000-0000-4000-8000-000000000002'''
\set senza_sub '''b2240000-0000-4000-8000-000000000001'''
\set admin '''a0000000-0000-4000-8000-000000000001'''
\set titolare2 '''a0000000-0000-4000-8000-000000000005'''

-- ---------------------------------------------------------------- abbonamento ATTIVO: eventi della vecchia
reset role;
update public.abbonamenti
set stato = 'ATTIVO', piano = 'STARTER', stripe_customer_id = 'cus_t224_rossi',
    stripe_subscription_id = 'sub_t224_nuova'
where officina_id = :rossi;
select is(
  (select stato || '/' || piano || '/' || stripe_customer_id || '/' || stripe_subscription_id
   from public.abbonamenti where officina_id = :rossi),
  'ATTIVO/STARTER/cus_t224_rossi/sub_t224_nuova',
  'partenza: Gomme Rossi ATTIVO con sub_nuova'
);

-- Evento con l'officina nei metadati (come il checkout).
select pg_temp.come_servizio();
select lives_ok(
  format(
    $$select public.aggiorna_abbonamento_stripe(%L, 'cus_t224_altro', 'sub_t224_vecchia', 'ANNULLATO', 'PRO')$$,
    :rossi
  ),
  'evento ANNULLATO della subscription vecchia: nessun errore (il webhook risponde 200)'
);
reset role;
select is(
  (select stato from public.abbonamenti where officina_id = :rossi),
  'ATTIVO',
  'la subscription vecchia non annulla l''abbonamento ATTIVO'
);
select is(
  (select stripe_subscription_id from public.abbonamenti where officina_id = :rossi),
  'sub_t224_nuova',
  'la subscription collegata resta quella nuova'
);
select is(
  (select piano || '/' || stripe_customer_id from public.abbonamenti where officina_id = :rossi),
  'STARTER/cus_t224_rossi',
  'l''evento ignorato non cambia piano e cliente Stripe'
);

-- Evento senza officina: trovata per cliente Stripe (la subscription vecchia non è salvata da nessuna parte).
select pg_temp.come_servizio();
select lives_ok(
  $$select public.aggiorna_abbonamento_stripe(null, 'cus_t224_rossi', 'sub_t224_vecchia', 'SCADUTO', null)$$,
  'evento SCADUTO della subscription vecchia trovato per cliente: nessun errore'
);
reset role;
select is(
  pg_temp.abbonamento(:rossi),
  'ATTIVO/sub_t224_nuova',
  'anche per cliente: l''evento della vecchia è ignorato'
);

-- Gli eventi della subscription collegata valgono sempre.
select pg_temp.come_servizio();
select lives_ok(
  $$select public.aggiorna_abbonamento_stripe(null, null, 'sub_t224_nuova', 'SCADUTO', null)$$,
  'evento SCADUTO della subscription collegata'
);
reset role;
select is(
  (select stato from public.abbonamenti where officina_id = :rossi),
  'SCADUTO',
  'la subscription collegata porta l''abbonamento a SCADUTO'
);
select is(
  (select stripe_subscription_id from public.abbonamenti where officina_id = :rossi),
  'sub_t224_nuova',
  'dopo SCADUTO la subscription collegata non cambia'
);

-- ---------------------------------------------------------------- abbonamento finito: la nuova si salva
update public.abbonamenti
set stato = 'ANNULLATO', stripe_subscription_id = 'sub_t224_vecchia'
where officina_id = :rossi;
select is(
  pg_temp.abbonamento(:rossi),
  'ANNULLATO/sub_t224_vecchia',
  'partenza: Gomme Rossi ANNULLATO con sub_vecchia'
);

select pg_temp.come_servizio();
select lives_ok(
  format(
    $$select public.aggiorna_abbonamento_stripe(%L, null, 'sub_t224_nuova', 'ATTIVO', 'PRO')$$,
    :rossi
  ),
  'evento ATTIVO di una subscription nuova su un abbonamento ANNULLATO'
);
reset role;
select is(
  (select stato from public.abbonamenti where officina_id = :rossi),
  'ATTIVO',
  'l''abbonamento ANNULLATO torna ATTIVO con la subscription nuova'
);
select is(
  (select stripe_subscription_id from public.abbonamenti where officina_id = :rossi),
  'sub_t224_nuova',
  'la subscription nuova prende il posto della vecchia'
);

-- ---------------------------------------------------------------- subscription di un'altra officina
-- Gomme Rossi non ATTIVO (altrimenti l'evento di un'altra subscription si ignora, vedi sopra).
update public.abbonamenti set stato = 'ANNULLATO' where officina_id = :rossi;
update public.abbonamenti set stripe_subscription_id = 'sub_t224_x' where officina_id = :express;
select is(pg_temp.abbonamento(:rossi), 'ANNULLATO/sub_t224_nuova', 'partenza: Gomme Rossi ANNULLATO');
select is(
  (select stripe_subscription_id from public.abbonamenti where officina_id = :express),
  'sub_t224_x',
  'partenza: sub_x salvata sull''abbonamento di Pneus Express'
);

select pg_temp.come_servizio();
select throws_ok(
  format(
    $$select public.aggiorna_abbonamento_stripe(%L, null, 'sub_t224_x', 'ATTIVO', null)$$,
    :rossi
  ),
  'P0001', 'SUBSCRIPTION_DI_ALTRA_OFFICINA',
  'la subscription di Pneus Express non si collega a Gomme Rossi'
);
reset role;
select is(pg_temp.abbonamento(:rossi), 'ANNULLATO/sub_t224_nuova', 'Gomme Rossi non è cambiata');
select is(
  (select stripe_subscription_id from public.abbonamenti where officina_id = :express),
  'sub_t224_x',
  'Pneus Express tiene la sua subscription'
);

-- ---------------------------------------------------------------- rifiuto con una subscription
select is(
  (select stato_affiliazione::text from public.officine where id = :express),
  'IN_ATTESA',
  'partenza: Pneus Express è IN_ATTESA'
);

select pg_temp.come(:admin);
select throws_ok(
  format('select public.rifiuta_affiliazione(%L)', :express),
  'P0001', 'ABBONAMENTO_STRIPE_PRESENTE',
  'l''admin non rifiuta un''officina con una subscription Stripe'
);
reset role;
select is(
  (select count(*)::int from public.officine where id = :express),
  1,
  'Pneus Express c''è ancora'
);
select is(
  (select stripe_subscription_id from public.abbonamenti where officina_id = :express),
  'sub_t224_x',
  'il suo abbonamento con la subscription c''è ancora'
);
select is(
  (select count(*)::int from public.notifiche
   where destinatario_id = :titolare2 and tipo::text = 'AFFILIAZIONE_RIFIUTATA'),
  0,
  'il titolare di Pneus Express non riceve l''avviso di rifiuto'
);

-- Anche SCADUTO (past_due/unpaid, subscription ancora viva) blocca il rifiuto.
update public.abbonamenti set stato = 'SCADUTO' where officina_id = :express;
select is(pg_temp.abbonamento(:express), 'SCADUTO/sub_t224_x', 'partenza: Pneus Express SCADUTO con sub_x');
select pg_temp.come(:admin);
select throws_ok(
  format('select public.rifiuta_affiliazione(%L)', :express),
  'P0001', 'ABBONAMENTO_STRIPE_PRESENTE',
  'anche con l''abbonamento SCADUTO la subscription blocca il rifiuto'
);
reset role;
select is(
  (select count(*)::int from public.officine where id = :express),
  1,
  'Pneus Express c''è ancora dopo il secondo tentativo'
);

-- ---------------------------------------------------------------- rifiuto senza subscription
-- Officina IN_ATTESA creata senza utente: il trigger le dà l'abbonamento; solo il cliente Stripe
-- (nessuna subscription) non blocca il rifiuto.
insert into public.officine (id, ragione_sociale, partita_iva, citta)
values (:senza_sub, 'Gomme Test T224', '22422422422', 'Bologna');
update public.abbonamenti set stripe_customer_id = 'cus_t224_senza_sub' where officina_id = :senza_sub;
select is(
  (select o.stato_affiliazione::text || '/' || coalesce(a.stripe_customer_id, '-') || '/'
     || coalesce(a.stripe_subscription_id, '-')
   from public.officine o join public.abbonamenti a on a.officina_id = o.id
   where o.id = :senza_sub),
  'IN_ATTESA/cus_t224_senza_sub/-',
  'partenza: officina IN_ATTESA con cliente Stripe e senza subscription'
);

select pg_temp.come(:admin);
select lives_ok(
  format('select public.rifiuta_affiliazione(%L)', :senza_sub),
  'senza subscription l''admin rifiuta la richiesta'
);
reset role;
select is(
  (select count(*)::int from public.officine where id = :senza_sub),
  0,
  'l''officina senza subscription è cancellata'
);
select is(
  (select count(*)::int from public.abbonamenti where officina_id = :senza_sub),
  0,
  'il suo abbonamento se ne va con lei'
);

select * from finish();
rollback;

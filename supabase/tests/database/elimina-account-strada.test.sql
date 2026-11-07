-- Test di elimina_account con un aiuto su strada in corso (T225). Richiede seed.sql.
-- Eseguire con: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

create function pg_temp.come(p_utente uuid) returns void language plpgsql as $$
begin
  reset role;
  if p_utente is null then
    set local role anon;
    perform set_config('request.jwt.claims', '{"role": "anon"}', true);
  else
    set local role authenticated;
    perform set_config(
      'request.jwt.claims',
      json_build_object('sub', p_utente, 'role', 'authenticated')::text,
      true
    );
  end if;
end;
$$;

-- Utenti del seed: …01 admin, …04 cliente Giulia di Gomme Rossi (b000…0001)
\set admin '''a0000000-0000-4000-8000-000000000001'''
\set giulia '''a0000000-0000-4000-8000-000000000004'''
\set rossi '''b0000000-0000-4000-8000-000000000001'''
\set richiesta '''c7250000-0000-4000-8000-000000000001'''

-- Dati di partenza: nel seed Giulia ha una prenotazione RICHIESTA, che farebbe scattare
-- PRENOTAZIONI_IN_CORSO prima del controllo provato qui. La si annulla e lo si verifica.
update public.prenotazioni set stato = 'ANNULLATA'
where cliente_id = :giulia and stato in ('RICHIESTA', 'PROPOSTA', 'CONFERMATA');
select is(
  (select count(*)::int from public.prenotazioni
   where cliente_id = :giulia and stato in ('RICHIESTA', 'PROPOSTA', 'CONFERMATA')),
  0,
  'Giulia parte senza prenotazioni in corso'
);

-- ---------------------------------------------------------------- APERTA non scaduta: blocca
insert into public.richieste_strada (id, cliente_id, latitudine, longitudine, descrizione, telefono)
values (:richiesta, :giulia, 45.1, 7.7, 'Gomma a terra', '+39 347 1112223');

select pg_temp.come(:giulia);
select throws_ok(
  $$select public.elimina_account()$$,
  'P0001', 'RICHIESTA_STRADA_IN_CORSO',
  'con una richiesta su strada APERTA non si può eliminare l''account'
);

reset role;
select is(
  (select count(*)::int from public.profiles where id = :giulia),
  1,
  'dopo il rifiuto (APERTA) il profilo di Giulia c''è ancora'
);

-- ---------------------------------------------------------------- ACCETTATA da un'ora: blocca
-- Anche se la scadenza della richiesta aperta è passata: per un'ACCETTATA conta accettata_il.
update public.richieste_strada
set stato = 'ACCETTATA', officina_id = :rossi, accettata_il = now() - interval '1 hour',
  scade_il = now() - interval '1 minute'
where id = :richiesta;

select pg_temp.come(:giulia);
select throws_ok(
  $$select public.elimina_account()$$,
  'P0001', 'RICHIESTA_STRADA_IN_CORSO',
  'con una richiesta su strada ACCETTATA da un''ora non si può eliminare l''account'
);

reset role;
select is(
  (select count(*)::int from public.profiles where id = :giulia),
  1,
  'dopo il rifiuto (ACCETTATA) il profilo di Giulia c''è ancora'
);

-- ---------------------------------------------------------------- solo APERTA scaduta: non blocca
-- La richiesta di Giulia torna APERTA ma scaduta; l'admin ha una richiesta APERTA valida, che non
-- deve contare per Giulia.
update public.richieste_strada
set stato = 'APERTA', officina_id = null, accettata_il = null, scade_il = now() - interval '1 minute'
where id = :richiesta;
insert into public.richieste_strada (id, cliente_id, latitudine, longitudine, descrizione, telefono)
values ('c7250000-0000-4000-8000-000000000002', :admin, 45.1, 7.7, 'Altra persona', '+39 333 1112223');

select pg_temp.come(:giulia);
select lives_ok(
  $$select public.elimina_account()$$,
  'con solo una richiesta APERTA già scaduta Giulia può eliminarsi'
);

reset role;
select is(
  (select count(*)::int from public.profiles where id = :giulia),
  0,
  'il profilo di Giulia non c''è più'
);
select is(
  (select count(*)::int from public.richieste_strada where id = :richiesta),
  0,
  'la richiesta scaduta di Giulia è sparita con l''account'
);

select * from finish();
rollback;

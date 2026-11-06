-- T224: una sola subscription Stripe per officina (R30, dritta T189).
-- 1. aggiorna_abbonamento_stripe: gli eventi di una subscription diversa da quella collegata a un
--    abbonamento ATTIVO si ignorano (niente errore: il webhook registra l'evento e risponde 200);
--    una subscription già salvata su un'altra officina dà SUBSCRIPTION_DI_ALTRA_OFFICINA.
-- 2. rifiuta_affiliazione: l'admin non cancella un'officina che ha una subscription Stripe
--    (ABBONAMENTO_STRIPE_PRESENTE): continuerebbe ad addebitare senza officina.
-- Solo `create or replace` con le stesse firme: nessuna tabella, colonna o dato cambia. Lo stato PROVA e
-- R28 (SCADUTO durante la prova) restano come sono.

-- ---------------------------------------------------------------------------------------------------
-- Aggiornamento di stato e piano
-- ---------------------------------------------------------------------------------------------------
-- L'abbonamento si cerca per officina; senza officina per abbonamento Stripe; se non c'è, per cliente
-- Stripe (solo se il cliente è collegato a un abbonamento soltanto). Lo stato PROVA lo decide TyreCare,
-- non Stripe; il piano PILOTA lo assegna solo l'ADMIN: Stripe può mandare solo STARTER o PRO (o niente,
-- e il piano resta quello che è).

create or replace function public.aggiorna_abbonamento_stripe(
  p_officina_id uuid,
  p_customer text,
  p_subscription text,
  p_stato text,
  p_piano text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_officina uuid := p_officina_id;
  v_stato text;
  v_sub text;
begin
  if p_stato is null or p_stato not in ('ATTIVO', 'SCADUTO', 'ANNULLATO') then
    raise exception 'STATO_NON_VALIDO';
  end if;

  if p_piano is not null and p_piano not in ('STARTER', 'PRO') then
    raise exception 'PIANO_NON_VALIDO';
  end if;

  if v_officina is null and p_subscription is not null then
    select a.officina_id into v_officina
    from public.abbonamenti a
    where a.stripe_subscription_id = p_subscription;
  end if;

  if v_officina is null and p_customer is not null then
    -- stripe_customer_id non è unico: con due abbonamenti sullo stesso cliente non si sceglie a caso.
    select (array_agg(a.officina_id))[1] into v_officina
    from public.abbonamenti a
    where a.stripe_customer_id = p_customer
    having count(*) = 1;
  end if;

  -- Blocca la riga: due eventi contemporanei della stessa officina passano uno alla volta e il secondo
  -- vede lo stato lasciato dal primo. Riga assente (o officina non trovata): ci pensa l'update qui sotto
  -- con ABBONAMENTO_NON_TROVATO, come prima.
  select a.stato, a.stripe_subscription_id into v_stato, v_sub
  from public.abbonamenti a
  where a.officina_id = v_officina
  for update;

  -- R30, dritta T189: una sola subscription viva per officina. Se l'abbonamento è ATTIVO con una
  -- subscription e l'evento parla di un'altra (una vecchia annullata o scaduta dopo un nuovo checkout),
  -- l'evento non deve sovrascrivere quella buona: si ignora senza errore, così il webhook lo registra e
  -- risponde 200 e Stripe non lo rimanda. Con l'abbonamento SCADUTO o ANNULLATO la subscription nuova
  -- invece si salva (è il nuovo abbonamento dopo quello finito).
  if v_stato = 'ATTIVO'
     and v_sub is not null
     and p_subscription is not null
     and p_subscription <> v_sub then
    return;
  end if;

  begin
    update public.abbonamenti
    set stato = p_stato,
        piano = coalesce(p_piano, piano),
        stripe_customer_id = coalesce(p_customer, stripe_customer_id),
        stripe_subscription_id = coalesce(p_subscription, stripe_subscription_id)
    where officina_id = v_officina;
  exception
    -- stripe_subscription_id è unico: la subscription è già collegata all'abbonamento di un'altra officina.
    when unique_violation then
      raise exception 'SUBSCRIPTION_DI_ALTRA_OFFICINA';
  end;

  if not found then
    raise exception 'ABBONAMENTO_NON_TROVATO';
  end if;
end;
$$;

comment on function public.aggiorna_abbonamento_stripe(uuid, text, text, text, text) is
  'Service role: aggiorna stato, piano e riferimenti Stripe di un abbonamento (webhook di Stripe). Ignora gli eventi di un''altra subscription se l''abbonamento è ATTIVO (R30); SUBSCRIPTION_DI_ALTRA_OFFICINA se la subscription è di un''altra officina.';

-- Solo il service role (le Edge Functions di Stripe)
revoke execute on function public.aggiorna_abbonamento_stripe(uuid, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.aggiorna_abbonamento_stripe(uuid, text, text, text, text)
  to service_role;

-- ---------------------------------------------------------------------------------------------------
-- rifiuta_affiliazione: avvisa i membri e cancella l'officina IN_ATTESA
-- ---------------------------------------------------------------------------------------------------

create or replace function public.rifiuta_affiliazione(p_officina_id uuid, p_motivo text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_officina record;
begin
  if (select auth.uid()) is not null and not public.is_admin() then
    raise exception 'Accesso riservato' using errcode = '42501';
  end if;

  if char_length(v_motivo) > 300 then
    raise exception 'MOTIVO_TROPPO_LUNGO';
  end if;

  -- Blocca la riga: un'attivazione contemporanea aspetta (e poi non trova più l'officina) oppure passa
  -- prima, e allora qui lo stato è ATTIVA.
  select o.id, o.ragione_sociale, o.stato_affiliazione into v_officina
  from public.officine o
  where o.id = p_officina_id
  for update;

  if not found then
    raise exception 'OFFICINA_NON_TROVATA';
  end if;

  if v_officina.stato_affiliazione <> 'IN_ATTESA' then
    raise exception 'OFFICINA_NON_IN_ATTESA';
  end if;

  -- R30, dritta T189: con una subscription Stripe collegata (anche SCADUTO = past_due/unpaid, ancora
  -- viva) la cancellazione lascerebbe Stripe ad addebitare un'officina che non c'è più. Prima si annulla
  -- la subscription; poi il rifiuto.
  if exists (
    select 1
    from public.abbonamenti a
    where a.officina_id = p_officina_id
      and a.stripe_subscription_id is not null
  ) then
    raise exception 'ABBONAMENTO_STRIPE_PRESENTE';
  end if;

  -- Prima della cancellazione: dopo i membri non ci sono più. La notifica non dipende dall'officina.
  insert into public.notifiche (destinatario_id, tipo, titolo, testo, link)
  select
    m.profile_id,
    'AFFILIAZIONE_RIFIUTATA',
    'Richiesta non accettata',
    left(
      'La richiesta per ' || v_officina.ragione_sociale || ' non è stata accettata.'
        || coalesce(' Motivo: ' || v_motivo, ''),
      600
    ),
    '/officina/registra'
  from public.officina_utenti m
  where m.officina_id = p_officina_id;

  -- R24: officina, membri e dati collegati se ne vanno (on delete cascade); il ruolo dei titolari resta.
  delete from public.officine where id = p_officina_id;
end;
$$;

comment on function public.rifiuta_affiliazione(uuid, text) is
  'Rifiuta una richiesta di affiliazione: avvisa i membri e cancella l''officina IN_ATTESA (la partita IVA torna libera, R24). ABBONAMENTO_STRIPE_PRESENTE se l''officina ha una subscription Stripe (R30). Solo admin o senza utente.';

revoke execute on function public.rifiuta_affiliazione(uuid, text) from public, anon;
grant execute on function public.rifiuta_affiliazione(uuid, text) to authenticated;

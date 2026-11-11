-- T211: eventi di Stripe fuori ordine e un cliente Stripe per officina (R35; idee T211 e T213).
-- 1. abbonamenti.stripe_evento_il: il momento (`created`) dell'ultimo evento di Stripe applicato.
--    Un evento arrivato in ritardo (Stripe non garantisce l'ordine e ritenta per giorni) non riporta
--    l'abbonamento a uno stato vecchio.
-- 2. Indice unico parziale su stripe_customer_id: un cliente Stripe appartiene a una sola officina, così
--    la ricerca per cliente è certa.
-- 3. aggiorna_abbonamento_stripe_evento: funzione NUOVA (il corpo di T224 più il momento dell'evento).
--    Un parametro in più con `create or replace` creerebbe un secondo overload della vecchia e PostgREST
--    non saprebbe quale chiamare: per questo il nome è nuovo. La vecchia resta (niente drop).
-- 4. collega_cliente_stripe: stessa firma; il cliente di un'altra officina dà CLIENTE_STRIPE_DI_ALTRA_OFFICINA.
-- Solo aggiunte: una colonna nullable, un indice, una funzione; nessun dato cambia.

-- ---------------------------------------------------------------------------------------------------
-- Colonna e indice
-- ---------------------------------------------------------------------------------------------------

alter table public.abbonamenti add column stripe_evento_il timestamptz;

comment on column public.abbonamenti.stripe_evento_il is
  'Momento (created) dell''evento di Stripe più recente applicato all''abbonamento; gli eventi più vecchi si ignorano (T211).';

-- Un cliente Stripe per officina. Le righe senza cliente (null) restano libere.
create unique index abbonamenti_stripe_customer_id_unico
  on public.abbonamenti (stripe_customer_id)
  where stripe_customer_id is not null;

-- ---------------------------------------------------------------------------------------------------
-- Aggiornamento di stato e piano, con il momento dell'evento
-- ---------------------------------------------------------------------------------------------------
-- Come aggiorna_abbonamento_stripe (T224): l'abbonamento si cerca per officina; senza officina per
-- abbonamento Stripe; se non c'è, per cliente Stripe (ora unico). Lo stato PROVA lo decide TyreCare, non
-- Stripe; il piano PILOTA lo assegna solo l'ADMIN: Stripe può mandare solo STARTER o PRO (o niente).
-- In più p_evento_il (il `created` dell'evento): se è più vecchio dell'ultimo evento applicato, l'evento
-- si ignora senza errore (il webhook lo registra e risponde 200). Se manca, l'evento si applica.

create function public.aggiorna_abbonamento_stripe_evento(
  p_officina_id uuid,
  p_customer text,
  p_subscription text,
  p_stato text,
  p_piano text,
  p_evento_il timestamptz
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
  v_evento_il timestamptz;
  v_vincolo text;
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
    -- stripe_customer_id è unico (abbonamenti_stripe_customer_id_unico): al massimo una riga.
    select a.officina_id into v_officina
    from public.abbonamenti a
    where a.stripe_customer_id = p_customer;
  end if;

  -- Blocca la riga: due eventi contemporanei della stessa officina passano uno alla volta e il secondo
  -- vede stato e momento lasciati dal primo. Riga assente (o officina non trovata): ci pensa l'update qui
  -- sotto con ABBONAMENTO_NON_TROVATO.
  select a.stato, a.stripe_subscription_id, a.stripe_evento_il into v_stato, v_sub, v_evento_il
  from public.abbonamenti a
  where a.officina_id = v_officina
  for update;

  -- T211: evento più vecchio dell'ultimo applicato (arrivato in ritardo o rimandato da Stripe): non deve
  -- riportare l'abbonamento a uno stato superato. Si ignora senza errore. Uguale o più nuovo: si applica.
  if p_evento_il is not null
     and v_evento_il is not null
     and p_evento_il < v_evento_il then
    return;
  end if;

  -- R30, dritta T189: una sola subscription viva per officina. Se l'abbonamento è ATTIVO con una
  -- subscription e l'evento parla di un'altra (una vecchia annullata o scaduta dopo un nuovo checkout),
  -- l'evento non deve sovrascrivere quella buona: si ignora senza errore. Con l'abbonamento SCADUTO o
  -- ANNULLATO la subscription nuova invece si salva (è il nuovo abbonamento dopo quello finito).
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
        stripe_subscription_id = coalesce(p_subscription, stripe_subscription_id),
        -- Il momento non torna mai indietro; un evento senza momento non lo cancella.
        stripe_evento_il = greatest(coalesce(stripe_evento_il, p_evento_il), p_evento_il)
    where officina_id = v_officina;
  exception
    -- La subscription o il cliente Stripe sono già collegati all'abbonamento di un'altra officina
    -- (dritta T217: si distingue il vincolo). Un altro vincolo non si traduce: l'errore resta quello.
    when unique_violation then
      get stacked diagnostics v_vincolo = constraint_name;
      if v_vincolo = 'abbonamenti_stripe_subscription_id_key' then
        raise exception 'SUBSCRIPTION_DI_ALTRA_OFFICINA';
      elsif v_vincolo = 'abbonamenti_stripe_customer_id_unico' then
        raise exception 'CLIENTE_STRIPE_DI_ALTRA_OFFICINA';
      end if;
      raise;
  end;

  if not found then
    raise exception 'ABBONAMENTO_NON_TROVATO';
  end if;
end;
$$;

comment on function public.aggiorna_abbonamento_stripe_evento(uuid, text, text, text, text, timestamptz) is
  'Service role: aggiorna stato, piano e riferimenti Stripe di un abbonamento (webhook di Stripe). Ignora gli eventi più vecchi dell''ultimo applicato (T211) e quelli di un''altra subscription se l''abbonamento è ATTIVO (R30); SUBSCRIPTION_DI_ALTRA_OFFICINA o CLIENTE_STRIPE_DI_ALTRA_OFFICINA se subscription o cliente sono di un''altra officina.';

-- Solo il service role (le Edge Functions di Stripe)
revoke execute on function public.aggiorna_abbonamento_stripe_evento(uuid, text, text, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.aggiorna_abbonamento_stripe_evento(uuid, text, text, text, text, timestamptz)
  to service_role;

-- La vecchia resta (zona vietata: niente drop) ma il webhook non la chiama più.
comment on function public.aggiorna_abbonamento_stripe(uuid, text, text, text, text) is
  'Sostituita da aggiorna_abbonamento_stripe_evento (T211): il webhook non la chiama più. Service role: aggiorna stato, piano e riferimenti Stripe di un abbonamento senza controllare l''ordine degli eventi.';

-- ---------------------------------------------------------------------------------------------------
-- Collegamento del cliente Stripe
-- ---------------------------------------------------------------------------------------------------
-- Come in 20261102000100: il cliente si collega una volta sola; se l'abbonamento ne ha già un altro,
-- errore (mai sovrascritto); richiamarla con lo stesso cliente non cambia niente. In più: un cliente già
-- collegato a un'altra officina dà CLIENTE_STRIPE_DI_ALTRA_OFFICINA (indice unico nuovo).

create or replace function public.collega_cliente_stripe(p_officina_id uuid, p_customer text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attuale text;
  v_vincolo text;
begin
  select a.stripe_customer_id into v_attuale
  from public.abbonamenti a
  where a.officina_id = p_officina_id
  for update;

  if not found then
    raise exception 'ABBONAMENTO_NON_TROVATO';
  end if;

  if v_attuale is null then
    begin
      update public.abbonamenti
      set stripe_customer_id = p_customer
      where officina_id = p_officina_id;
    exception
      when unique_violation then
        get stacked diagnostics v_vincolo = constraint_name;
        if v_vincolo = 'abbonamenti_stripe_customer_id_unico' then
          raise exception 'CLIENTE_STRIPE_DI_ALTRA_OFFICINA';
        end if;
        raise;
    end;
  elsif v_attuale is distinct from p_customer then
    raise exception 'CLIENTE_STRIPE_DIVERSO';
  end if;
end;
$$;

comment on function public.collega_cliente_stripe(uuid, text) is
  'Service role: collega il cliente Stripe all''abbonamento dell''officina (solo se non ne ha già un altro); CLIENTE_STRIPE_DI_ALTRA_OFFICINA se il cliente è già di un''altra officina.';

-- Solo il service role (le Edge Functions di Stripe), come prima.
revoke execute on function public.collega_cliente_stripe(uuid, text)
  from public, anon, authenticated;
grant execute on function public.collega_cliente_stripe(uuid, text) to service_role;

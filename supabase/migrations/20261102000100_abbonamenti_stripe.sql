-- T180 (R22, prima parte di T071): il database per Stripe.
-- Le Edge Functions di Stripe (T185 checkout, T189 webhook) girano con il service role e usano:
--   - stripe_eventi: gli eventi del webhook già ricevuti (Stripe può mandare lo stesso evento più volte);
--   - collega_cliente_stripe: collega il cliente Stripe all'abbonamento dell'officina;
--   - aggiorna_abbonamento_stripe: aggiorna stato e piano quando Stripe lo dice;
--   - registra_evento_stripe: segna un evento come ricevuto (true la prima volta, false le successive).
-- Nessun utente dell'app (anon, authenticated) può chiamare le funzioni o leggere la tabella: solo il
-- service role. Ogni notte un job cancella gli eventi più vecchi di 30 giorni.
-- Nessuna tabella e nessun dato esistenti cambiano.
-- Per cambiare: migrazione nuova con `create or replace function`; il job si toglie con
-- `cron.unschedule('pulizia-eventi-stripe')`.

-- ---------------------------------------------------------------------------------------------------
-- Eventi di Stripe già ricevuti
-- ---------------------------------------------------------------------------------------------------

create table public.stripe_eventi (
  id text primary key,
  tipo text not null,
  ricevuto_il timestamptz not null default now()
);

comment on table public.stripe_eventi is
  'Eventi del webhook di Stripe già ricevuti (per non elaborarli due volte). Solo service role.';

-- RLS attiva e nessuna policy: gli utenti dell'app non vedono niente; il service role non passa dall'RLS.
alter table public.stripe_eventi enable row level security;

revoke all on table public.stripe_eventi from public, anon, authenticated;
grant select, insert, update, delete on table public.stripe_eventi to service_role;

-- ---------------------------------------------------------------------------------------------------
-- Collegamento del cliente Stripe
-- ---------------------------------------------------------------------------------------------------
-- Il cliente si collega una volta sola: se l'abbonamento ne ha già un altro, errore (mai sovrascritto).
-- Richiamarla con lo stesso cliente non cambia niente.

create function public.collega_cliente_stripe(p_officina_id uuid, p_customer text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attuale text;
begin
  select a.stripe_customer_id into v_attuale
  from public.abbonamenti a
  where a.officina_id = p_officina_id
  for update;

  if not found then
    raise exception 'ABBONAMENTO_NON_TROVATO';
  end if;

  if v_attuale is null then
    update public.abbonamenti
    set stripe_customer_id = p_customer
    where officina_id = p_officina_id;
  elsif v_attuale is distinct from p_customer then
    raise exception 'CLIENTE_STRIPE_DIVERSO';
  end if;
end;
$$;

comment on function public.collega_cliente_stripe(uuid, text) is
  'Service role: collega il cliente Stripe all''abbonamento dell''officina (solo se non ne ha già un altro).';

-- ---------------------------------------------------------------------------------------------------
-- Aggiornamento di stato e piano
-- ---------------------------------------------------------------------------------------------------
-- L'abbonamento si cerca per officina; senza officina per abbonamento Stripe; se non c'è, per cliente
-- Stripe (solo se il cliente è collegato a un abbonamento soltanto). Lo stato PROVA lo decide TyreCare,
-- non Stripe; il piano PILOTA lo assegna solo l'ADMIN: Stripe può mandare solo STARTER o PRO (o niente,
-- e il piano resta quello che è).

create function public.aggiorna_abbonamento_stripe(
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

  update public.abbonamenti
  set stato = p_stato,
      piano = coalesce(p_piano, piano),
      stripe_customer_id = coalesce(p_customer, stripe_customer_id),
      stripe_subscription_id = coalesce(p_subscription, stripe_subscription_id)
  where officina_id = v_officina;

  if not found then
    raise exception 'ABBONAMENTO_NON_TROVATO';
  end if;
end;
$$;

comment on function public.aggiorna_abbonamento_stripe(uuid, text, text, text, text) is
  'Service role: aggiorna stato, piano e riferimenti Stripe di un abbonamento (webhook di Stripe).';

-- ---------------------------------------------------------------------------------------------------
-- Eventi ricevuti
-- ---------------------------------------------------------------------------------------------------
-- true se l'evento è nuovo (da elaborare), false se era già stato ricevuto. Regge due chiamate
-- contemporanee: la chiave primaria fa vincere una sola delle due.

create function public.registra_evento_stripe(p_id text, p_tipo text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.stripe_eventi (id, tipo)
  values (p_id, p_tipo)
  on conflict (id) do nothing;

  return found;
end;
$$;

comment on function public.registra_evento_stripe(text, text) is
  'Service role: registra un evento di Stripe; true se è nuovo, false se era già stato ricevuto.';

-- Solo il service role (le Edge Functions di Stripe)
revoke execute on function public.collega_cliente_stripe(uuid, text)
  from public, anon, authenticated;
revoke execute on function public.aggiorna_abbonamento_stripe(uuid, text, text, text, text)
  from public, anon, authenticated;
revoke execute on function public.registra_evento_stripe(text, text)
  from public, anon, authenticated;

grant execute on function public.collega_cliente_stripe(uuid, text) to service_role;
grant execute on function public.aggiorna_abbonamento_stripe(uuid, text, text, text, text)
  to service_role;
grant execute on function public.registra_evento_stripe(text, text) to service_role;

-- ---------------------------------------------------------------------------------------------------
-- Pulizia notturna degli eventi
-- ---------------------------------------------------------------------------------------------------
-- Stripe rimanda un evento al massimo per 3 giorni: dopo 30 giorni il ricordo non serve più.
-- Restituisce quanti eventi ha cancellato. `p_adesso` serve ai test.

create function public.pulisci_eventi_stripe(p_adesso timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quanti integer;
begin
  delete from public.stripe_eventi
  where ricevuto_il < p_adesso - interval '30 days';

  get diagnostics v_quanti = row_count;
  return v_quanti;
end;
$$;

comment on function public.pulisci_eventi_stripe(timestamptz) is
  'Job notturno: cancella gli eventi di Stripe ricevuti più di 30 giorni fa.';

-- La chiama solo il job
revoke execute on function public.pulisci_eventi_stripe(timestamptz)
  from public, anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;

-- Ogni notte alle 0:35 (UTC)
select cron.schedule(
  'pulizia-eventi-stripe',
  '35 0 * * *',
  $$select public.pulisci_eventi_stripe()$$
);

-- Fase 5 — Web Push (P21): ogni nuova notifica parte anche verso i dispositivi dell'utente.
--
-- - `iscrizioni_push`: un dispositivo/browser che ha dato il permesso (endpoint + chiavi del browser).
--   Ognuno vede, aggiunge ed elimina solo le proprie.
-- - Trigger su `notifiche`: chiama con `pg_net` (asincrono, non rallenta la transazione) la Edge
--   Function `invia-notifica`, che manda la push con le chiavi VAPID. Indirizzo della funzione e
--   segreto condiviso sono nel Vault di Supabase (`url_invia_notifica`, `segreto_invia_notifica`): se
--   mancano (es. database locale) il trigger non fa nulla e restano le notifiche nell'app.

create extension if not exists pg_net with schema extensions;

create table public.iscrizioni_push (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://'),
  p256dh text not null check (char_length(p256dh) between 1 and 200),
  auth text not null check (char_length(auth) between 1 and 100),
  created_at timestamptz not null default now()
);

create index iscrizioni_push_profile_id_idx on public.iscrizioni_push (profile_id);

comment on table public.iscrizioni_push is
  'Dispositivi iscritti alle notifiche push (Web Push) di un utente.';

alter table public.iscrizioni_push enable row level security;

create policy "iscrizioni_push: lettura propria"
  on public.iscrizioni_push for select to authenticated
  using (profile_id = (select auth.uid()));

create policy "iscrizioni_push: inserimento propria"
  on public.iscrizioni_push for insert to authenticated
  with check (profile_id = (select auth.uid()));

create policy "iscrizioni_push: eliminazione propria"
  on public.iscrizioni_push for delete to authenticated
  using (profile_id = (select auth.uid()));

revoke update on public.iscrizioni_push from anon, authenticated;

-- Lo stesso browser che si iscrive di nuovo (o con un altro account sullo stesso dispositivo): si
-- sostituisce l'iscrizione vecchia, che non è visibile a chi chiama (RLS) e bloccherebbe l'unicità.
create function public.iscrivi_push(p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Accesso richiesto' using errcode = '42501';
  end if;
  delete from public.iscrizioni_push where endpoint = p_endpoint;
  insert into public.iscrizioni_push (profile_id, endpoint, p256dh, auth)
  values ((select auth.uid()), p_endpoint, p_p256dh, p_auth);
end;
$$;

revoke execute on function public.iscrivi_push(text, text, text) from public, anon;
grant execute on function public.iscrivi_push(text, text, text) to authenticated;

create function public.invia_notifica_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_segreto text;
begin
  if not exists (select 1 from public.iscrizioni_push where profile_id = new.destinatario_id) then
    return new;
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'url_invia_notifica';
  select decrypted_secret into v_segreto from vault.decrypted_secrets
  where name = 'segreto_invia_notifica';
  if v_url is null or v_segreto is null then
    return new;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-segreto', v_segreto),
    body := jsonb_build_object('notifica_id', new.id)
  );
  return new;
end;
$$;

create trigger notifiche_push
  after insert on public.notifiche
  for each row execute function public.invia_notifica_push();

revoke execute on function public.invia_notifica_push() from public, anon, authenticated;

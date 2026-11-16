-- Autenticazione a due fattori (TOTP di Supabase Auth).
-- - `is_admin()`: vero solo con ruolo ADMIN **e** sessione al secondo livello (`aal2`). Un
--   amministratore senza 2FA, o che non ha ancora inserito il codice, per il database è un utente
--   qualsiasi: una password rubata da sola non apre i dati di tutte le officine.
-- - Chi ha attivato la 2FA (qualsiasi ruolo) deve avere una sessione `aal2` per leggere e scrivere:
--   lo garantiscono una policy restrittiva su ogni tabella (vale anche per Realtime) e il controllo
--   prima di ogni richiesta dell'API (`db_pre_request`, vale anche per le funzioni).

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2'
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and ruolo = 'ADMIN'
    );
$$;

-- Vero se la sessione rispetta la 2FA: è `aal2`, oppure l'utente non ha un fattore verificato.
create function public.mfa_soddisfatta()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2'
    or not exists (
      select 1 from auth.mfa_factors f
      where f.user_id = (select auth.uid()) and f.status = 'verified'
    );
$$;
revoke execute on function public.mfa_soddisfatta() from public, anon;
grant execute on function public.mfa_soddisfatta() to authenticated, service_role;

-- Policy restrittiva su tutte le tabelle con RLS (anche quelle create da altre migrazioni)
do $$
declare
  t record;
begin
  for t in
    select c.relname
    from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and c.relrowsecurity
      -- una tabella senza policy è già chiusa a tutti
      and exists (select 1 from pg_policy p where p.polrelid = c.oid)
  loop
    execute format(
      'create policy "2fa: sessione al secondo livello" on public.%I as restrictive for all to authenticated using ((select public.mfa_soddisfatta())) with check ((select public.mfa_soddisfatta()))',
      t.relname
    );
  end loop;
end;
$$;

-- Controllo prima di ogni richiesta dell'API (PostgREST): copre anche le funzioni `security definer`
create function public.controlla_richiesta()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.role()) = 'authenticated' and not public.mfa_soddisfatta() then
    raise exception 'MFA_RICHIESTA' using errcode = '42501';
  end if;
end;
$$;
revoke execute on function public.controlla_richiesta() from public;
grant execute on function public.controlla_richiesta() to anon, authenticated, service_role;

do $$
begin
  alter role authenticator set pgrst.db_pre_request = 'public.controlla_richiesta';
  notify pgrst, 'reload config';
exception
  when insufficient_privilege then
    raise warning 'db_pre_request non impostato: eseguire a mano (DOCS/SICUREZZA.md)';
end;
$$;

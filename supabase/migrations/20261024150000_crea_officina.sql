-- T027: crea un'officina con il suo titolare con una sola chiamata (pilota: LA SANTI GOMME).
-- Permessa a chi non ha un utente (editor SQL di Supabase, service role) e agli amministratori.
-- Errori attesi (messaggio = chiave, codice P0001): ACCOUNT_NON_TROVATO, PARTITA_IVA_GIA_PRESENTE.
-- Nessuna tabella cambia. Un'officina IN_ATTESA non è visibile ai clienti ma il titolare la usa già.

create function public.crea_officina_con_titolare(
  p_ragione_sociale text,
  p_partita_iva text,
  p_email_titolare text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ragione_sociale text := trim(coalesce(p_ragione_sociale, ''));
  v_partita_iva text := trim(coalesce(p_partita_iva, ''));
  v_profile_id uuid;
  v_officina_id uuid;
begin
  if (select auth.uid()) is not null and not public.is_admin() then
    raise exception 'Accesso riservato' using errcode = '42501';
  end if;

  select u.id into v_profile_id
  from auth.users u
  where lower(u.email) = lower(trim(coalesce(p_email_titolare, '')))
  limit 1;

  if v_profile_id is null then
    raise exception 'ACCOUNT_NON_TROVATO';
  end if;

  if exists (select 1 from public.officine where partita_iva = v_partita_iva) then
    raise exception 'PARTITA_IVA_GIA_PRESENTE';
  end if;

  insert into public.officine (ragione_sociale, partita_iva)
  values (v_ragione_sociale, v_partita_iva)
  returning id into v_officina_id;

  -- Un ADMIN (o chi è già OFFICINA) resta com'è: si promuove solo un CLIENTE.
  update public.profiles set ruolo = 'OFFICINA' where id = v_profile_id and ruolo = 'CLIENTE';

  insert into public.officina_utenti (officina_id, profile_id, ruolo)
  values (v_officina_id, v_profile_id, 'TITOLARE');

  return v_officina_id;
end;
$$;

comment on function public.crea_officina_con_titolare(text, text, text) is
  'Crea un''officina (IN_ATTESA) e ne fa titolare l''account con quell''email. Solo admin o senza utente.';

revoke execute on function public.crea_officina_con_titolare(text, text, text) from public, anon;
grant execute on function public.crea_officina_con_titolare(text, text, text) to authenticated;

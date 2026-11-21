-- T350 (R46, idea T316): un invito già usato vale come annullato quando il cliente non è più collegato
-- all'account che l'ha usato.
--
-- Prima di questa migrazione info_invito diceva USATO (e usato_da_te = vero) per ogni invito con
-- usato_il, anche dopo che l'officina aveva scollegato il cliente (scollega_cliente) o lo aveva
-- ricollegato a un altro account: chi riapriva il link leggeva «I veicoli … sono già nel tuo garage»,
-- che non era più vero, e accetta_invito gli restituiva il nome dell'officina come se fosse collegato.
--
-- Ora un invito usato il cui cliente (clienti_officina.profile_id) non è più usato_da è ANNULLATO:
-- info_invito restituisce stato = 'ANNULLATO' e usato_da_te = falso, accetta_invito dà
-- INVITO_ANNULLATO (anche allo stesso account, che deve chiedere un invito nuovo). Un invito usato con il
-- cliente ancora collegato a usato_da resta USATO come prima (stesso account: nome dell'officina; un
-- altro account: INVITO_GIA_USATO). La riga dell'invito non cambia: lo stato si calcola alla lettura.
--
-- Il resto è identico a 20261010120000_inviti_cliente.sql: firme, language, stable di info_invito,
-- security definer, search_path, permessi. Nessuna tabella e nessuna colonna cambiano.

create or replace function public.info_invito(p_codice text)
returns table (
  officina text,
  email text,
  stato text,
  scade_il timestamptz,
  usato_da_te boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    o.ragione_sociale,
    i.email,
    case
      when i.usato_il is not null and c.profile_id is distinct from i.usato_da then 'ANNULLATO'
      when i.usato_il is not null then 'USATO'
      when i.annullato_il is not null then 'ANNULLATO'
      when i.scade_il < now() then 'SCADUTO'
      else 'VALIDO'
    end,
    i.scade_il,
    coalesce(i.usato_da = (select auth.uid()) and c.profile_id is not distinct from i.usato_da, false)
  from public.inviti_cliente i
  join public.officine o on o.id = i.officina_id
  left join public.clienti_officina c on c.id = i.cliente_officina_id
  where i.codice_hash = public.impronta_codice(p_codice);
$$;

create or replace function public.accetta_invito(p_codice text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_invito public.inviti_cliente;
  v_email text;
  v_profile_id uuid;
  v_officina text;
begin
  if v_uid is null then
    raise exception 'Accesso richiesto' using errcode = '42501';
  end if;

  select * into v_invito
  from public.inviti_cliente i
  where i.codice_hash = public.impronta_codice(p_codice)
  for update;
  if not found then
    raise exception 'INVITO_NON_VALIDO';
  end if;

  select o.ragione_sociale into v_officina from public.officine o where o.id = v_invito.officina_id;

  if v_invito.usato_il is not null then
    -- Il cliente non è più collegato a chi ha usato l'invito (scollegato o ricollegato a un altro
    -- account): l'invito vale come annullato, anche per lo stesso account.
    select c.profile_id into v_profile_id
    from public.clienti_officina c
    where c.id = v_invito.cliente_officina_id
    for update;
    if v_profile_id is distinct from v_invito.usato_da then
      raise exception 'INVITO_ANNULLATO';
    end if;
    if v_invito.usato_da = v_uid then
      return v_officina;
    end if;
    raise exception 'INVITO_GIA_USATO';
  end if;
  if v_invito.annullato_il is not null then
    raise exception 'INVITO_ANNULLATO';
  end if;
  if v_invito.scade_il < now() then
    raise exception 'INVITO_SCADUTO';
  end if;

  -- Solo l'account con la stessa email, confermata
  select lower(u.email) into v_email
  from auth.users u
  where u.id = v_uid and u.email_confirmed_at is not null;
  if v_email is distinct from v_invito.email then
    raise exception 'EMAIL_DIVERSA';
  end if;

  select c.profile_id into v_profile_id
  from public.clienti_officina c
  where c.id = v_invito.cliente_officina_id
  for update;
  if v_profile_id is not null and v_profile_id <> v_uid then
    raise exception 'CLIENTE_GIA_COLLEGATO';
  end if;

  update public.clienti_officina set profile_id = v_uid where id = v_invito.cliente_officina_id;
  update public.inviti_cliente set usato_il = now(), usato_da = v_uid where id = v_invito.id;

  return v_officina;
end;
$$;

revoke execute on function public.info_invito(text) from public;
revoke execute on function public.accetta_invito(text) from public, anon;
grant execute on function public.info_invito(text) to anon, authenticated;
grant execute on function public.accetta_invito(text) to authenticated;

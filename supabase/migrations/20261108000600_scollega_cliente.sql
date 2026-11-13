-- T258: scollegare l'account di un cliente (R38). Serve quando l'invito è stato accettato dalla persona
-- sbagliata: il titolare rimette `clienti_officina.profile_id` a vuoto senza chiedere a TyreCare.
--
-- Chi può: il TITOLARE dell'officina del cliente e l'ADMIN; anche chi non ha un utente (editor SQL di
-- Supabase, service role), come attiva_officina. anon non ha EXECUTE. L'operatore, il cliente stesso e
-- i titolari di altre officine ricevono 42501.
-- Errori attesi (messaggio = chiave, codice P0001): CLIENTE_NON_TROVATO, CLIENTE_NON_COLLEGATO.
-- Per chi non è ADMIN un cliente inesistente è 42501 come un cliente di un'altra officina (come in
-- crea_invito_cliente): un estraneo non scopre quali clienti esistono. CLIENTE_NON_TROVATO lo vedono
-- solo ADMIN e chi non ha un utente.
--
-- Il trigger proteggi_collegamento_cliente continua a vietare agli utenti l'update diretto di
-- profile_id: qui la scrittura passa perché la funzione è security definer e current_user è il suo
-- proprietario, non `authenticated`.
--
-- Nessuna tabella e nessun dato esistente cambiano. La funzione tocca solo profile_id del cliente:
-- prenotazioni, notifiche e inviti (anche quelli già usati) restano come sono; il cliente si può
-- invitare di nuovo con crea_invito_cliente. Nessun avviso al cliente (R38).

create function public.scollega_cliente(p_cliente_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_officina_id uuid;
  v_profile_id uuid;
begin
  select c.officina_id into v_officina_id
  from public.clienti_officina c
  where c.id = p_cliente_id;

  -- Prima i permessi: per chi non è ADMIN, inesistente e di un'altra officina danno lo stesso errore.
  if v_uid is not null and not public.is_admin()
    and (v_officina_id is null or not public.is_titolare_officina(v_officina_id)) then
    raise exception 'Accesso riservato' using errcode = '42501';
  end if;

  if v_officina_id is null then
    raise exception 'CLIENTE_NON_TROVATO';
  end if;

  -- Blocca la riga: un accetta_invito in corso sullo stesso cliente aspetta (o viene aspettato).
  select c.profile_id into v_profile_id
  from public.clienti_officina c
  where c.id = p_cliente_id
  for update;
  if not found then
    raise exception 'CLIENTE_NON_TROVATO';
  end if;
  if v_profile_id is null then
    raise exception 'CLIENTE_NON_COLLEGATO';
  end if;

  update public.clienti_officina set profile_id = null where id = p_cliente_id;
end;
$$;

comment on function public.scollega_cliente(uuid) is
  'Toglie l''account collegato al cliente (profile_id vuoto). Solo titolare, admin o senza utente. Prenotazioni, notifiche e inviti già usati non cambiano.';

revoke execute on function public.scollega_cliente(uuid) from public, anon;
grant execute on function public.scollega_cliente(uuid) to authenticated;

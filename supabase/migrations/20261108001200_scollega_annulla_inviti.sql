-- T277 (R42): scollegare un cliente annulla anche i suoi inviti ancora aperti.
--
-- Prima di questa migrazione scollega_cliente toglieva solo profile_id: un invito non usato, non
-- annullato e non scaduto restava valido, e chi lo aveva (per esempio la persona sbagliata che aveva
-- accettato l'invito precedente, o chi aveva ricevuto il link inoltrato) poteva ricollegarsi da solo.
-- Ora, nello stesso blocco dell'update di profile_id, gli inviti aperti del cliente prendono
-- annullato_il = now(), come fa crea_invito_cliente con quelli superati: accetta_invito risponde
-- INVITO_ANNULLATO.
--
-- Il resto è identico a 20261108000600_scollega_cliente.sql: firma, security definer, search_path,
-- permessi (titolare, admin, chi non ha un utente; 42501 agli altri) ed errori (CLIENTE_NON_TROVATO,
-- CLIENTE_NON_COLLEGATO). Gli errori arrivano prima dell'annullo: un cliente non collegato non perde i
-- suoi inviti. Gli inviti già usati non cambiano; un invito creato dopo lo scollegamento vale come
-- sempre (il cliente si può invitare di nuovo). Nessuna tabella e nessuna colonna cambiano.

create or replace function public.scollega_cliente(p_cliente_id uuid)
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

  -- Un vecchio invito ancora aperto non deve ricollegare nessuno (R42)
  update public.inviti_cliente
  set annullato_il = now()
  where cliente_officina_id = p_cliente_id and usato_il is null and annullato_il is null;
end;
$$;

comment on function public.scollega_cliente(uuid) is
  'Toglie l''account collegato al cliente (profile_id vuoto) e annulla i suoi inviti ancora aperti. Solo titolare, admin o senza utente. Prenotazioni, notifiche e inviti già usati non cambiano.';

revoke execute on function public.scollega_cliente(uuid) from public, anon;
grant execute on function public.scollega_cliente(uuid) to authenticated;

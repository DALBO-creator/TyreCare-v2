-- T073: unisci_clienti annulla gli inviti diventati inutili.
-- Dopo l'unione la scheda p_in riceve anche gli inviti di p_da. Tra quelli ancora aperti (non usati,
-- non annullati, non scaduti):
-- - se p_in risulta collegata a un account, si annullano tutti (accettarli darebbe solo un errore);
-- - altrimenti resta aperto solo il più recente (created_at, poi id), come quando si crea un invito nuovo.
-- Il resto della funzione è identico a T031 (20261024160000_unisci_clienti.sql).
-- Nessuna tabella cambia e la migrazione non tocca dati esistenti.
-- Errori attesi (messaggio = chiave, codice P0001): CLIENTI_NON_VALIDI, ACCOUNT_DIVERSI.
-- Senza utente o senza essere titolare dell'officina: 42501.

create or replace function public.unisci_clienti(p_da uuid, p_in uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_da public.clienti_officina;
  v_in public.clienti_officina;
  v_note text;
  v_profile_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Accesso riservato' using errcode = '42501';
  end if;

  if p_da is null or p_in is null or p_da = p_in then
    raise exception 'CLIENTI_NON_VALIDI';
  end if;

  -- Blocco le due righe sempre nello stesso ordine: due unioni simultanee non si bloccano a vicenda.
  perform 1 from public.clienti_officina where id in (p_da, p_in) order by id for update;
  select * into v_da from public.clienti_officina where id = p_da;
  select * into v_in from public.clienti_officina where id = p_in;

  if v_da.id is null or v_in.id is null or v_da.officina_id <> v_in.officina_id then
    raise exception 'CLIENTI_NON_VALIDI';
  end if;

  if not public.is_titolare_officina(v_in.officina_id) then
    raise exception 'Accesso riservato' using errcode = '42501';
  end if;

  if v_da.profile_id is not null and v_in.profile_id is not null
    and v_da.profile_id <> v_in.profile_id then
    raise exception 'ACCOUNT_DIVERSI';
  end if;

  v_note := left(
    concat_ws(E'\n', nullif(v_in.note, ''), nullif(v_da.note, '')),
    2000
  );
  v_profile_id := coalesce(v_in.profile_id, v_da.profile_id);

  update public.veicoli set cliente_officina_id = p_in where cliente_officina_id = p_da;
  update public.inviti_cliente set cliente_officina_id = p_in where cliente_officina_id = p_da;

  -- Prima elimino p_da: codice_gestionale è unico per officina.
  delete from public.clienti_officina where id = p_da;

  update public.clienti_officina set
    profile_id = v_profile_id,
    codice_gestionale = coalesce(nullif(v_in.codice_gestionale, ''), v_da.codice_gestionale),
    telefono = coalesce(nullif(v_in.telefono, ''), v_da.telefono),
    email = coalesce(nullif(v_in.email, ''), v_da.email),
    ragione_sociale = coalesce(nullif(v_in.ragione_sociale, ''), v_da.ragione_sociale),
    nome = coalesce(nullif(v_in.nome, ''), v_da.nome),
    cognome = coalesce(nullif(v_in.cognome, ''), v_da.cognome),
    note = v_note,
    consenso_marketing = v_in.consenso_marketing or v_da.consenso_marketing
  where id = p_in;

  -- Inviti aperti di p_in (ora comprende quelli di p_da): con un account collegato non servono più;
  -- senza, ne resta aperto solo il più recente.
  update public.inviti_cliente i set annullato_il = now()
  where i.cliente_officina_id = p_in
    and i.usato_il is null and i.annullato_il is null and i.scade_il > now()
    and (
      v_profile_id is not null
      or i.id is distinct from (
        select r.id from public.inviti_cliente r
        where r.cliente_officina_id = p_in
          and r.usato_il is null and r.annullato_il is null and r.scade_il > now()
        order by r.created_at desc, r.id desc
        limit 1
      )
    );
end;
$$;

comment on function public.unisci_clienti(uuid, uuid) is
  'Unisce il cliente p_da in p_in (stessa officina, solo titolare): sposta veicoli e inviti, completa i campi vuoti, annulla gli inviti inutili.';

revoke execute on function public.unisci_clienti(uuid, uuid) from public, anon;
grant execute on function public.unisci_clienti(uuid, uuid) to authenticated;

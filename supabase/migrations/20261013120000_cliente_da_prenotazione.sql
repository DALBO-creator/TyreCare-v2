-- Cliente e veicolo dalla richiesta di appuntamento (Fase 4).
--
-- Chi prenota dall'app può non essere ancora cliente dell'officina. Dal dettaglio della richiesta chi
-- lavora in officina registra il veicolo con un tocco:
-- - se l'account di chi ha prenotato è già collegato a un cliente dell'officina, il veicolo va a lui;
-- - altrimenti si crea il cliente (nome e cognome del profilo, telefono della richiesta, email
--   confermata dell'account) **già collegato all'account**: il veicolo compare subito nel suo garage.
--
-- Il collegamento senza invito è sicuro perché cliente e veicolo nascono qui, dai dati che la persona
-- stessa ha mandato con la richiesta: non c'è uno storico di qualcun altro da mostrarle. Se la targa è
-- già registrata nell'officina la funzione si ferma (VEICOLO_GIA_REGISTRATO): quel veicolo ha già un
-- cliente e uno storico, e per collegarlo all'account resta l'invito via email (stessa email
-- confermata).
--
-- `security definer` serve solo per scrivere `profile_id` (il trigger `proteggi_collegamento_cliente`
-- lo vieta agli utenti) e per leggere profilo ed email di chi ha prenotato: i permessi li controlla la
-- funzione (membro dell'officina della richiesta). Gli id li sceglie il web, così una ripetizione dopo
-- un errore di rete riconosce il veicolo già creato (come le altre scritture, vedi
-- `20261008130000_scritture_ripetibili.sql`).

create function public.registra_cliente_da_prenotazione(
  p_prenotazione uuid,
  p_cliente_id uuid,
  p_veicolo_id uuid,
  p_marca text,
  p_modello text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pren public.prenotazioni;
  v_cliente uuid;
  v_nome text;
  v_cognome text;
  v_email text;
begin
  select * into v_pren from public.prenotazioni p where p.id = p_prenotazione;
  if not found or not public.is_membro_officina(v_pren.officina_id) then
    raise exception 'PRENOTAZIONE_NON_TROVATA';
  end if;

  -- Ripetizione dopo un errore di rete: il veicolo è già stato creato
  if exists (
    select 1 from public.veicoli v
    where v.id = p_veicolo_id and v.officina_id = v_pren.officina_id and v.targa = v_pren.targa
  ) then
    return p_veicolo_id;
  end if;

  if v_pren.stato in ('RIFIUTATA', 'ANNULLATA') then
    raise exception 'PRENOTAZIONE_CHIUSA';
  end if;
  if exists (
    select 1 from public.veicoli v
    where v.officina_id = v_pren.officina_id and v.targa = v_pren.targa
  ) then
    raise exception 'VEICOLO_GIA_REGISTRATO';
  end if;

  select c.id into v_cliente
  from public.clienti_officina c
  where c.officina_id = v_pren.officina_id and c.profile_id = v_pren.cliente_id
  order by c.created_at
  limit 1;

  if v_cliente is null then
    select pr.nome, pr.cognome into v_nome, v_cognome
    from public.profiles pr
    where pr.id = v_pren.cliente_id;
    select lower(u.email) into v_email
    from auth.users u
    where u.id = v_pren.cliente_id and u.email_confirmed_at is not null;

    insert into public.clienti_officina (id, officina_id, profile_id, nome, cognome, telefono, email)
    values (
      p_cliente_id, v_pren.officina_id, v_pren.cliente_id,
      left(coalesce(v_nome, ''), 100), left(coalesce(v_cognome, ''), 100),
      v_pren.telefono_cliente, v_email
    );
    v_cliente := p_cliente_id;
  end if;

  insert into public.veicoli (id, officina_id, cliente_officina_id, targa, marca, modello)
  values (
    p_veicolo_id, v_pren.officina_id, v_cliente, v_pren.targa,
    left(trim(coalesce(p_marca, '')), 50), left(trim(coalesce(p_modello, '')), 100)
  );
  return p_veicolo_id;
end;
$$;

comment on function public.registra_cliente_da_prenotazione(uuid, uuid, uuid, text, text) is
  'Registra il veicolo di una richiesta di appuntamento, creando se serve il cliente collegato all''account.';

revoke execute on function public.registra_cliente_da_prenotazione(uuid, uuid, uuid, text, text)
  from public, anon;
grant execute on function public.registra_cliente_da_prenotazione(uuid, uuid, uuid, text, text)
  to authenticated;

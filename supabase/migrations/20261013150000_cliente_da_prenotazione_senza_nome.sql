-- Correzione di `registra_cliente_da_prenotazione` (sessione 15, provata dal telefono dal titolare).
--
-- Un account senza nome e cognome nel profilo (es. creato dalla dashboard di Supabase) faceva fallire
-- la creazione del cliente con il vincolo `clienti_officina_nominativo` ("Qualcosa è andato storto").
-- Ora il nome di ripiego è la parte dell'email prima della @ ("mario.rossi"), che l'officina può
-- correggere; senza email confermata, "Cliente". Il resto della funzione è invariato.

create or replace function public.registra_cliente_da_prenotazione(
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

    -- Profilo senza nome (es. account creato dalla dashboard): il nominativo è obbligatorio
    -- (`clienti_officina_nominativo`), quindi si usa la parte dell'email prima della @
    if trim(coalesce(v_nome, '')) = '' and trim(coalesce(v_cognome, '')) = '' then
      v_nome := coalesce(nullif(split_part(v_email, '@', 1), ''), 'Cliente');
    end if;

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

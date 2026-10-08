-- Scritture ripetibili senza doppioni (2026-10-08).
--
-- Sul telefono la prima scrittura dopo qualche minuto di inattività può fallire per un errore di rete
-- (connessione chiusa nel frattempo): il browser ripete da solo le letture, non le scritture. Il web
-- ripete allora una volta la richiesta, e per farlo senza rischio di doppioni sceglie in anticipo gli id:
-- se il primo tentativo era arrivato al database, il secondo trova i record e non fa nulla.
-- Per clienti e veicoli basta l'id nell'insert (un doppione viola la chiave primaria); per le due
-- funzioni serve il controllo qui sotto.

-- ---------------------------------------------------------------------------------------------------
-- registra_controllo: nuovo parametro p_id (facoltativo)
-- ---------------------------------------------------------------------------------------------------
-- Un parametro in più cambia la firma della funzione: si elimina la vecchia (altrimenti resterebbero
-- due versioni) e si crea la nuova, con il corpo di 20261008120000 più il controllo iniziale.
drop function public.registra_controllo(uuid, jsonb, date, integer, text);

create function public.registra_controllo(
  p_veicolo_id uuid,
  p_misure jsonb,
  p_eseguito_il date default current_date,
  p_km integer default null,
  p_note text default '',
  p_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_officina_id uuid;
  v_controllo_id uuid;
  v_pneumatico_id uuid;
  v_misura jsonb;
begin
  -- Ripetizione di una chiamata già riuscita: il controllo c'è già, non si registra di nuovo
  if p_id is not null and exists (
    select 1 from public.controlli where id = p_id and veicolo_id = p_veicolo_id
  ) then
    return p_id;
  end if;

  select officina_id into v_officina_id from public.veicoli where id = p_veicolo_id;
  if v_officina_id is null or not public.is_membro_officina(v_officina_id) then
    raise exception 'Veicolo non trovato o non della tua officina' using errcode = '42501';
  end if;
  if jsonb_typeof(p_misure) is distinct from 'array' or jsonb_array_length(p_misure) = 0 then
    raise exception 'Il controllo deve avere almeno una misura' using errcode = '22023';
  end if;
  if p_eseguito_il > current_date then
    raise exception 'La data del controllo non può essere nel futuro' using errcode = '22023';
  end if;

  insert into public.controlli (id, officina_id, veicolo_id, eseguito_il, km, note)
  values (
    coalesce(p_id, gen_random_uuid()), v_officina_id, p_veicolo_id, p_eseguito_il, p_km,
    coalesce(p_note, '')
  )
  returning id into v_controllo_id;

  for v_misura in select value from jsonb_array_elements(p_misure) loop
    select id into v_pneumatico_id
    from public.pneumatici
    where veicolo_id = p_veicolo_id
      and smontato_il is null
      and posizione = (v_misura ->> 'posizione')::public.posizione_pneumatico;
    if not found then
      raise exception 'Nessuno pneumatico montato in posizione %', v_misura ->> 'posizione'
        using errcode = '22023';
    end if;

    insert into public.misure_pneumatico (
      controllo_id, pneumatico_id, veicolo_id, officina_id,
      battistrada_mm, pressione_bar, usura, danni
    ) values (
      v_controllo_id, v_pneumatico_id, p_veicolo_id, v_officina_id,
      (v_misura ->> 'battistrada_mm')::numeric,
      (v_misura ->> 'pressione_bar')::numeric,
      (v_misura ->> 'usura')::public.usura,
      coalesce(v_misura ->> 'danni', '')
    );
  end loop;

  return v_controllo_id;
end;
$$;

comment on function public.registra_controllo is
  'Crea un controllo con le misure per posizione, tutto o niente; con p_id già esistente non fa nulla.';

revoke execute on function public.registra_controllo(uuid, jsonb, date, integer, text, uuid)
  from public, anon;
grant execute on function public.registra_controllo(uuid, jsonb, date, integer, text, uuid)
  to authenticated;

-- ---------------------------------------------------------------------------------------------------
-- monta_pneumatici: "id" facoltativo in ogni elemento di p_pneumatici
-- ---------------------------------------------------------------------------------------------------
-- La firma non cambia: basta sostituire il corpo. Uno pneumatico con un id già presente è una
-- ripetizione: lo si restituisce senza smontare nulla. La chiamata è una transazione, quindi o ci
-- sono tutti (ripetizione) o nessuno.
create or replace function public.monta_pneumatici(
  p_veicolo_id uuid,
  p_pneumatici jsonb,
  p_montato_il date default current_date
)
returns setof uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_officina_id uuid;
  v_posizione public.posizione_pneumatico;
  v_id uuid;
  v_nuovo_id uuid;
  v_p jsonb;
begin
  select officina_id into v_officina_id from public.veicoli where id = p_veicolo_id;
  if v_officina_id is null or not public.is_membro_officina(v_officina_id) then
    raise exception 'Veicolo non trovato o non della tua officina' using errcode = '42501';
  end if;
  if jsonb_typeof(p_pneumatici) is distinct from 'array' or jsonb_array_length(p_pneumatici) = 0 then
    raise exception 'Indica almeno uno pneumatico da montare' using errcode = '22023';
  end if;
  if p_montato_il > current_date then
    raise exception 'La data di montaggio non può essere nel futuro' using errcode = '22023';
  end if;

  for v_p in select value from jsonb_array_elements(p_pneumatici) loop
    v_id := (v_p ->> 'id')::uuid;
    if v_id is not null and exists (
      select 1 from public.pneumatici where id = v_id and veicolo_id = p_veicolo_id
    ) then
      return next v_id;
      continue;
    end if;

    v_posizione := (v_p ->> 'posizione')::public.posizione_pneumatico;

    -- Smonta quello attuale. Se era stato montato dopo p_montato_il, il vincolo
    -- smontato_il >= montato_il dà errore: la data indicata sarebbe incoerente con lo storico
    update public.pneumatici
    set smontato_il = p_montato_il
    where veicolo_id = p_veicolo_id and posizione = v_posizione and smontato_il is null;

    -- Una posizione ripetuta nell'elenco viola l'indice "un montato per posizione": errore
    insert into public.pneumatici (
      id, officina_id, veicolo_id, posizione, stagione, misura, marca, modello, dot, montato_il
    ) values (
      coalesce(v_id, gen_random_uuid()), v_officina_id, p_veicolo_id, v_posizione,
      (v_p ->> 'stagione')::public.stagione,
      coalesce(v_p ->> 'misura', ''),
      coalesce(v_p ->> 'marca', ''),
      coalesce(v_p ->> 'modello', ''),
      nullif(v_p ->> 'dot', ''),
      p_montato_il
    )
    returning id into v_nuovo_id;

    return next v_nuovo_id;
  end loop;
end;
$$;

-- T175: date italiane nel database (idea T163, dritta T138).
--
-- `current_date` è la data UTC: tra mezzanotte e le 2 (le 1 d'inverno) in Italia è ancora "ieri". Effetti:
-- un'officina creata in quelle ore aveva la prova che finiva un giorno prima, e un controllo o un montaggio
-- registrati con la data di oggi venivano rifiutati come "nel futuro". Qui tutte le date "di oggi" che
-- l'utente legge come giorni diventano la data italiana: `(now() at time zone 'Europe/Rome')::date`.
--
-- Cambiano solo i default di tre colonne e, nelle tre funzioni, il default del parametro data e il
-- controllo "data nel futuro". I corpi sono copiati dalle definizioni più recenti
-- (20261008130000_scritture_ripetibili.sql e 20261008150000_modifica_controllo.sql); firme, commenti e
-- permessi restano quelli (`create or replace` li conserva). Le righe già presenti non si toccano.
-- Per cambiare: migrazione nuova con `alter column … set default` o `create or replace function`.

-- ---------------------------------------------------------------------------------------------------
-- Default delle colonne
-- ---------------------------------------------------------------------------------------------------

alter table public.abbonamenti
  alter column prova_fino_al set default ((now() at time zone 'Europe/Rome')::date + 29);

alter table public.controlli
  alter column eseguito_il set default ((now() at time zone 'Europe/Rome')::date);

alter table public.pneumatici
  alter column montato_il set default ((now() at time zone 'Europe/Rome')::date);

-- ---------------------------------------------------------------------------------------------------
-- registra_controllo (corpo di 20261008130000)
-- ---------------------------------------------------------------------------------------------------
create or replace function public.registra_controllo(
  p_veicolo_id uuid,
  p_misure jsonb,
  p_eseguito_il date default (now() at time zone 'Europe/Rome')::date,
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
  if p_eseguito_il > (now() at time zone 'Europe/Rome')::date then
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

-- ---------------------------------------------------------------------------------------------------
-- monta_pneumatici (corpo di 20261008130000)
-- ---------------------------------------------------------------------------------------------------
create or replace function public.monta_pneumatici(
  p_veicolo_id uuid,
  p_pneumatici jsonb,
  p_montato_il date default (now() at time zone 'Europe/Rome')::date
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
  if p_montato_il > (now() at time zone 'Europe/Rome')::date then
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

-- ---------------------------------------------------------------------------------------------------
-- modifica_controllo (corpo di 20261008150000; p_eseguito_il non ha default e resta così)
-- ---------------------------------------------------------------------------------------------------
create or replace function public.modifica_controllo(
  p_id uuid,
  p_misure jsonb,
  p_eseguito_il date,
  p_km integer default null,
  p_note text default ''
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_officina_id uuid;
  v_posizioni public.posizione_pneumatico[];
  v_misura jsonb;
begin
  select officina_id into v_officina_id from public.controlli where id = p_id;
  if v_officina_id is null or not public.is_membro_officina(v_officina_id) then
    raise exception 'Controllo non trovato o non della tua officina' using errcode = '42501';
  end if;
  if jsonb_typeof(p_misure) is distinct from 'array' or jsonb_array_length(p_misure) = 0 then
    raise exception 'Il controllo deve avere almeno una misura' using errcode = '22023';
  end if;
  if p_eseguito_il > (now() at time zone 'Europe/Rome')::date then
    raise exception 'La data del controllo non può essere nel futuro' using errcode = '22023';
  end if;

  select array_agg((value ->> 'posizione')::public.posizione_pneumatico)
  into v_posizioni
  from jsonb_array_elements(p_misure);
  if cardinality(v_posizioni) <> cardinality(array(select distinct unnest(v_posizioni))) then
    raise exception 'Posizione ripetuta nelle misure' using errcode = '22023';
  end if;

  update public.controlli
  set eseguito_il = p_eseguito_il, km = p_km, note = coalesce(p_note, '')
  where id = p_id;

  -- Misure delle posizioni non più indicate
  delete from public.misure_pneumatico m
  using public.pneumatici p
  where m.controllo_id = p_id
    and p.id = m.pneumatico_id
    and p.posizione <> all (v_posizioni);

  for v_misura in select value from jsonb_array_elements(p_misure) loop
    update public.misure_pneumatico m
    set battistrada_mm = (v_misura ->> 'battistrada_mm')::numeric,
        pressione_bar = (v_misura ->> 'pressione_bar')::numeric,
        usura = (v_misura ->> 'usura')::public.usura,
        danni = coalesce(v_misura ->> 'danni', '')
    from public.pneumatici p
    where m.controllo_id = p_id
      and p.id = m.pneumatico_id
      and p.posizione = (v_misura ->> 'posizione')::public.posizione_pneumatico;
    if not found then
      raise exception 'Il controllo non ha una misura in posizione %', v_misura ->> 'posizione'
        using errcode = '22023';
    end if;
  end loop;
end;
$$;

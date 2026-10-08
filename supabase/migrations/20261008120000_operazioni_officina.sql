-- Fase 2 — Operazioni dell'officina che toccano più tabelle insieme (PLAN P9).
--
-- Sono funzioni SQL chiamate dal web con `supabase.rpc(...)`: una chiamata è una sola transazione, quindi
-- se una parte fallisce non resta nulla a metà (es. un controllo senza misure).
-- Sono `security invoker`: girano con i permessi di chi le chiama, quindi valgono le stesse policy RLS
-- delle tabelle (un cliente o un'altra officina vengono bloccati come con un insert diretto).

-- ---------------------------------------------------------------------------------------------------
-- Nuovo controllo con le misure di ogni pneumatico
-- ---------------------------------------------------------------------------------------------------
-- p_misure: [{ "posizione": "ANT_SX", "battistrada_mm": 6.2, "pressione_bar": 2.3,
--              "usura": "REGOLARE", "danni": "" }, …]
-- Lo pneumatico si ricava dalla posizione: è quello montato ora. Il client non manda id di pneumatici,
-- così non può misurarne uno smontato o di un altro veicolo.
create function public.registra_controllo(
  p_veicolo_id uuid,
  p_misure jsonb,
  p_eseguito_il date default current_date,
  p_km integer default null,
  p_note text default ''
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

  insert into public.controlli (officina_id, veicolo_id, eseguito_il, km, note)
  values (v_officina_id, p_veicolo_id, p_eseguito_il, p_km, coalesce(p_note, ''))
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

    -- Una posizione ripetuta viola la chiave primaria (controllo, pneumatico): errore e nulla salvato
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
  'Crea un controllo con le misure per posizione, tutto o niente. Solo membri dell''officina.';

-- ---------------------------------------------------------------------------------------------------
-- Montaggio di pneumatici (nuovi o in sostituzione)
-- ---------------------------------------------------------------------------------------------------
-- p_pneumatici: [{ "posizione": "ANT_SX", "stagione": "INVERNALE", "misura": "175/65 R14 82T",
--                  "marca": "Michelin", "modello": "Alpin 6", "dot": "3823" }, …]
-- Se in una posizione c'è già uno pneumatico montato, viene smontato con data p_montato_il (resta nello
-- storico con i suoi controlli). Caso tipico: cambio stagionale, quattro posizioni in una volta.
create function public.monta_pneumatici(
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
    v_posizione := (v_p ->> 'posizione')::public.posizione_pneumatico;

    -- Smonta quello attuale. Se era stato montato dopo p_montato_il, il vincolo
    -- smontato_il >= montato_il dà errore: la data indicata sarebbe incoerente con lo storico
    update public.pneumatici
    set smontato_il = p_montato_il
    where veicolo_id = p_veicolo_id and posizione = v_posizione and smontato_il is null;

    -- Una posizione ripetuta nell'elenco viola l'indice "un montato per posizione": errore
    insert into public.pneumatici (
      officina_id, veicolo_id, posizione, stagione, misura, marca, modello, dot, montato_il
    ) values (
      v_officina_id, p_veicolo_id, v_posizione,
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

comment on function public.monta_pneumatici is
  'Monta pneumatici per posizione, smontando quelli presenti. Solo membri dell''officina.';

-- Solo utenti autenticati (le policy fanno il resto). Supabase dà di default l'esecuzione anche ad anon.
revoke execute on function public.registra_controllo(uuid, jsonb, date, integer, text) from public, anon;
grant execute on function public.registra_controllo(uuid, jsonb, date, integer, text) to authenticated;
revoke execute on function public.monta_pneumatici(uuid, jsonb, date) from public, anon;
grant execute on function public.monta_pneumatici(uuid, jsonb, date) to authenticated;

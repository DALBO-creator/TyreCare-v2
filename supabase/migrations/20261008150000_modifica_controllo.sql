-- Correzione di un controllo già registrato (sessione 8, 2026-10-08).
--
-- Cliente, veicolo e pneumatici si correggono con un semplice `update` dal web (una tabella sola). Un
-- controllo invece tocca due tabelle: i suoi dati e le misure. Come registra_controllo, la correzione
-- è una funzione SQL `security invoker`: una chiamata = una transazione, con le RLS di chi chiama
-- (membri dell'officina, TITOLARE e OPERATORE).
--
-- Le misure si correggono per posizione, solo su quelle già presenti nel controllo: gli pneumatici
-- misurati quel giorno restano gli stessi anche se nel frattempo sono stati smontati. Una posizione
-- assente da p_misure perde la sua misura (es. ruota di scorta misurata per sbaglio). Rieseguire la
-- stessa chiamata dà lo stesso risultato: si può ripetere dopo un errore di rete.

create function public.modifica_controllo(
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
  if p_eseguito_il > current_date then
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

comment on function public.modifica_controllo is
  'Corregge data, km, note e misure (per posizione) di un controllo, tutto o niente.';

revoke execute on function public.modifica_controllo(uuid, jsonb, date, integer, text)
  from public, anon;
grant execute on function public.modifica_controllo(uuid, jsonb, date, integer, text)
  to authenticated;

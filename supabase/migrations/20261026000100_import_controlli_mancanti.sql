-- T074: import dei controlli, "stessa gomma" anche quando il valore manca nel database (R15).
--
-- In T043 una cella vuota del FILE contava come uguale, ma un valore vuoto nel DATABASE no: una gomma
-- montata dall'app senza DOT (o con marca/misura vuote) veniva smontata alla data della riga e ne
-- nasceva un doppione con gli stessi dati più il DOT. Ora il valore mancante, da qualunque parte, conta
-- come uguale: cambiano solo le tre condizioni della ricerca "1) stessa gomma"; il resto del corpo è
-- identico a quello di T043 (20261024180000_import_controlli.sql).
--
-- Firma uguale: `create or replace` mantiene i permessi di T043 (execute revocato a public e anon,
-- concesso ad authenticated) e il commento della funzione; qui non si ricopiano revoke e grant.
-- Effetto da sapere: una gomma del database con misura, marca e DOT tutti vuoti è "stessa gomma" per
-- qualunque riga della sua posizione; se coprono la data più pneumatici candidati vale l'ordine già
-- presente (montato più di recente per primo).

create or replace function public.importa_controlli(
  p_officina_id uuid,
  p_righe jsonb,
  p_nome_file text default '',
  p_righe_scartate integer default 0,
  p_simula boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_riga jsonb;
  v_targa text;
  v_documento text;
  v_data date;
  v_pos public.posizione_pneumatico;
  v_misura text;
  v_marca text;
  v_dot text;
  v_stagione public.stagione;
  v_veicolo_id uuid;
  v_controllo_id uuid;
  v_controllo_veicolo uuid;
  v_pneumatico_id uuid;
  v_successivo date;
  -- Documenti creati da questo import e documenti già presenti prima (contati una volta sola)
  v_creati text[] := '{}';
  v_gia text[] := '{}';
  v_non_trovate text[] := '{}';
  v_controlli_nuovi integer := 0;
  v_controlli_gia integer := 0;
  v_pneumatici_nuovi integer := 0;
  v_misure_nuove integer := 0;
  v_misure_saltate integer := 0;
begin
  if not public.is_titolare_officina(p_officina_id) then
    raise exception 'Solo il titolare può importare i dati dell''officina' using errcode = '42501';
  end if;
  if jsonb_typeof(p_righe) is distinct from 'array' or jsonb_array_length(p_righe) = 0 then
    raise exception 'Non ci sono righe da importare' using errcode = '22023';
  end if;
  if jsonb_array_length(p_righe) > 5000 then
    raise exception 'Al massimo 5000 righe per volta' using errcode = '22023';
  end if;

  -- Sottotransazione: per la simulazione si annulla sollevando TCSIM (i contatori restano).
  begin
    for v_riga in
      select r.value
      from jsonb_array_elements(p_righe) as r (value)
      order by r.value ->> 'data', r.value ->> 'codice_documento', r.value ->> 'posizione', r.value::text
    loop
      if jsonb_typeof(v_riga) is distinct from 'object' then
        raise exception 'Riga non valida' using errcode = '22023';
      end if;

      v_documento := nullif(btrim(v_riga ->> 'codice_documento'), '');
      if v_documento is null then
        raise exception 'Riga senza codice documento' using errcode = '22023';
      end if;
      v_data := (v_riga ->> 'data')::date;
      v_pos := (v_riga ->> 'posizione')::public.posizione_pneumatico;
      v_misura := lower(btrim(coalesce(v_riga ->> 'misura', '')));
      v_marca := lower(btrim(coalesce(v_riga ->> 'marca', '')));
      v_dot := lower(btrim(coalesce(v_riga ->> 'dot', '')));

      -- Stessa forma canonica del trigger normalizza_veicolo
      v_targa := upper(regexp_replace(coalesce(v_riga ->> 'targa', ''), '[^A-Za-z0-9]', '', 'g'));
      select id into v_veicolo_id
      from public.veicoli
      where officina_id = p_officina_id and targa = v_targa;
      if not found then
        if not v_targa = any (v_non_trovate) then
          v_non_trovate := v_non_trovate || v_targa;
        end if;
        continue;
      end if;

      -- Il controllo: già presente prima dell'import → righe saltate; creato da questo import → si riusa
      select id, veicolo_id into v_controllo_id, v_controllo_veicolo
      from public.controlli
      where officina_id = p_officina_id and codice_documento = v_documento;
      if found then
        if not v_documento = any (v_creati) then
          if not v_documento = any (v_gia) then
            v_gia := v_gia || v_documento;
            v_controlli_gia := v_controlli_gia + 1;
          end if;
          continue;
        end if;
        -- Lo stesso documento su un altro veicolo: la misura non è ammessa (controllo di un solo veicolo)
        if v_controllo_veicolo <> v_veicolo_id then
          v_misure_saltate := v_misure_saltate + 1;
          continue;
        end if;
      end if;

      -- Pneumatico della posizione alla data d. 1) stessa gomma tra quelli che coprono d
      select p.id into v_pneumatico_id
      from public.pneumatici p
      where p.veicolo_id = v_veicolo_id and p.posizione = v_pos
        and p.montato_il <= v_data and (p.smontato_il is null or p.smontato_il >= v_data)
        and (v_misura = '' or coalesce(btrim(p.misura), '') = '' or lower(btrim(p.misura)) = v_misura)
        and (v_marca = '' or coalesce(btrim(p.marca), '') = '' or lower(btrim(p.marca)) = v_marca)
        and (v_dot = '' or coalesce(btrim(p.dot), '') = '' or lower(btrim(p.dot)) = v_dot)
      order by p.montato_il desc, p.created_at desc, p.id
      limit 1;

      if v_pneumatico_id is null then
        -- 3) copre d quello montato ora, ma è un'altra gomma: lo si smonta in d (prima l'update, poi
        -- l'insert: indice unico sui montati)
        update public.pneumatici
        set smontato_il = v_data
        where veicolo_id = v_veicolo_id and posizione = v_pos
          and smontato_il is null and montato_il <= v_data;
        if found then
          v_successivo := null;
        elsif exists (
          select 1 from public.pneumatici p
          where p.veicolo_id = v_veicolo_id and p.posizione = v_pos
            and p.montato_il <= v_data and p.smontato_il >= v_data
        ) then
          -- 4) copre d solo uno storico diverso: riga saltata
          v_misure_saltate := v_misure_saltate + 1;
          continue;
        else
          -- 2) nessuno copre d: se ce n'è uno montato dopo, il nuovo è storico e finisce quando comincia
          -- quello; altrimenti è montato ora
          select min(p.montato_il) into v_successivo
          from public.pneumatici p
          where p.veicolo_id = v_veicolo_id and p.posizione = v_pos and p.montato_il > v_data;
        end if;

        -- Stagione: quella del file, poi quella dell'ultimo pneumatico della posizione (preferendo i
        -- montati fino a d), poi la stagione del mese di d (R10)
        v_stagione := nullif(btrim(coalesce(v_riga ->> 'stagione', '')), '')::public.stagione;
        if v_stagione is null then
          select p.stagione into v_stagione
          from public.pneumatici p
          where p.veicolo_id = v_veicolo_id and p.posizione = v_pos
          order by (p.montato_il <= v_data) desc, p.montato_il desc, p.created_at desc, p.id
          limit 1;
        end if;
        if v_stagione is null then
          v_stagione := case
            when extract(month from v_data) in (11, 12, 1, 2, 3) then 'INVERNALE'
            else 'ESTIVO'
          end;
        end if;

        insert into public.pneumatici (
          officina_id, veicolo_id, posizione, stagione, misura, marca, modello, dot,
          montato_il, smontato_il, origine
        ) values (
          p_officina_id, v_veicolo_id, v_pos, v_stagione,
          btrim(coalesce(v_riga ->> 'misura', '')), btrim(coalesce(v_riga ->> 'marca', '')),
          btrim(coalesce(v_riga ->> 'modello', '')), nullif(btrim(coalesce(v_riga ->> 'dot', '')), ''),
          v_data, v_successivo, 'IMPORT'
        )
        returning id into v_pneumatico_id;
        v_pneumatici_nuovi := v_pneumatici_nuovi + 1;
      end if;

      -- Il controllo si crea alla prima riga utile del documento (km e note della prima riga)
      if v_controllo_id is null or not v_documento = any (v_creati) then
        insert into public.controlli (
          officina_id, veicolo_id, eseguito_il, km, note, origine, codice_documento
        ) values (
          p_officina_id, v_veicolo_id, v_data,
          nullif(btrim(coalesce(v_riga ->> 'km', '')), '')::integer,
          coalesce(v_riga ->> 'note', ''), 'IMPORT', v_documento
        )
        returning id into v_controllo_id;
        v_creati := v_creati || v_documento;
        v_controlli_nuovi := v_controlli_nuovi + 1;
      end if;

      insert into public.misure_pneumatico (
        controllo_id, pneumatico_id, veicolo_id, officina_id,
        battistrada_mm, pressione_bar, usura, danni
      ) values (
        v_controllo_id, v_pneumatico_id, v_veicolo_id, p_officina_id,
        (v_riga ->> 'battistrada_mm')::numeric,
        nullif(btrim(coalesce(v_riga ->> 'pressione_bar', '')), '')::numeric,
        nullif(btrim(coalesce(v_riga ->> 'usura', '')), '')::public.usura,
        coalesce(v_riga ->> 'danni', '')
      )
      on conflict (controllo_id, pneumatico_id) do nothing;
      if found then
        v_misure_nuove := v_misure_nuove + 1;
      else
        v_misure_saltate := v_misure_saltate + 1;
      end if;
    end loop;

    if p_simula then
      raise exception 'simulazione' using errcode = 'TCSIM';
    end if;
  exception
    when sqlstate 'TCSIM' then
      null;
  end;

  if not p_simula then
    insert into public.import_log (
      officina_id, tipo, nome_file, righe_importate, righe_scartate,
      controlli_nuovi, controlli_gia_presenti, pneumatici_nuovi, misure_nuove
    ) values (
      p_officina_id, 'CONTROLLI', left(coalesce(p_nome_file, ''), 255), jsonb_array_length(p_righe),
      greatest(coalesce(p_righe_scartate, 0), 0),
      v_controlli_nuovi, v_controlli_gia, v_pneumatici_nuovi, v_misure_nuove
    );
  end if;

  return jsonb_build_object(
    'controlli_nuovi', v_controlli_nuovi,
    'controlli_gia_presenti', v_controlli_gia,
    'pneumatici_nuovi', v_pneumatici_nuovi,
    'misure_nuove', v_misure_nuove,
    'misure_saltate', v_misure_saltate,
    'targhe_non_trovate', to_jsonb(v_non_trovate[1:50])
  );
end;
$$;

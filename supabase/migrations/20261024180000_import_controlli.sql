-- T043: import dei controlli dal gestionale (T023, parte 1).
--
-- Il file lo legge e lo controlla il browser (T044); qui arrivano solo le righe valide, già pulite.
-- Una funzione SQL scrive in una transazione i controlli, le misure e la storia degli pneumatici,
-- come `importa_clienti_veicoli` (stessa struttura: simulazione con TCSIM, riga in `import_log`).
--
-- Allargamento del vincolo `import_log_tipo_check`: l'unica modifica a una tabella esistente è
-- l'aggiunta di 'CONTROLLI' ai valori ammessi di `tipo` e di quattro colonne con default 0. Non tocca
-- dati né colonne esistenti (autorizzato dal pianificatore, T043).
--
-- Regole (scelta A, decisioni-rimandate R1 e R10):
-- - le righe si elaborano ordinate per data, codice documento, posizione, qualunque sia l'ordine nel file;
-- - il veicolo si cerca per targa nell'officina: se non c'è la riga si salta (`targhe_non_trovate`);
-- - controllo = (officina, codice documento): se esisteva già PRIMA dell'import tutte le sue righe si
--   saltano (reimportare lo stesso file non cambia nulla); altrimenti lo crea la prima riga;
-- - "stessa gomma" = misura, marca e DOT uguali senza badare a maiuscole e spazi; una cella vuota del
--   file conta come uguale;
-- - per ogni riga lo pneumatico della posizione alla data d è:
--   1. uno di quelli che coprono d (montato_il <= d e smontato_il nullo o >= d) se è la stessa gomma;
--   2. se nessuno copre d ed ecco un montato dopo: pneumatico storico montato in d e smontato alla data
--      del primo montaggio successivo della posizione; se non ce ne sono dopo: nuovo pneumatico
--      montato in d (smontato_il nullo);
--   3. se copre d quello montato ora ma è un'altra gomma: si smonta in d e se ne monta uno nuovo in d;
--   4. se copre d solo uno storico diverso: la riga si salta (misure_saltate);
-- - stagione di un pneumatico nuovo: quella del file, altrimenti quella dell'ultimo pneumatico della
--   posizione, altrimenti INVERNALE da novembre a marzo ed ESTIVO negli altri mesi.

alter table public.import_log
  add column controlli_nuovi integer not null default 0,
  add column controlli_gia_presenti integer not null default 0,
  add column pneumatici_nuovi integer not null default 0,
  add column misure_nuove integer not null default 0;

alter table public.import_log drop constraint import_log_tipo_check,
  add constraint import_log_tipo_check check (tipo in ('CLIENTI_VEICOLI', 'CONTROLLI'));

-- p_righe: [{codice_documento, targa, data 'AAAA-MM-GG', km|null, posizione, battistrada_mm,
--            pressione_bar|null, usura|null, danni, stagione|null, misura, marca, modello, dot|null, note}, …]
-- Restituisce {controlli_nuovi, controlli_gia_presenti, pneumatici_nuovi, misure_nuove, misure_saltate,
--              targhe_non_trovate (al massimo 50, senza doppioni)}.
-- Con p_simula = true fa le stesse scritture e poi le annulla (TCSIM): stessi conteggi, nessuna scrittura.

create function public.importa_controlli(
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
        and (v_misura = '' or lower(btrim(p.misura)) = v_misura)
        and (v_marca = '' or lower(btrim(p.marca)) = v_marca)
        and (v_dot = '' or lower(btrim(coalesce(p.dot, ''))) = v_dot)
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

comment on function public.importa_controlli is
  'Importa i controlli del gestionale con le misure e la storia degli pneumatici (idempotente); con p_simula conta senza scrivere.';

revoke execute on function public.importa_controlli(uuid, jsonb, text, integer, boolean)
  from public, anon;
grant execute on function public.importa_controlli(uuid, jsonb, text, integer, boolean)
  to authenticated;

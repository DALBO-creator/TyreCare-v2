-- T286: `import_id` di clienti e veicoli lo scrive solo l'import (correzione di T265, revisione
-- 2026-11-15). Le policy di insert e update di `clienti_officina` e `veicoli` (20261007120000) lasciano
-- ai membri dell'officina ogni colonna: un operatore o il titolare potevano segnare come «creato
-- dall'import» un cliente o un veicolo creato dall'app (insert o update diretto con import_id = l'id di
-- un import), e «Annulla questo import» l'avrebbe tolto.
--
-- Cosa aggiunge (nessuna colonna tolta o rinominata, nessun dato cambiato):
-- - `proteggi_import_id()`, trigger `before insert or update` su `clienti_officina` e `veicoli`: con un
--   utente (auth.uid() non nullo) che non è ADMIN, un import_id non nullo nuovo (insert, oppure update
--   che lo cambia) è ammesso solo se uguale all'impostazione `tyrecare.import_id`, che apre soltanto
--   importa_clienti_veicoli; altrimenti 42501. Tornare a null è sempre ammesso: lo fa `on delete set
--   null` quando sparisce la riga di import_log (anche con l'utente ancora impostato nella sessione), e
--   togliere il segno a una riga la esclude soltanto dall'annullo. ADMIN e service role (auth.uid()
--   nullo: migrazioni, seed, funzioni lato server) restano liberi, come in proteggi_termini (T078).
-- - `importa_clienti_veicoli` ricopiata da 20261108000800 con un solo cambio: apre l'impostazione con
--   l'id del proprio import prima del blocco con la simulazione e la richiude a '' subito prima del
--   return (firma, permessi, risposta e simulazione invariati). Un insert o update diretto più avanti
--   nella stessa transazione resta vietato. Se la funzione si interrompe con un errore, la transazione
--   (o la sottotransazione del chiamante) si annulla e con lei l'impostazione.

-- ---------------------------------------------------------------------------------------------------
-- proteggi_import_id
-- ---------------------------------------------------------------------------------------------------
-- security definer come proteggi_termini; nessuno la chiama direttamente. Gli altri trigger delle due
-- tabelle (updated_at, normalizza_veicolo, proteggi_collegamento_cliente) non toccano import_id:
-- l'ordine di esecuzione non conta.

create function public.proteggi_import_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or public.is_admin() then
    return new;
  end if;

  -- Tornare a null (o restare null) è sempre ammesso.
  if new.import_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.import_id is not distinct from old.import_id then
    return new;
  end if;

  if coalesce(current_setting('tyrecare.import_id', true), '') <> new.import_id::text then
    raise exception 'Solo l''import può segnare una riga come importata' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke execute on function public.proteggi_import_id() from public, anon, authenticated;

create trigger clienti_officina_proteggi_import_id
  before insert or update on public.clienti_officina
  for each row execute function public.proteggi_import_id();

create trigger veicoli_proteggi_import_id
  before insert or update on public.veicoli
  for each row execute function public.proteggi_import_id();

-- ---------------------------------------------------------------------------------------------------
-- importa_clienti_veicoli (ricopiata da 20261108000800; cambia solo tyrecare.import_id)
-- ---------------------------------------------------------------------------------------------------
-- p_righe: [{ "cliente": {codice_gestionale, nome, cognome, ragione_sociale, telefono, email} | null,
--             "veicolo": {targa, marca, modello, anno, telaio} | null }, …]
-- Con p_simula = true fa le stesse scritture e poi le annulla: l'anteprima mostra quanti clienti e
-- veicoli sarebbero nuovi o aggiornati, contati dallo stesso codice dell'import vero.
-- Restituisce {clienti_nuovi, clienti_aggiornati, veicoli_nuovi, veicoli_aggiornati}.

create or replace function public.importa_clienti_veicoli(
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
  v_c jsonb;
  v_v jsonb;
  v_codice text;
  v_targa text;
  v_cliente_id uuid;
  v_veicolo_id uuid;
  -- Id della riga di import_log, scritto in import_id delle righe create (T265)
  v_import_id uuid := gen_random_uuid();
  -- Clienti già passati in questo import (lo stesso cliente con più veicoli si conta una volta)
  v_visti text[] := '{}';
  v_clienti_nuovi integer := 0;
  v_clienti_aggiornati integer := 0;
  v_veicoli_nuovi integer := 0;
  v_veicoli_aggiornati integer := 0;
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

  -- Apre il permesso di proteggi_import_id solo per l'id di questo import (T286).
  perform set_config('tyrecare.import_id', v_import_id::text, true);

  -- Blocco con gestore d'errore = sottotransazione: per la simulazione si annulla sollevando TCSIM.
  -- I contatori sono variabili PL/pgSQL e restano anche dopo l'annullamento.
  begin
    for v_riga in select value from jsonb_array_elements(p_righe) loop
      v_cliente_id := null;
      v_c := v_riga -> 'cliente';
      v_v := v_riga -> 'veicolo';

      if jsonb_typeof(v_c) = 'object' then
        v_codice := nullif(btrim(v_c ->> 'codice_gestionale'), '');
        if v_codice is null then
          raise exception 'Cliente senza codice' using errcode = '22023';
        end if;

        select id into v_cliente_id
        from public.clienti_officina
        where officina_id = p_officina_id and codice_gestionale = v_codice;

        if v_cliente_id is null then
          insert into public.clienti_officina (
            officina_id, codice_gestionale, nome, cognome, ragione_sociale, telefono, email, origine,
            import_id
          ) values (
            p_officina_id, v_codice,
            coalesce(v_c ->> 'nome', ''), coalesce(v_c ->> 'cognome', ''),
            nullif(v_c ->> 'ragione_sociale', ''), nullif(v_c ->> 'telefono', ''),
            nullif(v_c ->> 'email', ''), 'IMPORT',
            v_import_id
          )
          returning id into v_cliente_id;
          v_clienti_nuovi := v_clienti_nuovi + 1;
        elsif not v_codice = any (v_visti) then
          -- Solo i campi non vuoti, e solo se cambia qualcosa (così si contano gli aggiornati)
          update public.clienti_officina
          set nome = coalesce(nullif(v_c ->> 'nome', ''), nome),
              cognome = coalesce(nullif(v_c ->> 'cognome', ''), cognome),
              ragione_sociale = coalesce(nullif(v_c ->> 'ragione_sociale', ''), ragione_sociale),
              telefono = coalesce(nullif(v_c ->> 'telefono', ''), telefono),
              email = coalesce(nullif(v_c ->> 'email', ''), email)
          where id = v_cliente_id
            and (nome, cognome, ragione_sociale, telefono, email) is distinct from (
              coalesce(nullif(v_c ->> 'nome', ''), nome),
              coalesce(nullif(v_c ->> 'cognome', ''), cognome),
              coalesce(nullif(v_c ->> 'ragione_sociale', ''), ragione_sociale),
              coalesce(nullif(v_c ->> 'telefono', ''), telefono),
              coalesce(nullif(v_c ->> 'email', ''), email)
            );
          if found then
            v_clienti_aggiornati := v_clienti_aggiornati + 1;
          end if;
        end if;
        v_visti := v_visti || v_codice;
      end if;

      if jsonb_typeof(v_v) = 'object' then
        -- Stessa forma canonica del trigger normalizza_veicolo
        v_targa := upper(regexp_replace(coalesce(v_v ->> 'targa', ''), '[^A-Za-z0-9]', '', 'g'));

        select id into v_veicolo_id
        from public.veicoli
        where officina_id = p_officina_id and targa = v_targa;

        if not found then
          insert into public.veicoli (
            officina_id, cliente_officina_id, targa, marca, modello, anno, telaio, origine, import_id
          ) values (
            p_officina_id, v_cliente_id, v_targa,
            coalesce(v_v ->> 'marca', ''), coalesce(v_v ->> 'modello', ''),
            (v_v ->> 'anno')::smallint, nullif(v_v ->> 'telaio', ''), 'IMPORT', v_import_id
          );
          v_veicoli_nuovi := v_veicoli_nuovi + 1;
        else
          update public.veicoli
          set marca = coalesce(nullif(v_v ->> 'marca', ''), marca),
              modello = coalesce(nullif(v_v ->> 'modello', ''), modello),
              anno = coalesce((v_v ->> 'anno')::smallint, anno),
              telaio = coalesce(nullif(v_v ->> 'telaio', ''), telaio),
              cliente_officina_id = coalesce(v_cliente_id, cliente_officina_id)
          where id = v_veicolo_id
            and (marca, modello, anno, telaio, cliente_officina_id) is distinct from (
              coalesce(nullif(v_v ->> 'marca', ''), marca),
              coalesce(nullif(v_v ->> 'modello', ''), modello),
              coalesce((v_v ->> 'anno')::smallint, anno),
              coalesce(nullif(v_v ->> 'telaio', ''), telaio),
              coalesce(v_cliente_id, cliente_officina_id)
            );
          if found then
            v_veicoli_aggiornati := v_veicoli_aggiornati + 1;
          end if;
        end if;
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
      id, officina_id, nome_file, righe_importate, righe_scartate,
      clienti_nuovi, clienti_aggiornati, veicoli_nuovi, veicoli_aggiornati
    ) values (
      v_import_id, p_officina_id, left(coalesce(p_nome_file, ''), 255), jsonb_array_length(p_righe),
      greatest(coalesce(p_righe_scartate, 0), 0),
      v_clienti_nuovi, v_clienti_aggiornati, v_veicoli_nuovi, v_veicoli_aggiornati
    );
  end if;

  -- Richiude il permesso: un insert o update diretto dopo l'import resta vietato (T286).
  perform set_config('tyrecare.import_id', '', true);

  return jsonb_build_object(
    'clienti_nuovi', v_clienti_nuovi,
    'clienti_aggiornati', v_clienti_aggiornati,
    'veicoli_nuovi', v_veicoli_nuovi,
    'veicoli_aggiornati', v_veicoli_aggiornati
  );
end;
$$;

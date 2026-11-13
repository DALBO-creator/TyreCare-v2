-- T265: annullare l'ultimo import di clienti e veicoli (R40). Serve quando il primo import dal
-- gestionale va storto (colonne associate male): il titolare toglie i clienti e i veicoli che
-- quell'import ha CREATO, senza toccare il resto.
--
-- Cosa aggiunge (nessuna colonna tolta o rinominata, nessun dato cancellato dalla migrazione):
-- - `clienti_officina.import_id` e `veicoli.import_id`: l'import che ha creato la riga (null per le
--   righe create dall'app, da importi precedenti a questa migrazione o aggiornate da un import);
-- - `import_log.annullato_il`: quando l'import è stato annullato (null = mai);
-- - `importa_clienti_veicoli` ricopiata da 20261016120000 con un solo cambio: l'id della riga di
--   `import_log` si genera all'inizio e si scrive in `import_id` delle righe create (firma, permessi,
--   risposta e simulazione invariati);
-- - `annulla_import(p_import_id)`.
--
-- Le chiavi esterne verso `import_log` sono DEFERRABLE INITIALLY DEFERRED: la funzione d'import scrive
-- clienti e veicoli prima della riga di `import_log` (che contiene i conteggi finali e non si può
-- aggiornare: niente policy di update), quindi il controllo si fa alla fine della transazione, quando
-- la riga esiste. In simulazione le scritture si annullano (TCSIM) e non resta nulla da controllare.
-- Se l'import viene cancellato (es. con l'officina), `import_id` torna null.
--
-- annulla_import, regole (R40):
-- - solo il TITOLARE dell'officina dell'import (non l'operatore, non l'admin, non chi non ha un
--   utente): altrimenti 42501. Import inesistente o di un'altra officina danno lo stesso 42501 (come in
--   scollega_cliente): un estraneo non scopre quali import esistono;
-- - errori attesi (messaggio = chiave, codice P0001), in quest'ordine: IMPORT_GIA_ANNULLATO;
--   IMPORT_NON_ULTIMO (c'è un import CLIENTI_VEICOLI più recente della stessa officina, anche se
--   annullato; un import CONTROLLI successivo non conta; anche un import di tipo CONTROLLI passato come
--   argomento dà questa chiave); IMPORT_SCADUTO (fatto da 7 giorni o più);
-- - si tolgono i veicoli con quell'import_id senza pneumatici, controlli, misure, prenotazioni o
--   richieste su strada collegati; poi i clienti con quell'import_id senza veicoli, senza account
--   (profile_id) e senza inviti (anche scaduti o annullati). Le tabelle pneumatici, controlli e
--   misure_pneumatico hanno `on delete cascade` verso veicoli: per questo si controllano esplicitamente,
--   altrimenti la cancellazione del veicolo le porterebbe via. Prenotazioni e richieste su strada non
--   hanno una chiave verso veicoli: si legano per officina e targa (già normalizzata in tutte e tre);
-- - le righe aggiornate dall'import non tornano come prima (non si salva la versione precedente);
-- - restituisce {veicoli_tolti, clienti_tolti, veicoli_tenuti, clienti_tenuti}.

-- ---------------------------------------------------------------------------------------------------
-- Colonne
-- ---------------------------------------------------------------------------------------------------

alter table public.clienti_officina
  add column import_id uuid references public.import_log (id) on delete set null
    deferrable initially deferred;

alter table public.veicoli
  add column import_id uuid references public.import_log (id) on delete set null
    deferrable initially deferred;

create index clienti_officina_import_id_idx on public.clienti_officina (import_id);
create index veicoli_import_id_idx on public.veicoli (import_id);

comment on column public.clienti_officina.import_id is
  'Import che ha creato il cliente (null se creato dall''app o solo aggiornato da un import).';
comment on column public.veicoli.import_id is
  'Import che ha creato il veicolo (null se creato dall''app o solo aggiornato da un import).';

alter table public.import_log add column annullato_il timestamptz;

comment on column public.import_log.annullato_il is
  'Quando il titolare ha annullato l''import con annulla_import (null = mai).';

-- ---------------------------------------------------------------------------------------------------
-- importa_clienti_veicoli (ricopiata da 20261016120000; cambia solo import_id)
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

  return jsonb_build_object(
    'clienti_nuovi', v_clienti_nuovi,
    'clienti_aggiornati', v_clienti_aggiornati,
    'veicoli_nuovi', v_veicoli_nuovi,
    'veicoli_aggiornati', v_veicoli_aggiornati
  );
end;
$$;

-- ---------------------------------------------------------------------------------------------------
-- annulla_import
-- ---------------------------------------------------------------------------------------------------
-- security definer: import_log non ha policy di update (annullato_il) e la cancellazione deve vedere
-- anche righe collegate che il titolare potrebbe non leggere; i permessi si controllano qui sotto.

create function public.annulla_import(p_import_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_officina_id uuid;
  v_tipo text;
  v_created_at timestamptz;
  v_annullato_il timestamptz;
  v_veicoli_tolti integer := 0;
  v_clienti_tolti integer := 0;
  v_veicoli_tenuti integer := 0;
  v_clienti_tenuti integer := 0;
begin
  select l.officina_id into v_officina_id
  from public.import_log l
  where l.id = p_import_id;

  -- Prima i permessi: inesistente e di un'altra officina danno lo stesso errore.
  if v_officina_id is null or not public.is_titolare_officina(v_officina_id) then
    raise exception 'Accesso riservato' using errcode = '42501';
  end if;

  -- Blocca la riga: un secondo annullo contemporaneo aspetta e poi trova annullato_il.
  select l.tipo, l.created_at, l.annullato_il into v_tipo, v_created_at, v_annullato_il
  from public.import_log l
  where l.id = p_import_id
  for update;

  if v_annullato_il is not null then
    raise exception 'IMPORT_GIA_ANNULLATO';
  end if;
  if v_tipo <> 'CLIENTI_VEICOLI' or exists (
    select 1 from public.import_log l
    where l.officina_id = v_officina_id
      and l.tipo = 'CLIENTI_VEICOLI'
      and l.id <> p_import_id
      and l.created_at > v_created_at
  ) then
    raise exception 'IMPORT_NON_ULTIMO';
  end if;
  if v_created_at <= now() - interval '7 days' then
    raise exception 'IMPORT_SCADUTO';
  end if;

  -- Blocca veicoli e clienti dell'import prima dei controlli: un controllo, un pneumatico o un invito
  -- inserito intanto (la sua chiave esterna prende un lock sulla riga) aspetta la fine o viene
  -- aspettato, così la cancellazione non porta via con la cascata una riga appena scritta.
  perform 1 from public.veicoli v
  where v.import_id = p_import_id and v.officina_id = v_officina_id
  for update;
  perform 1 from public.clienti_officina c
  where c.import_id = p_import_id and c.officina_id = v_officina_id
  for update;

  delete from public.veicoli v
  where v.import_id = p_import_id
    and v.officina_id = v_officina_id
    and not exists (select 1 from public.pneumatici p where p.veicolo_id = v.id)
    and not exists (select 1 from public.controlli k where k.veicolo_id = v.id)
    and not exists (select 1 from public.misure_pneumatico m where m.veicolo_id = v.id)
    and not exists (
      select 1 from public.prenotazioni b
      where b.officina_id = v.officina_id and b.targa = v.targa
    )
    and not exists (
      select 1 from public.richieste_strada r
      where r.officina_id = v.officina_id and r.targa = v.targa
    );
  get diagnostics v_veicoli_tolti = row_count;

  delete from public.clienti_officina c
  where c.import_id = p_import_id
    and c.officina_id = v_officina_id
    and c.profile_id is null
    and not exists (select 1 from public.veicoli v where v.cliente_officina_id = c.id)
    and not exists (select 1 from public.inviti_cliente i where i.cliente_officina_id = c.id);
  get diagnostics v_clienti_tolti = row_count;

  select count(*) into v_veicoli_tenuti
  from public.veicoli v
  where v.import_id = p_import_id and v.officina_id = v_officina_id;
  select count(*) into v_clienti_tenuti
  from public.clienti_officina c
  where c.import_id = p_import_id and c.officina_id = v_officina_id;

  update public.import_log set annullato_il = now() where id = p_import_id;

  return jsonb_build_object(
    'veicoli_tolti', v_veicoli_tolti,
    'clienti_tolti', v_clienti_tolti,
    'veicoli_tenuti', v_veicoli_tenuti,
    'clienti_tenuti', v_clienti_tenuti
  );
end;
$$;

comment on function public.annulla_import(uuid) is
  'Toglie clienti e veicoli creati dall''ultimo import CLIENTI_VEICOLI (meno di 7 giorni) e non usati. Solo titolare.';

revoke execute on function public.annulla_import(uuid) from public, anon;
grant execute on function public.annulla_import(uuid) to authenticated;

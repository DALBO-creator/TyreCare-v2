-- Import dal gestionale: clienti e veicoli dal CSV standard di TyreCare (PLAN P8, 2026-10-16).
--
-- Il file lo legge e lo controlla il browser (`packages/shared/src/importa.ts`); qui arrivano solo le
-- righe valide, già pulite. Decisioni del titolare (2026-10-16): niente Fastify per ora, una funzione
-- SQL scrive tutto in una transazione; prima clienti e veicoli, i controlli in un secondo momento.
--
-- Regole:
-- - import idempotente: il cliente si ritrova con il codice del gestionale, il veicolo con la targa;
--   reimportare lo stesso file non cambia nulla;
-- - una cella vuota NON cancella il dato già presente (es. il telefono inserito dall'app);
-- - una riga con il codice cliente collega il veicolo a quel cliente; senza, il collegamento resta;
-- - importa soltanto il TITOLARE; ogni import (non le simulazioni) lascia una riga in `import_log`.

-- ---------------------------------------------------------------------------------------------------
-- Registro degli import
-- ---------------------------------------------------------------------------------------------------

create table public.import_log (
  id uuid primary key default gen_random_uuid(),
  officina_id uuid not null references public.officine (id) on delete cascade,
  -- Cosa è stato importato: oggi solo clienti e veicoli, poi i controlli
  tipo text not null default 'CLIENTI_VEICOLI' check (tipo in ('CLIENTI_VEICOLI')),
  nome_file text not null default '' check (char_length(nome_file) <= 255),
  righe_importate integer not null check (righe_importate >= 0),
  -- Righe con errori, saltate dal browser prima dell'invio
  righe_scartate integer not null default 0 check (righe_scartate >= 0),
  clienti_nuovi integer not null default 0,
  clienti_aggiornati integer not null default 0,
  veicoli_nuovi integer not null default 0,
  veicoli_aggiornati integer not null default 0,
  eseguito_da uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index import_log_officina_id_idx on public.import_log (officina_id, created_at desc);

comment on table public.import_log is 'Registro degli import dal gestionale (chi, quando, quante righe).';

alter table public.import_log enable row level security;

create policy "import_log: lettura membri"
  on public.import_log for select to authenticated
  using (public.is_membro_officina(officina_id));

-- Scritto dalla funzione d'import (security invoker): solo il titolare, a nome proprio
create policy "import_log: inserimento titolare"
  on public.import_log for insert to authenticated
  with check (
    public.is_titolare_officina(officina_id) and eseguito_da = (select auth.uid())
  );

-- ---------------------------------------------------------------------------------------------------
-- importa_clienti_veicoli
-- ---------------------------------------------------------------------------------------------------
-- p_righe: [{ "cliente": {codice_gestionale, nome, cognome, ragione_sociale, telefono, email} | null,
--             "veicolo": {targa, marca, modello, anno, telaio} | null }, …]
-- Con p_simula = true fa le stesse scritture e poi le annulla: l'anteprima mostra quanti clienti e
-- veicoli sarebbero nuovi o aggiornati, contati dallo stesso codice dell'import vero.
-- Restituisce {clienti_nuovi, clienti_aggiornati, veicoli_nuovi, veicoli_aggiornati}.

create function public.importa_clienti_veicoli(
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
            officina_id, codice_gestionale, nome, cognome, ragione_sociale, telefono, email, origine
          ) values (
            p_officina_id, v_codice,
            coalesce(v_c ->> 'nome', ''), coalesce(v_c ->> 'cognome', ''),
            nullif(v_c ->> 'ragione_sociale', ''), nullif(v_c ->> 'telefono', ''),
            nullif(v_c ->> 'email', ''), 'IMPORT'
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
            officina_id, cliente_officina_id, targa, marca, modello, anno, telaio, origine
          ) values (
            p_officina_id, v_cliente_id, v_targa,
            coalesce(v_v ->> 'marca', ''), coalesce(v_v ->> 'modello', ''),
            (v_v ->> 'anno')::smallint, nullif(v_v ->> 'telaio', ''), 'IMPORT'
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
      officina_id, nome_file, righe_importate, righe_scartate,
      clienti_nuovi, clienti_aggiornati, veicoli_nuovi, veicoli_aggiornati
    ) values (
      p_officina_id, left(coalesce(p_nome_file, ''), 255), jsonb_array_length(p_righe),
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

comment on function public.importa_clienti_veicoli is
  'Importa clienti e veicoli dal CSV standard (idempotente); con p_simula conta senza scrivere.';

revoke execute on function public.importa_clienti_veicoli(uuid, jsonb, text, integer, boolean)
  from public, anon;
grant execute on function public.importa_clienti_veicoli(uuid, jsonb, text, integer, boolean)
  to authenticated;

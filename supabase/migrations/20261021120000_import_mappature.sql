-- Import: associazioni di colonne salvate (PLAN P22, 2026-10-21, T011).
--
-- Il titolare associa le colonne del suo file (Excel/CSV del gestionale) a quelle di TyreCare; qui la
-- associazione si salva con un nome e si riusa al prossimo import (`applicaMappatura` in
-- `packages/shared/src/importa.ts`). Come l'import, è roba solo del TITOLARE.
--
-- `colonne` = { "<colonna di TyreCare>": "<intestazione del file>", … }, le stesse chiavi di
-- `COLONNE_IMPORT` in `importa.ts`.

-- ---------------------------------------------------------------------------------------------------
-- mappatura_import_valida
-- ---------------------------------------------------------------------------------------------------
-- Vero solo se `p_colonne` è un oggetto con chiavi tra le colonne dell'import, valori stringhe di 1–200
-- caratteri e almeno una tra `targa` e `codice_cliente` (senza, l'import non sa a chi o a cosa
-- associare la riga). Il `case` evita `jsonb_each` su un valore che non è un oggetto (darebbe errore).

create function public.mappatura_import_valida(p_colonne jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p_colonne is null or jsonb_typeof(p_colonne) <> 'object' then false
    else
      (p_colonne ? 'targa' or p_colonne ? 'codice_cliente')
      and not exists (
        select 1
        from jsonb_each(p_colonne) as e (chiave, valore)
        where e.chiave not in (
            'codice_cliente', 'nome', 'cognome', 'ragione_sociale', 'telefono', 'email',
            'targa', 'marca', 'modello', 'anno', 'telaio'
          )
          or jsonb_typeof(e.valore) <> 'string'
          or char_length(e.valore #>> '{}') not between 1 and 200
      )
  end;
$$;

comment on function public.mappatura_import_valida(jsonb) is
  'Controlla un''associazione di colonne dell''import: chiavi note, valori testo 1-200, targa o codice.';

-- ---------------------------------------------------------------------------------------------------
-- import_mappature
-- ---------------------------------------------------------------------------------------------------

create table public.import_mappature (
  id uuid primary key default gen_random_uuid(),
  officina_id uuid not null references public.officine (id) on delete cascade,
  nome text not null check (char_length(trim(nome)) between 1 and 60),
  colonne jsonb not null check (public.mappatura_import_valida(colonne)),
  creata_da uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (officina_id, nome)
);

comment on table public.import_mappature is
  'Associazioni di colonne dell''import salvate da ogni officina, per riusarle al prossimo file.';
comment on column public.import_mappature.nome is
  'Nome scelto dal titolare (es. "GESTITYRE"), unico nell''officina.';
comment on column public.import_mappature.colonne is
  'Colonna di TyreCare -> intestazione del file, es. {"targa": "Targa veicolo"}.';
comment on column public.import_mappature.creata_da is 'Chi ha salvato l''associazione.';

create trigger import_mappature_updated_at
  before update on public.import_mappature
  for each row execute function public.imposta_updated_at();

alter table public.import_mappature enable row level security;

-- Solo il titolare (come l'import): l'operatore e le altre officine non vedono e non scrivono nulla
create policy "import_mappature: lettura titolare"
  on public.import_mappature for select to authenticated
  using (public.is_titolare_officina(officina_id));

create policy "import_mappature: inserimento titolare"
  on public.import_mappature for insert to authenticated
  with check (public.is_titolare_officina(officina_id));

create policy "import_mappature: modifica titolare"
  on public.import_mappature for update to authenticated
  using (public.is_titolare_officina(officina_id))
  with check (public.is_titolare_officina(officina_id));

create policy "import_mappature: eliminazione titolare"
  on public.import_mappature for delete to authenticated
  using (public.is_titolare_officina(officina_id));

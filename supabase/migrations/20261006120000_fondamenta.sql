-- Fase 1 — Fondamenta: profili, officine, utenti delle officine con ruoli (PLAN P12, P16) e policy RLS.
--
-- Principi:
-- - ogni tabella ha RLS attiva; senza una policy che lo permetta, nessun accesso dal client;
-- - i ruoli si leggono con funzioni SQL `security definer` (evitano la ricorsione delle policy);
-- - i campi "di potere" (ruolo globale, stato di affiliazione) li cambia solo un ADMIN o il backend
--   con la service role: lo garantisce un trigger, perché le policy RLS non distinguono le colonne.

-- ---------------------------------------------------------------------------------------------------
-- Tipi
-- ---------------------------------------------------------------------------------------------------

create type public.ruolo as enum ('ADMIN', 'OFFICINA', 'CLIENTE');
create type public.ruolo_officina as enum ('TITOLARE', 'OPERATORE');
create type public.stato_affiliazione as enum ('IN_ATTESA', 'ATTIVA', 'SOSPESA');

-- ---------------------------------------------------------------------------------------------------
-- Tabelle
-- ---------------------------------------------------------------------------------------------------

-- Un profilo per ogni account (auth.users): è la persona, indipendente dalle officine.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  ruolo public.ruolo not null default 'CLIENTE',
  nome text not null default '' check (char_length(nome) <= 100),
  cognome text not null default '' check (char_length(cognome) <= 100),
  telefono text check (telefono ~ '^\+?[0-9 ]{6,20}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Profilo di un account TyreCare (1:1 con auth.users).';
comment on column public.profiles.ruolo is 'Ruolo globale; modificabile solo da ADMIN o service role.';

create table public.officine (
  id uuid primary key default gen_random_uuid(),
  ragione_sociale text not null check (char_length(ragione_sociale) between 2 and 200),
  partita_iva text not null unique check (partita_iva ~ '^[0-9]{11}$'),
  indirizzo text not null default '',
  cap text check (cap ~ '^[0-9]{5}$'),
  citta text not null default '',
  provincia text check (provincia ~ '^[A-Z]{2}$'),
  latitudine numeric(9, 6) check (latitudine between -90 and 90),
  longitudine numeric(9, 6) check (longitudine between -180 and 180),
  telefono text check (telefono ~ '^\+?[0-9 ]{6,20}$'),
  email text check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  -- Orari di apertura, es. {"lun": [["08:30","12:30"],["14:30","19:00"]], "dom": []}
  orari jsonb not null default '{}'::jsonb check (jsonb_typeof(orari) = 'object'),
  stato_affiliazione public.stato_affiliazione not null default 'IN_ATTESA',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.officine is 'Officine/gommisti affiliati a TyreCare.';
comment on column public.officine.stato_affiliazione is 'Modificabile solo da ADMIN o service role.';

-- Dipendenti di un'officina: TITOLARE gestisce officina e utenti, OPERATORE lavora sui dati (P16).
create table public.officina_utenti (
  officina_id uuid not null references public.officine (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  ruolo public.ruolo_officina not null default 'OPERATORE',
  created_at timestamptz not null default now(),
  primary key (officina_id, profile_id)
);

create index officina_utenti_profile_id_idx on public.officina_utenti (profile_id);

comment on table public.officina_utenti is 'Utenti di un''officina con il loro livello (TITOLARE/OPERATORE).';

-- ---------------------------------------------------------------------------------------------------
-- Funzioni per i ruoli (usate nelle policy)
-- ---------------------------------------------------------------------------------------------------
-- `security definer` + search_path vuoto: leggono le tabelle senza passare dalle policy (niente
-- ricorsione) e non sono esposte a oggetti con lo stesso nome in altri schemi.
-- Rispondono solo su chi sta chiamando (auth.uid()), quindi non rivelano dati di altri.

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and ruolo = 'ADMIN'
  );
$$;

create function public.is_membro_officina(p_officina_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.officina_utenti
    where officina_id = p_officina_id and profile_id = (select auth.uid())
  );
$$;

create function public.is_titolare_officina(p_officina_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.officina_utenti
    where officina_id = p_officina_id
      and profile_id = (select auth.uid())
      and ruolo = 'TITOLARE'
  );
$$;

-- Vero se l'utente corrente lavora in almeno un'officina in comune con p_profile_id (colleghi).
create function public.is_collega(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.officina_utenti mio
    join public.officina_utenti altro on altro.officina_id = mio.officina_id
    where mio.profile_id = (select auth.uid()) and altro.profile_id = p_profile_id
  );
$$;

revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.is_membro_officina(uuid) from public, anon;
revoke execute on function public.is_titolare_officina(uuid) from public, anon;
revoke execute on function public.is_collega(uuid) from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_membro_officina(uuid) to authenticated;
grant execute on function public.is_titolare_officina(uuid) to authenticated;
grant execute on function public.is_collega(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------------
-- Trigger
-- ---------------------------------------------------------------------------------------------------

create function public.imposta_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.imposta_updated_at();

create trigger officine_updated_at
  before update on public.officine
  for each row execute function public.imposta_updated_at();

-- Alla registrazione crea il profilo. Il ruolo è SEMPRE 'CLIENTE': i metadati della registrazione li
-- sceglie l'utente, quindi da lì si prendono solo nome e cognome.
create function public.crea_profilo_nuovo_utente()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, nome, cognome)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'nome', ''), 100),
    left(coalesce(new.raw_user_meta_data ->> 'cognome', ''), 100)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.crea_profilo_nuovo_utente();

-- Blocca la modifica dei campi riservati da parte di utenti non ADMIN.
-- auth.uid() è nullo per service role, migrazioni e seed: in quei casi la modifica è permessa.
create function public.proteggi_campi_riservati()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or public.is_admin() then
    return new;
  end if;

  -- IF annidati: PL/pgSQL non interrompe la valutazione di `and`, e new.ruolo su `officine`
  -- (o new.stato_affiliazione su `profiles`) darebbe errore.
  if tg_table_name = 'profiles' then
    if new.ruolo is distinct from old.ruolo then
      raise exception 'Solo un amministratore può cambiare il ruolo di un utente'
        using errcode = '42501';
    end if;
  elsif tg_table_name = 'officine' then
    if new.stato_affiliazione is distinct from old.stato_affiliazione then
      raise exception 'Solo un amministratore può cambiare lo stato di affiliazione'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create trigger profiles_proteggi_campi
  before update on public.profiles
  for each row execute function public.proteggi_campi_riservati();

create trigger officine_proteggi_campi
  before update on public.officine
  for each row execute function public.proteggi_campi_riservati();

-- Un'officina non può restare senza TITOLARE per mano di un utente (es. il titolare che si rimuove).
-- Gira dopo la modifica, quindi conta i titolari rimasti. ADMIN e service role sono esclusi, così
-- l'eliminazione a cascata di un'officina o di un account non viene bloccata.
create function public.verifica_titolare_rimasto()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or public.is_admin() then
    return null;
  end if;

  if old.ruolo = 'TITOLARE' and not exists (
    select 1 from public.officina_utenti
    where officina_id = old.officina_id and ruolo = 'TITOLARE'
  ) then
    raise exception 'L''officina deve avere almeno un titolare' using errcode = '23514';
  end if;

  return null;
end;
$$;

create trigger officina_utenti_titolare_rimasto
  after update or delete on public.officina_utenti
  for each row execute function public.verifica_titolare_rimasto();

-- ---------------------------------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.officine enable row level security;
alter table public.officina_utenti enable row level security;

-- profiles: ognuno vede e modifica il proprio; i colleghi di officina si vedono; l'ADMIN vede tutto.
-- Nessuna policy di insert/delete: il profilo nasce dal trigger e muore con l'account.
create policy "profiles: lettura propria, colleghi, admin"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_collega(id) or public.is_admin());

create policy "profiles: modifica propria o admin"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()) or public.is_admin())
  with check (id = (select auth.uid()) or public.is_admin());

-- officine: quelle ATTIVE sono pubbliche (lista officine per le prenotazioni, anche senza login);
-- i membri vedono la propria in qualunque stato. Crea ed elimina solo l'ADMIN; modifica il TITOLARE.
create policy "officine: lettura attive"
  on public.officine for select to anon, authenticated
  using (stato_affiliazione = 'ATTIVA');

create policy "officine: lettura membri e admin"
  on public.officine for select to authenticated
  using (public.is_membro_officina(id) or public.is_admin());

create policy "officine: creazione admin"
  on public.officine for insert to authenticated
  with check (public.is_admin());

create policy "officine: modifica titolare o admin"
  on public.officine for update to authenticated
  using (public.is_titolare_officina(id) or public.is_admin())
  with check (public.is_titolare_officina(id) or public.is_admin());

create policy "officine: eliminazione admin"
  on public.officine for delete to authenticated
  using (public.is_admin());

-- officina_utenti: i membri vedono i colleghi; il TITOLARE (o l'ADMIN) gestisce i membri.
create policy "officina_utenti: lettura membri e admin"
  on public.officina_utenti for select to authenticated
  using (public.is_membro_officina(officina_id) or public.is_admin());

create policy "officina_utenti: inserimento titolare o admin"
  on public.officina_utenti for insert to authenticated
  with check (public.is_titolare_officina(officina_id) or public.is_admin());

create policy "officina_utenti: modifica titolare o admin"
  on public.officina_utenti for update to authenticated
  using (public.is_titolare_officina(officina_id) or public.is_admin())
  with check (public.is_titolare_officina(officina_id) or public.is_admin());

create policy "officina_utenti: eliminazione titolare o admin"
  on public.officina_utenti for delete to authenticated
  using (public.is_titolare_officina(officina_id) or public.is_admin());

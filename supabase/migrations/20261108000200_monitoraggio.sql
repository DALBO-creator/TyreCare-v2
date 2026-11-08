-- T244: monitoraggio del pilota, parte del database (R33, R34).
--
-- 1. versione_database(): l'ultima migrazione applicata al database. La pagina admin la confronta con
--    quella che conosce la build dell'app: se il database è indietro, vanno pubblicate le migrazioni.
--    Solo ADMIN (e chi non ha un utente: editor SQL, service role), come attiva_officina; anon non ha
--    EXECUTE.
-- 2. errori_app: gli errori non gestiti che gli utenti con un account incontrano nell'app (al posto di un
--    servizio esterno come Sentry). L'id lo genera il browser, così un reinvio dopo un errore di rete non
--    crea un doppione (stessa chiave primaria → 23505, che l'app tratta come "già inviato"). Ognuno scrive
--    solo a proprio nome; li legge solo l'ADMIN (neanche l'autore). Nessuna modifica né eliminazione
--    dall'app. Al massimo 30 in 24 ore per autore (trigger limita_errori_app).
-- 3. pulisci_errori_app(): cancella gli errori più vecchi di 30 giorni; la chiama un job notturno.
--    Con l'account se ne vanno anche i suoi errori (on delete cascade).
--
-- Nessuna tabella e nessun dato esistenti cambiano.

-- ---------------------------------------------------------------- versione del database

create function public.versione_database()
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and not public.is_admin() then
    raise exception 'Accesso riservato' using errcode = '42501';
  end if;

  return (select max(version) from supabase_migrations.schema_migrations);
end;
$$;

revoke execute on function public.versione_database() from public, anon;
grant execute on function public.versione_database() to authenticated;

-- ---------------------------------------------------------------- errori dell'app

create table public.errori_app (
  id uuid primary key,
  autore_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- Pagina dell'app senza parametri (es. '/garage/:id')
  percorso text not null default '' check (char_length(percorso) <= 200),
  messaggio text not null check (char_length(messaggio) between 1 and 500),
  -- Dettaglio tecnico (stack) già accorciato dall'app
  dettaglio text not null default '' check (char_length(dettaglio) <= 2000),
  -- Versione dell'app (build)
  versione text not null default '' check (char_length(versione) <= 40),
  -- Browser (user agent)
  agente text not null default '' check (char_length(agente) <= 300),
  created_at timestamptz not null default now()
);

create index errori_app_autore_id_created_at_idx on public.errori_app (autore_id, created_at);
create index errori_app_created_at_idx on public.errori_app (created_at);

comment on table public.errori_app is
  'Errori dell''app segnalati dal browser degli utenti con un account. Li legge solo l''ADMIN; si cancellano dopo 30 giorni.';

alter table public.errori_app enable row level security;

create policy "errori_app: lettura admin"
  on public.errori_app for select to authenticated
  using ((select public.is_admin()));

create policy "errori_app: inserimento proprio"
  on public.errori_app for insert to authenticated
  with check (autore_id = (select auth.uid()));

revoke update, delete on public.errori_app from anon, authenticated;

-- A differenza di limita_commenti serve `security definer`: l'autore non legge le sue righe (la RLS le
-- mostra solo all'ADMIN), quindi con i suoi permessi conterebbe sempre 0. `created_at` è forzato a now():
-- con una data vecchia si aggirerebbe il limite. Il lock per autore mette in fila gli invii contemporanei
-- dello stesso utente, così il conteggio non si può superare con richieste in parallelo.
create function public.limita_errori_app()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.created_at := now();
  perform pg_advisory_xact_lock(hashtext('errori_app:' || new.autore_id::text));
  if (
    select count(*) from public.errori_app
    where autore_id = new.autore_id and created_at > now() - interval '24 hours'
  ) >= 30 then
    raise exception 'TROPPI_ERRORI' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger limita_errori_app
  before insert on public.errori_app
  for each row execute function public.limita_errori_app();

-- ---------------------------------------------------------------- pulizia dopo 30 giorni

-- Restituisce quanti errori ha cancellato. `p_adesso` serve ai test.
-- Per cambiare i 30 giorni: nuova migrazione con `create or replace function`.
create function public.pulisci_errori_app(p_adesso timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quanti integer;
begin
  delete from public.errori_app
  where created_at < p_adesso - interval '30 days';

  get diagnostics v_quanti = row_count;
  return v_quanti;
end;
$$;

-- La chiama solo il job
revoke execute on function public.pulisci_errori_app(timestamptz)
  from public, anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;

-- Ogni notte all'1:50 (UTC)
select cron.schedule(
  'pulizia-errori-app',
  '50 1 * * *',
  $$select public.pulisci_errori_app()$$
);

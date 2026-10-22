-- Pilota (T015): commenti (feedback) che officine e clienti mandano dall'app.
--
-- - Chiunque abbia un account scrive commenti a proprio nome; se indica un'officina deve esserne membro
--   (il cliente la lascia vuota). L'id lo genera il browser, così un invio ripetuto dopo un errore di rete
--   non crea un doppione (stessa chiave primaria → errore 23505, che l'app tratta come "già inviato").
-- - Li legge l'autore (i suoi) e l'ADMIN. Nessuna modifica né eliminazione dall'app: solo l'ADMIN dalla
--   dashboard di Supabase.
-- - Contro gli abusi: al massimo 20 commenti in 24 ore per autore (trigger `limita_commenti`).

create table public.commenti (
  id uuid primary key,
  autore_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  officina_id uuid references public.officine (id) on delete set null,
  -- Pagina dell'app da cui è partito il commento (es. '/garage')
  percorso text not null default '' check (char_length(percorso) <= 200),
  testo text not null check (char_length(trim(testo)) between 3 and 2000),
  created_at timestamptz not null default now()
);

create index commenti_autore_id_created_at_idx on public.commenti (autore_id, created_at);
create index commenti_officina_id_idx on public.commenti (officina_id);

comment on table public.commenti is
  'Commenti (feedback) degli utenti durante il pilota. Li legge solo l''autore e l''ADMIN.';

alter table public.commenti enable row level security;

create policy "commenti: lettura propria o admin"
  on public.commenti for select to authenticated
  using (autore_id = (select auth.uid()) or (select public.is_admin()));

create policy "commenti: inserimento proprio"
  on public.commenti for insert to authenticated
  with check (
    autore_id = (select auth.uid())
    and (officina_id is null or public.is_membro_officina(officina_id))
  );

revoke update, delete on public.commenti from anon, authenticated;

-- Il conteggio gira con i permessi di chi scrive (niente `security definer`): la RLS gli mostra le sue
-- righe, cioè proprio quelle da contare. `created_at` è forzato a now(): altrimenti con una data vecchia
-- si potrebbe aggirare il limite.
create function public.limita_commenti()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_at := now();
  if (
    select count(*) from public.commenti
    where autore_id = new.autore_id and created_at > now() - interval '24 hours'
  ) >= 20 then
    raise exception 'TROPPI_COMMENTI' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger limita_commenti
  before insert on public.commenti
  for each row execute function public.limita_commenti();

-- Accettazione di privacy e termini: per ogni account resta scritto quale versione ha accettato e quando
-- (serve a dimostrare l'accettazione, P17). Nulli per gli account che ci sono già.

alter table public.profiles
  add column termini_versione text
    check (char_length(termini_versione) between 1 and 40),
  add column termini_accettati_il timestamptz;

comment on column public.profiles.termini_versione is
  'Versione dei termini e dell''informativa accettata (dai metadati della registrazione o da accetta_termini).';
comment on column public.profiles.termini_accettati_il is
  'Quando è stata accettata la versione indicata in termini_versione.';

-- Come nella migrazione del 6 ottobre, più i due campi. Il ruolo è SEMPRE 'CLIENTE': i metadati della
-- registrazione li sceglie l'utente, quindi da lì si prendono solo nome, cognome e versione dei termini.
create or replace function public.crea_profilo_nuovo_utente()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_termini text := btrim(new.raw_user_meta_data ->> 'termini_versione');
begin
  insert into public.profiles (id, nome, cognome, termini_versione, termini_accettati_il)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'nome', ''), 100),
    left(coalesce(new.raw_user_meta_data ->> 'cognome', ''), 100),
    case when coalesce(v_termini, '') <> '' then left(v_termini, 40) end,
    case when coalesce(v_termini, '') <> '' then now() end
  );
  return new;
end;
$$;

-- Per chi è già registrato quando cambiano i termini: aggiorna il proprio profilo
create function public.accetta_termini(p_versione text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_versione text := btrim(p_versione);
begin
  if (select auth.uid()) is null then
    raise exception 'Accesso richiesto' using errcode = '42501';
  end if;

  if coalesce(v_versione, '') = '' or char_length(v_versione) > 40 then
    raise exception 'VERSIONE_NON_VALIDA' using errcode = '22023';
  end if;

  update public.profiles
  set termini_versione = v_versione, termini_accettati_il = now()
  where id = (select auth.uid());
end;
$$;

revoke execute on function public.accetta_termini(text) from public, anon;
grant execute on function public.accetta_termini(text) to authenticated;

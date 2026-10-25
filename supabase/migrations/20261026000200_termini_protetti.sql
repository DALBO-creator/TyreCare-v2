-- T078: la versione dei termini accettata e la sua data restano una prova affidabile (P17).
-- La policy "profiles: modifica propria o admin" permetteva all'utente di riscriverle con un update
-- diretto del proprio profilo (es. termini_accettati_il = '2020-01-01'). Da qui in poi si cambiano solo
-- con accetta_termini, che mette l'ora del database. ADMIN e service role (auth.uid() nullo: migrazioni,
-- seed, funzioni lato server) restano liberi. La registrazione (crea_profilo_nuovo_utente) fa un insert,
-- quindi questo trigger non la tocca.

-- accetta_termini apre il permesso con un'impostazione locale alla transazione, solo per il proprio
-- update, e lo richiude subito dopo: un update diretto più avanti nella stessa transazione resta vietato.
create function public.proteggi_termini()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or public.is_admin() then
    return new;
  end if;

  if new.termini_versione is distinct from old.termini_versione
    or new.termini_accettati_il is distinct from old.termini_accettati_il then
    if coalesce(current_setting('tyrecare.accetta_termini', true), '') <> 'si' then
      raise exception 'I termini si accettano solo con accetta_termini' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

-- Come le altre funzioni trigger security definer del progetto: nessuno la chiama direttamente.
revoke execute on function public.proteggi_termini() from public, anon, authenticated;

create trigger profiles_proteggi_termini
  before update on public.profiles
  for each row execute function public.proteggi_termini();

-- Uguale alla versione di T054 (20261024184100_termini_accettati), più l'impostazione che autorizza il
-- trigger qui sopra. create or replace mantiene i grant di allora (solo authenticated).
create or replace function public.accetta_termini(p_versione text)
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

  perform set_config('tyrecare.accetta_termini', 'si', true);

  update public.profiles
  set termini_versione = v_versione, termini_accettati_il = now()
  where id = (select auth.uid());

  -- Richiuso subito: vale solo per l'update qui sopra.
  perform set_config('tyrecare.accetta_termini', '', true);
end;
$$;

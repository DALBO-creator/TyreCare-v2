-- T100: attivare e sospendere un'officina con una sola chiamata (pagina dell'amministratore, T061, R14).
-- attiva_officina mette lo stato ATTIVA e promuove a OFFICINA i titolari che sono ancora CLIENTE, nella
-- stessa transazione: cambiano insieme o per niente. sospendi_officina mette SOSPESA (l'officina sparisce
-- ai clienti: la policy di lettura pubblica vuole ATTIVA) e non tocca il ruolo dei titolari (R14).
-- Permesse agli amministratori e a chi non ha un utente (editor SQL di Supabase, service role), come
-- crea_officina_con_titolare. anon non ha EXECUTE. Errore atteso (messaggio = chiave, codice P0001):
-- OFFICINA_NON_TROVATA. Entrambe ripetibili.
-- Dentro una funzione security definer auth.uid() resta quello di chi chiama: il trigger
-- proteggi_campi_riservati vede l'admin e lascia passare i cambi di stato e di ruolo.
-- Nessuna tabella e nessun dato esistente cambiano.

create function public.attiva_officina(p_officina_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and not public.is_admin() then
    raise exception 'Accesso riservato' using errcode = '42501';
  end if;

  if not exists (select 1 from public.officine where id = p_officina_id) then
    raise exception 'OFFICINA_NON_TROVATA';
  end if;

  update public.officine set stato_affiliazione = 'ATTIVA'
  where id = p_officina_id and stato_affiliazione is distinct from 'ATTIVA';

  -- Un ADMIN (o chi è già OFFICINA) resta com'è: si promuove solo un CLIENTE.
  update public.profiles p set ruolo = 'OFFICINA'
  from public.officina_utenti m
  where m.officina_id = p_officina_id
    and m.ruolo = 'TITOLARE'
    and m.profile_id = p.id
    and p.ruolo = 'CLIENTE';
end;
$$;

create function public.sospendi_officina(p_officina_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and not public.is_admin() then
    raise exception 'Accesso riservato' using errcode = '42501';
  end if;

  if not exists (select 1 from public.officine where id = p_officina_id) then
    raise exception 'OFFICINA_NON_TROVATA';
  end if;

  -- R14: il ruolo dei titolari non cambia.
  update public.officine set stato_affiliazione = 'SOSPESA'
  where id = p_officina_id and stato_affiliazione is distinct from 'SOSPESA';
end;
$$;

comment on function public.attiva_officina(uuid) is
  'Mette l''officina ATTIVA e porta a OFFICINA i suoi titolari ancora CLIENTE. Solo admin o senza utente.';
comment on function public.sospendi_officina(uuid) is
  'Mette l''officina SOSPESA (invisibile ai clienti); il ruolo dei titolari non cambia. Solo admin o senza utente.';

revoke execute on function public.attiva_officina(uuid) from public, anon;
revoke execute on function public.sospendi_officina(uuid) from public, anon;
grant execute on function public.attiva_officina(uuid) to authenticated;
grant execute on function public.sospendi_officina(uuid) to authenticated;

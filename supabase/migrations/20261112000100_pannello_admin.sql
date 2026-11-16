-- Pannello dell'amministratore (2026-11-12): sicurezza dell'account ADMIN e strumenti di correzione.
--
-- 1. Verifica in due passaggi obbligatoria: `is_admin()` è vero solo se la sessione ha completato la
--    2FA (claim `aal` = 'aal2' del JWT di Supabase Auth). Con la sola password l'account ADMIN si
--    comporta come un utente normale: RLS e funzioni admin lo respingono. Una password rubata non basta.
--    Se si perde il telefono: dall'editor SQL `delete from auth.mfa_factors where user_id = '<id>';`
--    e alla prossima apertura del pannello si registra di nuovo l'app di autenticazione.
-- 2. Il ruolo ADMIN si dà e si toglie solo dall'editor SQL / service role (auth.uid() nullo): nemmeno un
--    ADMIN può creare altri ADMIN dall'app (un account admin compromesso non si "moltiplica").
-- 3. Registro delle azioni dell'admin (`admin_registro`): sola lettura per l'admin, scritto da trigger e
--    dalle funzioni di questa migrazione. Nessuno può modificarlo o cancellarlo dal client.
-- 4. Funzioni del pannello (tutte security definer, solo admin con 2FA):
--    admin_riepilogo, admin_cerca_utenti, admin_correggi_profilo, admin_cambia_ruolo,
--    admin_conferma_email, admin_blocca_utente, admin_disconnetti_utente.
-- Nessun dato esistente cambia.

-- ---------------------------------------------------------------------------------------------------
-- 1. is_admin con la 2FA
-- ---------------------------------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and ruolo = 'ADMIN'
    );
$$;

comment on function public.is_admin() is
  'Vero se chi chiama ha ruolo ADMIN e ha completato la verifica in due passaggi (aal2).';

-- ---------------------------------------------------------------------------------------------------
-- 2. Il ruolo ADMIN solo dall'editor SQL
-- ---------------------------------------------------------------------------------------------------

create function public.proteggi_ruolo_admin()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return new;
  end if;
  if new.ruolo is distinct from old.ruolo and (new.ruolo = 'ADMIN' or old.ruolo = 'ADMIN') then
    raise exception 'Il ruolo di amministratore si cambia solo dal database' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function public.proteggi_ruolo_admin() from public, anon, authenticated;

create trigger profiles_proteggi_ruolo_admin
  before update on public.profiles
  for each row execute function public.proteggi_ruolo_admin();

-- ---------------------------------------------------------------------------------------------------
-- 3. Registro delle azioni dell'admin
-- ---------------------------------------------------------------------------------------------------

create table public.admin_registro (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  admin_id uuid references public.profiles (id) on delete set null,
  azione text not null check (char_length(azione) between 1 and 60),
  tabella text not null default '' check (char_length(tabella) <= 60),
  oggetto_id text not null default '' check (char_length(oggetto_id) <= 100),
  dettagli jsonb not null default '{}'::jsonb
);

create index admin_registro_created_at_idx on public.admin_registro (created_at desc);

comment on table public.admin_registro is
  'Azioni fatte da un ADMIN (registro di controllo). Lo scrivono solo trigger e funzioni security definer.';

alter table public.admin_registro enable row level security;

-- Solo lettura per l'admin; nessuna policy di scrittura: il client non può inserire, cambiare o cancellare.
create policy "admin_registro: lettura admin"
  on public.admin_registro for select to authenticated
  using ((select public.is_admin()));

revoke insert, update, delete, truncate on public.admin_registro from anon, authenticated;

create function public.registra_admin(
  p_azione text,
  p_tabella text,
  p_oggetto_id text,
  p_dettagli jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.admin_registro (admin_id, azione, tabella, oggetto_id, dettagli)
  values ((select auth.uid()), p_azione, p_tabella, coalesce(p_oggetto_id, ''), coalesce(p_dettagli, '{}'));
$$;

-- Interna: la chiamano solo le funzioni e i trigger di questa migrazione.
revoke execute on function public.registra_admin(text, text, text, jsonb) from public, anon, authenticated;

-- Trigger: ogni scrittura fatta da un admin (con 2FA) su queste tabelle finisce nel registro, con i
-- campi cambiati (vecchio → nuovo) per gli update. Copre anche attiva/sospendi/rifiuta e il piano.
create function public.registra_scrittura_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_vecchio jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_nuovo jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_dettagli jsonb := '{}'::jsonb;
  v_chiave text;
  v_id text;
begin
  if (select auth.uid()) is null or not public.is_admin() then
    return null;
  end if;

  if tg_op = 'UPDATE' then
    for v_chiave in select jsonb_object_keys(v_nuovo) loop
      if v_chiave <> 'updated_at' and v_vecchio -> v_chiave is distinct from v_nuovo -> v_chiave then
        v_dettagli := v_dettagli
          || jsonb_build_object(v_chiave, jsonb_build_array(v_vecchio -> v_chiave, v_nuovo -> v_chiave));
      end if;
    end loop;
    if v_dettagli = '{}'::jsonb then
      return null;
    end if;
  elsif tg_op = 'DELETE' then
    v_dettagli := v_vecchio;
  else
    v_dettagli := v_nuovo;
  end if;

  v_id := coalesce(
    coalesce(v_nuovo, v_vecchio) ->> 'id',
    coalesce(v_nuovo, v_vecchio) ->> 'officina_id',
    ''
  );
  perform public.registra_admin(lower(tg_op), tg_table_name, v_id, v_dettagli);
  return null;
end;
$$;

revoke execute on function public.registra_scrittura_admin() from public, anon, authenticated;

create trigger profiles_registro_admin
  after insert or update or delete on public.profiles
  for each row execute function public.registra_scrittura_admin();
create trigger officine_registro_admin
  after insert or update or delete on public.officine
  for each row execute function public.registra_scrittura_admin();
create trigger officina_utenti_registro_admin
  after insert or update or delete on public.officina_utenti
  for each row execute function public.registra_scrittura_admin();
create trigger abbonamenti_registro_admin
  after insert or update or delete on public.abbonamenti
  for each row execute function public.registra_scrittura_admin();

-- ---------------------------------------------------------------------------------------------------
-- 4. Funzioni del pannello
-- ---------------------------------------------------------------------------------------------------

create function public.richiedi_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo l''amministratore, con la verifica in due passaggi' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function public.richiedi_admin() from public, anon, authenticated;

-- Numeri della piattaforma e cose da guardare, in un solo json.
create function public.admin_riepilogo()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.richiedi_admin();
  return jsonb_build_object(
    'utenti', (select count(*) from auth.users),
    'utenti_7_giorni', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'utenti_non_confermati', (select count(*) from auth.users where email_confirmed_at is null),
    'utenti_bloccati', (select count(*) from auth.users where banned_until > now()),
    'accessi_24_ore', (select count(*) from auth.users where last_sign_in_at > now() - interval '24 hours'),
    'officine_attive', (select count(*) from public.officine where stato_affiliazione = 'ATTIVA'),
    'officine_in_attesa', (select count(*) from public.officine where stato_affiliazione = 'IN_ATTESA'),
    'officine_sospese', (select count(*) from public.officine where stato_affiliazione = 'SOSPESA'),
    'abbonamenti_scaduti', (select count(*) from public.abbonamenti where stato = 'SCADUTO'),
    'prove_in_scadenza', (
      select count(*) from public.abbonamenti
      where stato = 'PROVA' and prova_fino_al between current_date and current_date + 7
    ),
    'clienti', (select count(*) from public.clienti_officina),
    'veicoli', (select count(*) from public.veicoli),
    'controlli', (select count(*) from public.controlli),
    'controlli_7_giorni', (
      select count(*) from public.controlli where created_at > now() - interval '7 days'
    ),
    'prenotazioni_in_corso', (
      select count(*) from public.prenotazioni where stato in ('RICHIESTA', 'PROPOSTA', 'CONFERMATA')
    ),
    'prenotazioni_7_giorni', (
      select count(*) from public.prenotazioni where created_at > now() - interval '7 days'
    ),
    'commenti_7_giorni', (
      select count(*) from public.commenti where created_at > now() - interval '7 days'
    ),
    'iscrizioni_push', (select count(*) from public.iscrizioni_push)
  );
end;
$$;

revoke execute on function public.admin_riepilogo() from public, anon;
grant execute on function public.admin_riepilogo() to authenticated;

-- Ricerca degli account per email, nome, cognome o telefono (vuoto = i 50 più recenti).
create function public.admin_cerca_utenti(p_testo text default '')
returns table (
  id uuid,
  email text,
  nome text,
  cognome text,
  telefono text,
  ruolo public.ruolo,
  created_at timestamptz,
  ultimo_accesso timestamptz,
  email_confermata boolean,
  bloccato boolean,
  con_2fa boolean,
  officine text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_testo text := btrim(coalesce(p_testo, ''));
  v_filtro text;
begin
  perform public.richiedi_admin();
  if char_length(v_testo) > 100 then
    raise exception 'TESTO_TROPPO_LUNGO' using errcode = '22023';
  end if;
  -- I caratteri jolly di LIKE scritti dall'admin valgono come testo
  v_filtro := '%' || replace(replace(replace(v_testo, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  return query
  select
    u.id,
    u.email::text,
    p.nome,
    p.cognome,
    p.telefono,
    p.ruolo,
    u.created_at,
    u.last_sign_in_at,
    u.email_confirmed_at is not null,
    coalesce(u.banned_until > now(), false),
    exists (select 1 from auth.mfa_factors f where f.user_id = u.id and f.status = 'verified'),
    coalesce((
      select string_agg(o.ragione_sociale || ' (' || ou.ruolo::text || ')', ', ' order by o.ragione_sociale)
      from public.officina_utenti ou
      join public.officine o on o.id = ou.officina_id
      where ou.profile_id = u.id
    ), '')
  from auth.users u
  join public.profiles p on p.id = u.id
  where v_testo = ''
    or u.email ilike v_filtro
    or p.nome ilike v_filtro
    or p.cognome ilike v_filtro
    or (p.nome || ' ' || p.cognome) ilike v_filtro
    or coalesce(p.telefono, '') ilike v_filtro
    or u.id::text = v_testo
  order by u.created_at desc
  limit 50;
end;
$$;

revoke execute on function public.admin_cerca_utenti(text) from public, anon;
grant execute on function public.admin_cerca_utenti(text) to authenticated;

-- Correzione rapida di nome, cognome e telefono (il trigger del registro annota la modifica).
create function public.admin_correggi_profilo(
  p_utente uuid,
  p_nome text,
  p_cognome text,
  p_telefono text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.richiedi_admin();
  update public.profiles
  set nome = btrim(coalesce(p_nome, '')),
      cognome = btrim(coalesce(p_cognome, '')),
      telefono = nullif(btrim(coalesce(p_telefono, '')), '')
  where id = p_utente;
  if not found then
    raise exception 'UTENTE_NON_TROVATO';
  end if;
end;
$$;

revoke execute on function public.admin_correggi_profilo(uuid, text, text, text) from public, anon;
grant execute on function public.admin_correggi_profilo(uuid, text, text, text) to authenticated;

-- CLIENTE ↔ OFFICINA. ADMIN no (vedi il trigger sopra).
create function public.admin_cambia_ruolo(p_utente uuid, p_ruolo public.ruolo)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.richiedi_admin();
  if p_ruolo = 'ADMIN' or exists (select 1 from public.profiles where id = p_utente and ruolo = 'ADMIN') then
    raise exception 'RUOLO_ADMIN_SOLO_DAL_DATABASE';
  end if;
  update public.profiles set ruolo = p_ruolo where id = p_utente;
  if not found then
    raise exception 'UTENTE_NON_TROVATO';
  end if;
end;
$$;

revoke execute on function public.admin_cambia_ruolo(uuid, public.ruolo) from public, anon;
grant execute on function public.admin_cambia_ruolo(uuid, public.ruolo) to authenticated;

-- Conferma a mano l'email di un account (quando l'email di conferma non arriva).
create function public.admin_conferma_email(p_utente uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.richiedi_admin();
  update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now()) where id = p_utente;
  if not found then
    raise exception 'UTENTE_NON_TROVATO';
  end if;
  perform public.registra_admin('conferma_email', 'auth.users', p_utente::text);
end;
$$;

revoke execute on function public.admin_conferma_email(uuid) from public, anon;
grant execute on function public.admin_conferma_email(uuid) to authenticated;

-- Chiude tutte le sessioni dell'account: alla scadenza del token (al massimo 1 ora) deve rientrare.
create function public.admin_disconnetti_utente(p_utente uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.richiedi_admin();
  if not exists (select 1 from auth.users where id = p_utente) then
    raise exception 'UTENTE_NON_TROVATO';
  end if;
  delete from auth.sessions where user_id = p_utente;
  delete from auth.refresh_tokens where user_id = p_utente::text;
  perform public.registra_admin('disconnetti', 'auth.users', p_utente::text);
end;
$$;

revoke execute on function public.admin_disconnetti_utente(uuid) from public, anon;
grant execute on function public.admin_disconnetti_utente(uuid) to authenticated;

-- Blocca (o sblocca) l'accesso di un account e chiude le sue sessioni. Non si blocca un ADMIN né sé stessi.
create function public.admin_blocca_utente(p_utente uuid, p_blocca boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.richiedi_admin();
  if p_utente = (select auth.uid())
    or exists (select 1 from public.profiles where id = p_utente and ruolo = 'ADMIN') then
    raise exception 'NON_SI_BLOCCA_UN_ADMIN';
  end if;
  update auth.users
  set banned_until = case when p_blocca then now() + interval '100 years' end
  where id = p_utente;
  if not found then
    raise exception 'UTENTE_NON_TROVATO';
  end if;
  if p_blocca then
    delete from auth.sessions where user_id = p_utente;
    delete from auth.refresh_tokens where user_id = p_utente::text;
  end if;
  perform public.registra_admin(case when p_blocca then 'blocca' else 'sblocca' end, 'auth.users', p_utente::text);
end;
$$;

revoke execute on function public.admin_blocca_utente(uuid, boolean) from public, anon;
grant execute on function public.admin_blocca_utente(uuid, boolean) to authenticated;

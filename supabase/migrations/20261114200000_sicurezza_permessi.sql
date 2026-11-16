-- Sicurezza (lancio): permessi minimi dopo l'audit di RLS e funzioni.
-- 1) `anon` aveva tutti i permessi sulle tabelle (li dà Supabase in automatico) e lo fermava solo la RLS:
--    ora ha solo la lettura delle tre tabelle pubbliche (officine attive, servizi prenotabili, chiusure).
-- 2) Nessun ruolo dell'app può fare TRUNCATE / REFERENCES / TRIGGER.
-- 3) Le funzioni dei trigger non si chiamano dall'API.
-- 4) `officina_utenti`: il titolare non aggiunge più membri a mano (poteva aggiungere un utente
--    qualsiasi e leggerne così nome e telefono con `is_collega`) e non cambia le chiavi di una riga.
-- 5) `iscrizioni_push`: l'endpoint deve essere di un servizio push conosciuto (la funzione
--    `invia-notifica` fa una richiesta a quell'indirizzo: senza elenco sarebbe una SSRF).

-- ---------------------------------------------------------------- 1, 2: permessi sulle tabelle
revoke all on all tables in schema public from anon;
grant select on public.officine, public.servizi_officina, public.chiusure_officina to anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;
revoke all on all sequences in schema public from anon;

-- Tabelle e funzioni future: niente in automatico ad `anon`
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public
  revoke truncate, references, trigger on tables from authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke execute on functions from anon;

-- ---------------------------------------------------------------- 3: funzioni dei trigger
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as firma
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.prorettype = 'pg_catalog.trigger'::regtype
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.firma);
  end loop;
end;
$$;

-- Funzioni di servizio senza motivo di essere chiamate da chi non ha fatto l'accesso
revoke execute on function public.distanza_km(numeric, numeric, numeric, numeric) from public, anon;
revoke execute on function public.testo_gomme(bigint) from public, anon;
revoke execute on function public.testo_quando(date, public.fascia_oraria, timestamptz) from public, anon;
revoke execute on function public.testo_veicolo(text, text, text) from public, anon;
revoke execute on function public.stato_battistrada(numeric, public.stagione) from public, anon;

-- ---------------------------------------------------------------- 4: membri dell'officina
drop policy "officina_utenti: inserimento titolare o admin" on public.officina_utenti;
create policy "officina_utenti: inserimento admin" on public.officina_utenti
  for insert to authenticated
  with check (public.is_admin());

create function public.proteggi_chiavi_membro()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or public.is_admin() then
    return new;
  end if;
  if new.officina_id is distinct from old.officina_id
    or new.profile_id is distinct from old.profile_id then
    raise exception 'Solo un amministratore può spostare un membro' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function public.proteggi_chiavi_membro() from public, anon, authenticated;

create trigger officina_utenti_proteggi_chiavi
  before update on public.officina_utenti
  for each row execute function public.proteggi_chiavi_membro();

-- ---------------------------------------------------------------- 5: endpoint push
-- `not valid`: vale per le righe nuove, non blocca la migrazione per quelle già presenti.
alter table public.iscrizioni_push
  add constraint iscrizioni_push_endpoint_servizio_noto check (
    char_length(endpoint) <= 2000
    and endpoint ~ '^https://([a-z0-9-]+\.)*(googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com|push\.apple\.com)/[^\s]*$'
  ) not valid;

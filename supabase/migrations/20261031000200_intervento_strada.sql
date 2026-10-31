-- T139 (R18, PLAN P15) — Intervento su strada, parte 1: il database delle richieste d'aiuto.
--
-- Il cliente fermo per una gomma manda una richiesta con la posizione del telefono, una descrizione, il
-- telefono e la targa (facoltativa). La ricevono, come notifica, tutti i membri (titolare e operatori)
-- delle officine ATTIVE che offrono il servizio ("Offro l'aiuto su strada"), con la posizione impostata e
-- con la richiesta entro il loro raggio (5–100 km, di default 30). Se non c'è nessuna officina la
-- richiesta non parte e il cliente riceve subito l'errore NESSUNA_OFFICINA.
--
-- Chi vede che cosa (R18):
-- - il cliente vede le sue richieste; l'ADMIN tutte;
-- - i membri di un'officina vedono una richiesta (posizione esatta e telefono compresi) solo quando è
--   stata accettata dalla loro officina (`officina_id`). Prima dell'accettazione le officine vicine non
--   leggono la tabella: distanza, descrizione e targa le daranno le funzioni di T140;
-- - nessuno scrive direttamente nella tabella: solo le funzioni qui sotto (security definer).
--
-- Tempi: una richiesta APERTA scade dopo 2 ore; una ACCETTATA si chiude da sola dopo 24 ore; le richieste
-- ANNULLATE, SCADUTE o CHIUSE si cancellano dopo 90 giorni (job ogni 10 minuti).
-- Per cambiarli: migrazione nuova con `create or replace function` (e `alter column … set default` per
-- `scade_il`). Il job si toglie con `cron.unschedule('richieste-strada')`.
--
-- I valori nuovi di `tipo_notifica` si usano solo dentro corpi di funzioni plpgsql: in una migrazione non
-- si possono usare nella stessa transazione in cui vengono aggiunti.

alter type public.tipo_notifica add value 'STRADA_RICHIESTA';
alter type public.tipo_notifica add value 'STRADA_ACCETTATA';
alter type public.tipo_notifica add value 'STRADA_ANNULLATA';

-- ---------------------------------------------------------------------------------------------------
-- Officine: chi offre il servizio e fin dove
-- ---------------------------------------------------------------------------------------------------
-- Le cambia il titolare (o l'ADMIN) con la policy esistente "officine: modifica titolare o admin":
-- il trigger officine_proteggi_campi blocca solo stato, ragione sociale e partita IVA.

alter table public.officine
  add column intervento_strada boolean not null default false,
  add column raggio_strada_km integer not null default 30
    check (raggio_strada_km between 5 and 100);

comment on column public.officine.intervento_strada is
  'Vero se l''officina offre l''aiuto su strada (R18). La cambia il titolare.';
comment on column public.officine.raggio_strada_km is
  'Distanza massima (km, in linea d''aria) delle richieste di aiuto su strada che l''officina riceve.';

-- ---------------------------------------------------------------------------------------------------
-- Distanza in linea d'aria
-- ---------------------------------------------------------------------------------------------------
-- La stessa formula di `distanzaKm` in `packages/shared/src/distanza.ts` (emisenoverso, raggio 6371 km;
-- least(1, …) evita un errore di asin con i punti agli antipodi). Se cambia lì, va cambiata anche qui.

create function public.distanza_km(lat1 numeric, lon1 numeric, lat2 numeric, lon2 numeric)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select (
    2 * 6371 * asin(least(1, sqrt(
      sin(radians(lat2 - lat1) / 2) ^ 2
        + cos(radians(lat1)) * cos(radians(lat2)) * sin(radians(lon2 - lon1) / 2) ^ 2
    )))
  )::numeric;
$$;

comment on function public.distanza_km(numeric, numeric, numeric, numeric) is
  'Distanza in km in linea d''aria tra due punti (come distanzaKm di packages/shared).';

-- ---------------------------------------------------------------------------------------------------
-- Richieste
-- ---------------------------------------------------------------------------------------------------

create table public.richieste_strada (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.profiles (id) on delete cascade,
  latitudine numeric(9, 6) not null check (latitudine between -90 and 90),
  longitudine numeric(9, 6) not null check (longitudine between -180 and 180),
  descrizione text not null check (char_length(descrizione) between 1 and 500),
  telefono text not null check (telefono ~ '^\+?[0-9 ]{6,20}$'),
  targa text check (char_length(targa) <= 10),
  stato text not null default 'APERTA'
    check (stato in ('APERTA', 'ACCETTATA', 'ANNULLATA', 'SCADUTA', 'CHIUSA')),
  -- L'officina che ha accettato (null finché è APERTA)
  officina_id uuid references public.officine (id) on delete set null,
  accettata_il timestamptz,
  scade_il timestamptz not null default (now() + interval '2 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index richieste_strada_stato_scade_il_idx on public.richieste_strada (stato, scade_il);
create index richieste_strada_cliente_id_idx on public.richieste_strada (cliente_id);
create index richieste_strada_officina_id_idx on public.richieste_strada (officina_id);
-- Una sola richiesta in corso per cliente, anche con due chiamate nello stesso istante
create unique index richieste_strada_una_in_corso_idx on public.richieste_strada (cliente_id)
  where stato in ('APERTA', 'ACCETTATA');

comment on table public.richieste_strada is
  'Richieste di aiuto su strada dei clienti (R18). Si scrivono solo con le funzioni *_richiesta_strada.';

create trigger richieste_strada_updated_at
  before update on public.richieste_strada
  for each row execute function public.imposta_updated_at();

alter table public.richieste_strada enable row level security;

-- Nessuna policy per i membri delle officine vicine: prima dell'accettazione posizione esatta e telefono
-- non li vede nessuna officina (R18).
create policy "richieste_strada: lettura cliente, officina che ha accettato, admin"
  on public.richieste_strada for select to authenticated
  using (
    cliente_id = (select auth.uid())
    or (officina_id is not null and public.is_membro_officina(officina_id))
    or public.is_admin()
  );

-- Dall'app solo lettura; anon niente
revoke all on public.richieste_strada from anon, authenticated;
grant select on public.richieste_strada to authenticated;

-- ---------------------------------------------------------------------------------------------------
-- Nuova richiesta (cliente)
-- ---------------------------------------------------------------------------------------------------
-- Errori con chiave (l'app li traduce): POSIZIONE_NON_VALIDA, DESCRIZIONE_NON_VALIDA,
-- TELEFONO_NON_VALIDO, TARGA_NON_VALIDA, RICHIESTA_GIA_APERTA, NESSUNA_OFFICINA.
-- Prima del controllo "già aperta" chiude le richieste del cliente già scadute o da chiudere che il job
-- (ogni 10 minuti) non ha ancora sistemato: così chi vede "scaduta" può subito riprovare.

create function public.crea_richiesta_strada(
  p_latitudine numeric,
  p_longitudine numeric,
  p_descrizione text,
  p_telefono text,
  p_targa text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_descrizione text := trim(coalesce(p_descrizione, ''));
  v_telefono text := trim(coalesce(p_telefono, ''));
  v_targa text := nullif(upper(regexp_replace(coalesce(p_targa, ''), '[^A-Za-z0-9]', '', 'g')), '');
  v_officine uuid[];
  v_nomi text[];
  v_distanze numeric[];
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Accesso richiesto' using errcode = '42501';
  end if;

  if p_latitudine is null or p_longitudine is null
    or p_latitudine not between -90 and 90 or p_longitudine not between -180 and 180 then
    raise exception 'POSIZIONE_NON_VALIDA';
  end if;
  if char_length(v_descrizione) not between 1 and 500 then
    raise exception 'DESCRIZIONE_NON_VALIDA';
  end if;
  if v_telefono !~ '^\+?[0-9 ]{6,20}$' then
    raise exception 'TELEFONO_NON_VALIDO';
  end if;
  if char_length(v_targa) > 10 then
    raise exception 'TARGA_NON_VALIDA';
  end if;

  update public.richieste_strada
  set stato = 'SCADUTA'
  where cliente_id = v_uid and stato = 'APERTA' and scade_il < now();
  update public.richieste_strada
  set stato = 'CHIUSA'
  where cliente_id = v_uid and stato = 'ACCETTATA' and accettata_il < now() - interval '24 hours';

  if exists (
    select 1 from public.richieste_strada
    where cliente_id = v_uid and stato in ('APERTA', 'ACCETTATA')
  ) then
    raise exception 'RICHIESTA_GIA_APERTA';
  end if;

  -- Le officine vicine, dalla più vicina
  select
    coalesce(array_agg(v.id order by v.distanza), '{}'),
    coalesce(array_agg(v.ragione_sociale order by v.distanza), '{}'),
    coalesce(array_agg(v.distanza order by v.distanza), '{}')
  into v_officine, v_nomi, v_distanze
  from (
    select o.id, o.ragione_sociale, o.raggio_strada_km,
      public.distanza_km(o.latitudine, o.longitudine, p_latitudine, p_longitudine) as distanza
    from public.officine o
    where o.stato_affiliazione = 'ATTIVA'
      and o.intervento_strada
      and o.latitudine is not null
      and o.longitudine is not null
  ) v
  where v.distanza <= v.raggio_strada_km;

  if cardinality(v_officine) = 0 then
    raise exception 'NESSUNA_OFFICINA';
  end if;

  begin
    insert into public.richieste_strada (
      cliente_id, latitudine, longitudine, descrizione, telefono, targa
    )
    values (v_uid, p_latitudine, p_longitudine, v_descrizione, v_telefono, v_targa)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'RICHIESTA_GIA_APERTA';
  end;

  -- Una notifica per persona (chi lavora in due officine vicine la riceve una volta, con la più vicina);
  -- non a chi ha fatto la richiesta.
  insert into public.notifiche (destinatario_id, tipo, titolo, testo, link)
  select distinct on (u.profile_id)
    u.profile_id,
    'STRADA_RICHIESTA',
    'Richiesta di aiuto su strada',
    left(
      'Un automobilista fermo a '
        || case when v.distanza < 1 then 'meno di 1 km' else round(v.distanza) || ' km' end
        || ' da ' || v.ragione_sociale
        || ' chiede aiuto per una gomma. Apri la pagina per i dettagli.',
      600
    ),
    '/officina/strada'
  from unnest(v_officine, v_nomi, v_distanze) as v (officina_id, ragione_sociale, distanza)
  join public.officina_utenti u on u.officina_id = v.officina_id
  where u.profile_id <> v_uid
  order by u.profile_id, v.distanza;

  return v_id;
end;
$$;

comment on function public.crea_richiesta_strada(numeric, numeric, text, text, text) is
  'Il cliente chiede aiuto su strada: avvisa i membri delle officine vicine che offrono il servizio.';

-- ---------------------------------------------------------------------------------------------------
-- Annullamento (cliente)
-- ---------------------------------------------------------------------------------------------------
-- Solo il cliente della richiesta, finché è APERTA o ACCETTATA; se era accettata avvisa i membri
-- dell'officina. Altrimenti RICHIESTA_NON_DISPONIBILE (anche per le richieste di altri: non si rivela se
-- esistono).

create function public.annulla_richiesta_strada(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_richiesta public.richieste_strada;
begin
  if v_uid is null then
    raise exception 'Accesso richiesto' using errcode = '42501';
  end if;

  select * into v_richiesta
  from public.richieste_strada
  where id = p_id and cliente_id = v_uid and stato in ('APERTA', 'ACCETTATA')
  for update;
  if not found then
    raise exception 'RICHIESTA_NON_DISPONIBILE';
  end if;

  update public.richieste_strada set stato = 'ANNULLATA' where id = p_id;

  if v_richiesta.stato = 'ACCETTATA' and v_richiesta.officina_id is not null then
    insert into public.notifiche (destinatario_id, tipo, titolo, testo, link)
    select
      u.profile_id,
      'STRADA_ANNULLATA',
      'Aiuto su strada annullato',
      'Il cliente ha annullato la richiesta di aiuto su strada che avevate accettato.',
      '/officina/strada'
    from public.officina_utenti u
    where u.officina_id = v_richiesta.officina_id and u.profile_id <> v_uid;
  end if;
end;
$$;

comment on function public.annulla_richiesta_strada(uuid) is
  'Il cliente annulla la sua richiesta di aiuto su strada (APERTA o ACCETTATA).';

revoke execute on function public.crea_richiesta_strada(numeric, numeric, text, text, text)
  from public, anon;
revoke execute on function public.annulla_richiesta_strada(uuid) from public, anon;
grant execute on function public.crea_richiesta_strada(numeric, numeric, text, text, text)
  to authenticated;
grant execute on function public.annulla_richiesta_strada(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------------
-- Manutenzione (solo il job)
-- ---------------------------------------------------------------------------------------------------
-- Prima cancella le richieste finite da più di 90 giorni, poi fa scadere e chiude: così una richiesta
-- appena passata a SCADUTA o CHIUSA non viene cancellata nella stessa chiamata. `p_adesso` serve ai test.

create function public.manutenzione_richieste_strada(p_adesso timestamptz default now())
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.richieste_strada
  where stato in ('ANNULLATA', 'SCADUTA', 'CHIUSA')
    and updated_at < p_adesso - interval '90 days';

  update public.richieste_strada
  set stato = 'SCADUTA'
  where stato = 'APERTA' and scade_il < p_adesso;

  update public.richieste_strada
  set stato = 'CHIUSA'
  where stato = 'ACCETTATA' and accettata_il < p_adesso - interval '24 hours';
end;
$$;

comment on function public.manutenzione_richieste_strada(timestamptz) is
  'Job ogni 10 minuti: scadenza (2 ore), chiusura (24 ore) e cancellazione (90 giorni) delle richieste.';

revoke execute on function public.manutenzione_richieste_strada(timestamptz)
  from public, anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'richieste-strada',
  '*/10 * * * *',
  $$select public.manutenzione_richieste_strada()$$
);

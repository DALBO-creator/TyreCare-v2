-- T173 (R23, idee T164 e T166) — Aiuto su strada: niente auto-accettazione e limite di richieste per ora.
--
-- - `richieste_strada_vicine(officina)`: chi lavora in un'officina (titolare o operatore) e chiede aiuto
--   come cliente non vede la propria richiesta nell'elenco della sua officina (`r.cliente_id <> v_uid`).
--   Gli altri membri della stessa officina la vedono come prima.
-- - `accetta_richiesta_strada(richiesta, officina)`: la propria richiesta non si accetta. L'errore è lo
--   stesso di una richiesta già presa (RICHIESTA_NON_DISPONIBILE): non si dice perché.
-- - `crea_richiesta_strada(...)`: un cliente può creare al massimo **3** richieste nell'ultima ora, in
--   qualsiasi stato (anche annullate o scadute), poi TROPPE_RICHIESTE. Così chi annulla e ricrea non
--   riempie di notifiche le officine vicine. Il controllo viene dopo le chiusure automatiche e dopo
--   "una in corso" (RICHIESTA_GIA_APERTA resta l'errore di chi ne ha già una aperta), subito prima
--   dell'insert.
--
-- Il resto delle tre funzioni è identico a T139 (20261031000200) e T140 (20261031000300): stesse firme,
-- `create or replace` mantiene `grant`, `revoke` e commenti.
-- Per cambiare il limite (R23): numero e intervallo in `crea_richiesta_strada` (migrazione nuova), il
-- messaggio in `apps/web/src/lib/strada.ts` e la guida cliente.

-- ---------------------------------------------------------------------------------------------------
-- Nuova richiesta (cliente): limite di 3 all'ora
-- ---------------------------------------------------------------------------------------------------
-- Errori con chiave (l'app li traduce): POSIZIONE_NON_VALIDA, DESCRIZIONE_NON_VALIDA,
-- TELEFONO_NON_VALIDO, TARGA_NON_VALIDA, RICHIESTA_GIA_APERTA, TROPPE_RICHIESTE, NESSUNA_OFFICINA.
-- Prima del controllo "già aperta" chiude le richieste del cliente già scadute o da chiudere che il job
-- (ogni 10 minuti) non ha ancora sistemato: così chi vede "scaduta" può subito riprovare.

create or replace function public.crea_richiesta_strada(
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

  -- Al massimo 3 richieste nell'ultima ora, in qualsiasi stato (R23)
  if (
    select count(*) from public.richieste_strada
    where cliente_id = v_uid and created_at > now() - interval '1 hour'
  ) >= 3 then
    raise exception 'TROPPE_RICHIESTE';
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

-- ---------------------------------------------------------------------------------------------------
-- Elenco delle richieste vicine (membri dell'officina): senza le proprie
-- ---------------------------------------------------------------------------------------------------
-- Vuoto (non un errore) se l'officina non ha i requisiti: la pagina mostra "nessuna richiesta".
-- Le colonne di `returns table` sono variabili in plpgsql: nella query tutte le colonne hanno l'alias.

create or replace function public.richieste_strada_vicine(p_officina_id uuid)
returns table (
  id uuid,
  descrizione text,
  targa text,
  distanza_km numeric,
  created_at timestamptz,
  scade_il timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null or not public.is_membro_officina(p_officina_id) then
    raise exception 'Accesso negato' using errcode = '42501';
  end if;

  return query
  select r.id, r.descrizione, r.targa, round(v.distanza, 1), r.created_at, r.scade_il
  from public.officine o
  cross join public.richieste_strada r
  cross join lateral (
    select public.distanza_km(o.latitudine, o.longitudine, r.latitudine, r.longitudine) as distanza
  ) v
  where o.id = p_officina_id
    and o.stato_affiliazione = 'ATTIVA'
    and o.intervento_strada
    and o.latitudine is not null
    and o.longitudine is not null
    and r.stato = 'APERTA'
    and r.scade_il > now()
    and r.cliente_id <> v_uid
    and v.distanza <= o.raggio_strada_km
  order by r.created_at desc, r.id;
end;
$$;

-- ---------------------------------------------------------------------------------------------------
-- Accettazione (membri dell'officina): non la propria richiesta
-- ---------------------------------------------------------------------------------------------------
-- Ordine dei controlli: 1) autenticato e membro dell'officina, officina con i requisiti → altrimenti
-- 42501; 2) la richiesta, bloccata con `for update`: assente, non APERTA, scaduta o fatta da chi accetta
-- → RICHIESTA_NON_DISPONIBILE; 3) richiesta entro il raggio dell'officina → altrimenti 42501.
-- Il controllo del raggio viene dopo il blocco perché la posizione si legge dalla riga bloccata.

create or replace function public.accetta_richiesta_strada(p_id uuid, p_officina_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_officina public.officine;
  v_richiesta public.richieste_strada;
begin
  if v_uid is null or not public.is_membro_officina(p_officina_id) then
    raise exception 'Accesso negato' using errcode = '42501';
  end if;

  select o.* into v_officina
  from public.officine o
  where o.id = p_officina_id
    and o.stato_affiliazione = 'ATTIVA'
    and o.intervento_strada
    and o.latitudine is not null
    and o.longitudine is not null;
  if not found then
    raise exception 'Accesso negato' using errcode = '42501';
  end if;

  select r.* into v_richiesta
  from public.richieste_strada r
  where r.id = p_id
  for update;
  if not found or v_richiesta.stato <> 'APERTA' or v_richiesta.scade_il <= now() then
    raise exception 'RICHIESTA_NON_DISPONIBILE';
  end if;
  -- La propria richiesta non si accetta (R23): stesso errore, non si dice perché
  if v_richiesta.cliente_id = v_uid then
    raise exception 'RICHIESTA_NON_DISPONIBILE';
  end if;

  if public.distanza_km(
    v_officina.latitudine, v_officina.longitudine, v_richiesta.latitudine, v_richiesta.longitudine
  ) > v_officina.raggio_strada_km then
    raise exception 'Accesso negato' using errcode = '42501';
  end if;

  update public.richieste_strada
  set stato = 'ACCETTATA', officina_id = p_officina_id, accettata_il = now()
  where id = p_id;

  insert into public.notifiche (destinatario_id, tipo, titolo, testo, link)
  values (
    v_richiesta.cliente_id,
    'STRADA_ACCETTATA',
    'Un''officina sta arrivando',
    left(
      v_officina.ragione_sociale || ' ha accettato la tua richiesta di aiuto su strada. '
        || case
          when v_officina.telefono is not null then 'Telefono dell''officina: ' || v_officina.telefono || '.'
          else 'Resta dove sei: ti chiamerà al numero che hai indicato.'
        end,
      600
    ),
    '/strada'
  );
end;
$$;

-- T140 (R18, PLAN P15) — Intervento su strada, parte 2: elenco per le officine, accettazione e chiusura.
--
-- - `richieste_strada_vicine(officina)`: i membri di un'officina che può rispondere (ATTIVA, con "Offro
--   l'aiuto su strada" e con la posizione) vedono le richieste APERTE non scadute entro il loro raggio,
--   con **solo** descrizione, targa, distanza (km, 1 decimale) e orari. Posizione esatta, telefono e
--   cliente restano nascosti fino all'accettazione (R18).
-- - `accetta_richiesta_strada(richiesta, officina)`: la prima officina che accetta prende la richiesta
--   (`select … for update`: due accettazioni contemporanee si mettono in fila e la seconda trova la
--   richiesta già ACCETTATA). Da quel momento i suoi membri leggono la riga intera con la policy di T139
--   e il cliente riceve la notifica STRADA_ACCETTATA con nome e telefono dell'officina.
-- - `chiudi_richiesta_strada(richiesta)`: un membro dell'officina che l'ha accettata la chiude (CHIUSA).
--
-- La condizione "l'officina può rispondere a questa richiesta" è la stessa di `crea_richiesta_strada`
-- (T139): ATTIVA, intervento_strada, latitudine e longitudine presenti, e
-- `public.distanza_km(officina, richiesta) <= raggio_strada_km`. Se cambia lì va cambiata anche qui (in
-- tutte e due le funzioni sotto).
--
-- Errori: `42501` per chi non può (non autenticato, non membro, officina senza i requisiti, richiesta
-- fuori dal raggio); `RICHIESTA_NON_DISPONIBILE` per la richiesta che non c'è, non è più APERTA, è
-- scaduta o (chiusura) non è stata accettata dalla propria officina.

-- ---------------------------------------------------------------------------------------------------
-- Elenco delle richieste vicine (membri dell'officina)
-- ---------------------------------------------------------------------------------------------------
-- Vuoto (non un errore) se l'officina non ha i requisiti: la pagina mostra "nessuna richiesta".
-- Le colonne di `returns table` sono variabili in plpgsql: nella query tutte le colonne hanno l'alias.

create function public.richieste_strada_vicine(p_officina_id uuid)
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
    and v.distanza <= o.raggio_strada_km
  order by r.created_at desc, r.id;
end;
$$;

comment on function public.richieste_strada_vicine(uuid) is
  'Richieste di aiuto su strada aperte entro il raggio dell''officina, senza posizione, telefono e cliente.';

-- ---------------------------------------------------------------------------------------------------
-- Accettazione (membri dell'officina)
-- ---------------------------------------------------------------------------------------------------
-- Ordine dei controlli: 1) autenticato e membro dell'officina, officina con i requisiti → altrimenti
-- 42501; 2) la richiesta, bloccata con `for update`: assente, non APERTA o scaduta →
-- RICHIESTA_NON_DISPONIBILE; 3) richiesta entro il raggio dell'officina → altrimenti 42501.
-- Il controllo del raggio viene dopo il blocco perché la posizione si legge dalla riga bloccata.

create function public.accetta_richiesta_strada(p_id uuid, p_officina_id uuid)
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

comment on function public.accetta_richiesta_strada(uuid, uuid) is
  'Un membro dell''officina accetta una richiesta di aiuto su strada vicina: la prima che accetta la prende.';

-- ---------------------------------------------------------------------------------------------------
-- Chiusura (membri dell'officina che ha accettato)
-- ---------------------------------------------------------------------------------------------------
-- Per chiunque altro, e per le richieste non ACCETTATE, RICHIESTA_NON_DISPONIBILE (non si rivela se la
-- richiesta esiste).

create function public.chiudi_richiesta_strada(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Accesso richiesto' using errcode = '42501';
  end if;

  perform 1
  from public.richieste_strada r
  where r.id = p_id
    and r.stato = 'ACCETTATA'
    and r.officina_id is not null
    and public.is_membro_officina(r.officina_id)
  for update;
  if not found then
    raise exception 'RICHIESTA_NON_DISPONIBILE';
  end if;

  update public.richieste_strada set stato = 'CHIUSA' where id = p_id;
end;
$$;

comment on function public.chiudi_richiesta_strada(uuid) is
  'L''officina che ha accettato la richiesta di aiuto su strada la chiude (CHIUSA).';

revoke execute on function public.richieste_strada_vicine(uuid) from public, anon;
revoke execute on function public.accetta_richiesta_strada(uuid, uuid) from public, anon;
revoke execute on function public.chiudi_richiesta_strada(uuid) from public, anon;
grant execute on function public.richieste_strada_vicine(uuid) to authenticated;
grant execute on function public.accetta_richiesta_strada(uuid, uuid) to authenticated;
grant execute on function public.chiudi_richiesta_strada(uuid) to authenticated;

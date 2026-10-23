-- Fase 4 — Capienza per fascia (PLAN P14, compito T020, 2026-10-23).
--
-- Restano le richieste che l'officina conferma (MVP di P14, decisioni del 2026-10-12 "giorno e fascia"):
-- niente prenotazione diretta e niente slot orari. L'officina può fissare quante richieste accetta al
-- massimo per mattina o pomeriggio; oltre quel numero la fascia risulta piena e il cliente non può
-- chiederla (FASCIA_PIENA). Il limite vale solo per le richieste nuove dei clienti: l'officina può
-- sempre confermare, proporre o spostare un appuntamento anche in una fascia piena.
--
-- Occupano una fascia:
-- - le richieste ancora da gestire (RICHIESTA), nel giorno e nella fascia chiesti;
-- - le proposte e gli appuntamenti confermati (PROPOSTA, CONFERMATA), nel giorno e nella fascia
--   dell'ora fissata dall'officina (`appuntamento` in ora italiana; prima delle 13:00 = MATTINA, dalle
--   13:00 = POMERIGGIO, come `fasce_aperte`), anche se il cliente aveva chiesto un altro giorno.
-- Rifiutate, annullate, completate e non presentate non occupano posto.

-- ---------------------------------------------------------------------------------------------------
-- Capienza dell'officina
-- ---------------------------------------------------------------------------------------------------

alter table public.officine
  add column capienza_fascia smallint check (capienza_fascia between 1 and 99);

comment on column public.officine.capienza_fascia is
  'Richieste accettate al massimo per mattina o pomeriggio di un giorno; null = nessun limite (P14).';

-- ---------------------------------------------------------------------------------------------------
-- Occupazione delle fasce
-- ---------------------------------------------------------------------------------------------------

-- Quante prenotazioni occupano una fascia. Solo per uso interno (richiedi_prenotazione, fasce_piene):
-- non è concessa ad anon e authenticated, perché conta prenotazioni che chi chiama non può vedere.
create function public.occupazione_fascia(
  p_officina_id uuid,
  p_giorno date,
  p_fascia public.fascia_oraria
)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.prenotazioni p
  where p.officina_id = p_officina_id
    and (
      p.stato = 'RICHIESTA' and p.giorno = p_giorno and p.fascia = p_fascia
      or p.stato in ('PROPOSTA', 'CONFERMATA')
        and (p.appuntamento at time zone 'Europe/Rome')::date = p_giorno
        and (case when (p.appuntamento at time zone 'Europe/Rome')::time < '13:00'
               then 'MATTINA' else 'POMERIGGIO' end)::public.fascia_oraria = p_fascia
    );
$$;

-- Le fasce piene di un'officina, da domani a giorni_prenotabili(): le usa il modulo "Prenota" per
-- spegnerle. È pubblica come le officine attive, ma restituisce solo giorno e fascia, mai i conteggi
-- né i dati delle prenotazioni. Per un'officina non ATTIVA o senza capienza non restituisce righe.
create function public.fasce_piene(p_officina_id uuid)
returns table (giorno date, fascia public.fascia_oraria)
language sql
stable
security definer
set search_path = ''
as $$
  select d::date, f.valore
  from public.officine o
  cross join generate_series(
    public.oggi_in_italia() + 1,
    public.oggi_in_italia() + public.giorni_prenotabili(),
    interval '1 day'
  ) as d
  cross join unnest(enum_range(null::public.fascia_oraria)) as f (valore)
  where o.id = p_officina_id
    and o.stato_affiliazione = 'ATTIVA'
    and o.capienza_fascia is not null
    and public.occupazione_fascia(o.id, d::date, f.valore) >= o.capienza_fascia
  order by 1, 2;
$$;

-- ---------------------------------------------------------------------------------------------------
-- richiedi_prenotazione: come in 20261012150000, più il controllo della capienza
-- ---------------------------------------------------------------------------------------------------
-- Errori attesi (messaggio = chiave letta dall'app, codice P0001): OFFICINA_NON_DISPONIBILE,
-- SERVIZIO_NON_DISPONIBILE, GIORNO_NON_VALIDO, OFFICINA_CHIUSA, FASCIA_PIENA, TARGA_NON_VALIDA,
-- TELEFONO_NON_VALIDO, TROPPE_RICHIESTE. Senza accesso: 42501.
--
-- Due richieste contemporanee per l'ultimo posto della stessa fascia non devono passare entrambe: il
-- lucchetto `pg_advisory_xact_lock` (per officina, giorno e fascia, fino alla fine della transazione)
-- le mette in fila, e il conteggio dopo il lucchetto vede la richiesta già salvata dall'altra.

create or replace function public.richiedi_prenotazione(
  p_officina_id uuid,
  p_servizio_id uuid,
  p_giorno date,
  p_fascia public.fascia_oraria,
  p_targa text,
  p_veicolo text,
  p_telefono text,
  p_note text default '',
  p_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_orari jsonb;
  v_servizio text;
  v_nome text;
  v_targa text := upper(regexp_replace(coalesce(p_targa, ''), '[^A-Za-z0-9]', '', 'g'));
  v_telefono text := trim(coalesce(p_telefono, ''));
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Accesso richiesto' using errcode = '42501';
  end if;

  -- Ripetizione di una chiamata già riuscita
  if p_id is not null and exists (
    select 1 from public.prenotazioni where id = p_id and cliente_id = v_uid
  ) then
    return p_id;
  end if;

  select o.orari into v_orari
  from public.officine o
  where o.id = p_officina_id and o.stato_affiliazione = 'ATTIVA';
  if not found then
    raise exception 'OFFICINA_NON_DISPONIBILE';
  end if;

  select s.nome into v_servizio
  from public.servizi_officina s
  where s.id = p_servizio_id and s.officina_id = p_officina_id and s.prenotabile;
  if not found then
    raise exception 'SERVIZIO_NON_DISPONIBILE';
  end if;

  if p_giorno is null or p_giorno <= public.oggi_in_italia()
    or p_giorno > public.oggi_in_italia() + public.giorni_prenotabili() then
    raise exception 'GIORNO_NON_VALIDO';
  end if;
  if p_fascia is null or not p_fascia = any (public.fasce_aperte(v_orari, p_giorno))
    or exists (
      select 1 from public.chiusure_officina c
      where c.officina_id = p_officina_id and p_giorno between c.dal and c.al
    ) then
    raise exception 'OFFICINA_CHIUSA';
  end if;

  -- Capienza: una richiesta alla volta per officina, giorno e fascia (vedi sopra)
  perform pg_advisory_xact_lock(
    hashtextextended(p_officina_id::text || p_giorno::text || p_fascia::text, 0)
  );
  if exists (
    select 1 from public.officine o
    where o.id = p_officina_id
      and o.capienza_fascia is not null
      and public.occupazione_fascia(p_officina_id, p_giorno, p_fascia) >= o.capienza_fascia
  ) then
    raise exception 'FASCIA_PIENA';
  end if;

  if v_targa !~ '^[A-Z0-9]{2,10}$' then
    raise exception 'TARGA_NON_VALIDA';
  end if;
  if v_telefono !~ '^\+?[0-9 ]{6,20}$' then
    raise exception 'TELEFONO_NON_VALIDO';
  end if;

  -- Contro gli abusi: al massimo 3 richieste in attesa per officina
  if (
    select count(*) from public.prenotazioni p
    where p.cliente_id = v_uid and p.officina_id = p_officina_id
      and p.stato in ('RICHIESTA', 'PROPOSTA')
  ) >= 3 then
    raise exception 'TROPPE_RICHIESTE';
  end if;

  select trim(p.nome || ' ' || p.cognome) into v_nome from public.profiles p where p.id = v_uid;

  insert into public.prenotazioni (
    id, officina_id, servizio_id, servizio, cliente_id, nome_cliente, telefono_cliente, targa,
    veicolo, giorno, fascia, note
  ) values (
    coalesce(p_id, gen_random_uuid()), p_officina_id, p_servizio_id, v_servizio, v_uid,
    coalesce(v_nome, ''), v_telefono, v_targa, left(trim(coalesce(p_veicolo, '')), 150), p_giorno,
    p_fascia, left(trim(coalesce(p_note, '')), 1000)
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------------------------------
-- Permessi (come in 20261012120000)
-- ---------------------------------------------------------------------------------------------------

revoke execute on function public.occupazione_fascia(uuid, date, public.fascia_oraria)
  from public, anon, authenticated;
revoke execute on function public.fasce_piene(uuid) from public;
grant execute on function public.fasce_piene(uuid) to anon, authenticated;
revoke execute on function public.richiedi_prenotazione(
  uuid, uuid, date, public.fascia_oraria, text, text, text, text, uuid
) from public, anon;
grant execute on function public.richiedi_prenotazione(
  uuid, uuid, date, public.fascia_oraria, text, text, text, text, uuid
) to authenticated;

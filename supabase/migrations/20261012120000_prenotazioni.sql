-- Fase 4 — Prenotazioni: catalogo dei servizi dell'officina e richieste di appuntamento (PLAN P14).
--
-- Decisioni del titolare (2026-10-12):
-- - il cliente può chiedere un appuntamento a **tutte le officine attive**, anche se non ne è ancora
--   cliente;
-- - sceglie **giorno e fascia** (mattina/pomeriggio) tra quelli di apertura; l'officina conferma con
--   l'ora precisa, propone un altro orario o rifiuta (MVP di P14: la prenotazione è una richiesta);
-- - nel catalogo il **prezzo indicativo è facoltativo** ("da 40 €"; vuoto = su preventivo).
--
-- Stati di una prenotazione:
--   RICHIESTA ──conferma──▶ CONFERMATA ──▶ COMPLETATA / NON_PRESENTATO
--       │ └──propone──▶ PROPOSTA ──il cliente accetta──▶ CONFERMATA
--       └──rifiuta──▶ RIFIUTATA            (il cliente può annullare: ANNULLATA)
--
-- Le prenotazioni si scrivono solo dalle funzioni qui sotto (nessuna policy di scrittura): così le
-- regole sugli stati valgono per tutti. Il cliente non è (ancora) un `clienti_officina`: nome e
-- telefono sono copiati nella prenotazione, perché l'officina non può leggere i profili dei clienti.

-- ---------------------------------------------------------------------------------------------------
-- Tipi
-- ---------------------------------------------------------------------------------------------------

create type public.fascia_oraria as enum ('MATTINA', 'POMERIGGIO');
create type public.stato_prenotazione as enum (
  'RICHIESTA', 'PROPOSTA', 'CONFERMATA', 'RIFIUTATA', 'ANNULLATA', 'COMPLETATA', 'NON_PRESENTATO'
);

-- ---------------------------------------------------------------------------------------------------
-- Tabelle
-- ---------------------------------------------------------------------------------------------------

create table public.servizi_officina (
  id uuid primary key default gen_random_uuid(),
  officina_id uuid not null references public.officine (id) on delete cascade,
  nome text not null check (char_length(nome) between 2 and 100),
  descrizione text not null default '' check (char_length(descrizione) <= 500),
  -- Durata indicativa, per l'officina e per il cliente
  durata_minuti smallint check (durata_minuti between 5 and 600),
  -- Prezzo indicativo "a partire da", in euro; null = su preventivo
  prezzo_da numeric(8, 2) check (prezzo_da >= 0),
  -- Un servizio non prenotabile resta nel catalogo dell'officina ma il cliente non lo vede
  prenotabile boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, officina_id)
);

create index servizi_officina_officina_id_idx on public.servizi_officina (officina_id);

comment on table public.servizi_officina is 'Catalogo dei servizi prenotabili di un''officina (P14).';

create table public.prenotazioni (
  id uuid primary key default gen_random_uuid(),
  officina_id uuid not null references public.officine (id) on delete cascade,
  servizio_id uuid,
  -- Nome del servizio al momento della richiesta: resta anche se il servizio cambia o si elimina
  servizio text not null check (char_length(servizio) between 1 and 100),
  cliente_id uuid not null references public.profiles (id) on delete cascade,
  nome_cliente text not null check (char_length(nome_cliente) <= 201),
  telefono_cliente text not null check (telefono_cliente ~ '^\+?[0-9 ]{6,20}$'),
  -- Targa normalizzata come in `veicoli`; descrizione libera del veicolo (es. "Fiat Panda")
  targa text not null check (targa ~ '^[A-Z0-9]{2,10}$'),
  veicolo text not null default '' check (char_length(veicolo) <= 150),
  giorno date not null,
  fascia public.fascia_oraria not null,
  note text not null default '' check (char_length(note) <= 1000),
  stato public.stato_prenotazione not null default 'RICHIESTA',
  -- Ora precisa: confermata (CONFERMATA) o proposta dall'officina (PROPOSTA)
  appuntamento timestamptz,
  messaggio_officina text not null default '' check (char_length(messaggio_officina) <= 500),
  gestita_da uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (servizio_id, officina_id)
    references public.servizi_officina (id, officina_id) on delete set null (servizio_id),
  constraint prenotazioni_appuntamento check (
    stato not in ('PROPOSTA', 'CONFERMATA', 'COMPLETATA', 'NON_PRESENTATO') or appuntamento is not null
  )
);

create index prenotazioni_officina_giorno_idx on public.prenotazioni (officina_id, giorno);
create index prenotazioni_cliente_id_idx on public.prenotazioni (cliente_id);

comment on table public.prenotazioni is
  'Richieste di appuntamento dei clienti alle officine. Si scrive solo dalle funzioni.';

create trigger servizi_officina_updated_at
  before update on public.servizi_officina
  for each row execute function public.imposta_updated_at();

create trigger prenotazioni_updated_at
  before update on public.prenotazioni
  for each row execute function public.imposta_updated_at();

-- ---------------------------------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------------------------------

alter table public.servizi_officina enable row level security;
alter table public.prenotazioni enable row level security;

-- Il catalogo è pubblico come le officine attive (anche senza accesso); i membri vedono anche i
-- servizi non prenotabili. Lo gestisce il TITOLARE (P16).
create policy "servizi_officina: lettura prenotabili di officine attive"
  on public.servizi_officina for select to anon, authenticated
  using (
    prenotabile and exists (
      select 1 from public.officine o
      where o.id = officina_id and o.stato_affiliazione = 'ATTIVA'
    )
  );

create policy "servizi_officina: lettura membri"
  on public.servizi_officina for select to authenticated
  using (public.is_membro_officina(officina_id));

create policy "servizi_officina: inserimento titolare"
  on public.servizi_officina for insert to authenticated
  with check (public.is_titolare_officina(officina_id));

create policy "servizi_officina: modifica titolare"
  on public.servizi_officina for update to authenticated
  using (public.is_titolare_officina(officina_id))
  with check (public.is_titolare_officina(officina_id));

create policy "servizi_officina: eliminazione titolare"
  on public.servizi_officina for delete to authenticated
  using (public.is_titolare_officina(officina_id));

-- Le prenotazioni le vedono il cliente che le ha chieste e chi lavora nell'officina.
create policy "prenotazioni: lettura cliente o membri"
  on public.prenotazioni for select to authenticated
  using (cliente_id = (select auth.uid()) or public.is_membro_officina(officina_id));

-- ---------------------------------------------------------------------------------------------------
-- Orari e fasce
-- ---------------------------------------------------------------------------------------------------
-- `officine.orari` ha una chiave per giorno (lun … dom) con gli intervalli di apertura, es.
-- {"lun": [["08:30","12:30"],["14:30","19:00"]], "dom": []}. Mattina = un intervallo che inizia prima
-- delle 13; pomeriggio = un intervallo che finisce dopo le 13 (un orario continuato le ha entrambe).
-- La stessa regola è in `packages/shared/src/prenotazioni.ts` (`fasceAperte`).

create function public.fasce_aperte(p_orari jsonb, p_giorno date)
returns public.fascia_oraria[]
language sql
immutable
set search_path = ''
as $$
  with giorno as (
    select coalesce(p_orari, '{}'::jsonb)
      -> (array['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'])[extract(isodow from p_giorno)::int]
      as intervalli
  ),
  intervalli as (
    select (i ->> 0)::time as inizio, (i ->> 1)::time as fine
    from giorno, jsonb_array_elements(
      case when jsonb_typeof(giorno.intervalli) = 'array' then giorno.intervalli else '[]'::jsonb end
    ) as i
  )
  select array_remove(array[
    case when exists (select 1 from intervalli where inizio < '13:00')
      then 'MATTINA'::public.fascia_oraria end,
    case when exists (select 1 from intervalli where fine > '13:00')
      then 'POMERIGGIO'::public.fascia_oraria end
  ], null);
$$;

-- Oggi e le ore in Italia: le date delle prenotazioni sono date italiane
create function public.oggi_in_italia()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Europe/Rome')::date;
$$;

-- ---------------------------------------------------------------------------------------------------
-- Funzioni
-- ---------------------------------------------------------------------------------------------------
-- Errori attesi (messaggio = chiave letta dall'app, codice P0001): OFFICINA_NON_DISPONIBILE,
-- SERVIZIO_NON_DISPONIBILE, GIORNO_NON_VALIDO, OFFICINA_CHIUSA, TARGA_NON_VALIDA,
-- TELEFONO_NON_VALIDO, TROPPE_RICHIESTE, STATO_NON_VALIDO, ORARIO_NON_VALIDO.
-- Una prenotazione che non esiste o non è visibile a chi chiama è 42501, come per la RLS.

-- Giorni in avanti in cui si può chiedere un appuntamento (e spostarlo)
create function public.giorni_prenotabili()
returns integer
language sql
immutable
set search_path = ''
as $$
  select 60;
$$;

-- Il cliente chiede un appuntamento. Ripetibile con lo stesso p_id (scritture ripetibili, 2026-10-08).
create function public.richiedi_prenotazione(
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
  if p_fascia is null or not p_fascia = any (public.fasce_aperte(v_orari, p_giorno)) then
    raise exception 'OFFICINA_CHIUSA';
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

-- L'officina risponde: CONFERMA (con l'ora, nel giorno chiesto), PROPONI (un altro orario, anche per
-- spostare un appuntamento confermato), RIFIUTA (anche un appuntamento già confermato), oppure, dopo
-- l'appuntamento, COMPLETATA o NON_PRESENTATO. Ripetibile: la stessa risposta due volte non è un errore.
create function public.rispondi_prenotazione(
  p_id uuid,
  p_azione text,
  p_appuntamento timestamptz default null,
  p_messaggio text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pren public.prenotazioni;
  v_nuovo public.stato_prenotazione;
  v_ammessi public.stato_prenotazione[];
begin
  select * into v_pren from public.prenotazioni where id = p_id for update;
  if not found or not public.is_membro_officina(v_pren.officina_id) then
    raise exception 'Prenotazione non trovata' using errcode = '42501';
  end if;

  case p_azione
    when 'CONFERMA' then
      v_nuovo := 'CONFERMATA';
      v_ammessi := array['RICHIESTA', 'PROPOSTA']::public.stato_prenotazione[];
    when 'PROPONI' then
      v_nuovo := 'PROPOSTA';
      v_ammessi := array['RICHIESTA', 'PROPOSTA', 'CONFERMATA']::public.stato_prenotazione[];
    when 'RIFIUTA' then
      v_nuovo := 'RIFIUTATA';
      v_ammessi := array['RICHIESTA', 'PROPOSTA', 'CONFERMATA']::public.stato_prenotazione[];
    when 'COMPLETATA' then
      v_nuovo := 'COMPLETATA';
      v_ammessi := array['CONFERMATA']::public.stato_prenotazione[];
    when 'NON_PRESENTATO' then
      v_nuovo := 'NON_PRESENTATO';
      v_ammessi := array['CONFERMATA']::public.stato_prenotazione[];
    else
      raise exception 'Azione sconosciuta: %', p_azione using errcode = '22023';
  end case;

  -- Ripetizione di una risposta già arrivata
  if v_pren.stato = v_nuovo
    and (p_appuntamento is null or v_pren.appuntamento = p_appuntamento) then
    return;
  end if;
  if not v_pren.stato = any (v_ammessi) then
    raise exception 'STATO_NON_VALIDO';
  end if;

  if p_azione in ('CONFERMA', 'PROPONI') then
    if p_appuntamento is null or p_appuntamento <= now()
      or (p_appuntamento at time zone 'Europe/Rome')::date
        > public.oggi_in_italia() + public.giorni_prenotabili()
      or p_azione = 'CONFERMA'
        and (p_appuntamento at time zone 'Europe/Rome')::date <> v_pren.giorno then
      raise exception 'ORARIO_NON_VALIDO';
    end if;
  end if;

  update public.prenotazioni
  set stato = v_nuovo,
      appuntamento = case when p_azione in ('CONFERMA', 'PROPONI') then p_appuntamento
                          else appuntamento end,
      messaggio_officina = left(trim(coalesce(p_messaggio, '')), 500),
      gestita_da = (select auth.uid())
  where id = p_id;
end;
$$;

-- Il cliente risponde all'orario proposto dall'officina: accetta (CONFERMATA, con giorno e fascia
-- dell'orario proposto) o rifiuta (ANNULLATA). Ripetibile.
create function public.rispondi_proposta(p_id uuid, p_accetta boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pren public.prenotazioni;
  v_locale timestamp;
begin
  select * into v_pren from public.prenotazioni where id = p_id for update;
  if not found or v_pren.cliente_id is distinct from (select auth.uid()) then
    raise exception 'Prenotazione non trovata' using errcode = '42501';
  end if;
  if v_pren.stato = (case when p_accetta then 'CONFERMATA' else 'ANNULLATA' end)::public.stato_prenotazione then
    return;
  end if;
  if v_pren.stato <> 'PROPOSTA' then
    raise exception 'STATO_NON_VALIDO';
  end if;

  if p_accetta then
    v_locale := v_pren.appuntamento at time zone 'Europe/Rome';
    update public.prenotazioni
    set stato = 'CONFERMATA',
        giorno = v_locale::date,
        fascia = (case when v_locale::time < '13:00' then 'MATTINA' else 'POMERIGGIO' end)::public.fascia_oraria
    where id = p_id;
  else
    update public.prenotazioni set stato = 'ANNULLATA' where id = p_id;
  end if;
end;
$$;

-- Il cliente annulla una richiesta o un appuntamento non ancora passato. Ripetibile.
create function public.annulla_prenotazione(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pren public.prenotazioni;
begin
  select * into v_pren from public.prenotazioni where id = p_id for update;
  if not found or v_pren.cliente_id is distinct from (select auth.uid()) then
    raise exception 'Prenotazione non trovata' using errcode = '42501';
  end if;
  if v_pren.stato = 'ANNULLATA' then
    return;
  end if;
  if v_pren.stato not in ('RICHIESTA', 'PROPOSTA', 'CONFERMATA')
    or v_pren.stato = 'CONFERMATA' and v_pren.appuntamento <= now() then
    raise exception 'STATO_NON_VALIDO';
  end if;
  update public.prenotazioni set stato = 'ANNULLATA' where id = p_id;
end;
$$;

revoke execute on function public.richiedi_prenotazione(
  uuid, uuid, date, public.fascia_oraria, text, text, text, text, uuid
) from public, anon;
revoke execute on function public.rispondi_prenotazione(uuid, text, timestamptz, text)
  from public, anon;
revoke execute on function public.rispondi_proposta(uuid, boolean) from public, anon;
revoke execute on function public.annulla_prenotazione(uuid) from public, anon;
grant execute on function public.richiedi_prenotazione(
  uuid, uuid, date, public.fascia_oraria, text, text, text, text, uuid
) to authenticated;
grant execute on function public.rispondi_prenotazione(uuid, text, timestamptz, text)
  to authenticated;
grant execute on function public.rispondi_proposta(uuid, boolean) to authenticated;
grant execute on function public.annulla_prenotazione(uuid) to authenticated;

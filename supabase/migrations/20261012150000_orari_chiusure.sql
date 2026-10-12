-- Fase 4 — Orari di apertura validati e chiusure straordinarie (sessione 14, 2026-10-12).
--
-- - `officine.orari` ora ha un formato controllato: chiavi lun … dom, per ogni giorno al massimo 3
--   intervalli ["HH:MM", "HH:MM"] con apertura prima della chiusura, in ordine e senza sovrapposizioni.
--   Prima un orario scritto male (es. "8.30") faceva fallire `fasce_aperte` durante una prenotazione.
-- - `chiusure_officina`: periodi in cui l'officina è chiusa anche se l'orario settimanale dice aperto
--   (ferie, festivi, inventario). Le scrive il TITOLARE; le leggono tutti, come le officine attive.
-- - `richiedi_prenotazione` rifiuta i giorni di chiusura (OFFICINA_CHIUSA).

-- ---------------------------------------------------------------------------------------------------
-- Orari validi
-- ---------------------------------------------------------------------------------------------------

create function public.orari_validi(p_orari jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p_orari is null or jsonb_typeof(p_orari) <> 'object' then false
    -- Solo i giorni della settimana
    when exists (
      select 1 from jsonb_object_keys(p_orari) k
      where k not in ('lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom')
    ) then false
    -- Ogni giorno è un elenco di al massimo 3 intervalli
    when exists (
      select 1 from jsonb_each(p_orari) g
      where jsonb_typeof(g.value) <> 'array'
        or (case when jsonb_typeof(g.value) = 'array' then jsonb_array_length(g.value) end) > 3
    ) then false
    -- Ogni intervallo è ["HH:MM", "HH:MM"] con l'apertura prima della chiusura
    when exists (
      select 1
      from jsonb_each(p_orari) g, jsonb_array_elements(g.value) i
      where jsonb_typeof(i) <> 'array'
        or (case when jsonb_typeof(i) = 'array' then jsonb_array_length(i) end) <> 2
        or coalesce(i ->> 0, '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        or coalesce(i ->> 1, '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        or (i ->> 0) >= (i ->> 1)
    ) then false
    -- Intervalli in ordine, senza sovrapposizioni: ognuno inizia dopo la fine del precedente
    when exists (
      select 1
      from jsonb_each(p_orari) g,
        jsonb_array_elements(g.value) with ordinality a (intervallo, n),
        jsonb_array_elements(g.value) with ordinality b (intervallo, n)
      where b.n = a.n + 1 and (b.intervallo ->> 0) <= (a.intervallo ->> 1)
    ) then false
    else true
  end;
$$;

alter table public.officine
  add constraint officine_orari_validi check (public.orari_validi(orari));

comment on column public.officine.orari is
  'Orari settimanali: {"lun": [["08:30","12:30"],["14:30","19:00"]], …}; vedi orari_validi().';

-- ---------------------------------------------------------------------------------------------------
-- Chiusure straordinarie
-- ---------------------------------------------------------------------------------------------------

create table public.chiusure_officina (
  id uuid primary key default gen_random_uuid(),
  officina_id uuid not null references public.officine (id) on delete cascade,
  dal date not null,
  al date not null,
  motivo text not null default '' check (char_length(motivo) <= 100),
  created_at timestamptz not null default now(),
  constraint chiusure_officina_periodo check (al >= dal and al - dal <= 366)
);

create index chiusure_officina_officina_al_idx on public.chiusure_officina (officina_id, al);

comment on table public.chiusure_officina is
  'Giorni di chiusura straordinaria di un''officina (ferie, festivi), dal … al compresi.';

alter table public.chiusure_officina enable row level security;

create policy "chiusure_officina: lettura officine attive"
  on public.chiusure_officina for select to anon, authenticated
  using (
    exists (
      select 1 from public.officine o
      where o.id = officina_id and o.stato_affiliazione = 'ATTIVA'
    )
  );

create policy "chiusure_officina: lettura membri"
  on public.chiusure_officina for select to authenticated
  using (public.is_membro_officina(officina_id));

create policy "chiusure_officina: inserimento titolare"
  on public.chiusure_officina for insert to authenticated
  with check (public.is_titolare_officina(officina_id));

create policy "chiusure_officina: modifica titolare"
  on public.chiusure_officina for update to authenticated
  using (public.is_titolare_officina(officina_id))
  with check (public.is_titolare_officina(officina_id));

create policy "chiusure_officina: eliminazione titolare"
  on public.chiusure_officina for delete to authenticated
  using (public.is_titolare_officina(officina_id));

-- ---------------------------------------------------------------------------------------------------
-- richiedi_prenotazione: come in 20261012120000, più il controllo delle chiusure
-- ---------------------------------------------------------------------------------------------------

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

-- Fase 5 — Promemoria degli pneumatici (P11). Decisioni del titolare (2026-10-14):
--
-- 1. **Esito del controllo**: appena l'officina registra un controllo con gomme gialle o rosse, il
--    cliente riceve una notifica con il link al report.
-- 2. **Cambio stagionale**: se sul veicolo risultano montate gomme estive dal 15 ottobre (obbligo
--    invernale dal 15 novembre), o invernali dal 15 marzo, il cliente riceve un promemoria, una volta
--    per stagione e per targa, alle 10 (ora italiana).
--
-- Li riceve solo il cliente con il veicolo collegato al suo account (garage), mai l'officina. Sono righe
-- di `notifiche` come le altre, quindi arrivano anche come push.

alter type public.tipo_notifica add value 'ESITO_CONTROLLO';
alter type public.tipo_notifica add value 'CAMBIO_STAGIONE';

-- Chiave che rende unica una notifica per il suo destinatario: un promemoria con la stessa chiave non
-- si ripete (es. `CAMBIO_STAGIONE:INVERNALE:2026:AB123CD`).
alter table public.notifiche
  add column chiave text check (char_length(chiave) between 1 and 200);

create unique index notifiche_chiave_idx on public.notifiche (destinatario_id, chiave)
  where chiave is not null;

-- ---------------------------------------------------------------------------------------------------
-- Funzioni di supporto
-- ---------------------------------------------------------------------------------------------------

-- Stato del battistrada: le stesse soglie di `SOGLIE_BATTISTRADA_MM` / `statoBattistrada()` in
-- `packages/shared/src/pneumatici.ts` (limite di legge 1,6 mm; consigliati 3 mm estivi, 4 invernali e
-- 4 stagioni). Se cambiano lì, vanno cambiate anche qui (test in `promemoria-pneumatici.test.sql`).
create function public.stato_battistrada(p_mm numeric, p_stagione public.stagione)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_mm < 1.6 then 'ROSSO'
    when p_mm < case p_stagione when 'ESTIVO' then 3 else 4 end then 'GIALLO'
    else 'VERDE'
  end;
$$;

-- "AB123CD (Fiat Panda)", oppure solo la targa
create function public.testo_veicolo(p_targa text, p_marca text, p_modello text)
returns text
language sql
immutable
set search_path = ''
as $$
  select p_targa || coalesce(' (' || nullif(trim(p_marca || ' ' || p_modello), '') || ')', '');
$$;

-- "1 gomma" / "2 gomme"
create function public.testo_gomme(p_quante bigint)
returns text
language sql
immutable
set search_path = ''
as $$
  select p_quante || case when p_quante = 1 then ' gomma' else ' gomme' end;
$$;

-- ---------------------------------------------------------------------------------------------------
-- 1. Esito del controllo
-- ---------------------------------------------------------------------------------------------------
-- Trigger "deferred": scatta alla fine della transazione, quando `registra_controllo` ha già scritto
-- anche le misure. Non scatta per i controlli importati dal gestionale né per quelli registrati in
-- ritardo (più di 7 giorni dopo): sarebbero notizie vecchie. Una correzione del controllo
-- (`modifica_controllo`) non manda una seconda notifica.

create function public.notifica_esito_controllo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profilo uuid;
  v_veicolo text;
  v_officina text;
  v_rosse bigint;
  v_gialle bigint;
  v_parti text[] := '{}';
begin
  if new.origine <> 'APP' or new.eseguito_il < public.oggi_in_italia() - 7 then
    return null;
  end if;

  select c.profile_id, public.testo_veicolo(v.targa, v.marca, v.modello)
  into v_profilo, v_veicolo
  from public.veicoli v
  join public.clienti_officina c on c.id = v.cliente_officina_id
  where v.id = new.veicolo_id;
  if v_profilo is null then
    return null;
  end if;

  select
    count(*) filter (where public.stato_battistrada(m.battistrada_mm, p.stagione) = 'ROSSO'),
    count(*) filter (where public.stato_battistrada(m.battistrada_mm, p.stagione) = 'GIALLO')
  into v_rosse, v_gialle
  from public.misure_pneumatico m
  join public.pneumatici p on p.id = m.pneumatico_id
  where m.controllo_id = new.id;
  if v_rosse = 0 and v_gialle = 0 then
    return null;
  end if;

  if v_rosse > 0 then
    v_parti := v_parti || (public.testo_gomme(v_rosse) || ' sotto il limite di legge');
  end if;
  if v_gialle > 0 then
    v_parti := v_parti || (public.testo_gomme(v_gialle) || ' sotto la soglia consigliata');
  end if;
  select o.ragione_sociale into v_officina from public.officine o where o.id = new.officina_id;

  insert into public.notifiche (destinatario_id, tipo, titolo, testo, link, chiave)
  values (
    v_profilo,
    'ESITO_CONTROLLO',
    case when v_rosse > 0 then 'Gomme da sostituire' else 'Gomme da tenere d''occhio' end,
    left(
      coalesce(v_officina, 'L''officina') || ' ha controllato ' || v_veicolo || ': '
        || array_to_string(v_parti, ' e ') || '. Apri il report per i dettagli.',
      600
    ),
    '/controllo?id=' || new.id,
    'ESITO_CONTROLLO:' || new.id
  )
  on conflict (destinatario_id, chiave) where chiave is not null do nothing;

  return null;
end;
$$;

create constraint trigger controlli_notifica_esito
  after insert on public.controlli
  deferrable initially deferred
  for each row execute function public.notifica_esito_controllo();

revoke execute on function public.notifica_esito_controllo() from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------
-- 2. Cambio stagionale
-- ---------------------------------------------------------------------------------------------------
-- Finestre (ora italiana): dal 15 ottobre a fine anno → gomme invernali, per chi ha montate gomme
-- estive; dal 15 marzo a fine maggio → gomme estive, per chi ha montate gomme invernali. Le 4 stagioni
-- e la ruota di scorta non contano. Un promemoria per stagione e per targa (la stessa targa può essere
-- in due officine). Restituisce quanti promemoria ha creato; `p_adesso` serve ai test.

create function public.crea_promemoria_pneumatici(p_adesso timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_locale timestamp := p_adesso at time zone 'Europe/Rome';
  v_oggi date := v_locale::date;
  v_mese_giorno text := to_char(v_oggi, 'MM-DD');
  v_da_montare public.stagione;
  v_montate public.stagione;
  v_titolo text;
  v_motivo text;
  v_quanti integer;
begin
  if v_locale::time < time '10:00' then
    return 0;
  end if;
  if v_mese_giorno between '10-15' and '12-31' then
    v_da_montare := 'INVERNALE';
    v_montate := 'ESTIVO';
    v_titolo := 'È ora delle gomme invernali';
    v_motivo := 'risultano montate gomme estive: dal 15 novembre su molte strade servono gomme '
      || 'invernali o catene a bordo.';
  elsif v_mese_giorno between '03-15' and '05-31' then
    v_da_montare := 'ESTIVO';
    v_montate := 'INVERNALE';
    v_titolo := 'È ora delle gomme estive';
    v_motivo := 'risultano montate gomme invernali: con il caldo si consumano prima e frenano peggio.';
  else
    return 0;
  end if;

  insert into public.notifiche (destinatario_id, tipo, titolo, testo, link, chiave)
  select distinct on (c.profile_id, v.targa)
    c.profile_id,
    'CAMBIO_STAGIONE',
    v_titolo,
    'Sul veicolo ' || public.testo_veicolo(v.targa, v.marca, v.modello) || ' ' || v_motivo
      || ' Prenota il cambio dall''app.',
    '/garage/veicolo?targa=' || v.targa,
    'CAMBIO_STAGIONE:' || v_da_montare || ':' || extract(year from v_oggi) || ':' || v.targa
  from public.veicoli v
  join public.clienti_officina c on c.id = v.cliente_officina_id
  where c.profile_id is not null
    and exists (
      select 1 from public.pneumatici p
      where p.veicolo_id = v.id and p.smontato_il is null and p.posizione <> 'SCORTA'
        and p.stagione = v_montate
    )
  order by c.profile_id, v.targa
  on conflict (destinatario_id, chiave) where chiave is not null do nothing;

  get diagnostics v_quanti = row_count;
  return v_quanti;
end;
$$;

revoke execute on function public.crea_promemoria_pneumatici(timestamptz)
  from public, anon, authenticated;

-- Al minuto 15 di ogni ora: dalle 10 italiane parte il promemoria, i giri dopo non lo ripetono
select cron.schedule(
  'promemoria-pneumatici',
  '15 * * * *',
  $$select public.crea_promemoria_pneumatici()$$
);

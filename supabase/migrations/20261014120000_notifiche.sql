-- Fase 5 — Notifiche nell'app (primo passo; poi Web Push ed email).
--
-- Ogni cambio di stato di una prenotazione crea una notifica per chi deve saperlo: il cliente quando
-- risponde l'officina, chi lavora in officina quando scrive il cliente. Le notifiche le scrive solo il
-- trigger su `prenotazioni` (vale per tutte le funzioni che la modificano, anche future); l'utente può
-- solo leggerle e segnarle come lette. Titolo e testo sono già pronti in italiano: così l'app, le
-- notifiche push e le email usano tutti lo stesso testo.
--
--   evento (prenotazione)                         destinatari           tipo
--   nuova richiesta                               officina              NUOVA_RICHIESTA
--   l'officina conferma                           cliente               CONFERMATA
--   l'officina propone (o sposta) un orario       cliente               PROPOSTA
--   l'officina rifiuta                            cliente               RIFIUTATA
--   il cliente accetta l'orario proposto          officina              PROPOSTA_ACCETTATA
--   il cliente annulla                            officina              ANNULLATA
--
-- "Officina" = tutti gli utenti dell'officina (titolare e operatori), tranne chi ha fatto l'azione.
-- Completato e non presentato non avvisano nessuno: li segna l'officina stessa.

create type public.tipo_notifica as enum (
  'NUOVA_RICHIESTA', 'CONFERMATA', 'PROPOSTA', 'RIFIUTATA', 'PROPOSTA_ACCETTATA', 'ANNULLATA'
);

create table public.notifiche (
  id uuid primary key default gen_random_uuid(),
  destinatario_id uuid not null references public.profiles (id) on delete cascade,
  tipo public.tipo_notifica not null,
  titolo text not null check (char_length(titolo) between 1 and 100),
  testo text not null default '' check (char_length(testo) <= 600),
  -- Pagina dell'app da aprire (percorso interno, es. /appuntamento?id=…)
  link text not null check (link ~ '^/[^/]'),
  prenotazione_id uuid references public.prenotazioni (id) on delete cascade,
  letta_il timestamptz,
  created_at timestamptz not null default now()
);

create index notifiche_destinatario_idx on public.notifiche (destinatario_id, created_at desc);
create index notifiche_prenotazione_id_idx on public.notifiche (prenotazione_id);

comment on table public.notifiche is
  'Notifiche per l''utente (Fase 5). Le scrive il trigger delle prenotazioni; l''utente le segna lette.';

alter table public.notifiche enable row level security;

create policy "notifiche: lettura destinatario"
  on public.notifiche for select to authenticated
  using (destinatario_id = (select auth.uid()));

create policy "notifiche: segna lette destinatario"
  on public.notifiche for update to authenticated
  using (destinatario_id = (select auth.uid()))
  with check (destinatario_id = (select auth.uid()));

-- Dall'app si può cambiare solo `letta_il`; inserimento ed eliminazione non sono permessi
revoke insert, update, delete on public.notifiche from anon, authenticated;
grant update (letta_il) on public.notifiche to authenticated;

-- Realtime: il contatore delle non lette si aggiorna senza ricaricare (la RLS vale anche qui)
alter publication supabase_realtime add table public.notifiche;

-- ---------------------------------------------------------------------------------------------------
-- Testi
-- ---------------------------------------------------------------------------------------------------

-- "martedì 13 ottobre, ore 9:30" con l'ora, altrimenti "martedì 13 ottobre, mattina". Come `quando`
-- in `apps/web/src/ui/prenotazione.ts` (lì con la maiuscola a inizio riga).
create function public.testo_quando(
  p_giorno date,
  p_fascia public.fascia_oraria,
  p_appuntamento timestamptz
)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_locale timestamp := p_appuntamento at time zone 'Europe/Rome';
  v_giorno date := coalesce(v_locale::date, p_giorno);
  v_testo text;
begin
  v_testo := (array['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'])
      [extract(isodow from v_giorno)::int]
    || ' ' || extract(day from v_giorno)::int || ' '
    || (array['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto',
              'settembre', 'ottobre', 'novembre', 'dicembre'])[extract(month from v_giorno)::int];
  if v_locale is not null then
    return v_testo || ', ore ' || extract(hour from v_locale)::int || ':'
      || to_char(v_locale, 'MI');
  end if;
  return v_testo || ', ' || case p_fascia when 'MATTINA' then 'mattina' else 'pomeriggio' end;
end;
$$;

-- ---------------------------------------------------------------------------------------------------
-- Trigger
-- ---------------------------------------------------------------------------------------------------

create function public.notifica_prenotazione()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attore uuid := (select auth.uid());
  v_officina text;
  v_cliente text := coalesce(nullif(trim(new.nome_cliente), ''), 'Un cliente');
  v_quando text := public.testo_quando(new.giorno, new.fascia, new.appuntamento);
  v_tipo public.tipo_notifica;
  v_titolo text;
  v_testo text;
  v_al_cliente boolean;
begin
  if tg_op = 'INSERT' then
    if new.stato <> 'RICHIESTA' then
      return new;
    end if;
    v_tipo := 'NUOVA_RICHIESTA';
  elsif new.stato is distinct from old.stato then
    v_tipo := case new.stato
      when 'CONFERMATA' then
        -- Da una proposta conferma il cliente (accetta) oppure l'officina (conferma lei stessa)
        case when old.stato = 'PROPOSTA' and v_attore = new.cliente_id
          then 'PROPOSTA_ACCETTATA' else 'CONFERMATA' end
      when 'PROPOSTA' then 'PROPOSTA'
      when 'RIFIUTATA' then 'RIFIUTATA'
      when 'ANNULLATA' then 'ANNULLATA'
    end::public.tipo_notifica;
  elsif new.stato = 'PROPOSTA' and new.appuntamento is distinct from old.appuntamento then
    -- Un'altra proposta di orario mentre la prima aspetta ancora la risposta
    v_tipo := 'PROPOSTA';
  end if;
  if v_tipo is null then
    return new;
  end if;

  select o.ragione_sociale into v_officina from public.officine o where o.id = new.officina_id;
  v_al_cliente := v_tipo in ('CONFERMATA', 'PROPOSTA', 'RIFIUTATA');

  case v_tipo
    when 'NUOVA_RICHIESTA' then
      v_titolo := 'Nuova richiesta di appuntamento';
      v_testo := v_cliente || ' · ' || new.servizio || ' · ' || v_quando;
    when 'CONFERMATA' then
      v_titolo := 'Appuntamento confermato';
      v_testo := v_officina || ' ti aspetta ' || v_quando || ' · ' || new.servizio;
    when 'PROPOSTA' then
      v_titolo := 'Nuovo orario proposto';
      v_testo := v_officina || ' propone ' || v_quando || ' per ' || new.servizio
        || '. Accetta o annulla dall''app.';
    when 'RIFIUTATA' then
      v_titolo := 'Appuntamento non accettato';
      v_testo := v_officina || ' · ' || new.servizio || ' · ' || v_quando;
    when 'PROPOSTA_ACCETTATA' then
      v_titolo := 'Orario accettato';
      v_testo := v_cliente || ' · ' || new.servizio || ' · ' || v_quando;
    when 'ANNULLATA' then
      v_titolo := 'Appuntamento annullato';
      v_testo := v_cliente || ' · ' || new.servizio || ' · ' || v_quando;
  end case;
  if v_tipo in ('CONFERMATA', 'PROPOSTA', 'RIFIUTATA') and new.messaggio_officina <> '' then
    v_testo := v_testo || E'\n«' || new.messaggio_officina || '»';
  end if;

  insert into public.notifiche (destinatario_id, tipo, titolo, testo, link, prenotazione_id)
  select d.id, v_tipo, v_titolo, left(v_testo, 600), '/appuntamento?id=' || new.id, new.id
  from (
    select new.cliente_id as id where v_al_cliente
    union
    select u.profile_id from public.officina_utenti u
    where not v_al_cliente and u.officina_id = new.officina_id
  ) as d
  where d.id is distinct from v_attore;

  return new;
end;
$$;

create trigger prenotazioni_notifica
  after insert or update of stato, appuntamento on public.prenotazioni
  for each row execute function public.notifica_prenotazione();

revoke execute on function public.notifica_prenotazione() from public, anon, authenticated;

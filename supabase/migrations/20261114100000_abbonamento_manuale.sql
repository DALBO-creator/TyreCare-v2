-- Lancio: niente pagamenti nell'app. L'abbonamento dell'officina lo gestisce a mano l'amministratore.
--
-- Decisione del titolare (2026-11-13): i clienti pagano in officina; TyreCare incassa fuori dall'app
-- (bonifico e fattura) l'installazione (149 € una tantum) e l'abbonamento dell'officina (100 €/mese
-- oppure 1000 €/anno, IVA esclusa). Stripe esce del tutto.
--
-- 1. Via tutto ciò che serviva solo a Stripe: job `pulizia-eventi-stripe`, tabella `stripe_eventi`,
--    funzioni del webhook, colonne `stripe_*` di `abbonamenti`, il controllo ABBONAMENTO_STRIPE_PRESENTE
--    di `rifiuta_affiliazione` (torna il corpo di 20261105000100).
-- 2. `abbonamenti` (sempre una riga per officina, creata dal trigger `officine_crea_abbonamento`):
--      piano   MENSILE | ANNUALE                      (prima STARTER | PRO | PILOTA → MENSILE)
--      stato   PROVA | ATTIVO | SCADUTO | SOSPESO     (prima ANNULLATO → SCADUTO)
--      prova_fino_al  ultimo giorno della prova, incluso (già c'era)
--      iniziato_il    primo giorno dell'abbonamento pagato
--      scade_il       ultimo giorno pagato, incluso
--      installazione_pagata, installazione_pagata_il
--      importo_concordato  euro per periodo del piano (al mese o all'anno); null = prezzo di listino
--      note_admin     note interne dell'amministratore: l'officina NON le legge (permessi di colonna)
-- 3. Scrive solo l'amministratore, e solo dalle funzioni `admin_*` (security definer + `is_admin()`):
--    `authenticated` non ha più insert/update/delete sulla tabella. Il titolare legge la riga della sua
--    officina, senza `note_admin`.
-- 4. Stato dell'abbonamento e stato dell'officina restano allineati con un trigger su `officine`:
--    officina SOSPESA → abbonamento SOSPESO; riattivata → lo stato si ricalcola dalle date; prima
--    attivazione → la prova di 30 giorni parte da quel giorno (non dalla richiesta).
-- 5. Job notturno `scadenza-abbonamenti` (sostituisce `scadenza-prove`): mette SCADUTO le prove e gli
--    abbonamenti finiti e avvisa titolari e amministratori; sette giorni prima avvisa i titolari.
--    Come prima (R19) SCADUTO non blocca niente: se e quando sospendere lo decide l'amministratore.
--
-- I valori nuovi di `tipo_notifica` si usano solo dentro corpi plpgsql (in una migrazione un valore
-- aggiunto con `add value` non si può usare nella stessa transazione).

-- ---------------------------------------------------------------------------------------------------
-- 1. Stripe: via
-- ---------------------------------------------------------------------------------------------------

select cron.unschedule(jobid) from cron.job where jobname = 'pulizia-eventi-stripe';

drop function if exists public.pulisci_eventi_stripe(timestamptz);
drop function if exists public.annota_evento_stripe(text, text);
drop function if exists public.registra_evento_stripe(text, text);
drop function if exists public.aggiorna_abbonamento_stripe_evento(uuid, text, text, text, text, timestamptz);
drop function if exists public.aggiorna_abbonamento_stripe(uuid, text, text, text, text);
drop function if exists public.collega_cliente_stripe(uuid, text);
drop table if exists public.stripe_eventi;

drop index if exists public.abbonamenti_stripe_customer_id_unico;
alter table public.abbonamenti
  drop column stripe_customer_id,
  drop column stripe_subscription_id,
  drop column stripe_evento_il;

-- rifiuta_affiliazione: corpo di 20261105000100, senza il controllo sulla subscription di Stripe.
create or replace function public.rifiuta_affiliazione(p_officina_id uuid, p_motivo text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_officina record;
begin
  if (select auth.uid()) is not null and not public.is_admin() then
    raise exception 'Accesso riservato' using errcode = '42501';
  end if;

  if char_length(v_motivo) > 300 then
    raise exception 'MOTIVO_TROPPO_LUNGO';
  end if;

  -- Blocca la riga: un'attivazione contemporanea aspetta (e poi non trova più l'officina) oppure passa
  -- prima, e allora qui lo stato è ATTIVA.
  select o.id, o.ragione_sociale, o.stato_affiliazione into v_officina
  from public.officine o
  where o.id = p_officina_id
  for update;

  if not found then
    raise exception 'OFFICINA_NON_TROVATA';
  end if;

  if v_officina.stato_affiliazione <> 'IN_ATTESA' then
    raise exception 'OFFICINA_NON_IN_ATTESA';
  end if;

  -- Prima della cancellazione: dopo i membri non ci sono più. La notifica non dipende dall'officina.
  insert into public.notifiche (destinatario_id, tipo, titolo, testo, link)
  select
    m.profile_id,
    'AFFILIAZIONE_RIFIUTATA',
    'Richiesta non accettata',
    left(
      'La richiesta per ' || v_officina.ragione_sociale || ' non è stata accettata.'
        || coalesce(' Motivo: ' || v_motivo, ''),
      600
    ),
    '/officina/registra'
  from public.officina_utenti m
  where m.officina_id = p_officina_id;

  -- R24: officina, membri e dati collegati se ne vanno (on delete cascade); il ruolo dei titolari resta.
  delete from public.officine where id = p_officina_id;
end;
$$;

comment on function public.rifiuta_affiliazione(uuid, text) is
  'Rifiuta una richiesta di affiliazione: avvisa i membri e cancella l''officina IN_ATTESA (la partita IVA torna libera, R24). Solo admin o senza utente.';

revoke execute on function public.rifiuta_affiliazione(uuid, text) from public, anon;
grant execute on function public.rifiuta_affiliazione(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------------------------------
-- 2. Abbonamento gestito a mano
-- ---------------------------------------------------------------------------------------------------

alter table public.abbonamenti
  drop constraint abbonamenti_piano_check,
  drop constraint abbonamenti_stato_check;

update public.abbonamenti set piano = 'MENSILE' where piano not in ('MENSILE', 'ANNUALE');
update public.abbonamenti set stato = 'SCADUTO' where stato = 'ANNULLATO';
-- Un abbonamento che Stripe dava per ATTIVO non ha una scadenza: riparte dalla prova, la data la mette
-- l'amministratore (prima del lancio non ci sono abbonamenti pagati).
update public.abbonamenti set stato = 'PROVA' where stato = 'ATTIVO';

alter table public.abbonamenti
  alter column piano set default 'MENSILE',
  add constraint abbonamenti_piano_check check (piano in ('MENSILE', 'ANNUALE')),
  add constraint abbonamenti_stato_check check (stato in ('PROVA', 'ATTIVO', 'SCADUTO', 'SOSPESO')),
  add column iniziato_il date,
  add column scade_il date,
  add column installazione_pagata boolean not null default false,
  add column installazione_pagata_il date,
  add column importo_concordato numeric(8, 2) check (importo_concordato >= 0),
  add column note_admin text not null default '' check (char_length(note_admin) <= 2000),
  add constraint abbonamenti_date_check check (iniziato_il is null or scade_il is null or iniziato_il <= scade_il),
  add constraint abbonamenti_attivo_con_scadenza check (stato <> 'ATTIVO' or scade_il is not null);

comment on table public.abbonamenti is
  'Abbonamento di un''officina (1:1), gestito a mano dall''amministratore: i pagamenti avvengono fuori dall''app. Legge il titolare (senza note_admin); scrivono solo le funzioni admin_*.';
comment on column public.abbonamenti.piano is 'MENSILE (100 €/mese) o ANNUALE (1000 €/anno), IVA esclusa.';
comment on column public.abbonamenti.stato is
  'PROVA, ATTIVO, SCADUTO o SOSPESO (officina sospesa dall''amministratore).';
comment on column public.abbonamenti.iniziato_il is 'Primo giorno dell''abbonamento pagato.';
comment on column public.abbonamenti.scade_il is 'Ultimo giorno pagato, incluso.';
comment on column public.abbonamenti.installazione_pagata is 'L''installazione (una tantum) è stata pagata.';
comment on column public.abbonamenti.importo_concordato is
  'Euro per periodo del piano (al mese o all''anno), IVA esclusa; null = prezzo di listino.';
comment on column public.abbonamenti.note_admin is
  'Note interne dell''amministratore: authenticated non ha il permesso di leggere la colonna.';

-- ---------------------------------------------------------------------------------------------------
-- 3. Permessi: l'officina legge (senza le note), nessuno scrive dall'API
-- ---------------------------------------------------------------------------------------------------

drop policy "abbonamenti: creazione admin" on public.abbonamenti;
drop policy "abbonamenti: modifica admin" on public.abbonamenti;
drop policy "abbonamenti: eliminazione admin" on public.abbonamenti;

revoke all on table public.abbonamenti from anon, authenticated;
grant select (
  officina_id, piano, stato, prova_fino_al, iniziato_il, scade_il,
  installazione_pagata, installazione_pagata_il, importo_concordato, created_at, updated_at
) on table public.abbonamenti to authenticated;

-- ---------------------------------------------------------------------------------------------------
-- Aiuti
-- ---------------------------------------------------------------------------------------------------

-- Prezzo di listino del piano, in euro per periodo (IVA esclusa). Gli stessi numeri stanno in
-- `packages/shared/src/abbonamenti.ts` (PIANI): se cambiano, si cambiano in tutti e due i posti.
create function public.listino_abbonamento(p_piano text)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case p_piano when 'ANNUALE' then 1000 else 100 end::numeric;
$$;

-- '2026-11-21' → '21 novembre 2026'
create function public.data_italiana(p_giorno date)
returns text
language sql
immutable
set search_path = ''
as $$
  select extract(day from p_giorno)::int || ' '
    || (array['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto',
              'settembre', 'ottobre', 'novembre', 'dicembre'])[extract(month from p_giorno)::int]
    || ' ' || extract(year from p_giorno)::int;
$$;

-- Stato che risulta dalle sole date: con una scadenza pagata vale quella, altrimenti la prova.
create function public.stato_abbonamento_da_date(
  p_scade_il date,
  p_prova_fino_al date,
  p_oggi date default ((now() at time zone 'Europe/Rome')::date)
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_scade_il is not null then case when p_scade_il >= p_oggi then 'ATTIVO' else 'SCADUTO' end
    when p_prova_fino_al >= p_oggi then 'PROVA'
    else 'SCADUTO'
  end;
$$;

revoke execute on function public.listino_abbonamento(text) from public, anon;
revoke execute on function public.data_italiana(date) from public, anon;
revoke execute on function public.stato_abbonamento_da_date(date, date, date) from public, anon;
grant execute on function public.listino_abbonamento(text) to authenticated, service_role;
grant execute on function public.data_italiana(date) to authenticated, service_role;
grant execute on function public.stato_abbonamento_da_date(date, date, date) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------
-- 4. Abbonamento allineato allo stato dell'officina
-- ---------------------------------------------------------------------------------------------------
-- Vale per `attiva_officina` e `sospendi_officina` (che restano come sono) e per qualsiasi altro cambio
-- di `stato_affiliazione`.

create function public.sincronizza_abbonamento_officina()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_oggi date := (now() at time zone 'Europe/Rome')::date;
begin
  if new.stato_affiliazione = 'SOSPESA' then
    update public.abbonamenti set stato = 'SOSPESO'
    where officina_id = new.id and stato <> 'SOSPESO';
  elsif new.stato_affiliazione = 'ATTIVA' and old.stato_affiliazione = 'SOSPESA' then
    update public.abbonamenti
    set stato = public.stato_abbonamento_da_date(scade_il, prova_fino_al, v_oggi)
    where officina_id = new.id and stato = 'SOSPESO';
  elsif new.stato_affiliazione = 'ATTIVA' and old.stato_affiliazione = 'IN_ATTESA' then
    -- Prima attivazione: i 30 giorni di prova si contano da oggi (ultimo giorno incluso).
    update public.abbonamenti set prova_fino_al = v_oggi + 29
    where officina_id = new.id and stato = 'PROVA' and scade_il is null;
  end if;
  return new;
end;
$$;

comment on function public.sincronizza_abbonamento_officina() is
  'Trigger: officina SOSPESA → abbonamento SOSPESO; riattivata → stato dalle date; prima attivazione → la prova parte da oggi.';

revoke execute on function public.sincronizza_abbonamento_officina() from public, anon, authenticated;

create trigger officine_sincronizza_abbonamento
  after update of stato_affiliazione on public.officine
  for each row
  when (new.stato_affiliazione is distinct from old.stato_affiliazione)
  execute function public.sincronizza_abbonamento_officina();

-- Le officine già sospese prima di questa migrazione
update public.abbonamenti a set stato = 'SOSPESO'
from public.officine o
where o.id = a.officina_id and o.stato_affiliazione = 'SOSPESA';

comment on function public.crea_abbonamento_officina() is
  'Trigger: crea l''abbonamento (MENSILE, PROVA) di ogni officina nuova; la prova riparte da 30 giorni quando l''officina viene attivata.';

-- ---------------------------------------------------------------------------------------------------
-- 5. Scadenze e avvisi
-- ---------------------------------------------------------------------------------------------------

alter type public.tipo_notifica add value 'ABBONAMENTO';

select cron.unschedule(jobid) from cron.job where jobname = 'scadenza-prove';
drop function public.scadi_prove_abbonamento(date);

-- Restituisce quanti abbonamenti (prove comprese) ha messo SCADUTO. `p_oggi` serve ai test.
create function public.scadi_abbonamenti(
  p_oggi date default ((now() at time zone 'Europe/Rome')::date)
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quanti integer;
begin
  -- Tra sette giorni finisce: avviso ai titolari (una volta sola: il job gira una volta al giorno).
  insert into public.notifiche (destinatario_id, tipo, titolo, testo, link)
  select
    m.profile_id,
    'ABBONAMENTO',
    case when a.stato = 'PROVA' then 'La prova sta per finire' else 'Abbonamento in scadenza' end,
    left(
      case when a.stato = 'PROVA'
        then 'La prova gratuita di ' || o.ragione_sociale || ' finisce il '
          || public.data_italiana(a.prova_fino_al) || '. Scrivici per attivare l''abbonamento.'
        else 'L''abbonamento di ' || o.ragione_sociale || ' scade il '
          || public.data_italiana(a.scade_il) || '. Scrivici per rinnovarlo.'
      end,
      600
    ),
    '/officina/abbonamento'
  from public.abbonamenti a
  join public.officine o on o.id = a.officina_id
  join public.officina_utenti m on m.officina_id = a.officina_id and m.ruolo = 'TITOLARE'
  where (a.stato = 'ATTIVO' and a.scade_il = p_oggi + 7)
     or (a.stato = 'PROVA' and a.prova_fino_al = p_oggi + 7);

  -- Finiti ieri o prima: SCADUTO, con avviso ai titolari e agli amministratori.
  with scaduti as (
    update public.abbonamenti a
    set stato = 'SCADUTO'
    where (a.stato = 'ATTIVO' and a.scade_il < p_oggi)
       or (a.stato = 'PROVA' and a.prova_fino_al < p_oggi)
    returning a.officina_id, (a.scade_il is null) as era_prova
  ),
  ai_titolari as (
    insert into public.notifiche (destinatario_id, tipo, titolo, testo, link)
    select
      m.profile_id,
      'ABBONAMENTO',
      case when s.era_prova then 'La prova è finita' else 'Abbonamento scaduto' end,
      left(
        case when s.era_prova
          then 'La prova gratuita di ' || o.ragione_sociale
            || ' è finita. Scrivici per attivare l''abbonamento.'
          else 'L''abbonamento di ' || o.ragione_sociale || ' è scaduto. Scrivici per rinnovarlo.'
        end,
        600
      ),
      '/officina/abbonamento'
    from scaduti s
    join public.officine o on o.id = s.officina_id
    join public.officina_utenti m on m.officina_id = s.officina_id and m.ruolo = 'TITOLARE'
  ),
  agli_admin as (
    insert into public.notifiche (destinatario_id, tipo, titolo, testo, link)
    select
      p.id,
      'ABBONAMENTO',
      case when s.era_prova then 'Prova finita' else 'Abbonamento scaduto' end,
      left(
        o.ragione_sociale || ' (' || o.citta || '): '
          || case when s.era_prova then 'la prova gratuita è finita.' else 'l''abbonamento è scaduto.' end,
        600
      ),
      '/admin/officina?id=' || s.officina_id
    from scaduti s
    join public.officine o on o.id = s.officina_id
    cross join public.profiles p
    where p.ruolo = 'ADMIN'
  )
  select count(*) into v_quanti from scaduti;

  return v_quanti;
end;
$$;

comment on function public.scadi_abbonamenti(date) is
  'Job notturno: avvisa i titolari 7 giorni prima della fine, mette SCADUTO prove e abbonamenti finiti e avvisa titolari e amministratori.';

-- La chiama solo il job
revoke execute on function public.scadi_abbonamenti(date) from public, anon, authenticated;

-- Ogni notte alle 0:25 (UTC), cioè 1:25 o 2:25 in Italia: la data italiana è già quella del giorno nuovo.
select cron.schedule(
  'scadenza-abbonamenti',
  '25 0 * * *',
  $$select public.scadi_abbonamenti()$$
);

-- ---------------------------------------------------------------------------------------------------
-- Funzioni dell'amministratore sull'abbonamento
-- ---------------------------------------------------------------------------------------------------
-- Tutte: security definer, solo `is_admin()` (codice 42501 per gli altri), niente EXECUTE ad anon.
-- Errori attesi (messaggio = chiave, codice P0001): OFFICINA_NON_TROVATA, PIANO_NON_VALIDO,
-- STATO_NON_VALIDO, SCADENZA_MANCANTE, DATE_NON_VALIDE, IMPORTO_NON_VALIDO, NOTE_TROPPO_LUNGHE,
-- PERIODO_NON_VALIDO.

-- Imposta tutti i dati dell'abbonamento in un colpo (il modulo della scheda dell'officina).
-- Con l'officina SOSPESA lo stato resta SOSPESO: si ricalcola dalle date alla riattivazione.
create function public.admin_imposta_abbonamento(
  p_officina_id uuid,
  p_piano text,
  p_stato text,
  p_prova_fino_al date default null,
  p_iniziato_il date default null,
  p_scade_il date default null,
  p_importo numeric default null,
  p_note text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_oggi date := (now() at time zone 'Europe/Rome')::date;
  v_note text := btrim(coalesce(p_note, ''));
  v_sospesa boolean;
begin
  if not public.is_admin() then
    raise exception 'Accesso riservato' using errcode = '42501';
  end if;

  select o.stato_affiliazione = 'SOSPESA' into v_sospesa
  from public.officine o where o.id = p_officina_id
  for update;
  if not found then
    raise exception 'OFFICINA_NON_TROVATA';
  end if;

  if p_piano is null or p_piano not in ('MENSILE', 'ANNUALE') then
    raise exception 'PIANO_NON_VALIDO';
  end if;
  if p_stato is null or p_stato not in ('PROVA', 'ATTIVO', 'SCADUTO') then
    raise exception 'STATO_NON_VALIDO';
  end if;
  if p_stato = 'ATTIVO' and p_scade_il is null then
    raise exception 'SCADENZA_MANCANTE';
  end if;
  if p_iniziato_il is not null and p_scade_il is not null and p_iniziato_il > p_scade_il then
    raise exception 'DATE_NON_VALIDE';
  end if;
  if p_importo is not null and (p_importo < 0 or p_importo > 99999) then
    raise exception 'IMPORTO_NON_VALIDO';
  end if;
  if char_length(v_note) > 2000 then
    raise exception 'NOTE_TROPPO_LUNGHE';
  end if;

  update public.abbonamenti
  set piano = p_piano,
      stato = case when v_sospesa then 'SOSPESO' else p_stato end,
      prova_fino_al = coalesce(p_prova_fino_al, prova_fino_al),
      iniziato_il = case
        when p_iniziato_il is null and p_stato = 'ATTIVO' then least(v_oggi, p_scade_il)
        else p_iniziato_il
      end,
      scade_il = p_scade_il,
      importo_concordato = p_importo,
      note_admin = v_note
  where officina_id = p_officina_id;

  if not found then
    raise exception 'OFFICINA_NON_TROVATA';
  end if;
end;
$$;

-- Rinnova di un mese o di un anno con un clic. Il periodo nuovo parte dal giorno dopo la scadenza
-- attuale se non è ancora passata, altrimenti da oggi. Il piano segue il periodo scelto. Restituisce la
-- nuova scadenza e avvisa i titolari.
create function public.admin_rinnova_abbonamento(p_officina_id uuid, p_periodo text)
returns date
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_oggi date := (now() at time zone 'Europe/Rome')::date;
  v_durata interval;
  v_sospesa boolean;
  v_ragione_sociale text;
  v_scade date;
begin
  if not public.is_admin() then
    raise exception 'Accesso riservato' using errcode = '42501';
  end if;

  if p_periodo = 'MESE' then
    v_durata := interval '1 month';
  elsif p_periodo = 'ANNO' then
    v_durata := interval '1 year';
  else
    raise exception 'PERIODO_NON_VALIDO';
  end if;

  select o.stato_affiliazione = 'SOSPESA', o.ragione_sociale into v_sospesa, v_ragione_sociale
  from public.officine o where o.id = p_officina_id
  for update;
  if not found then
    raise exception 'OFFICINA_NON_TROVATA';
  end if;

  -- `scade_il` è l'ultimo giorno incluso: dal 14 novembre, un mese arriva al 13 dicembre.
  update public.abbonamenti
  set piano = case p_periodo when 'ANNO' then 'ANNUALE' else 'MENSILE' end,
      stato = case when v_sospesa then 'SOSPESO' else 'ATTIVO' end,
      iniziato_il = coalesce(iniziato_il, v_oggi),
      scade_il = (
        (case when scade_il >= v_oggi then scade_il + 1 else v_oggi end) + v_durata - interval '1 day'
      )::date
  where officina_id = p_officina_id
  returning scade_il into v_scade;

  if not found then
    raise exception 'OFFICINA_NON_TROVATA';
  end if;

  insert into public.notifiche (destinatario_id, tipo, titolo, testo, link)
  select
    m.profile_id,
    'ABBONAMENTO',
    'Abbonamento rinnovato',
    left(
      'L''abbonamento di ' || v_ragione_sociale || ' è valido fino al '
        || public.data_italiana(v_scade) || '. Grazie!',
      600
    ),
    '/officina/abbonamento'
  from public.officina_utenti m
  where m.officina_id = p_officina_id and m.ruolo = 'TITOLARE';

  return v_scade;
end;
$$;

-- Segna l'installazione come pagata (con la data: oggi se non indicata) o non pagata.
create function public.admin_registra_installazione(
  p_officina_id uuid,
  p_pagata boolean,
  p_pagata_il date default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Accesso riservato' using errcode = '42501';
  end if;

  update public.abbonamenti
  set installazione_pagata = coalesce(p_pagata, false),
      installazione_pagata_il = case
        when coalesce(p_pagata, false)
          then coalesce(p_pagata_il, (now() at time zone 'Europe/Rome')::date)
      end
  where officina_id = p_officina_id;

  if not found then
    raise exception 'OFFICINA_NON_TROVATA';
  end if;
end;
$$;

comment on function public.admin_imposta_abbonamento(uuid, text, text, date, date, date, numeric, text) is
  'Solo admin: imposta piano, stato, date, importo concordato e note dell''abbonamento di un''officina.';
comment on function public.admin_rinnova_abbonamento(uuid, text) is
  'Solo admin: rinnova l''abbonamento di un MESE o di un ANNO, lo mette ATTIVO e avvisa i titolari; restituisce la nuova scadenza.';
comment on function public.admin_registra_installazione(uuid, boolean, date) is
  'Solo admin: segna l''installazione come pagata (con la data) o non pagata.';

revoke execute on function public.admin_imposta_abbonamento(uuid, text, text, date, date, date, numeric, text)
  from public, anon;
revoke execute on function public.admin_rinnova_abbonamento(uuid, text) from public, anon;
revoke execute on function public.admin_registra_installazione(uuid, boolean, date) from public, anon;
grant execute on function public.admin_imposta_abbonamento(uuid, text, text, date, date, date, numeric, text)
  to authenticated;
grant execute on function public.admin_rinnova_abbonamento(uuid, text) to authenticated;
grant execute on function public.admin_registra_installazione(uuid, boolean, date) to authenticated;

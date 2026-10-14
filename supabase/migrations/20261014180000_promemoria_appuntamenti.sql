-- Fase 5 — Promemoria del giorno prima (P11, P21).
--
-- Ogni ora un job di Supabase Cron (`pg_cron`) chiama `crea_promemoria_appuntamenti()`: dalle 18 (ora
-- italiana) il cliente di ogni appuntamento CONFERMATO per il giorno dopo riceve una notifica
-- PROMEMORIA. È una riga in `notifiche` come le altre, quindi arriva anche la push (trigger
-- `notifiche_push`).
--
-- - Un solo promemoria per orario: `prenotazioni.promemoria_per` ricorda per quale `appuntamento` è
--   partito. Se l'officina sposta l'appuntamento a un altro giorno, al nuovo orario ne parte un altro.
-- - Il job gira ogni ora (non una volta al giorno) perché pg_cron usa l'ora UTC: così l'ora legale non
--   sposta l'invio, e un giro saltato si recupera al successivo.
-- - Non ricevono il promemoria chi lavora in officina: hanno il calendario.

alter type public.tipo_notifica add value 'PROMEMORIA';

alter table public.prenotazioni add column promemoria_per timestamptz;

comment on column public.prenotazioni.promemoria_per is
  'Orario (appuntamento) per cui è già partito il promemoria del giorno prima.';

-- Restituisce quanti promemoria ha creato. `p_adesso` serve ai test.
create function public.crea_promemoria_appuntamenti(p_adesso timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_locale timestamp := p_adesso at time zone 'Europe/Rome';
  v_domani date := v_locale::date + 1;
  v_quanti integer;
begin
  if v_locale::time < time '18:00' then
    return 0;
  end if;

  with da_avvisare as (
    update public.prenotazioni p
    set promemoria_per = p.appuntamento
    where p.stato = 'CONFERMATA'
      and (p.appuntamento at time zone 'Europe/Rome')::date = v_domani
      and p.promemoria_per is distinct from p.appuntamento
    returning p.*
  )
  insert into public.notifiche (destinatario_id, tipo, titolo, testo, link, prenotazione_id)
  select
    d.cliente_id,
    'PROMEMORIA',
    'Domani hai un appuntamento',
    left(
      coalesce(o.ragione_sociale, 'L''officina') || ' ti aspetta '
        || public.testo_quando(d.giorno, d.fascia, d.appuntamento) || ' · ' || d.servizio,
      600
    ),
    '/appuntamento?id=' || d.id,
    d.id
  from da_avvisare d
  left join public.officine o on o.id = d.officina_id;

  get diagnostics v_quanti = row_count;
  return v_quanti;
end;
$$;

revoke execute on function public.crea_promemoria_appuntamenti(timestamptz)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------
-- Job programmato
-- ---------------------------------------------------------------------------------------------------

create extension if not exists pg_cron with schema pg_catalog;

-- Al minuto 5 di ogni ora (dalle 18 italiane in poi parte il promemoria)
select cron.schedule(
  'promemoria-appuntamenti',
  '5 * * * *',
  $$select public.crea_promemoria_appuntamenti()$$
);

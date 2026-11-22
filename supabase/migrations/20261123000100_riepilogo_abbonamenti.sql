-- Riepilogo del pannello admin: «prove in scadenza» col giorno italiano e i numeri degli abbonamenti (T368).
--
-- Corpo di `admin_riepilogo` da 20261112000100_pannello_admin.sql, con due soli cambi:
-- 1. `prove_in_scadenza` usa il giorno italiano (`(now() at time zone 'Europe/Rome')::date`) invece di
--    `current_date` (UTC), che tra mezzanotte e le 2 dava ancora il giorno prima;
-- 2. tre chiavi nuove: `abbonamenti_attivi` (stato ATTIVO), `prove_in_corso` (stato PROVA) e
--    `ricavo_mensile`: euro al mese IVA esclusa dei soli ATTIVO, importo concordato o listino
--    (`listino_abbonamento`), diviso 12 per il piano ANNUALE (R48).
-- Firma, `stable`, `security definer`, `search_path` e permessi invariati. Nessuna tabella o colonna nuova.

create or replace function public.admin_riepilogo()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.richiedi_admin();
  return jsonb_build_object(
    'utenti', (select count(*) from auth.users),
    'utenti_7_giorni', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'utenti_non_confermati', (select count(*) from auth.users where email_confirmed_at is null),
    'utenti_bloccati', (select count(*) from auth.users where banned_until > now()),
    'accessi_24_ore', (select count(*) from auth.users where last_sign_in_at > now() - interval '24 hours'),
    'officine_attive', (select count(*) from public.officine where stato_affiliazione = 'ATTIVA'),
    'officine_in_attesa', (select count(*) from public.officine where stato_affiliazione = 'IN_ATTESA'),
    'officine_sospese', (select count(*) from public.officine where stato_affiliazione = 'SOSPESA'),
    'abbonamenti_scaduti', (select count(*) from public.abbonamenti where stato = 'SCADUTO'),
    'prove_in_scadenza', (
      select count(*) from public.abbonamenti
      where stato = 'PROVA'
        and prova_fino_al between (now() at time zone 'Europe/Rome')::date
                              and (now() at time zone 'Europe/Rome')::date + 7
    ),
    'abbonamenti_attivi', (select count(*) from public.abbonamenti where stato = 'ATTIVO'),
    'prove_in_corso', (select count(*) from public.abbonamenti where stato = 'PROVA'),
    'ricavo_mensile', (
      select round(coalesce(sum(
        coalesce(importo_concordato, public.listino_abbonamento(piano))
          / case piano when 'ANNUALE' then 12 else 1 end
      ), 0), 2)
      from public.abbonamenti
      where stato = 'ATTIVO'
    ),
    'clienti', (select count(*) from public.clienti_officina),
    'veicoli', (select count(*) from public.veicoli),
    'controlli', (select count(*) from public.controlli),
    'controlli_7_giorni', (
      select count(*) from public.controlli where created_at > now() - interval '7 days'
    ),
    'prenotazioni_in_corso', (
      select count(*) from public.prenotazioni where stato in ('RICHIESTA', 'PROPOSTA', 'CONFERMATA')
    ),
    'prenotazioni_7_giorni', (
      select count(*) from public.prenotazioni where created_at > now() - interval '7 days'
    ),
    'commenti_7_giorni', (
      select count(*) from public.commenti where created_at > now() - interval '7 days'
    ),
    'iscrizioni_push', (select count(*) from public.iscrizioni_push)
  );
end;
$$;

revoke execute on function public.admin_riepilogo() from public, anon;
grant execute on function public.admin_riepilogo() to authenticated;

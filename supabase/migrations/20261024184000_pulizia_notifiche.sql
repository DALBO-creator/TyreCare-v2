-- Pulizia automatica delle notifiche vecchie (R6, cancellazioni automatiche chieste dalle bozze legali).
-- Le notifiche lette si cancellano dopo 180 giorni dalla lettura, tutte dopo 365 giorni dalla creazione.
-- Questa migrazione NON cancella niente da sola: crea la funzione e il job notturno.
-- Per cambiare i tempi: nuova migrazione con `create or replace function` (e, per l'orario, `cron.schedule`
-- con lo stesso nome).

-- Restituisce quante notifiche ha cancellato. `p_adesso` serve ai test.
create function public.pulisci_notifiche(p_adesso timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quante integer;
begin
  delete from public.notifiche
  where letta_il < p_adesso - interval '180 days'
     or created_at < p_adesso - interval '365 days';

  get diagnostics v_quante = row_count;
  return v_quante;
end;
$$;

-- La chiama solo il job
revoke execute on function public.pulisci_notifiche(timestamptz)
  from public, anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;

-- Ogni notte all'1:40 (UTC)
select cron.schedule(
  'pulizia-notifiche',
  '40 1 * * *',
  $$select public.pulisci_notifiche()$$
);

-- Pulizia automatica delle prenotazioni vecchie (R25, misura "cancellazione automatica" delle bozze legali).
-- Le prenotazioni con il giorno dell'appuntamento di oltre 24 mesi fa si cancellano, in qualsiasi stato.
-- Le notifiche collegate spariscono con loro (`notifiche.prenotazione_id` è `on delete cascade`).
-- Questa migrazione NON cancella niente da sola: crea la funzione e il job notturno.
-- Per cambiare i tempi (R25): nuova migrazione con `create or replace function` (e, per l'orario,
-- `cron.schedule` con lo stesso nome).

-- Restituisce quante prenotazioni ha cancellato. `p_oggi` serve ai test; il default è il giorno italiano
-- (non `current_date`, che è UTC).
create function public.pulisci_prenotazioni(
  p_oggi date default ((now() at time zone 'Europe/Rome')::date)
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quante integer;
begin
  -- Il giorno esattamente di 24 mesi prima resta (confronto stretto)
  delete from public.prenotazioni
  where giorno < (p_oggi - interval '24 months')::date;

  get diagnostics v_quante = row_count;
  return v_quante;
end;
$$;

-- La chiama solo il job
revoke execute on function public.pulisci_prenotazioni(date)
  from public, anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;

-- Ogni notte alle 00:45 (UTC)
select cron.schedule(
  'pulizia-prenotazioni',
  '45 0 * * *',
  $$select public.pulisci_prenotazioni()$$
);

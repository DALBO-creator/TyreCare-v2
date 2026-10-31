-- T138 (R19): prova di 30 giorni contando oggi e scadenza automatica delle prove finite.
-- prova_fino_al è l'ultimo giorno incluso (R16): con default current_date + 29 il primo giorno la pagina
-- "Abbonamento" legge "mancano 30 giorni". Cambia solo il default per le officine nuove: le righe già
-- presenti NON si toccano (tengono la loro data di fine).
-- Ogni notte un job mette SCADUTO le prove finite (non il piano PILOTA). SCADUTO per ora si mostra
-- soltanto: nessuna funzione dell'officina viene bloccata (R19).
-- Per cambiare: migrazione nuova con `alter column … set default` o `create or replace function
-- public.scadi_prove_abbonamento`; il job si toglie con `cron.unschedule('scadenza-prove')`.

-- ---------------------------------------------------------------------------------------------------
-- Prova di 30 giorni contando oggi
-- ---------------------------------------------------------------------------------------------------

alter table public.abbonamenti alter column prova_fino_al set default (current_date + 29);

comment on column public.abbonamenti.prova_fino_al is
  'Ultimo giorno della prova gratuita, incluso: 30 giorni contando oggi.';

comment on function public.crea_abbonamento_officina() is
  'Trigger: crea l''abbonamento (STARTER, PROVA) di ogni officina nuova; ultimo giorno incluso: 30 giorni contando oggi.';

-- ---------------------------------------------------------------------------------------------------
-- Scadenza automatica
-- ---------------------------------------------------------------------------------------------------
-- Una prova è finita quando il suo ultimo giorno (prova_fino_al) è prima di oggi (data italiana).
-- Restituisce quante prove ha messo SCADUTO. `p_oggi` serve ai test.

create function public.scadi_prove_abbonamento(
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
  update public.abbonamenti
  set stato = 'SCADUTO'
  where stato = 'PROVA'
    and piano <> 'PILOTA'
    and prova_fino_al < p_oggi;

  get diagnostics v_quante = row_count;
  return v_quante;
end;
$$;

comment on function public.scadi_prove_abbonamento(date) is
  'Job notturno: mette SCADUTO gli abbonamenti in PROVA (non PILOTA) con l''ultimo giorno prima di oggi.';

-- La chiama solo il job
revoke execute on function public.scadi_prove_abbonamento(date)
  from public, anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;

-- Ogni notte alle 0:25 (UTC), cioè 1:25 o 2:25 in Italia: la data italiana è già quella del giorno nuovo.
select cron.schedule(
  'scadenza-prove',
  '25 0 * * *',
  $$select public.scadi_prove_abbonamento()$$
);

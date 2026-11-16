-- Pilota: andamento per officina (R41, T255). L'amministratore legge in un colpo i numeri che
-- `DOCS/pilota/piano-pilota.md` §3 chiede di annotare ogni settimana, invece di contarli dalle pagine.
-- Calcolati al momento (nessuna tabella storica), solo numeri e nome dell'officina: nessun dato
-- personale dei clienti. Solo admin con la verifica in due passaggi (`richiedi_admin`, aal2).
-- Per cambiare: migrazione nuova con `create or replace function`.

create function public.andamento_officine(p_da date, p_a date)
returns table (
  officina_id uuid,
  ragione_sociale text,
  stato_affiliazione text,
  clienti integer,
  clienti_collegati integer,
  clienti_con_push integer,
  inviti_creati integer,
  controlli_app integer,
  controlli_importati integer,
  richieste_appuntamento integer,
  richieste_strada_accettate integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  -- Prima l'accesso: chi non è admin riceve sempre 42501, qualunque periodo passi
  perform public.richiedi_admin();

  if p_da is null or p_a is null or p_da > p_a then
    raise exception 'PERIODO_NON_VALIDO' using errcode = 'P0001';
  end if;

  return query
  select
    o.id,
    o.ragione_sociale,
    o.stato_affiliazione::text,
    -- Totali: lo stato di adesso
    (select count(*)::integer from public.clienti_officina c where c.officina_id = o.id),
    (
      select count(*)::integer from public.clienti_officina c
      where c.officina_id = o.id and c.profile_id is not null
    ),
    (
      select count(*)::integer from public.clienti_officina c
      where c.officina_id = o.id
        and c.profile_id is not null
        and exists (select 1 from public.iscrizioni_push ip where ip.profile_id = c.profile_id)
    ),
    -- Nel periodo: created_at letto come giorno italiano
    (
      select count(*)::integer from public.inviti_cliente i
      where i.officina_id = o.id
        and (i.created_at at time zone 'Europe/Rome')::date between p_da and p_a
    ),
    (
      select count(*)::integer from public.controlli k
      where k.officina_id = o.id and k.origine = 'APP'
        and (k.created_at at time zone 'Europe/Rome')::date between p_da and p_a
    ),
    (
      select count(*)::integer from public.controlli k
      where k.officina_id = o.id and k.origine = 'IMPORT'
        and (k.created_at at time zone 'Europe/Rome')::date between p_da and p_a
    ),
    (
      select count(*)::integer from public.prenotazioni p
      where p.officina_id = o.id
        and (p.created_at at time zone 'Europe/Rome')::date between p_da and p_a
    ),
    (
      select count(*)::integer from public.richieste_strada s
      where s.officina_id = o.id
        and (s.created_at at time zone 'Europe/Rome')::date between p_da and p_a
    )
  from public.officine o
  order by o.ragione_sociale, o.id;
end;
$$;

comment on function public.andamento_officine(date, date) is
  'Solo admin (aal2): numeri del pilota per ogni officina (anche senza attività, con zeri), ordinati per '
  'ragione sociale. Totali di adesso: clienti = righe di clienti_officina; clienti_collegati = quelle con '
  'profile_id (account cliente collegato); clienti_con_push = collegati con almeno una riga in '
  'iscrizioni_push. Nel periodo [p_da, p_a], giorni italiani di created_at: inviti_creati = inviti_cliente '
  '(anche usati, scaduti o annullati); controlli_app / controlli_importati = controlli con origine APP / '
  'IMPORT; richieste_appuntamento = prenotazioni in qualsiasi stato; richieste_strada_accettate = '
  'richieste_strada con officina_id dell''officina (quella che ha accettato). p_da > p_a o date nulle: '
  'PERIODO_NON_VALIDO. Nessun dato personale.';

revoke execute on function public.andamento_officine(date, date) from public, anon;
grant execute on function public.andamento_officine(date, date) to authenticated;

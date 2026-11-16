-- Lancio: pagina dell'amministratore per l'abbonamento di un'officina (`/admin/abbonamento`).
-- `note_admin` non è leggibile da `authenticated` (permessi di colonna di 20261114100000): anche l'admin
-- passa da questa funzione, che restituisce la riga intera con i dati dell'officina. Solo admin (aal2).
-- Per cambiare: migrazione nuova con `create or replace function`.

create function public.admin_leggi_abbonamento(p_officina_id uuid)
returns table (
  officina_id uuid,
  ragione_sociale text,
  stato_affiliazione public.stato_affiliazione,
  piano text,
  stato text,
  prova_fino_al date,
  iniziato_il date,
  scade_il date,
  installazione_pagata boolean,
  installazione_pagata_il date,
  importo_concordato numeric,
  note_admin text,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Accesso riservato' using errcode = '42501';
  end if;

  return query
  select
    o.id, o.ragione_sociale, o.stato_affiliazione,
    a.piano, a.stato, a.prova_fino_al, a.iniziato_il, a.scade_il,
    a.installazione_pagata, a.installazione_pagata_il, a.importo_concordato, a.note_admin, a.updated_at
  from public.officine o
  join public.abbonamenti a on a.officina_id = o.id
  where o.id = p_officina_id;

  if not found then
    raise exception 'OFFICINA_NON_TROVATA';
  end if;
end;
$$;

comment on function public.admin_leggi_abbonamento(uuid) is
  'Solo admin: abbonamento completo di un''officina (note interne comprese) con ragione sociale e stato dell''affiliazione.';

revoke execute on function public.admin_leggi_abbonamento(uuid) from public, anon;
grant execute on function public.admin_leggi_abbonamento(uuid) to authenticated;

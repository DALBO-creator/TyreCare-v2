-- T219: un'officina SOSPESA e poi riattivata riceve un avviso suo ("La tua officina è di nuovo attiva",
-- link /clienti), non il benvenuto con l'invito a caricare i dati pensato per la prima attivazione.
-- Corpo di attiva_officina da 20261105000100 (T191) + lettura dello stato precedente con `for update`
-- (due chiamate insieme non leggono lo stesso stato). Da IN_ATTESA l'avviso resta quello di oggi; da
-- ATTIVA nessun avviso, come prima. Firma invariata: nessun cambio ai tipi generati.

create or replace function public.attiva_officina(p_officina_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attivata int;
  v_prima public.stato_affiliazione;
begin
  if (select auth.uid()) is not null and not public.is_admin() then
    raise exception 'Accesso riservato' using errcode = '42501';
  end if;

  if not exists (select 1 from public.officine where id = p_officina_id) then
    raise exception 'OFFICINA_NON_TROVATA';
  end if;

  -- Stato prima dell'attivazione: decide quale avviso mandare (T219).
  select stato_affiliazione into v_prima
  from public.officine
  where id = p_officina_id
  for update;

  update public.officine set stato_affiliazione = 'ATTIVA'
  where id = p_officina_id and stato_affiliazione is distinct from 'ATTIVA';
  -- 1 solo se l'officina non era ATTIVA (T191: si avvisa una volta sola).
  get diagnostics v_attivata = row_count;

  -- Un ADMIN (o chi è già OFFICINA) resta com'è: si promuove solo un CLIENTE.
  update public.profiles p set ruolo = 'OFFICINA'
  from public.officina_utenti m
  where m.officina_id = p_officina_id
    and m.ruolo = 'TITOLARE'
    and m.profile_id = p.id
    and p.ruolo = 'CLIENTE';

  if v_attivata > 0 then
    insert into public.notifiche (destinatario_id, tipo, titolo, testo, link)
    select
      m.profile_id,
      'AFFILIAZIONE_ATTIVATA',
      case when v_prima = 'SOSPESA'
        then 'La tua officina è di nuovo attiva'
        else 'La tua officina è attiva'
      end,
      case when v_prima = 'SOSPESA'
        then left(o.ragione_sociale || ' è di nuovo visibile ai clienti.', 600)
        else left(o.ragione_sociale || ' ora è visibile ai clienti: puoi caricare i tuoi dati.', 600)
      end,
      case when v_prima = 'SOSPESA' then '/clienti' else '/clienti/importa' end
    from public.officina_utenti m
    join public.officine o on o.id = m.officina_id
    where m.officina_id = p_officina_id and m.ruolo = 'TITOLARE';
  end if;
end;
$$;

comment on function public.attiva_officina(uuid) is
  'Mette l''officina ATTIVA e porta a OFFICINA i suoi titolari ancora CLIENTE; se prima non era ATTIVA li avvisa (da SOSPESA con l''avviso di riattivazione). Solo admin o senza utente.';

revoke execute on function public.attiva_officina(uuid) from public, anon;
grant execute on function public.attiva_officina(uuid) to authenticated;

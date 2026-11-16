-- T290 (R43): l'avviso «La tua officina è sospesa» parte solo se l'officina era ATTIVA. Un'officina mai
-- attivata (IN_ATTESA) non è mai stata visibile ai clienti: la frase «non è più visibile ai clienti»
-- sarebbe falsa, quindi diventa SOSPESA senza avviso.
--
-- - sospendi_officina: corpo di 20261108000500 (T242). Lo stato precedente si legge con
--   `select … for update` prima dell'update: due sospensioni contemporanee si mettono in fila sul lock
--   della riga e la seconda legge già SOSPESA, quindi l'avviso parte una volta sola.
-- - Firma, security definer, search_path, controllo admin, errori (42501 «Accesso riservato»,
--   OFFICINA_NON_TROVATA), permessi e testo dell'avviso invariati; il ruolo dei titolari non cambia (R14).
-- Nessuna tabella e nessun dato esistente cambiano.

create or replace function public.sospendi_officina(p_officina_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prima public.stato_affiliazione;
begin
  if (select auth.uid()) is not null and not public.is_admin() then
    raise exception 'Accesso riservato' using errcode = '42501';
  end if;

  -- Stato di partenza, con il lock della riga fino alla fine della transazione.
  select stato_affiliazione into v_prima
  from public.officine
  where id = p_officina_id
  for update;

  if not found then
    raise exception 'OFFICINA_NON_TROVATA';
  end if;

  -- R14: il ruolo dei titolari non cambia.
  update public.officine set stato_affiliazione = 'SOSPESA'
  where id = p_officina_id and stato_affiliazione is distinct from 'SOSPESA';

  -- R43: avviso solo a chi era visibile ai clienti (da IN_ATTESA o già SOSPESA niente).
  if v_prima = 'ATTIVA' then
    insert into public.notifiche (destinatario_id, tipo, titolo, testo, link)
    select
      m.profile_id,
      'AFFILIAZIONE_SOSPESA',
      'La tua officina è sospesa',
      left(
        o.ragione_sociale
          || ' non è più visibile ai clienti. Per sapere perché scrivici con «Invia un commento».',
        600
      ),
      '/commento'
    from public.officina_utenti m
    join public.officine o on o.id = m.officina_id
    where m.officina_id = p_officina_id and m.ruolo = 'TITOLARE';
  end if;
end;
$$;

comment on function public.sospendi_officina(uuid) is
  'Mette l''officina SOSPESA (invisibile ai clienti) e, solo se prima era ATTIVA, avvisa i suoi titolari; il ruolo dei titolari non cambia. Solo admin o senza utente.';

revoke execute on function public.sospendi_officina(uuid) from public, anon;
grant execute on function public.sospendi_officina(uuid) to authenticated;

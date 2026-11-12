-- T242 (R36): quando un'officina viene sospesa, i suoi titolari ricevono un avviso nell'app ("La tua
-- officina è sospesa", link /commento per chiedere il perché), come avviene per la riattivazione (T219).
--
-- - tipo_notifica: valore nuovo AFFILIAZIONE_SOSPESA. Si usa solo dentro il corpo plpgsql di
--   sospendi_officina (risolto all'esecuzione): in una migrazione un valore aggiunto con `add value` non si
--   può usare nella stessa transazione.
-- - sospendi_officina: corpo di 20261028000200 (T100) + l'avviso. La transizione si riconosce dalle righe
--   toccate dall'update (`where … is distinct from 'SOSPESA'`): se l'officina era già SOSPESA non parte
--   niente, e due sospensioni contemporanee ne contano una sola (la seconda aspetta il lock della riga e
--   poi non la trova più). Firma, permessi e controlli invariati; il ruolo dei titolari non cambia (R14).
-- Nessuna tabella e nessun dato esistente cambiano.

alter type public.tipo_notifica add value 'AFFILIAZIONE_SOSPESA';

create or replace function public.sospendi_officina(p_officina_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sospesa int;
begin
  if (select auth.uid()) is not null and not public.is_admin() then
    raise exception 'Accesso riservato' using errcode = '42501';
  end if;

  if not exists (select 1 from public.officine where id = p_officina_id) then
    raise exception 'OFFICINA_NON_TROVATA';
  end if;

  -- R14: il ruolo dei titolari non cambia.
  update public.officine set stato_affiliazione = 'SOSPESA'
  where id = p_officina_id and stato_affiliazione is distinct from 'SOSPESA';
  -- 1 solo se l'officina non era SOSPESA (T242: si avvisa una volta sola).
  get diagnostics v_sospesa = row_count;

  if v_sospesa > 0 then
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
  'Mette l''officina SOSPESA (invisibile ai clienti) e, se prima non lo era, avvisa i suoi titolari; il ruolo dei titolari non cambia. Solo admin o senza utente.';

revoke execute on function public.sospendi_officina(uuid) from public, anon;
grant execute on function public.sospendi_officina(uuid) to authenticated;

-- Report pubblico spento per le officine sospese (T083, R12).
--
-- `report_pubblico` (migrazione 20261025000200_link_report, T063) restituiva il report anche quando
-- l'officina del controllo era stata sospesa. Ora restituisce `null` se l'officina del controllo è
-- `SOSPESA`; `IN_ATTESA` e `ATTIVA` continuano a funzionare (decisione R12). I link non vengono toccati:
-- se l'officina torna `ATTIVA` i link ancora validi riprendono a funzionare.
-- Stesso corpo di T063, più la join con `officine` sull'officina del controllo; firma e forma
-- (`language sql stable security definer`) invariate.

-- Il report del controllo per chi apre il link: `null` se il codice non esiste, è scaduto o è stato
-- disattivato (anche per un codice nullo o vuoto), o se l'officina del controllo è sospesa. Le chiavi
-- sono quelle di `Report` (`apps/web/src/lib/report.ts`); del veicolo non escono né il cliente né il
-- telaio.
create or replace function public.report_pubblico(p_codice text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', c.id,
    'officina_id', c.officina_id,
    'eseguito_il', c.eseguito_il,
    'km', c.km,
    'note', c.note,
    'veicolo', jsonb_build_object(
      'id', v.id,
      'targa', v.targa,
      'marca', v.marca,
      'modello', v.modello,
      'anno', v.anno,
      'officina', (
        select jsonb_build_object(
          'id', o.id,
          'ragione_sociale', o.ragione_sociale,
          'indirizzo', o.indirizzo,
          'citta', o.citta,
          'telefono', o.telefono
        )
        from public.officine o
        where o.id = v.officina_id
      )
    ),
    'misure', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'battistrada_mm', m.battistrada_mm,
          'pressione_bar', m.pressione_bar,
          'usura', m.usura,
          'danni', m.danni,
          'pneumatico', jsonb_build_object(
            'id', p.id,
            'posizione', p.posizione,
            'stagione', p.stagione,
            'misura', p.misura,
            'marca', p.marca,
            'modello', p.modello,
            'dot', p.dot,
            'montato_il', p.montato_il,
            'smontato_il', p.smontato_il
          )
        )
        order by p.posizione, p.id
      )
      from public.misure_pneumatico m
      join public.pneumatici p on p.id = m.pneumatico_id
      where m.controllo_id = c.id
    ), '[]'::jsonb)
  )
  from public.link_report l
  join public.controlli c on c.id = l.controllo_id
  join public.veicoli v on v.id = c.veicolo_id
  join public.officine oc on oc.id = c.officina_id
  where nullif(p_codice, '') is not null
    and oc.stato_affiliazione <> 'SOSPESA'
    and l.codice_hash = public.impronta_codice(p_codice)
    and l.revocato_il is null
    and l.scade_il > now();
$$;

-- `create or replace` mantiene i permessi: si ripetono per documentarli.
revoke execute on function public.report_pubblico(text) from public;
grant execute on function public.report_pubblico(text) to anon, authenticated;

comment on function public.report_pubblico(text) is
  'Report di un controllo dal codice del link; null se il codice non vale o l''officina è SOSPESA (R12).';

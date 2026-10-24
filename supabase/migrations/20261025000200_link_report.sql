-- Link pubblico del report di un controllo (T063, R8).
--
-- L'officina manda il report di un controllo a chi non ha l'app (WhatsApp, email) con un link che
-- contiene un codice casuale (128 bit). Come per gli inviti (`inviti_cliente`), il database salva solo
-- l'impronta SHA-256 del codice (`public.impronta_codice`): il codice in chiaro esce una volta sola,
-- verso l'app dell'officina. Il link scade dopo 30 giorni e l'officina lo può disattivare.
--
-- Chi apre il link (anche senza account) vede solo quel controllo: veicolo, officina e misure, nella
-- stessa forma del `Report` di `apps/web/src/lib/report.ts`. Nessun dato del cliente.

-- ---------------------------------------------------------------------------------------------------
-- Tabella
-- ---------------------------------------------------------------------------------------------------

create table public.link_report (
  id uuid primary key default gen_random_uuid(),
  controllo_id uuid not null references public.controlli (id) on delete cascade,
  officina_id uuid not null references public.officine (id) on delete cascade,
  codice_hash bytea not null unique,
  scade_il timestamptz not null,
  revocato_il timestamptz,
  creato_da uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index link_report_controllo_idx on public.link_report (controllo_id);
create index link_report_officina_idx on public.link_report (officina_id);

comment on table public.link_report is
  'Link pubblici al report di un controllo. Si scrive solo dalle funzioni crea/revoca_link_report.';
comment on column public.link_report.codice_hash is
  'SHA-256 del codice nel link: il codice in chiaro non viene salvato.';

alter table public.link_report enable row level security;

-- I membri vedono i link della loro officina. Nessuna policy di scrittura: i link si creano e si
-- disattivano solo dalle funzioni qui sotto. Chi non ha accesso (anon) non legge la tabella.
create policy "link_report: lettura membri"
  on public.link_report for select to authenticated
  using (public.is_membro_officina(officina_id));

revoke all on table public.link_report from anon, authenticated;
grant select on table public.link_report to authenticated;

-- ---------------------------------------------------------------------------------------------------
-- Funzioni
-- ---------------------------------------------------------------------------------------------------
-- Un controllo che non esiste o di un'altra officina è 42501 in entrambi i casi: l'errore non dice se
-- il controllo esiste.

-- Crea un link per un controllo dell'officina e restituisce il codice in chiaro (una volta sola).
-- I link già creati restano validi: ognuno ha la sua scadenza.
create function public.crea_link_report(p_controllo_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_officina_id uuid;
  v_codice text := encode(extensions.gen_random_bytes(16), 'hex');
begin
  select c.officina_id into v_officina_id from public.controlli c where c.id = p_controllo_id;
  if v_officina_id is null or not public.is_membro_officina(v_officina_id) then
    raise exception 'Controllo non trovato' using errcode = '42501';
  end if;

  insert into public.link_report (controllo_id, officina_id, codice_hash, scade_il, creato_da)
  values (
    p_controllo_id, v_officina_id, public.impronta_codice(v_codice), now() + interval '30 days',
    (select auth.uid())
  );

  return v_codice;
end;
$$;

-- Disattiva tutti i link ancora validi di un controllo. Ripetibile.
create function public.revoca_link_report(p_controllo_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_officina_id uuid;
begin
  select c.officina_id into v_officina_id from public.controlli c where c.id = p_controllo_id;
  if v_officina_id is null or not public.is_membro_officina(v_officina_id) then
    raise exception 'Controllo non trovato' using errcode = '42501';
  end if;

  update public.link_report l
  set revocato_il = now()
  where l.controllo_id = p_controllo_id and l.revocato_il is null and l.scade_il > now();
end;
$$;

-- Il report del controllo per chi apre il link: `null` se il codice non esiste, è scaduto o è stato
-- disattivato (anche per un codice nullo o vuoto). Le chiavi sono quelle di `Report`
-- (`apps/web/src/lib/report.ts`); del veicolo non escono né il cliente né il telaio.
create function public.report_pubblico(p_codice text)
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
  where nullif(p_codice, '') is not null
    and l.codice_hash = public.impronta_codice(p_codice)
    and l.revocato_il is null
    and l.scade_il > now();
$$;

revoke execute on function public.crea_link_report(uuid) from public, anon;
revoke execute on function public.revoca_link_report(uuid) from public, anon;
grant execute on function public.crea_link_report(uuid) to authenticated;
grant execute on function public.revoca_link_report(uuid) to authenticated;
revoke execute on function public.report_pubblico(text) from public;
grant execute on function public.report_pubblico(text) to anon, authenticated;

-- T067: abbonamento di ogni officina (piano, stato, fine della prova): la base per Stripe (Fase 7, R5).
-- Una riga per officina (la chiave è officina_id). Il titolare la legge; la cambiano solo l'ADMIN e chi
-- non passa dall'RLS (service role: il webhook di Stripe, più avanti). Gli operatori non la vedono.
-- piano e stato sono text con check (non enum): si allargano con una migrazione che cambia solo il check.
-- La riga nasce da sola con ogni officina (trigger), comprese quelle di richiedi_affiliazione e
-- crea_officina_con_titolare; le officine già presenti la ricevono qui sotto.
-- Nessuna tabella e nessun dato esistenti cambiano: si aggiungono solo righe nella tabella nuova.

-- ---------------------------------------------------------------------------------------------------
-- Tabella
-- ---------------------------------------------------------------------------------------------------

create table public.abbonamenti (
  officina_id uuid primary key references public.officine (id) on delete cascade,
  piano text not null default 'STARTER' check (piano in ('STARTER', 'PRO', 'PILOTA')),
  stato text not null default 'PROVA' check (stato in ('PROVA', 'ATTIVO', 'SCADUTO', 'ANNULLATO')),
  prova_fino_al date not null default (current_date + 30),
  stripe_customer_id text,
  stripe_subscription_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.abbonamenti is
  'Abbonamento di un''officina (1:1). Legge il titolare; scrivono solo ADMIN e service role.';
comment on column public.abbonamenti.prova_fino_al is 'Ultimo giorno della prova gratuita (30 giorni).';
comment on column public.abbonamenti.stripe_subscription_id is 'Abbonamento Stripe collegato (Fase 7).';

create trigger abbonamenti_updated_at
  before update on public.abbonamenti
  for each row execute function public.imposta_updated_at();

-- ---------------------------------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------------------------------

alter table public.abbonamenti enable row level security;

-- Lettura: il titolare della sua officina e l'ADMIN. L'operatore no (il piano non è affar suo).
create policy "abbonamenti: lettura titolare e admin"
  on public.abbonamenti for select to authenticated
  using (public.is_titolare_officina(officina_id) or public.is_admin());

-- Scrittura: solo l'ADMIN. Il service role non passa dall'RLS e non ha bisogno di policy.
create policy "abbonamenti: creazione admin"
  on public.abbonamenti for insert to authenticated
  with check (public.is_admin());

create policy "abbonamenti: modifica admin"
  on public.abbonamenti for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "abbonamenti: eliminazione admin"
  on public.abbonamenti for delete to authenticated
  using (public.is_admin());

-- anon non tocca la tabella; authenticated passa comunque dalle policy qui sopra.
revoke all on table public.abbonamenti from anon, authenticated;
grant select, insert, update, delete on table public.abbonamenti to authenticated;

-- ---------------------------------------------------------------------------------------------------
-- Ogni officina nuova ha il suo abbonamento in prova
-- ---------------------------------------------------------------------------------------------------
-- security definer: l'officina la può creare anche chi non può scrivere in abbonamenti (richiedi_affiliazione
-- chiamata da un CLIENTE). on conflict: se la riga c'è già (inserita a mano prima) non si tocca.

create function public.crea_abbonamento_officina()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.abbonamenti (officina_id)
  values (new.id)
  on conflict (officina_id) do nothing;
  return new;
end;
$$;

comment on function public.crea_abbonamento_officina() is
  'Trigger: crea l''abbonamento (STARTER, PROVA per 30 giorni) di ogni officina nuova.';

revoke execute on function public.crea_abbonamento_officina() from public, anon, authenticated;

create trigger officine_crea_abbonamento
  after insert on public.officine
  for each row execute function public.crea_abbonamento_officina();

-- Le officine che ci sono già: stessa riga di default (prova di 30 giorni da oggi).
insert into public.abbonamenti (officina_id)
select id from public.officine
on conflict (officina_id) do nothing;

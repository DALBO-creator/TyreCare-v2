-- Fase 2 — Dati: clienti dell'officina, veicoli, pneumatici, controlli e misure (PLAN P9, P10, P12).
--
-- Principi:
-- - i dati sono DELL'OFFICINA (decisione 2026-10-07): ogni officina ha le sue schede veicolo, anche se
--   la stessa targa è cliente di più officine; il garage del cliente le unisce per targa;
-- - ogni tabella porta `officina_id`, così le policy restano semplici (is_membro_officina). Chiavi esterne
--   composte garantiscono la coerenza: un controllo, uno pneumatico e una misura appartengono sempre allo
--   stesso veicolo e alla stessa officina;
-- - il cliente con un account vede in sola lettura i veicoli collegati al suo profilo;
-- - l'ADMIN di TyreCare NON vede i dati dei clienti delle officine (GDPR: TyreCare è responsabile del
--   trattamento, non titolare). Per l'assistenza si usa il backend con la service role.

-- ---------------------------------------------------------------------------------------------------
-- Tipi
-- ---------------------------------------------------------------------------------------------------

create type public.stagione as enum ('ESTIVO', 'INVERNALE', 'QUATTRO_STAGIONI');
create type public.posizione_pneumatico as enum ('ANT_SX', 'ANT_DX', 'POST_SX', 'POST_DX', 'SCORTA');
-- Da dove arriva un dato: inserito dall'app o importato dal gestionale
create type public.origine_dato as enum ('APP', 'IMPORT');
-- Usura irregolare del battistrada (P10): suggerisce convergenza o pressione sbagliata
create type public.usura as enum ('REGOLARE', 'INTERNA', 'ESTERNA', 'CENTRALE', 'BORDI');

-- ---------------------------------------------------------------------------------------------------
-- Tabelle
-- ---------------------------------------------------------------------------------------------------

-- Anagrafica del cliente nell'officina (dal gestionale o inserita a mano). È dell'officina: la persona
-- con un account TyreCare è `profiles`, collegata qui con `profile_id` quando "rivendica" i suoi veicoli.
create table public.clienti_officina (
  id uuid primary key default gen_random_uuid(),
  officina_id uuid not null references public.officine (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete set null,
  -- Codice del cliente nel gestionale: chiave dell'import idempotente (P8)
  codice_gestionale text check (char_length(codice_gestionale) between 1 and 50),
  nome text not null default '' check (char_length(nome) <= 100),
  cognome text not null default '' check (char_length(cognome) <= 100),
  ragione_sociale text check (char_length(ragione_sociale) between 1 and 200),
  telefono text check (telefono ~ '^\+?[0-9 ]{6,20}$'),
  email text check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  note text not null default '' check (char_length(note) <= 2000),
  consenso_marketing boolean not null default false,
  origine public.origine_dato not null default 'APP',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (officina_id, codice_gestionale),
  -- Per le chiavi esterne composte (veicolo e cliente della stessa officina)
  unique (id, officina_id),
  constraint clienti_officina_nominativo check (
    nome <> '' or cognome <> '' or ragione_sociale is not null
  )
);

create index clienti_officina_profile_id_idx on public.clienti_officina (profile_id);

comment on table public.clienti_officina is 'Clienti di un''officina; profile_id = account TyreCare collegato.';
comment on column public.clienti_officina.profile_id is
  'Modificabile solo da ADMIN o service role (flusso di rivendicazione).';

create table public.veicoli (
  id uuid primary key default gen_random_uuid(),
  officina_id uuid not null references public.officine (id) on delete cascade,
  cliente_officina_id uuid,
  -- Normalizzata dal trigger: maiuscole, senza spazi e trattini
  targa text not null check (targa ~ '^[A-Z0-9]{2,10}$'),
  -- VIN: 17 caratteri, senza I, O, Q
  telaio text check (telaio ~ '^[A-HJ-NPR-Z0-9]{17}$'),
  marca text not null default '' check (char_length(marca) <= 50),
  modello text not null default '' check (char_length(modello) <= 100),
  anno smallint check (anno between 1900 and 2100),
  origine public.origine_dato not null default 'APP',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (officina_id, targa),
  unique (id, officina_id),
  -- Il cliente deve essere della stessa officina; se viene eliminato, il veicolo resta senza cliente
  foreign key (cliente_officina_id, officina_id)
    references public.clienti_officina (id, officina_id) on delete set null (cliente_officina_id)
);

create index veicoli_cliente_officina_id_idx on public.veicoli (cliente_officina_id);

comment on table public.veicoli is 'Veicoli di un''officina (una scheda per officina, anche a parità di targa).';

-- Pneumatici montati (o smontati: storico) su un veicolo, per posizione.
create table public.pneumatici (
  id uuid primary key default gen_random_uuid(),
  officina_id uuid not null,
  veicolo_id uuid not null,
  posizione public.posizione_pneumatico not null,
  stagione public.stagione not null,
  misura text not null default '' check (char_length(misura) <= 40), -- es. "205/55 R16 91V"
  marca text not null default '' check (char_length(marca) <= 50),
  modello text not null default '' check (char_length(modello) <= 100),
  -- DOT: settimana + anno di produzione, es. "3823" = 38ª settimana del 2023
  dot text check (dot ~ '^(0[1-9]|[1-4][0-9]|5[0-3])[0-9]{2}$'),
  montato_il date not null default current_date,
  smontato_il date,
  origine public.origine_dato not null default 'APP',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, veicolo_id),
  foreign key (veicolo_id, officina_id) references public.veicoli (id, officina_id) on delete cascade,
  check (smontato_il is null or smontato_il >= montato_il)
);

-- Un solo pneumatico montato per posizione
create unique index pneumatici_montato_per_posizione_idx
  on public.pneumatici (veicolo_id, posizione) where smontato_il is null;
create index pneumatici_officina_id_idx on public.pneumatici (officina_id);

comment on table public.pneumatici is 'Pneumatici di un veicolo; smontato_il nullo = montato ora.';

-- Un controllo del veicolo in officina (da app o importato).
create table public.controlli (
  id uuid primary key default gen_random_uuid(),
  officina_id uuid not null,
  veicolo_id uuid not null,
  eseguito_il date not null default current_date,
  km integer check (km between 0 and 2000000),
  note text not null default '' check (char_length(note) <= 2000),
  origine public.origine_dato not null default 'APP',
  -- Numero del documento nel gestionale: chiave dell'import idempotente (P8)
  codice_documento text check (char_length(codice_documento) between 1 and 50),
  eseguito_da uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (officina_id, codice_documento),
  unique (id, veicolo_id),
  foreign key (veicolo_id, officina_id) references public.veicoli (id, officina_id) on delete cascade
);

create index controlli_veicolo_id_idx on public.controlli (veicolo_id, eseguito_il desc);
create index controlli_officina_id_idx on public.controlli (officina_id);

-- Misura di uno pneumatico durante un controllo. Controllo e pneumatico devono essere dello stesso veicolo.
create table public.misure_pneumatico (
  controllo_id uuid not null,
  pneumatico_id uuid not null,
  veicolo_id uuid not null,
  officina_id uuid not null,
  -- Profondità minima misurata (mm): è quella che decide lo stato (verde/giallo/rosso)
  battistrada_mm numeric(3, 1) not null check (battistrada_mm between 0 and 20),
  pressione_bar numeric(3, 1) check (pressione_bar between 0 and 9.9),
  usura public.usura,
  danni text not null default '' check (char_length(danni) <= 500),
  created_at timestamptz not null default now(),
  primary key (controllo_id, pneumatico_id),
  foreign key (controllo_id, veicolo_id) references public.controlli (id, veicolo_id) on delete cascade,
  foreign key (pneumatico_id, veicolo_id) references public.pneumatici (id, veicolo_id) on delete cascade,
  foreign key (veicolo_id, officina_id) references public.veicoli (id, officina_id) on delete cascade
);

create index misure_pneumatico_pneumatico_id_idx on public.misure_pneumatico (pneumatico_id);
create index misure_pneumatico_officina_id_idx on public.misure_pneumatico (officina_id);

-- ---------------------------------------------------------------------------------------------------
-- Funzioni per le policy
-- ---------------------------------------------------------------------------------------------------

-- Vero se il veicolo è collegato all'account dell'utente corrente (garage del cliente).
create function public.is_veicolo_mio(p_veicolo_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.veicoli v
    join public.clienti_officina c on c.id = v.cliente_officina_id
    where v.id = p_veicolo_id and c.profile_id = (select auth.uid())
  );
$$;

revoke execute on function public.is_veicolo_mio(uuid) from public, anon;
grant execute on function public.is_veicolo_mio(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------------
-- Trigger
-- ---------------------------------------------------------------------------------------------------

create trigger clienti_officina_updated_at
  before update on public.clienti_officina
  for each row execute function public.imposta_updated_at();

create trigger veicoli_updated_at
  before update on public.veicoli
  for each row execute function public.imposta_updated_at();

create trigger pneumatici_updated_at
  before update on public.pneumatici
  for each row execute function public.imposta_updated_at();

create trigger controlli_updated_at
  before update on public.controlli
  for each row execute function public.imposta_updated_at();

-- Targa e telaio in forma canonica ("ab 123-cd" → "AB123CD"): import e ricerche trovano i duplicati.
create function public.normalizza_veicolo()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.targa := upper(regexp_replace(new.targa, '[^A-Za-z0-9]', '', 'g'));
  new.telaio := nullif(upper(regexp_replace(coalesce(new.telaio, ''), '[^A-Za-z0-9]', '', 'g')), '');
  return new;
end;
$$;

create trigger veicoli_normalizza
  before insert or update on public.veicoli
  for each row execute function public.normalizza_veicolo();

-- Il collegamento cliente ↔ account lo fanno solo ADMIN o service role: altrimenti un'officina potrebbe
-- far comparire un veicolo nel garage di un utente qualsiasi.
create function public.proteggi_collegamento_cliente()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or public.is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' and new.profile_id is not null
    or tg_op = 'UPDATE' and new.profile_id is distinct from old.profile_id then
    raise exception 'Solo TyreCare può collegare un cliente a un account' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger clienti_officina_proteggi_collegamento
  before insert or update on public.clienti_officina
  for each row execute function public.proteggi_collegamento_cliente();

-- ---------------------------------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------------------------------
-- Membri dell'officina (TITOLARE e OPERATORE): leggono, inseriscono e modificano i dati della propria
-- officina. Eliminare clienti e veicoli è del TITOLARE; controlli, pneumatici e misure li corregge
-- anche l'OPERATORE. Il cliente legge soltanto.

alter table public.clienti_officina enable row level security;
alter table public.veicoli enable row level security;
alter table public.pneumatici enable row level security;
alter table public.controlli enable row level security;
alter table public.misure_pneumatico enable row level security;

-- clienti_officina
create policy "clienti_officina: lettura membri o cliente stesso"
  on public.clienti_officina for select to authenticated
  using (public.is_membro_officina(officina_id) or profile_id = (select auth.uid()));

create policy "clienti_officina: inserimento membri"
  on public.clienti_officina for insert to authenticated
  with check (public.is_membro_officina(officina_id));

create policy "clienti_officina: modifica membri"
  on public.clienti_officina for update to authenticated
  using (public.is_membro_officina(officina_id))
  with check (public.is_membro_officina(officina_id));

create policy "clienti_officina: eliminazione titolare"
  on public.clienti_officina for delete to authenticated
  using (public.is_titolare_officina(officina_id));

-- veicoli
create policy "veicoli: lettura membri o cliente"
  on public.veicoli for select to authenticated
  using (public.is_membro_officina(officina_id) or public.is_veicolo_mio(id));

create policy "veicoli: inserimento membri"
  on public.veicoli for insert to authenticated
  with check (public.is_membro_officina(officina_id));

create policy "veicoli: modifica membri"
  on public.veicoli for update to authenticated
  using (public.is_membro_officina(officina_id))
  with check (public.is_membro_officina(officina_id));

create policy "veicoli: eliminazione titolare"
  on public.veicoli for delete to authenticated
  using (public.is_titolare_officina(officina_id));

-- pneumatici
create policy "pneumatici: lettura membri o cliente"
  on public.pneumatici for select to authenticated
  using (public.is_membro_officina(officina_id) or public.is_veicolo_mio(veicolo_id));

create policy "pneumatici: scrittura membri"
  on public.pneumatici for all to authenticated
  using (public.is_membro_officina(officina_id))
  with check (public.is_membro_officina(officina_id));

-- controlli
create policy "controlli: lettura membri o cliente"
  on public.controlli for select to authenticated
  using (public.is_membro_officina(officina_id) or public.is_veicolo_mio(veicolo_id));

create policy "controlli: scrittura membri"
  on public.controlli for all to authenticated
  using (public.is_membro_officina(officina_id))
  with check (public.is_membro_officina(officina_id));

-- misure_pneumatico
create policy "misure_pneumatico: lettura membri o cliente"
  on public.misure_pneumatico for select to authenticated
  using (public.is_membro_officina(officina_id) or public.is_veicolo_mio(veicolo_id));

create policy "misure_pneumatico: scrittura membri"
  on public.misure_pneumatico for all to authenticated
  using (public.is_membro_officina(officina_id))
  with check (public.is_membro_officina(officina_id));

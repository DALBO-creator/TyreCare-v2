-- Rivendicazione dei veicoli: invito via email dall'officina (sessione 12, 2026-10-10).
--
-- Decisione del titolare (2026-10-10): il cliente collega il suo account all'anagrafica dell'officina
-- (`clienti_officina.profile_id`) aprendo un **invito** che l'officina gli manda per email.
--
-- Come funziona:
-- - un membro dell'officina crea l'invito per un cliente non ancora collegato, con l'email del cliente.
--   Il database genera un codice casuale (128 bit) e ne salva solo l'impronta SHA-256: il codice in
--   chiaro esce una volta sola, verso l'app dell'officina, che lo mette nel link dell'email;
-- - il cliente apre il link, accede (o si registra) e accetta. L'invito vale solo per l'account con
--   **la stessa email, confermata**: un link inoltrato o letto da altri non collega nulla;
-- - l'invito scade dopo 14 giorni; un nuovo invito per lo stesso cliente annulla i precedenti.
--
-- Il trigger `proteggi_collegamento_cliente` continua a vietare agli utenti di scrivere `profile_id`:
-- lo può fare solo una funzione `security definer` (qui `accetta_invito`), che gira come proprietario.

-- ---------------------------------------------------------------------------------------------------
-- Tabella
-- ---------------------------------------------------------------------------------------------------

create table public.inviti_cliente (
  id uuid primary key default gen_random_uuid(),
  officina_id uuid not null,
  cliente_officina_id uuid not null,
  -- Sempre in minuscolo: il confronto con l'email dell'account non dipende dalle maiuscole
  email text not null check (email ~ '^[^@\sA-Z]+@[^@\sA-Z]+\.[^@\sA-Z]+$' and char_length(email) <= 254),
  codice_hash bytea not null unique,
  creato_da uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  scade_il timestamptz not null,
  usato_il timestamptz,
  usato_da uuid references public.profiles (id) on delete set null,
  annullato_il timestamptz,
  foreign key (cliente_officina_id, officina_id)
    references public.clienti_officina (id, officina_id) on delete cascade
);

create index inviti_cliente_cliente_idx on public.inviti_cliente (cliente_officina_id);

comment on table public.inviti_cliente is
  'Inviti per collegare un account TyreCare a un cliente dell''officina. Si scrive solo dalle funzioni.';
comment on column public.inviti_cliente.codice_hash is
  'SHA-256 del codice nel link: il codice in chiaro non viene salvato.';

alter table public.inviti_cliente enable row level security;

-- I membri vedono gli inviti della loro officina (per sapere se un invito è in corso). Nessuna policy
-- di scrittura: inviti creati, annullati e accettati solo dalle funzioni qui sotto.
create policy "inviti_cliente: lettura membri"
  on public.inviti_cliente for select to authenticated
  using (public.is_membro_officina(officina_id));

-- ---------------------------------------------------------------------------------------------------
-- Il collegamento cliente ↔ account
-- ---------------------------------------------------------------------------------------------------
-- Come prima, più un caso: la modifica arriva da una funzione `security definer` (current_user è il
-- suo proprietario, non `authenticated`). Le richieste dell'app girano sempre come `authenticated` o
-- `anon` e non possono cambiare ruolo.

create or replace function public.proteggi_collegamento_cliente()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
    or public.is_admin()
    or current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if tg_op = 'INSERT' and new.profile_id is not null
    or tg_op = 'UPDATE' and new.profile_id is distinct from old.profile_id then
    raise exception 'Solo TyreCare può collegare un cliente a un account' using errcode = '42501';
  end if;
  return new;
end;
$$;

comment on column public.clienti_officina.profile_id is
  'Account TyreCare collegato: lo scrivono solo ADMIN, service role o accetta_invito().';

-- ---------------------------------------------------------------------------------------------------
-- Funzioni
-- ---------------------------------------------------------------------------------------------------
-- Errori attesi (messaggio = chiave letta dall'app, codice P0001): EMAIL_NON_VALIDA,
-- CLIENTE_GIA_COLLEGATO, INVITO_NON_VALIDO, INVITO_GIA_USATO, INVITO_ANNULLATO, INVITO_SCADUTO,
-- EMAIL_DIVERSA. Un cliente che non esiste o di un'altra officina è 42501, come per la RLS.

-- Impronta del codice: il codice in chiaro non si salva né si confronta mai direttamente.
create function public.impronta_codice(p_codice text)
returns bytea
language sql
immutable
set search_path = ''
as $$
  select sha256(convert_to(coalesce(p_codice, ''), 'UTF8'));
$$;

-- Crea un invito per un cliente dell'officina e restituisce il codice in chiaro (una volta sola).
create function public.crea_invito_cliente(p_cliente_id uuid, p_email text)
returns table (codice text, scade_il timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_officina_id uuid;
  v_profile_id uuid;
  v_email text := lower(trim(coalesce(p_email, '')));
  v_codice text := encode(extensions.gen_random_bytes(16), 'hex');
  v_scade_il timestamptz := now() + interval '14 days';
begin
  select c.officina_id, c.profile_id into v_officina_id, v_profile_id
  from public.clienti_officina c
  where c.id = p_cliente_id;
  if v_officina_id is null or not public.is_membro_officina(v_officina_id) then
    raise exception 'Cliente non trovato' using errcode = '42501';
  end if;
  if v_profile_id is not null then
    raise exception 'CLIENTE_GIA_COLLEGATO';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then
    raise exception 'EMAIL_NON_VALIDA';
  end if;

  -- Vale solo l'ultimo invito: quelli ancora aperti per lo stesso cliente si annullano
  update public.inviti_cliente i
  set annullato_il = now()
  where i.cliente_officina_id = p_cliente_id and i.usato_il is null and i.annullato_il is null;

  insert into public.inviti_cliente (
    officina_id, cliente_officina_id, email, codice_hash, creato_da, scade_il
  ) values (
    v_officina_id, p_cliente_id, v_email, public.impronta_codice(v_codice), (select auth.uid()),
    v_scade_il
  );

  return query select v_codice, v_scade_il;
end;
$$;

-- Annulla gli inviti ancora aperti di un cliente (es. email sbagliata). Ripetibile.
create function public.annulla_invito_cliente(p_cliente_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_officina_id uuid;
begin
  select c.officina_id into v_officina_id from public.clienti_officina c where c.id = p_cliente_id;
  if v_officina_id is null or not public.is_membro_officina(v_officina_id) then
    raise exception 'Cliente non trovato' using errcode = '42501';
  end if;
  update public.inviti_cliente i
  set annullato_il = now()
  where i.cliente_officina_id = p_cliente_id and i.usato_il is null and i.annullato_il is null;
end;
$$;

-- Cosa dice un invito, per la pagina che il cliente apre dal link (anche prima di accedere).
-- Chi ha il codice è il destinatario: può sapere officina, email dell'invito e stato. Nessuna riga
-- se il codice non esiste. Stato: VALIDO, USATO, ANNULLATO, SCADUTO.
create function public.info_invito(p_codice text)
returns table (
  officina text,
  email text,
  stato text,
  scade_il timestamptz,
  usato_da_te boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    o.ragione_sociale,
    i.email,
    case
      when i.usato_il is not null then 'USATO'
      when i.annullato_il is not null then 'ANNULLATO'
      when i.scade_il < now() then 'SCADUTO'
      else 'VALIDO'
    end,
    i.scade_il,
    coalesce(i.usato_da = (select auth.uid()), false)
  from public.inviti_cliente i
  join public.officine o on o.id = i.officina_id
  where i.codice_hash = public.impronta_codice(p_codice);
$$;

-- Il cliente accetta l'invito: il suo account viene collegato al cliente dell'officina e da quel
-- momento vede i suoi veicoli nel garage. Restituisce il nome dell'officina. Ripetibile: accettare di
-- nuovo un invito già accettato dallo stesso account non è un errore.
create function public.accetta_invito(p_codice text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_invito public.inviti_cliente;
  v_email text;
  v_profile_id uuid;
  v_officina text;
begin
  if v_uid is null then
    raise exception 'Accesso richiesto' using errcode = '42501';
  end if;

  select * into v_invito
  from public.inviti_cliente i
  where i.codice_hash = public.impronta_codice(p_codice)
  for update;
  if not found then
    raise exception 'INVITO_NON_VALIDO';
  end if;

  select o.ragione_sociale into v_officina from public.officine o where o.id = v_invito.officina_id;

  if v_invito.usato_il is not null then
    if v_invito.usato_da = v_uid then
      return v_officina;
    end if;
    raise exception 'INVITO_GIA_USATO';
  end if;
  if v_invito.annullato_il is not null then
    raise exception 'INVITO_ANNULLATO';
  end if;
  if v_invito.scade_il < now() then
    raise exception 'INVITO_SCADUTO';
  end if;

  -- Solo l'account con la stessa email, confermata
  select lower(u.email) into v_email
  from auth.users u
  where u.id = v_uid and u.email_confirmed_at is not null;
  if v_email is distinct from v_invito.email then
    raise exception 'EMAIL_DIVERSA';
  end if;

  select c.profile_id into v_profile_id
  from public.clienti_officina c
  where c.id = v_invito.cliente_officina_id
  for update;
  if v_profile_id is not null and v_profile_id <> v_uid then
    raise exception 'CLIENTE_GIA_COLLEGATO';
  end if;

  update public.clienti_officina set profile_id = v_uid where id = v_invito.cliente_officina_id;
  update public.inviti_cliente set usato_il = now(), usato_da = v_uid where id = v_invito.id;

  return v_officina;
end;
$$;

revoke execute on function public.impronta_codice(text) from public, anon, authenticated;
revoke execute on function public.crea_invito_cliente(uuid, text) from public, anon;
revoke execute on function public.annulla_invito_cliente(uuid) from public, anon;
revoke execute on function public.info_invito(text) from public;
revoke execute on function public.accetta_invito(text) from public, anon;
grant execute on function public.crea_invito_cliente(uuid, text) to authenticated;
grant execute on function public.annulla_invito_cliente(uuid) to authenticated;
grant execute on function public.info_invito(text) to anon, authenticated;
grant execute on function public.accetta_invito(text) to authenticated;

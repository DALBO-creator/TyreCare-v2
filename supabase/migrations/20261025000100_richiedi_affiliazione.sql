-- T059: un gommista con un account chiede di entrare in TyreCare (R7).
-- L'officina nasce IN_ATTESA (default della tabella) e chi la chiede ne diventa TITOLARE: la prepara
-- subito, ma i clienti la vedono solo dopo l'attivazione dell'amministratore (policy "lettura attive").
-- Il ruolo globale del profilo NON cambia qui: lo cambia l'amministratore all'attivazione (T061).
-- Errori attesi (messaggio = chiave, codice P0001): GIA_IN_OFFICINA, PARTITA_IVA_NON_VALIDA,
-- RAGIONE_SOCIALE_NON_VALIDA, CITTA_MANCANTE, PARTITA_IVA_GIA_PRESENTE. Senza utente: 42501.
-- Qui si controlla solo il formato della partita IVA; la cifra di controllo la verifica la pagina (T060).
-- Nessuna tabella cambia.

create function public.richiedi_affiliazione(
  p_ragione_sociale text,
  p_partita_iva text,
  p_citta text,
  p_telefono text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_utente uuid := (select auth.uid());
  v_ragione_sociale text := btrim(coalesce(p_ragione_sociale, ''));
  v_partita_iva text := btrim(coalesce(p_partita_iva, ''));
  v_citta text := btrim(coalesce(p_citta, ''));
  v_telefono text := nullif(btrim(coalesce(p_telefono, '')), '');
  v_email text;
  v_officina_id uuid;
begin
  if v_utente is null then
    raise exception 'Accesso riservato' using errcode = '42501';
  end if;

  -- Due richieste contemporanee dello stesso account: la seconda aspetta la prima e poi trova la riga
  -- in officina_utenti (officina_utenti non ha un vincolo unico sul solo profile_id).
  perform pg_advisory_xact_lock(hashtextextended('richiedi_affiliazione:' || v_utente::text, 0));

  if exists (select 1 from public.officina_utenti where profile_id = v_utente) then
    raise exception 'GIA_IN_OFFICINA';
  end if;

  if v_partita_iva !~ '^[0-9]{11}$' then
    raise exception 'PARTITA_IVA_NON_VALIDA';
  end if;

  if char_length(v_ragione_sociale) not between 2 and 200 then
    raise exception 'RAGIONE_SOCIALE_NON_VALIDA';
  end if;

  if v_citta = '' then
    raise exception 'CITTA_MANCANTE';
  end if;

  if exists (select 1 from public.officine where partita_iva = v_partita_iva) then
    raise exception 'PARTITA_IVA_GIA_PRESENTE';
  end if;

  select u.email into v_email from auth.users u where u.id = v_utente;

  begin
    insert into public.officine (ragione_sociale, partita_iva, citta, telefono, email)
    values (v_ragione_sociale, v_partita_iva, v_citta, v_telefono, v_email)
    returning id into v_officina_id;
  exception
    -- Stessa partita IVA inserita da un'altra richiesta tra il controllo e l'inserimento.
    when unique_violation then
      raise exception 'PARTITA_IVA_GIA_PRESENTE';
  end;

  insert into public.officina_utenti (officina_id, profile_id, ruolo)
  values (v_officina_id, v_utente, 'TITOLARE');

  return v_officina_id;
end;
$$;

comment on function public.richiedi_affiliazione(text, text, text, text) is
  'Crea un''officina IN_ATTESA con titolare l''account che chiama (richiesta di affiliazione, R7).';

revoke execute on function public.richiedi_affiliazione(text, text, text, text) from public, anon;
grant execute on function public.richiedi_affiliazione(text, text, text, text) to authenticated;

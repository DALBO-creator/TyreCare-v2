-- T191 (R24): avvisi dell'affiliazione e rifiuto di una richiesta.
--
-- - richiedi_affiliazione: oltre a creare l'officina IN_ATTESA, manda una notifica a ogni profilo ADMIN
--   ("Nuova officina da attivare", link /admin/officine).
-- - attiva_officina: quando l'officina passa da non attiva ad ATTIVA (anche da SOSPESA) avvisa i suoi
--   titolari ("La tua officina è attiva"); una seconda attivazione non manda niente. La transizione si
--   riconosce dalle righe toccate dall'update (`where … is distinct from 'ATTIVA'`): due attivazioni
--   contemporanee ne contano una sola. Il link è /clienti/importa: il vincolo di `notifiche.link`
--   (`^/[^/]`) non accetta "/".
-- - rifiuta_affiliazione (nuova): solo admin o senza utente (editor SQL, service role), come
--   attiva_officina; solo per officine IN_ATTESA. Avvisa tutti i membri ("Richiesta non accettata", con il
--   motivo se c'è, link /officina/registra) e poi cancella l'officina: le tabelle collegate se ne vanno con
--   `on delete cascade` (commenti e richieste su strada hanno `on delete set null`), la partita IVA torna
--   libera e chi l'ha chiesta può riprovare. Il ruolo OFFICINA eventualmente già dato resta (R14).
--   `notifiche` non ha FK verso `officine`: la notifica del rifiuto resta.
--   Errori attesi (messaggio = chiave, codice P0001): MOTIVO_TROPPO_LUNGO (oltre 300 caratteri),
--   OFFICINA_NON_TROVATA, OFFICINA_NON_IN_ATTESA. Accesso negato: 42501.
--
-- I valori nuovi di `tipo_notifica` si usano solo dentro corpi di funzioni plpgsql: in una migrazione non
-- si possono usare nella stessa transazione in cui vengono aggiunti.
-- Nessuna tabella e nessun dato esistente cambiano.

alter type public.tipo_notifica add value 'AFFILIAZIONE_RICHIESTA';
alter type public.tipo_notifica add value 'AFFILIAZIONE_ATTIVATA';
alter type public.tipo_notifica add value 'AFFILIAZIONE_RIFIUTATA';

-- ---------------------------------------------------------------------------------------------------
-- richiedi_affiliazione: corpo di 20261025000100 + la notifica agli amministratori
-- ---------------------------------------------------------------------------------------------------

create or replace function public.richiedi_affiliazione(
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

  -- T191: l'amministratore sa subito che c'è un'officina da attivare.
  insert into public.notifiche (destinatario_id, tipo, titolo, testo, link)
  select
    p.id,
    'AFFILIAZIONE_RICHIESTA',
    'Nuova officina da attivare',
    left(v_ragione_sociale || ' (' || v_citta || ') chiede di usare TyreCare.', 600),
    '/admin/officine'
  from public.profiles p
  where p.ruolo = 'ADMIN';

  return v_officina_id;
end;
$$;

comment on function public.richiedi_affiliazione(text, text, text, text) is
  'Crea un''officina IN_ATTESA con titolare l''account che chiama (richiesta di affiliazione, R7) e avvisa gli amministratori.';

revoke execute on function public.richiedi_affiliazione(text, text, text, text) from public, anon;
grant execute on function public.richiedi_affiliazione(text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------------------------------
-- attiva_officina: corpo di 20261028000200 + la notifica ai titolari quando diventa ATTIVA
-- ---------------------------------------------------------------------------------------------------

create or replace function public.attiva_officina(p_officina_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attivata int;
begin
  if (select auth.uid()) is not null and not public.is_admin() then
    raise exception 'Accesso riservato' using errcode = '42501';
  end if;

  if not exists (select 1 from public.officine where id = p_officina_id) then
    raise exception 'OFFICINA_NON_TROVATA';
  end if;

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
      'La tua officina è attiva',
      left(o.ragione_sociale || ' ora è visibile ai clienti: puoi caricare i tuoi dati.', 600),
      '/clienti/importa'
    from public.officina_utenti m
    join public.officine o on o.id = m.officina_id
    where m.officina_id = p_officina_id and m.ruolo = 'TITOLARE';
  end if;
end;
$$;

comment on function public.attiva_officina(uuid) is
  'Mette l''officina ATTIVA e porta a OFFICINA i suoi titolari ancora CLIENTE; se prima non era ATTIVA li avvisa. Solo admin o senza utente.';

revoke execute on function public.attiva_officina(uuid) from public, anon;
grant execute on function public.attiva_officina(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------------
-- rifiuta_affiliazione: avvisa i membri e cancella l'officina IN_ATTESA
-- ---------------------------------------------------------------------------------------------------

create function public.rifiuta_affiliazione(p_officina_id uuid, p_motivo text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_officina record;
begin
  if (select auth.uid()) is not null and not public.is_admin() then
    raise exception 'Accesso riservato' using errcode = '42501';
  end if;

  if char_length(v_motivo) > 300 then
    raise exception 'MOTIVO_TROPPO_LUNGO';
  end if;

  -- Blocca la riga: un'attivazione contemporanea aspetta (e poi non trova più l'officina) oppure passa
  -- prima, e allora qui lo stato è ATTIVA.
  select o.id, o.ragione_sociale, o.stato_affiliazione into v_officina
  from public.officine o
  where o.id = p_officina_id
  for update;

  if not found then
    raise exception 'OFFICINA_NON_TROVATA';
  end if;

  if v_officina.stato_affiliazione <> 'IN_ATTESA' then
    raise exception 'OFFICINA_NON_IN_ATTESA';
  end if;

  -- Prima della cancellazione: dopo i membri non ci sono più. La notifica non dipende dall'officina.
  insert into public.notifiche (destinatario_id, tipo, titolo, testo, link)
  select
    m.profile_id,
    'AFFILIAZIONE_RIFIUTATA',
    'Richiesta non accettata',
    left(
      'La richiesta per ' || v_officina.ragione_sociale || ' non è stata accettata.'
        || coalesce(' Motivo: ' || v_motivo, ''),
      600
    ),
    '/officina/registra'
  from public.officina_utenti m
  where m.officina_id = p_officina_id;

  -- R24: officina, membri e dati collegati se ne vanno (on delete cascade); il ruolo dei titolari resta.
  delete from public.officine where id = p_officina_id;
end;
$$;

comment on function public.rifiuta_affiliazione(uuid, text) is
  'Rifiuta una richiesta di affiliazione: avvisa i membri e cancella l''officina IN_ATTESA (la partita IVA torna libera, R24). Solo admin o senza utente.';

revoke execute on function public.rifiuta_affiliazione(uuid, text) from public, anon;
grant execute on function public.rifiuta_affiliazione(uuid, text) to authenticated;

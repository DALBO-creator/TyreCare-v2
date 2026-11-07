-- T225: chi ha una richiesta di aiuto su strada in corso non può eliminare l'account (idea T216, R31).
-- Nessuna tabella cambia e la migrazione non tocca dati esistenti: sostituisce il corpo di
-- `elimina_account()` (T038, 20261024170000) con lo stesso corpo più un controllo. Firma invariata.
--
-- Cosa succede con `delete from auth.users`:
--   - spariscono (cascade): profilo, righe di `officina_utenti`, prenotazioni come cliente (anche quelle
--     passate), richieste di aiuto su strada (anche quelle chiuse), notifiche, sottoscrizioni push,
--     commenti scritti;
--   - restano all'officina, scollegati (set null): anagrafica cliente (`clienti_officina.profile_id`),
--     veicoli, controlli (`eseguito_da`), inviti, import e mappature (`creata_da`, `eseguito_da`),
--     `prenotazioni.gestita_da` delle prenotazioni di altri clienti.
-- Non si elimina: un ADMIN, il TITOLARE di un'officina (prima va passata ad altri o eliminata dall'ADMIN),
-- chi ha prenotazioni in corso (RICHIESTA, PROPOSTA, CONFERMATA: prima vanno annullate), chi ha una
-- richiesta di aiuto su strada in corso (APERTA non scaduta o ACCETTATA da meno di 24 ore: prima va
-- annullata, così l'officina non la perde a metà intervento). Le richieste oltre quei limiti non bloccano:
-- sono già finite e le chiude la lettura o il job successivo (stessi limiti di `crea_richiesta_strada`).
-- Errori attesi (messaggio = chiave, codice P0001): ACCOUNT_AMMINISTRATORE, TITOLARE_DI_OFFICINA,
-- PRENOTAZIONI_IN_CORSO, RICHIESTA_STRADA_IN_CORSO. Senza utente: 42501.

create or replace function public.elimina_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_utente uuid := (select auth.uid());
begin
  if v_utente is null then
    raise exception 'Accesso riservato' using errcode = '42501';
  end if;

  if exists (select 1 from public.profiles where id = v_utente and ruolo = 'ADMIN') then
    raise exception 'ACCOUNT_AMMINISTRATORE';
  end if;

  if exists (
    select 1 from public.officina_utenti where profile_id = v_utente and ruolo = 'TITOLARE'
  ) then
    raise exception 'TITOLARE_DI_OFFICINA';
  end if;

  if exists (
    select 1 from public.prenotazioni
    where cliente_id = v_utente and stato in ('RICHIESTA', 'PROPOSTA', 'CONFERMATA')
  ) then
    raise exception 'PRENOTAZIONI_IN_CORSO';
  end if;

  -- Aiuto su strada in corso: stessi limiti di crea_richiesta_strada (APERTA fino a scade_il,
  -- ACCETTATA per 24 ore dall'accettazione)
  if exists (
    select 1 from public.richieste_strada
    where cliente_id = v_utente
      and (
        (stato = 'APERTA' and scade_il >= now())
        or (stato = 'ACCETTATA' and accettata_il >= now() - interval '24 hours')
      )
  ) then
    raise exception 'RICHIESTA_STRADA_IN_CORSO';
  end if;

  -- Le chiavi esterne fanno il resto (vedi sopra).
  delete from auth.users where id = v_utente;
end;
$$;

comment on function public.elimina_account() is
  'Elimina l''account di chi chiama (auth.users e a cascata profilo, prenotazioni, richieste su strada, notifiche, push, commenti); i dati delle officine su di lui restano scollegati. Rifiuta chi ha prenotazioni o un aiuto su strada in corso. Vedi NOTES.';

revoke execute on function public.elimina_account() from public, anon;
grant execute on function public.elimina_account() to authenticated;

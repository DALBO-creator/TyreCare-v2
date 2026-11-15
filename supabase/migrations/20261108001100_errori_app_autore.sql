-- T269: limita_errori_app non rivela quanti errori ha un altro utente (correzione di T244).
--
-- Prima: un utente che scriveva un errore con l'autore_id di un altro passava dal trigger, che contava
-- (security definer, sopra la RLS) gli errori dell'ALTRO; se l'altro ne aveva già 30 riceveva
-- TROPPI_ERRORI invece del rifiuto della RLS, e così scopriva quanti errori aveva l'altro.
--
-- Perché basta "lasciar passare" la riga: i trigger BEFORE ROW girano PRIMA del WITH CHECK della RLS.
-- Se l'autore_id non è quello di chi scrive, il trigger restituisce la riga senza contare nulla; poi la
-- policy "errori_app: inserimento proprio" (with check (autore_id = (select auth.uid()))) la rifiuta
-- con 42501, come per qualunque altra riga a nome di un altro. Senza utente (auth.uid() null: editor
-- SQL, service role) il limite resta com'era.
--
-- Anonimo: auth.uid() è null anche per anon, quindi il controllo sopra non lo copre. anon aveva ancora
-- il privilegio INSERT di default (senza nessuna policy, quindi non inseriva comunque), e il trigger
-- contava gli errori dell'autore_id indicato prima del rifiuto della RLS. Togliendo INSERT ad anon il
-- rifiuto (42501) arriva al controllo dei privilegi, prima di qualunque trigger. Per anon non cambia
-- nient'altro: gli errori li segnala solo chi ha un account.
--
-- Firma della funzione e trigger invariati; nessuna tabella e nessun dato cambiano.

revoke insert on public.errori_app from anon;

create or replace function public.limita_errori_app()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- A nome di un altro: niente conteggio, decide la RLS (42501)
  if new.autore_id is distinct from (select auth.uid()) and (select auth.uid()) is not null then
    return new;
  end if;

  new.created_at := now();
  perform pg_advisory_xact_lock(hashtext('errori_app:' || new.autore_id::text));
  if (
    select count(*) from public.errori_app
    where autore_id = new.autore_id and created_at > now() - interval '24 hours'
  ) >= 30 then
    raise exception 'TROPPI_ERRORI' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- T024: ragione sociale e partita IVA dell'officina le cambia solo un amministratore.
-- La pagina "Dati dell'officina" le mostra soltanto, ma la policy "officine: modifica titolare o admin"
-- permetteva al titolare di cambiarle chiamando l'API. Si estende la funzione del trigger già
-- esistente (officine_proteggi_campi, migrazione 20261006120000_fondamenta): nessun trigger nuovo.
-- auth.uid() nullo (service role, migrazioni, seed) e ADMIN restano liberi.
create or replace function public.proteggi_campi_riservati()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or public.is_admin() then
    return new;
  end if;

  -- IF annidati: PL/pgSQL non interrompe la valutazione di `and`, e new.ruolo su `officine`
  -- (o new.stato_affiliazione su `profiles`) darebbe errore.
  if tg_table_name = 'profiles' then
    if new.ruolo is distinct from old.ruolo then
      raise exception 'Solo un amministratore può cambiare il ruolo di un utente'
        using errcode = '42501';
    end if;
  elsif tg_table_name = 'officine' then
    if new.stato_affiliazione is distinct from old.stato_affiliazione then
      raise exception 'Solo un amministratore può cambiare lo stato di affiliazione'
        using errcode = '42501';
    end if;
    if new.ragione_sociale is distinct from old.ragione_sociale then
      raise exception 'Solo un amministratore può cambiare la ragione sociale'
        using errcode = '42501';
    end if;
    if new.partita_iva is distinct from old.partita_iva then
      raise exception 'Solo un amministratore può cambiare la partita IVA'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

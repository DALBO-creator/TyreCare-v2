-- Garage del cliente (sessione 10, 2026-10-09).
--
-- Il cliente vede i suoi veicoli in tutte le officine che li hanno registrati (`is_veicolo_mio`), ma
-- delle officine vedeva solo quelle ATTIVE: per un'officina in attesa o sospesa il garage non saprebbe
-- dire "controllato da …" né mostrare il telefono. Un cliente collegato al proprio account
-- (`clienti_officina.profile_id`) può quindi leggere anche le officine di cui è cliente, in qualunque
-- stato. Sono dati che l'officina dà comunque ai suoi clienti (nome, indirizzo, telefono, orari).

-- Vero se l'utente corrente è collegato come cliente dell'officina indicata.
create function public.is_cliente_officina(p_officina_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.clienti_officina
    where officina_id = p_officina_id and profile_id = (select auth.uid())
  );
$$;

revoke execute on function public.is_cliente_officina(uuid) from public, anon;
grant execute on function public.is_cliente_officina(uuid) to authenticated;

create policy "officine: lettura dei propri clienti"
  on public.officine for select to authenticated
  using (public.is_cliente_officina(id));

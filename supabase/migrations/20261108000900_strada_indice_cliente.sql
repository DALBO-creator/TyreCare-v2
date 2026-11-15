-- T206: indice per il limite orario delle richieste di aiuto su strada.
--
-- `crea_richiesta_strada` (20261101000100_strada_limiti.sql) conta le richieste del cliente
-- nell'ultima ora (`where cliente_id = v_uid and created_at > now() - interval '1 hour'`) prima di
-- crearne una nuova. L'indice su (cliente_id) da solo obbliga a leggere tutte le richieste del
-- cliente; con (cliente_id, created_at) il conteggio legge solo quelle dell'ultima ora e resta
-- veloce anche quando lo storico cresce. Solo aggiunta: nessun indice esistente viene toccato.
-- Niente `concurrently`: le migrazioni girano in transazione.

create index if not exists richieste_strada_cliente_id_created_at_idx
  on public.richieste_strada (cliente_id, created_at);

-- Test dei campi riservati dell'officina (T024): ragione sociale e partita IVA le cambia solo un
-- amministratore (trigger officine_proteggi_campi → proteggi_campi_riservati). Richiede seed.sql.
-- Eseguire con: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(10);

create function pg_temp.come(p_utente uuid) returns void language plpgsql as $$
begin
  reset role;
  set local role authenticated;
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_utente, 'role', 'authenticated')::text,
    true
  );
end;
$$;

-- ---------------------------------------------------------------- titolare di Gomme Rossi
select pg_temp.come('a0000000-0000-4000-8000-000000000002');

select lives_ok(
  $$update public.officine set telefono = '+39 011 1112223'
    where id = 'b0000000-0000-4000-8000-000000000001'$$,
  'titolare: cambia il telefono'
);
select throws_ok(
  $$update public.officine set ragione_sociale = 'Gomme Bianchi S.r.l.'
    where id = 'b0000000-0000-4000-8000-000000000001'$$,
  '42501', 'Solo un amministratore può cambiare la ragione sociale',
  'titolare: non cambia la ragione sociale'
);
select throws_ok(
  $$update public.officine set partita_iva = '11111111111'
    where id = 'b0000000-0000-4000-8000-000000000001'$$,
  '42501', 'Solo un amministratore può cambiare la partita IVA',
  'titolare: non cambia la partita IVA'
);
-- Il valore inviato è uguale a quello salvato: non è una modifica.
select lives_ok(
  $$update public.officine
    set telefono = '+39 011 4445556', ragione_sociale = 'Gomme Rossi S.n.c.',
        partita_iva = '01234567890'
    where id = 'b0000000-0000-4000-8000-000000000001'$$,
  'titolare: telefono con ragione sociale e partita IVA invariate'
);

reset role;
select is(
  (select row(ragione_sociale, partita_iva, telefono)::text from public.officine
    where id = 'b0000000-0000-4000-8000-000000000001'),
  row('Gomme Rossi S.n.c.', '01234567890', '+39 011 4445556')::text,
  'Gomme Rossi: ragione sociale e partita IVA invariate, telefono aggiornato'
);

-- ---------------------------------------------------------------- titolare2 di Pneus Express
select pg_temp.come('a0000000-0000-4000-8000-000000000005');
select throws_ok(
  $$update public.officine set stato_affiliazione = 'ATTIVA'
    where id = 'b0000000-0000-4000-8000-000000000002'$$,
  '42501', 'Solo un amministratore può cambiare lo stato di affiliazione',
  'titolare2: non cambia lo stato di affiliazione (non regressione)'
);

-- ---------------------------------------------------------------- amministratore
select pg_temp.come('a0000000-0000-4000-8000-000000000001');
select lives_ok(
  $$update public.officine set ragione_sociale = 'Gomme Rossi S.r.l.', partita_iva = '01234567891'
    where id = 'b0000000-0000-4000-8000-000000000001'$$,
  'admin: cambia ragione sociale e partita IVA'
);

reset role;
select is(
  (select row(ragione_sociale, partita_iva)::text from public.officine
    where id = 'b0000000-0000-4000-8000-000000000001'),
  row('Gomme Rossi S.r.l.', '01234567891')::text,
  'Gomme Rossi: ragione sociale e partita IVA cambiate dall''admin'
);

-- ---------------------------------------------------------------- service role (auth.uid() nullo)
select set_config('request.jwt.claims', '{"role": "service_role"}', true);
select is((select auth.uid()), null::uuid, 'service role: auth.uid() è nullo');
select lives_ok(
  $$update public.officine set ragione_sociale = 'Gomme Rossi S.n.c.', partita_iva = '01234567890'
    where id = 'b0000000-0000-4000-8000-000000000001'$$,
  'senza utente (service role/seed): cambia ragione sociale e partita IVA'
);

select * from finish();
rollback;

-- Test degli inviti già usati dopo lo scollegamento del cliente (T350, R46). Richiede seed.sql.
-- Eseguire con: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(18);

create function pg_temp.come(p_utente uuid) returns void language plpgsql as $$
begin
  reset role;
  set local role authenticated;
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_utente, 'role', 'authenticated', 'aal', 'aal2')::text,
    true
  );
end;
$$;

-- Gomme Rossi: un cliente nuovo, senza account, invitato con l'email di Giulia (…0004). Paolo (…0005,
-- titolare di Pneus Express) fa da «altro account». Mario (…0002) è il titolare di Gomme Rossi.
\set rossi '''b0000000-0000-4000-8000-000000000001'''
\set cliente '''c3500000-0000-4000-8000-000000000001'''
\set giulia '''a0000000-0000-4000-8000-000000000004'''
\set paolo '''a0000000-0000-4000-8000-000000000005'''
\set titolare '''a0000000-0000-4000-8000-000000000002'''

insert into public.clienti_officina (id, officina_id, profile_id, nome, cognome) values
  (:cliente, :rossi, null, 'Sara', 'Invitata');
insert into public.inviti_cliente (
  officina_id, cliente_officina_id, email, codice_hash, scade_il
) values (
  :rossi, :cliente, 'cliente@tyrecare.test', public.impronta_codice('prova-t350-invito'),
  now() + interval '14 days'
);

-- ---------------------------------------------------------------- stato di partenza (dritta T100)
select is(
  (select profile_id from public.clienti_officina where id = :cliente),
  null,
  'partenza: il cliente non è collegato'
);

-- ---------------------------------------------------------------- invito usato, cliente collegato
select pg_temp.come(:giulia);
select is(
  public.accetta_invito('prova-t350-invito'),
  'Gomme Rossi S.n.c.',
  'Giulia accetta l''invito e riceve il nome dell''officina'
);
select results_eq(
  'select stato, usato_da_te from public.info_invito(''prova-t350-invito'')',
  $$values ('USATO', true)$$,
  'cliente collegato: per Giulia l''invito è USATO e usato da lei'
);
select is(
  public.accetta_invito('prova-t350-invito'),
  'Gomme Rossi S.n.c.',
  'cliente collegato: Giulia può riaccettare lo stesso invito'
);

select pg_temp.come(:paolo);
select throws_ok(
  'select public.accetta_invito(''prova-t350-invito'')',
  'P0001', 'INVITO_GIA_USATO',
  'cliente collegato: un altro account riceve INVITO_GIA_USATO'
);
select results_eq(
  'select stato, usato_da_te from public.info_invito(''prova-t350-invito'')',
  $$values ('USATO', false)$$,
  'cliente collegato: per un altro account l''invito è USATO e non usato da lui'
);

reset role;
select is(
  (select profile_id from public.clienti_officina where id = :cliente),
  :giulia::uuid,
  'prima dello scollegamento il cliente è collegato a Giulia'
);

-- ---------------------------------------------------------------- dopo lo scollegamento
select pg_temp.come(:titolare);
select lives_ok(
  format('select public.scollega_cliente(%L)', :cliente),
  'il titolare scollega il cliente'
);

reset role;
select is(
  (select profile_id from public.clienti_officina where id = :cliente),
  null,
  'profile_id ora è vuoto'
);

select pg_temp.come(:giulia);
select results_eq(
  'select stato, usato_da_te from public.info_invito(''prova-t350-invito'')',
  $$values ('ANNULLATO', false)$$,
  'scollegato: per Giulia l''invito usato ora è ANNULLATO e non più usato da lei'
);
select throws_ok(
  'select public.accetta_invito(''prova-t350-invito'')',
  'P0001', 'INVITO_ANNULLATO',
  'scollegato: Giulia (stesso account) riceve INVITO_ANNULLATO'
);

reset role;
select is(
  (select profile_id from public.clienti_officina where id = :cliente),
  null,
  'dopo il tentativo il cliente resta scollegato'
);

-- ---------------------------------------------------------------- ricollegato a un altro account
-- Come proprietario (senza utente): il trigger di protezione lascia scrivere profile_id.
update public.clienti_officina set profile_id = :paolo where id = :cliente;
select is(
  (select profile_id from public.clienti_officina where id = :cliente),
  :paolo::uuid,
  'il cliente ora è collegato a un altro account'
);

select pg_temp.come(:giulia);
select results_eq(
  'select stato, usato_da_te from public.info_invito(''prova-t350-invito'')',
  $$values ('ANNULLATO', false)$$,
  'ricollegato ad altri: per Giulia l''invito è ANNULLATO'
);
select throws_ok(
  'select public.accetta_invito(''prova-t350-invito'')',
  'P0001', 'INVITO_ANNULLATO',
  'ricollegato ad altri: Giulia riceve INVITO_ANNULLATO'
);

select pg_temp.come(:paolo);
select results_eq(
  'select stato, usato_da_te from public.info_invito(''prova-t350-invito'')',
  $$values ('ANNULLATO', false)$$,
  'ricollegato ad altri: anche per il nuovo account l''invito è ANNULLATO'
);
select throws_ok(
  'select public.accetta_invito(''prova-t350-invito'')',
  'P0001', 'INVITO_ANNULLATO',
  'ricollegato ad altri: il nuovo account riceve INVITO_ANNULLATO, non il nome dell''officina'
);

reset role;
select is(
  (select profile_id from public.clienti_officina where id = :cliente),
  :paolo::uuid,
  'i tentativi non cambiano il collegamento'
);

select * from finish();
rollback;

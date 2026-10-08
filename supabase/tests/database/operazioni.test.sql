-- Test delle funzioni registra_controllo e monta_pneumatici. Richiede i dati di seed.sql.
-- Eseguire con: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;

select plan(21);

create function pg_temp.come(p_utente uuid) returns void language plpgsql as $$
begin
  reset role;
  if p_utente is null then
    set local role anon;
    perform set_config('request.jwt.claims', '{"role": "anon"}', true);
  else
    set local role authenticated;
    perform set_config(
      'request.jwt.claims',
      json_build_object('sub', p_utente, 'role', 'authenticated')::text,
      true
    );
  end if;
end;
$$;

-- Panda di Giulia da Gomme Rossi (4 invernali montati) e Golf di Franco (nessuno pneumatico)
\set panda '''d0000000-0000-4000-8000-000000000001'''
\set golf '''d0000000-0000-4000-8000-000000000002'''

-- ---------------------------------------------------------------- registra_controllo
select pg_temp.come('a0000000-0000-4000-8000-000000000003'); -- operatore di Gomme Rossi

select lives_ok(
  format($$select public.registra_controllo(%L, '[
    {"posizione": "ANT_SX", "battistrada_mm": 5.9, "pressione_bar": 2.2, "usura": "REGOLARE"},
    {"posizione": "POST_SX", "battistrada_mm": 1.2, "usura": "INTERNA", "danni": "Taglio sul fianco"}
  ]', current_date, 43100, 'Prova')$$, :panda),
  'operatore: registra un controllo con due misure'
);
select results_eq(
  $$select c.km, c.eseguito_da, count(m.*)::int
    from public.controlli c join public.misure_pneumatico m on m.controllo_id = c.id
    where c.km = 43100 group by c.id$$,
  $$values (43100, 'a0000000-0000-4000-8000-000000000003'::uuid, 2)$$,
  'il controllo ha km, autore e le due misure'
);
select is(
  (select m.danni from public.misure_pneumatico m join public.pneumatici p on p.id = m.pneumatico_id
   where m.battistrada_mm = 1.2 and p.posizione = 'POST_SX'),
  'Taglio sul fianco',
  'la misura è sullo pneumatico montato nella posizione indicata'
);

-- Tutto o niente: con una misura sbagliata non resta il controllo
select throws_ok(
  format($$select public.registra_controllo(%L, '[
    {"posizione": "ANT_SX", "battistrada_mm": 5},
    {"posizione": "SCORTA", "battistrada_mm": 7}
  ]', current_date, 50000)$$, :panda),
  '22023', null,
  'posizione senza pneumatico montato: errore'
);
select is_empty(
  'select 1 from public.controlli where km = 50000',
  'dopo l''errore non resta un controllo a metà'
);
select throws_ok(
  format($$select public.registra_controllo(%L, '[
    {"posizione": "ANT_SX", "battistrada_mm": 5}, {"posizione": "ANT_SX", "battistrada_mm": 4}
  ]')$$, :panda),
  '23505', null,
  'posizione ripetuta: errore'
);
select throws_ok(
  format($$select public.registra_controllo(%L, '[]')$$, :panda),
  '22023', null,
  'nessuna misura: errore'
);
select throws_ok(
  format($$select public.registra_controllo(%L, '[{"posizione": "ANT_SX", "battistrada_mm": 5}]',
    current_date + 1)$$, :panda),
  '22023', null,
  'data nel futuro: errore'
);

select pg_temp.come('a0000000-0000-4000-8000-000000000004'); -- Giulia, cliente
select throws_ok(
  format($$select public.registra_controllo(%L, '[{"posizione": "ANT_SX", "battistrada_mm": 9}]')$$,
    :panda),
  '42501', null,
  'cliente: non può registrare controlli sulla propria auto'
);

select pg_temp.come('a0000000-0000-4000-8000-000000000005'); -- titolare di Pneus Express
select throws_ok(
  format($$select public.registra_controllo(%L, '[{"posizione": "ANT_SX", "battistrada_mm": 9}]')$$,
    :panda),
  '42501', null,
  'altra officina: non può registrare controlli sui veicoli di Gomme Rossi'
);

select pg_temp.come(null);
select throws_ok(
  format($$select public.registra_controllo(%L, '[{"posizione": "ANT_SX", "battistrada_mm": 9}]')$$,
    :panda),
  '42501', null,
  'anonimo: non può eseguire la funzione'
);

-- ---------------------------------------------------------------- monta_pneumatici
select pg_temp.come('a0000000-0000-4000-8000-000000000003'); -- operatore di Gomme Rossi

select is(
  (select count(*)::int from public.monta_pneumatici(:panda, '[
    {"posizione": "ANT_SX", "stagione": "ESTIVO", "misura": "175/65 R14 82T", "marca": "Pirelli", "dot": "1226"},
    {"posizione": "ANT_DX", "stagione": "ESTIVO", "misura": "175/65 R14 82T", "marca": "Pirelli", "dot": ""}
  ]')),
  2,
  'operatore: monta due pneumatici sulla Panda'
);
select results_eq(
  format($$select posizione::text, stagione::text, marca, dot from public.pneumatici
    where veicolo_id = %L and smontato_il is null order by 1$$, :panda),
  $$values ('ANT_DX', 'ESTIVO', 'Pirelli', null), ('ANT_SX', 'ESTIVO', 'Pirelli', '1226'),
           ('POST_DX', 'INVERNALE', 'Michelin', '3823'), ('POST_SX', 'INVERNALE', 'Michelin', '3823')$$,
  'i nuovi sono montati davanti, i posteriori restano; DOT vuoto diventa nullo'
);
select is(
  (select smontato_il from public.pneumatici where id = 'e0000000-0000-4000-8000-000000000001'),
  current_date,
  'il vecchio anteriore sinistro resta nello storico, smontato oggi'
);
select is(
  (select count(*)::int from public.monta_pneumatici(:golf, '[
    {"posizione": "ANT_SX", "stagione": "QUATTRO_STAGIONI"}, {"posizione": "ANT_DX", "stagione": "QUATTRO_STAGIONI"},
    {"posizione": "POST_SX", "stagione": "QUATTRO_STAGIONI"}, {"posizione": "POST_DX", "stagione": "QUATTRO_STAGIONI"}
  ]', current_date - 3)),
  4,
  'operatore: monta quattro pneumatici sulla Golf che non ne aveva'
);
select throws_ok(
  format($$select public.monta_pneumatici(%L, '[{"posizione": "POST_SX", "stagione": "ESTIVO"}]',
    '2025-01-01')$$, :panda),
  '23514', null,
  'data di montaggio precedente a quella dello pneumatico attuale: errore'
);

-- ---------------------------------------------------------------- ripetizioni (errore di rete)
-- Il web sceglie gli id in anticipo e, se la richiesta fallisce per la rete, la ripete: la seconda
-- chiamata non deve creare doppioni
select pg_temp.come('a0000000-0000-4000-8000-000000000003'); -- operatore di Gomme Rossi

select is(
  public.registra_controllo(:panda, '[{"posizione": "ANT_SX", "battistrada_mm": 7}]',
    current_date, 60000, '', 'f0000000-0000-4000-8000-0000000000aa'),
  'f0000000-0000-4000-8000-0000000000aa'::uuid,
  'registra_controllo usa l''id indicato'
);
select is(
  public.registra_controllo(:panda, '[{"posizione": "ANT_SX", "battistrada_mm": 7}]',
    current_date, 60000, '', 'f0000000-0000-4000-8000-0000000000aa'),
  'f0000000-0000-4000-8000-0000000000aa'::uuid,
  'registra_controllo ripetuto restituisce lo stesso controllo'
);
select is(
  (select count(*)::int from public.controlli where km = 60000),
  1,
  'la ripetizione non crea un secondo controllo'
);

select public.monta_pneumatici(:golf, '[
  {"id": "e0000000-0000-4000-8000-0000000000aa", "posizione": "ANT_SX", "stagione": "ESTIVO"}
]');
select public.monta_pneumatici(:golf, '[
  {"id": "e0000000-0000-4000-8000-0000000000aa", "posizione": "ANT_SX", "stagione": "ESTIVO"}
]');
select results_eq(
  format($$select id, smontato_il from public.pneumatici
    where veicolo_id = %L and posizione = 'ANT_SX' and stagione = 'ESTIVO'$$, :golf),
  $$values ('e0000000-0000-4000-8000-0000000000aa'::uuid, null::date)$$,
  'monta_pneumatici ripetuto: lo pneumatico resta montato e non si duplica'
);

select pg_temp.come('a0000000-0000-4000-8000-000000000004'); -- Giulia, cliente
select throws_ok(
  format($$select public.monta_pneumatici(%L, '[{"posizione": "ANT_SX", "stagione": "ESTIVO"}]')$$,
    :panda),
  '42501', null,
  'cliente: non può montare pneumatici'
);

select * from finish();
rollback;

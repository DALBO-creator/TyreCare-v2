-- T231: il motivo degli eventi di Stripe scartati.
-- Quando il webhook scarta un evento per un errore permanente (es. ABBONAMENTO_NON_TROVATO), lo registra
-- lo stesso e risponde 200 a Stripe; finora il perché restava solo nel log della funzione, che dopo pochi
-- giorni sparisce. Ora la chiave d'errore si salva sull'evento e si legge dalla console di Supabase.
--   - stripe_eventi.motivo: la chiave d'errore (al massimo 200 caratteri; null = evento elaborato);
--   - annota_evento_stripe: scrive il motivo su un evento già registrato (solo service role).
-- Nessuna email o notifica: il dato resta nella tabella (che la pulizia notturna svuota dopo 30 giorni).
-- Solo aggiunte: nessuna tabella, colonna o dato esistente cambia.
-- Per cambiare: migrazione nuova con `create or replace function`.

alter table public.stripe_eventi
  add column motivo text check (char_length(motivo) <= 200);

comment on column public.stripe_eventi.motivo is
  'Chiave d''errore per cui il webhook ha scartato l''evento (max 200 caratteri); null se elaborato.';

-- ---------------------------------------------------------------------------------------------------
-- Annotazione del motivo
-- ---------------------------------------------------------------------------------------------------
-- true se l'evento esiste (motivo scritto), false se non è registrato (niente da annotare).
-- Il motivo si tronca a 200 caratteri; un motivo nullo cancella quello presente.

create function public.annota_evento_stripe(p_id text, p_motivo text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.stripe_eventi
  set motivo = left(p_motivo, 200)
  where id = p_id;

  return found;
end;
$$;

comment on function public.annota_evento_stripe(text, text) is
  'Service role: salva sull''evento di Stripe il motivo dello scarto (max 200 caratteri); true se esiste.';

-- Solo il service role (il webhook di Stripe)
revoke execute on function public.annota_evento_stripe(text, text)
  from public, anon, authenticated;
grant execute on function public.annota_evento_stripe(text, text) to service_role;

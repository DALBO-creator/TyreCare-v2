-- T199: preferenza dell'utente sulle email di riserva delle notifiche (T066, T114, R26).
-- Solo una colonna nuova con default: nessun dato esistente cambia (tutti i profili partono da `true`).
-- La modifica l'utente da sé con la policy "profiles: modifica propria o admin" (fondamenta): la colonna
-- non è tra quelle protette dai trigger `profiles_proteggi_campi` (ruolo) e `profiles_proteggi_termini`
-- (termini), perché è una scelta dell'utente e non una prova.
-- La legge `invia-notifica` (service role) prima di mandare l'email: con `false` niente email.

alter table public.profiles
  add column email_notifiche boolean not null default true;

comment on column public.profiles.email_notifiche is
  'Se false, invia-notifica non manda l''email di riserva quando la push non arriva (T199).';

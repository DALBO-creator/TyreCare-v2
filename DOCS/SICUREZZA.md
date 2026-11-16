# SICUREZZA — Cosa protegge l'app e cosa va impostato a mano

Pagina di riferimento della sessione di lancio (2026-11-14, completata il 2026-11-16). Le regole vere stanno
nel database: l'interfaccia mostra solo le schermate giuste.

## Cosa fa il database

| Misura | Dove |
| --- | --- |
| `anon` legge solo `officine`, `servizi_officina`, `chiusure_officina`; nessun ruolo dell'app fa TRUNCATE, REFERENCES, TRIGGER | `20261114200000_sicurezza_permessi.sql` |
| Le funzioni dei trigger non si chiamano dall'API | idem |
| `officina_utenti`: i membri li aggiunge solo l'admin; il titolare non sposta le righe | idem (trigger `proteggi_chiavi_membro`) |
| `iscrizioni_push.endpoint` solo di servizi push conosciuti (niente SSRF da `invia-notifica`) | idem (`not valid`: vale per le righe nuove) |
| `is_admin()` vero solo con ruolo ADMIN **e** sessione `aal2` | `20261112000100_pannello_admin.sql` (ripetuta in `20261114200100_due_fattori.sql`) |
| Chi ha la 2FA attiva (qualsiasi ruolo) con la sola password non legge né scrive nulla | `20261114200100_due_fattori.sql`: policy restrittiva su ogni tabella + `db_pre_request` |
| Il ruolo ADMIN si dà e si toglie solo dall'editor SQL; registro delle azioni `admin_registro` | `20261112000100_pannello_admin.sql` |
| `abbonamenti`: lo scrivono solo le funzioni `admin_*`; il titolare non legge `note_admin` | `20261114100000_abbonamento_manuale.sql` |

## Cosa fa l'app

- Router (`lib/router.ts`, `main.ts`): se la sessione è `aal1` e l'utente ha un fattore TOTP verificato,
  ogni pagina con login mostra la richiesta del codice (`mostraCodiceAccesso` in `pagine/sicurezza.ts`);
  dopo il codice (`MFA_CHALLENGE_VERIFIED`) ridisegna la pagina dell'URL.
- `/profilo/sicurezza`: attivare (QR + codice) o disattivare (serve il codice) la verifica in due passaggi.
- `/admin/*`: l'admin senza 2FA viene portato a registrarla (`pagine/admin-comune.ts`).
- Password: almeno 10 caratteri con maiuscola, minuscola e numero (`PASSWORD_MIN`, `AIUTO_PASSWORD` in
  `packages/shared/src/auth.ts`; `supabase/config.toml` allineato).
- Intestazioni HTTP e CSP applicata (non più Report-Only) in `apps/web/vercel.json`.

## Da fare a mano sul cloud (Davide)

1. **Migrazioni**: `npx supabase db push --include-all` (le migrazioni `20261108…` degli agenti sono più
   vecchie della `20261112…` già pubblicata: senza `--include-all` il comando si rifiuta). Prima
   `--dry-run`, guida in `pilota/pubblicazione.md`.
2. **`db_pre_request`**: se il push stampa il warning «db_pre_request non impostato», eseguire nell'editor
   SQL del progetto:
   ```sql
   alter role authenticator set pgrst.db_pre_request = 'public.controlla_richiesta';
   notify pgrst, 'reload config';
   ```
   Senza, la policy restrittiva protegge comunque le tabelle; resta aperta solo la chiamata delle funzioni
   `security definer` con sessione `aal1`.
3. **Authentication → Multi-Factor**: TOTP attivo (iscrizione e verifica).
4. **Authentication → Password**: lunghezza minima **10**, requisiti **lettere minuscole, maiuscole e
   numeri**; se c'è, attivare la protezione dalle password trapelate e la riautenticazione per il cambio
   password. Gli account esistenti con password più deboli continuano ad accedere: la regola vale al
   prossimo cambio.
5. **Stripe**: cancellare le Edge Functions rimaste sul cloud
   (`npx supabase functions delete stripe-checkout`, poi `stripe-portale` e `stripe-webhook`), i segreti
   `STRIPE_*` e l'endpoint del webhook nella dashboard di Stripe.
6. **Admin**: aprire `/admin` e registrare l'app di autenticazione (QR). Da quel momento all'accesso
   l'app chiede sempre il codice.
7. **Vercel**: `VITE_SUPABASE_ANON_KEY` anche nell'ambiente *Preview*; sull'anteprima aprire la console
   e controllare che la CSP non blocchi accesso, push, «Vicino a me».

## Se qualcuno perde il telefono

Dall'editor SQL: `delete from auth.mfa_factors where user_id = '<id>';` dopo aver verificato chi è.
L'utente rientra con la sola password e può riattivare la 2FA dal Profilo.

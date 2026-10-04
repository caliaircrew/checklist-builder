# Currency reminder emails — one-time setup

What it does: every morning (9 am Pacific in summer, 8 am in winter) a Supabase Cron job calls the `reminders`
Edge Function, which emails members whose aircraft "current through" month, flight attendant recurrent, or
CPR / AED / first aid date is 60 days out, 30 days out, or just lapsed. One email per member; each reminder is sent
once (logged in `reminder_log`). Members turn it off on Account → Email reminders.

Uses the Resend setup and the RESEND_API_KEY / MAIL_FROM secrets from docs/RECOVERY_SETUP.md.

1. SQL Editor → run `supabase/013_reminders.sql` (ends with member_settings and reminder_log, both rls_on = true).
2. Edge Functions → Deploy a new function → Via Editor → name `reminders` → paste
   `supabase/functions/reminders/index.ts` → Deploy → Settings: turn OFF "Verify JWT with legacy secret" → Save.
3. Edge Functions → Secrets → add `REMINDER_KEY` = the long random value Claude gave you.
4. SQL Editor, a NEW query (don't save it): `select vault.create_secret('THE-SAME-VALUE', 'reminder_key');`
5. SQL Editor → run `supabase/014_reminder_schedule.sql` (ends with cali-currency-reminders · 0 16 * * * · true).
6. Test: put a "current through" month 1–2 months ahead on one of your own aircraft, Save, then in the SQL Editor run
   only the `select net.http_post(...)` statement from 014. The email arrives within a minute. Running it again sends
   nothing (already sent).

Change the time: edit '0 16 * * *' in 014 (minute hour, UTC) and re-run it. Stop it:
`select cron.unschedule(jobid) from cron.job where jobname = 'cali-currency-reminders';`

-- =============================================================================
-- Cali Aircrew — run the currency reminders every day at 9 am Pacific (16:00 UTC; 8 am in winter).
-- Version 014 · 2026-10-03 · run AFTER: 013 is applied, the "reminders" Edge Function is deployed (Verify JWT off),
-- and the REMINDER_KEY secret is set. Safe to re-run.
--
-- BEFORE running this file, store the same REMINDER_KEY value in the database vault ONCE (separate query,
-- don't save it in a file):
--     select vault.create_secret('PASTE-THE-REMINDER_KEY-VALUE', 'reminder_key');
-- =============================================================================
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

select cron.unschedule(jobid) from cron.job where jobname = 'cali-currency-reminders';
select cron.schedule('cali-currency-reminders', '0 16 * * *', $job$
  select net.http_post(
    url     := 'https://egpfdyvksqierfdkogwe.supabase.co/functions/v1/reminders',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-cron-key', (select decrypted_secret from vault.decrypted_secrets where name = 'reminder_key')),
    body    := '{}'::jsonb);
$job$);

select jobname, schedule, active from cron.job where jobname = 'cali-currency-reminders';
-- To send today's reminders right away (e.g. to test), run just the  select net.http_post(...)  statement above.

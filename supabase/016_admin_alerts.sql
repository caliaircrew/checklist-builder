-- =============================================================================
-- Cali Aircrew — email alerts to admins (profiles waiting for review, text waiting, help requests, partner inquiries).
-- Version 016 · 2026-10-03 · needs 007, 009, 011, 013, 014.
-- Run AFTER redeploying the reminders Edge Function (v1.49). Safe to re-run.
--   member_settings.admin_emails   each admin can turn the alerts off (Admin page switch); on unless turned off
--   admin_alert_state              what was already announced, so each item is emailed once (server only)
--   admin_alert_recipients()       admins' emails for the job (server only)
--   cron job                       hourly at :05, same function as the daily reminders, mode "admin"
-- =============================================================================
alter table public.member_settings add column if not exists admin_emails boolean not null default true;

create table if not exists public.admin_alert_state (
  id         integer primary key default 1 check (id = 1),
  notified   jsonb not null default '[]'::jsonb check (jsonb_typeof(notified) = 'array'),
  last_sent  timestamptz,
  updated_at timestamptz not null default now()
);
insert into public.admin_alert_state (id) values (1) on conflict do nothing;
alter table public.admin_alert_state enable row level security;
revoke all on public.admin_alert_state from anon, authenticated;     -- no policies: server (service key) only

create or replace function public.admin_alert_recipients() returns table (email text)
language sql stable security definer set search_path = '' as $$
  select u.email::text from public.admins a join auth.users u on u.id = a.user_id
  left join public.member_settings s on s.user_id = a.user_id
  where u.email is not null and coalesce(s.admin_emails, true);
$$;
revoke all on function public.admin_alert_recipients() from public, anon, authenticated;
grant execute on function public.admin_alert_recipients() to service_role;

select cron.unschedule(jobid) from cron.job where jobname = 'cali-admin-alerts';
select cron.schedule('cali-admin-alerts', '5 * * * *', $job$
  select net.http_post(
    url     := 'https://egpfdyvksqierfdkogwe.supabase.co/functions/v1/reminders',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-cron-key', (select decrypted_secret from vault.decrypted_secrets where name = 'reminder_key')),
    body    := '{"mode": "admin"}'::jsonb);
$job$);

select jobname, schedule, active from cron.job where jobname in ('cali-currency-reminders', 'cali-admin-alerts') order by 1;

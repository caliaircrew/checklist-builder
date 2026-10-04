-- =============================================================================
-- Cali Aircrew — self-service account recovery codes. Run once in the SQL Editor (safe to re-run).
-- Version 012 · 2026-10-03 · needs 011.
-- Used only by the "recovery" Edge Function (server-side, service key). Members and visitors have no access.
--   recovery_codes    one-time 6-digit codes (stored hashed), 15-minute expiry, limited attempts
--   recovery_lookup   finds an account's backup email from its sign-in email (Edge Function only)
-- =============================================================================
create table if not exists public.recovery_codes (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  purpose    text not null check (purpose in ('confirm_backup', 'recover')),
  code_hash  text not null,
  sent_to    text not null default '',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '15 minutes',
  attempts   integer not null default 0,
  used       boolean not null default false
);
create index if not exists recovery_codes_user on public.recovery_codes (user_id, created_at);
alter table public.recovery_codes enable row level security;
revoke all on public.recovery_codes from anon, authenticated;   -- no policies: only the service key (Edge Function) can use it

create or replace function public.recovery_lookup(p_email text) returns table (user_id uuid, backup_email text, backup_confirmed boolean, sign_in_email text)
language sql stable security definer set search_path = '' as $$
  select u.id, coalesce(r.backup_email, ''), coalesce(r.backup_confirmed, false), u.email::text
  from auth.users u left join public.account_recovery r on r.user_id = u.id
  where lower(u.email) = lower(trim(p_email));
$$;
revoke all on function public.recovery_lookup(text) from public, anon, authenticated;
grant execute on function public.recovery_lookup(text) to service_role;

select relname as table_name, relrowsecurity as rls_on from pg_class where relnamespace = 'public'::regnamespace and relname = 'recovery_codes';

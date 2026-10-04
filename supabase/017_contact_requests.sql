-- =============================================================================
-- Cali Aircrew — contact requests (first step toward messaging).
-- Version 017 · 2026-10-04 · needs 002, 007 (is_admin), 013 (member_settings). Safe to re-run.
--   contact_requests                 every request: who sent it, to whom, optional aircraft, the note, status.
--                                    Written ONLY by the "contact" Edge Function (server key). Senders read what
--                                    they sent, pilots read what they received, admins read everything.
--                                    status: sent | failed (email didn't go; doesn't count toward limits)
--                                            | reported (recipient used the report link) | cleared (admin reviewed a report)
--   member_settings.contact_requests  a member can turn requests off on the Account page (on unless turned off)
-- Deploy the "contact" Edge Function (GitHub Actions does this) — no new secrets.
-- =============================================================================
create table if not exists public.contact_requests (
  id            uuid primary key default gen_random_uuid(),
  sender_id     uuid not null references auth.users (id) on delete cascade,
  recipient_id  uuid not null references auth.users (id) on delete cascade,
  seq           integer check (seq is null or seq between 0 and 9999),     -- aircraft the request is about (optional)
  sender_label  text not null default '' check (char_length(sender_label) <= 120),
  note          text not null check (char_length(note) between 1 and 500),
  status        text not null default 'sent' check (status in ('sent', 'failed', 'reported', 'cleared')),
  report_hash   text not null default '',                                -- sha-256 of the one-time report code (server only)
  report_reason text not null default '' check (char_length(report_reason) <= 500),
  reported_at   timestamptz,
  created_at    timestamptz not null default now(),
  check (sender_id <> recipient_id)
);
create index if not exists contact_requests_sender_idx    on public.contact_requests (sender_id, created_at desc);
create index if not exists contact_requests_recipient_idx on public.contact_requests (recipient_id, created_at desc);
alter table public.contact_requests enable row level security;
revoke all on public.contact_requests from anon, authenticated;
-- Column-level read: everything except the report code hash.
grant select (id, sender_id, recipient_id, seq, sender_label, note, status, report_reason, reported_at, created_at)
  on public.contact_requests to authenticated;
grant update (status) on public.contact_requests to authenticated;          -- admins only, by the policy below

drop policy if exists "sender, recipient or admin read" on public.contact_requests;
create policy "sender, recipient or admin read" on public.contact_requests for select to authenticated
  using (sender_id = (select auth.uid()) or recipient_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "admins review reports" on public.contact_requests;
create policy "admins review reports" on public.contact_requests for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()) and status in ('reported', 'cleared'));

alter table public.member_settings add column if not exists contact_requests boolean not null default true;

select 'contact_requests ready' as status;

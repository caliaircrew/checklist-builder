-- =============================================================================
-- Cali Aircrew — Account page. Run once in the SQL Editor (safe to re-run).
-- Version 011 · 2026-10-03 · needs 002 and 007.
--
--   account_recovery    backup email + phone a member saves for account recovery (member and admins only)
--   help_requests       "Can't get in? Ask Cali Aircrew" — anyone can send one; admins read and close them
--   delete_my_account   a signed-in member deletes their own account after typing their email
-- =============================================================================

create table if not exists public.account_recovery (
  user_id          uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  backup_email     text not null default '' check (length(backup_email) <= 254 and (backup_email = '' or backup_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')),
  backup_confirmed boolean not null default false,
  phone            text not null default '' check (length(phone) <= 30),
  updated_at       timestamptz not null default now()
);
alter table public.account_recovery enable row level security;
revoke all on public.account_recovery from anon, authenticated;
grant select, insert, update, delete on public.account_recovery to authenticated;
drop policy if exists "own or admin read recovery" on public.account_recovery;
create policy "own or admin read recovery" on public.account_recovery for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "own recovery" on public.account_recovery;
create policy "own recovery" on public.account_recovery for all to authenticated
  using (user_id = (select auth.uid()) and (select public.mfa_ok()))
  with check (user_id = (select auth.uid()) and (select public.mfa_ok()));
-- A member can't mark their own backup email as confirmed; that happens only through the confirmation step.
create or replace function public.account_recovery_guard() returns trigger
language plpgsql set search_path = '' as $$   -- runs as the caller, so current_user is the real role
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' or new.backup_email is distinct from old.backup_email then new.backup_confirmed := false;
    else new.backup_confirmed := old.backup_confirmed; end if;
  elsif tg_op = 'UPDATE' and new.backup_email is distinct from old.backup_email then
    new.backup_confirmed := false;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists account_recovery_guard on public.account_recovery;
create trigger account_recovery_guard before insert or update on public.account_recovery for each row execute function public.account_recovery_guard();

create table if not exists public.help_requests (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  email      text not null check (length(email) <= 254 and email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  message    text not null default '' check (length(message) <= 1000),
  kind       text not null default 'locked_out' check (kind in ('locked_out', 'other')),
  status     text not null default 'open' check (status in ('open', 'done')),
  note       text not null default '' check (length(note) <= 1000)
);
alter table public.help_requests enable row level security;
revoke all on public.help_requests from anon, authenticated;
grant insert (email, message, kind) on public.help_requests to anon, authenticated;
grant select, update, delete on public.help_requests to authenticated;
drop policy if exists "anyone asks for help" on public.help_requests;
create policy "anyone asks for help" on public.help_requests for insert to anon, authenticated with check (true);
drop policy if exists "admins handle help" on public.help_requests;
create policy "admins handle help" on public.help_requests for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create or replace function public.delete_my_account(p_confirm_email text) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); em text;
begin
  if uid is null then raise exception 'Sign in first'; end if;
  if not public.mfa_ok() then raise exception 'Enter your Microsoft Authenticator code first'; end if;
  select u.email into em from auth.users u where u.id = uid;
  if lower(trim(coalesce(p_confirm_email, ''))) <> lower(coalesce(em, '')) then raise exception 'Type your sign-in email exactly to confirm'; end if;
  if exists (select 1 from public.admins where user_id = uid) then raise exception 'Admins: ask another admin to remove your admin access first'; end if;
  insert into public.admin_audit (admin_id, admin_email, action, target_user, target_email, detail)
  values (uid, em, 'self_delete', uid, em, '{}'::jsonb);
  delete from auth.users where id = uid;   -- profiles, aircraft, checklists and recovery details are removed with it
end $$;
revoke all on function public.delete_my_account(text) from public, anon;
grant execute on function public.delete_my_account(text) to authenticated;

select relname as table_name, relrowsecurity as rls_on from pg_class
where relnamespace = 'public'::regnamespace and relname in ('account_recovery', 'help_requests') order by 1;

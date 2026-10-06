-- 018 Checklist sync fix (2026-10-05) — run once in the Supabase SQL editor.
-- Saving checklists failed with "permission denied for table mfa_factors": the two-step rule on
-- checklists and my_items read auth.mfa_factors directly, which signed-in users may no longer read.
-- The rule now uses public.mfa_ok() (security definer, same check), as every other table already does.
drop policy if exists "mfa when enrolled" on public.checklists;
create policy "mfa when enrolled" on public.checklists as restrictive for all to authenticated
  using ((select public.mfa_ok())) with check ((select public.mfa_ok()));
drop policy if exists "mfa when enrolled" on public.my_items;
create policy "mfa when enrolled" on public.my_items as restrictive for all to authenticated
  using ((select public.mfa_ok())) with check ((select public.mfa_ok()));
select 'checklist sync fixed' as result;

-- 019 Profile photos (app 1.66) — run once in the Supabase SQL editor.
--   crew_profiles.photo   the member's current photo file ('' = none), always "<their user id>/<number>.jpg"
--   moderation.photo_ok   the file an admin approved; the photo shows on the public profile only while photo = photo_ok
--   storage bucket crew-photos (private): members upload/delete only in their own folder; anyone may view an
--   approved photo of a listed profile; the owner and admins can view pending ones.
-- Also: delete_my_account error wording for any authenticator app (queued in the roadmap, v1.64).

alter table public.crew_profiles add column if not exists photo text not null default '';
alter table public.crew_profiles drop constraint if exists crew_profiles_photo_check;
alter table public.crew_profiles add constraint crew_profiles_photo_check
  check (photo = '' or (photo ~ '^[0-9a-f-]{36}/[0-9]{10,16}\.jpg$' and split_part(photo, '/', 1) = user_id::text));
alter table public.moderation add column if not exists photo_ok text not null default '';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('crew-photos', 'crew-photos', false, 524288, array['image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = 524288, allowed_mime_types = array['image/jpeg'];

drop policy if exists "crew photos upload own" on storage.objects;
create policy "crew photos upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'crew-photos' and (storage.foldername(name))[1] = (select auth.uid())::text and name ~ '^[0-9a-f-]{36}/[0-9]{10,16}\.jpg$');
drop policy if exists "crew photos delete own or admin" on storage.objects;
create policy "crew photos delete own or admin" on storage.objects for delete to authenticated
  using (bucket_id = 'crew-photos' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin())));
drop policy if exists "crew photos view" on storage.objects;
create policy "crew photos view" on storage.objects for select to anon, authenticated
  using (bucket_id = 'crew-photos' and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (select public.is_admin())
    or exists (select 1 from public.crew_profiles p join public.moderation m on m.user_id = p.user_id
               where p.photo = objects.name and m.photo_ok = objects.name and p.published and m.approved and not m.hidden)));

-- Admin: approve (p_ok) or remove a member's photo.
create or replace function public.admin_photo(p_user uuid, p_ok boolean) returns text
language plpgsql security definer set search_path = '' as $$
declare cur text;
begin
  perform public.admin_guard();
  select photo into cur from public.crew_profiles where user_id = p_user;
  if coalesce(cur, '') = '' then raise exception 'This member has no photo'; end if;
  if p_ok then
    insert into public.moderation (user_id, photo_ok) values (p_user, cur)
    on conflict (user_id) do update set photo_ok = excluded.photo_ok;
  else
    update public.crew_profiles set photo = '' where user_id = p_user;
    update public.moderation set photo_ok = '' where user_id = p_user;
  end if;
  perform public.admin_log(case when p_ok then 'photo_approve' else 'photo_remove' end, p_user, jsonb_build_object('file', cur));
  return cur;   -- the admin page deletes the file after a removal
end $$;
revoke all on function public.admin_photo(uuid, boolean) from public, anon;
grant execute on function public.admin_photo(uuid, boolean) to authenticated;

-- Admin: photos waiting for review.
create or replace function public.admin_photo_queue() returns table (user_id uuid, display_name text, photo text, published boolean)
language plpgsql security definer set search_path = '' as $$
begin
  perform public.admin_guard();
  return query select p.user_id, p.display_name, p.photo, p.published from public.crew_profiles p
    left join public.moderation m on m.user_id = p.user_id
    where p.photo <> '' and p.photo is distinct from coalesce(m.photo_ok, '') order by p.updated_at;
end $$;
revoke all on function public.admin_photo_queue() from public, anon;
grant execute on function public.admin_photo_queue() to authenticated;

-- Queued wording fix (v1.64): any authenticator app.
create or replace function public.delete_my_account(p_confirm_email text) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); em text;
begin
  if uid is null then raise exception 'Sign in first'; end if;
  if not public.mfa_ok() then raise exception 'Enter the code from your authenticator app first'; end if;
  select u.email into em from auth.users u where u.id = uid;
  if lower(trim(coalesce(p_confirm_email, ''))) <> lower(coalesce(em, '')) then raise exception 'Type your sign-in email exactly to confirm'; end if;
  if exists (select 1 from public.admins where user_id = uid) then raise exception 'Admins: ask another admin to remove your admin access first'; end if;
  insert into public.admin_audit (admin_id, admin_email, action, target_user, target_email, detail)
  values (uid, em, 'self_delete', uid, em, '{}'::jsonb);
  delete from auth.users where id = uid;   -- profiles, aircraft, checklists and recovery details are removed with it
end $$;
revoke all on function public.delete_my_account(text) from public, anon;
grant execute on function public.delete_my_account(text) to authenticated;

select 'profile photos ready' as result;

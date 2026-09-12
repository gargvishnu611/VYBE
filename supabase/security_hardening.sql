-- VYBE production security hardening
-- Run AFTER supabase/schema.sql in the Supabase SQL Editor.
-- This migration keeps the admin identity server-enforced and removes client/user write paths that could weaken catalogue security.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.id = auth.uid()
      and p.role = 'admin'
      and lower(coalesce(u.email, '')) = 'shivgarg597@gmail.com'
  );
$$;

-- One-time bootstrap for the single authorised admin identity.
-- The password is intentionally NOT stored in SQL, JavaScript, or GitHub.
create or replace function public.bootstrap_vybe_admin()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null or current_email <> 'shivgarg597@gmail.com' then
    return false;
  end if;

  insert into public.profiles (id, display_name, role)
  values (auth.uid(), split_part(current_email, '@', 1), 'admin')
  on conflict (id) do update
    set role = 'admin';

  return true;
end;
$$;

revoke all on function public.bootstrap_vybe_admin() from public;
grant execute on function public.bootstrap_vybe_admin() to authenticated;

-- Users must not be able to edit their own role. Profile management is admin-only for now.
drop policy if exists "profiles own update" on public.profiles;
drop policy if exists "profiles admin update" on public.profiles;
create policy "profiles admin update" on public.profiles
for update using (public.is_admin()) with check (public.is_admin());

-- Catalogue: public read only for published songs; all writes are admin-only.
drop policy if exists "admin songs insert" on public.songs;
drop policy if exists "admin songs update" on public.songs;
drop policy if exists "admin songs delete" on public.songs;
create policy "admin songs insert" on public.songs for insert with check (public.is_admin());
create policy "admin songs update" on public.songs for update using (public.is_admin()) with check (public.is_admin());
create policy "admin songs delete" on public.songs for delete using (public.is_admin());

-- Artists: public read; management is admin-only.
drop policy if exists "admin artists insert" on public.artists;
drop policy if exists "admin artists update" on public.artists;
drop policy if exists "admin artists delete" on public.artists;
create policy "admin artists insert" on public.artists for insert with check (public.is_admin());
create policy "admin artists update" on public.artists for update using (public.is_admin()) with check (public.is_admin());
create policy "admin artists delete" on public.artists for delete using (public.is_admin());

-- Requests: users may create requests, but only admin can moderate/delete them.
drop policy if exists "request owner update" on public.song_requests;
drop policy if exists "admin request update" on public.song_requests;
drop policy if exists "admin request delete" on public.song_requests;
create policy "admin request update" on public.song_requests for update using (public.is_admin()) with check (public.is_admin());
create policy "admin request delete" on public.song_requests for delete using (public.is_admin());

-- Submissions: public/owner read as defined by the base schema; only admin changes moderation state.
drop policy if exists "admin submission delete" on public.artist_submissions;
create policy "admin submission delete" on public.artist_submissions for delete using (public.is_admin());

-- Storage: public can read published asset buckets, but uploads/edits/deletes are admin-only.
drop policy if exists "authenticated upload music" on storage.objects;
drop policy if exists "owner can update uploads" on storage.objects;
drop policy if exists "admin upload assets" on storage.objects;
drop policy if exists "admin update assets" on storage.objects;
drop policy if exists "admin delete assets" on storage.objects;
create policy "admin upload assets" on storage.objects
for insert to authenticated
with check (public.is_admin() and bucket_id in ('music','artwork','artist-assets'));
create policy "admin update assets" on storage.objects
for update to authenticated
using (public.is_admin() and bucket_id in ('music','artwork','artist-assets'))
with check (public.is_admin() and bucket_id in ('music','artwork','artist-assets'));
create policy "admin delete assets" on storage.objects
for delete to authenticated
using (public.is_admin() and bucket_id in ('music','artwork','artist-assets'));

-- Prevent accidental direct execution by anonymous clients.
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

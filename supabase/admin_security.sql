-- VYBE admin security hardening
-- Run after supabase/schema.sql in Supabase SQL Editor.
-- The admin password is NEVER stored here or in GitHub.

-- Only this email is eligible to be an admin.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce((select email from auth.users where id = auth.uid()), '')) = 'shivgarg597@gmail.com'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin');
$$;

-- Existing profile self-update policy could otherwise allow role escalation.
drop policy if exists "profiles own update" on public.profiles;
create policy "profiles own update safe" on public.profiles
for update using (auth.uid() = id or public.is_admin())
with check (
  public.is_admin()
  or (auth.uid() = id and role = (select p.role from public.profiles p where p.id = auth.uid()))
);

-- Ensure the allow-listed email becomes admin on profile creation/update;
-- every other account is forced to a normal user role.
create or replace function public.enforce_vybe_admin_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(coalesce((select email from auth.users where id = new.id), '')) = 'shivgarg597@gmail.com' then
    new.role := 'admin';
  elsif new.role = 'admin' then
    new.role := 'user';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_vybe_admin_role on public.profiles;
create trigger enforce_vybe_admin_role
before insert or update on public.profiles
for each row execute procedure public.enforce_vybe_admin_role();

-- Lock music/artwork uploads to admin only. Public playback remains public for published assets.
drop policy if exists "authenticated upload music" on storage.objects;
drop policy if exists "owner can update uploads" on storage.objects;
create policy "admin upload VYBE assets" on storage.objects
for insert to authenticated
with check (
  bucket_id in ('music','artwork','artist-assets')
  and public.is_admin()
);
create policy "admin update VYBE assets" on storage.objects
for update to authenticated
using (bucket_id in ('music','artwork','artist-assets') and public.is_admin())
with check (bucket_id in ('music','artwork','artist-assets') and public.is_admin());
create policy "admin delete VYBE assets" on storage.objects
for delete to authenticated
using (bucket_id in ('music','artwork','artist-assets') and public.is_admin());

-- Admin-only catalogue management.
create policy "admin insert songs" on public.songs for insert with check (public.is_admin());
create policy "admin update songs" on public.songs for update using (public.is_admin()) with check (public.is_admin());
create policy "admin delete songs" on public.songs for delete using (public.is_admin());
create policy "admin insert artists" on public.artists for insert with check (public.is_admin());
create policy "admin update artists" on public.artists for update using (public.is_admin()) with check (public.is_admin());
create policy "admin delete artists" on public.artists for delete using (public.is_admin());
create policy "admin request moderation" on public.song_requests for update using (public.is_admin()) with check (public.is_admin());
create policy "admin submission read all" on public.artist_submissions for select using (public.is_admin() or owner_id = auth.uid());

-- Admins can create a profile for the allow-listed account; other users cannot create arbitrary profiles.
create policy "admin manage profiles" on public.profiles for all using (public.is_admin()) with check (public.is_admin());

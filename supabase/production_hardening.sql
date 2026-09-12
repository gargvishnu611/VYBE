-- VYBE production security hardening
-- Run AFTER the main VYBE schema in Supabase SQL Editor.
-- Safe to re-run.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_user not in ('postgres','supabase_admin') and not public.is_admin() then
    if new.role is distinct from old.role then
      raise exception 'Only an administrator may change account roles';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role
before update on public.profiles
for each row execute function public.protect_profile_role();

drop policy if exists "profiles own update" on public.profiles;
drop policy if exists "profiles own update safe" on public.profiles;
drop policy if exists "profiles admin update" on public.profiles;
create policy "profiles own update safe" on public.profiles
for update to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);
create policy "profiles admin update" on public.profiles
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admin songs insert" on public.songs;
drop policy if exists "admin songs update" on public.songs;
drop policy if exists "admin songs delete" on public.songs;
drop policy if exists "admin artists insert" on public.artists;
drop policy if exists "admin artists update" on public.artists;
drop policy if exists "admin artists delete" on public.artists;
create policy "admin songs insert" on public.songs for insert to authenticated with check (public.is_admin());
create policy "admin songs update" on public.songs for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin songs delete" on public.songs for delete to authenticated using (public.is_admin());
create policy "admin artists insert" on public.artists for insert to authenticated with check (public.is_admin());
create policy "admin artists update" on public.artists for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin artists delete" on public.artists for delete to authenticated using (public.is_admin());

drop policy if exists "request owner update" on public.song_requests;
drop policy if exists "requests admin update" on public.song_requests;
create policy "requests admin update" on public.song_requests
for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "requests admin delete" on public.song_requests
for delete to authenticated using (public.is_admin());

drop policy if exists "submissions admin update" on public.artist_submissions;
drop policy if exists "submissions admin delete" on public.artist_submissions;
create policy "submissions admin update" on public.artist_submissions
for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "submissions admin delete" on public.artist_submissions
for delete to authenticated using (public.is_admin());

drop policy if exists "authenticated upload music" on storage.objects;
drop policy if exists "authenticated upload own media" on storage.objects;
drop policy if exists "owner can update uploads" on storage.objects;
drop policy if exists "owner or admin update media" on storage.objects;
drop policy if exists "admin delete uploads" on storage.objects;
create policy "authenticated upload own media" on storage.objects
for insert to authenticated
with check (
  bucket_id in ('music','artwork','artist-assets')
  and (public.is_admin() or (storage.foldername(name))[1] = auth.uid()::text)
);
create policy "owner or admin update media" on storage.objects
for update to authenticated
using (public.is_admin() or owner_id = auth.uid() or (storage.foldername(name))[1] = auth.uid()::text)
with check (public.is_admin() or owner_id = auth.uid() or (storage.foldername(name))[1] = auth.uid()::text);
create policy "admin delete uploads" on storage.objects
for delete to authenticated using (public.is_admin());

revoke insert, update, delete on public.songs from anon, public;
revoke insert, update, delete on public.artists from anon, public;
revoke update, delete on public.artist_submissions from anon, public;

create index if not exists songs_publish_sort_idx on public.songs(status, published_at desc);
create index if not exists artists_name_idx on public.artists(lower(name));
create index if not exists requests_status_votes_idx on public.song_requests(status, votes desc);

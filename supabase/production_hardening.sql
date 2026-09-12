-- VYBE production security hardening
-- Run AFTER the main VYBE schema in Supabase SQL Editor.
-- This migration is safe to re-run.

-- Profiles: users can edit their profile fields, but cannot self-promote to admin/artist.
drop policy if exists "profiles own update" on public.profiles;
drop policy if exists "profiles own update safe" on public.profiles;
drop policy if exists "profiles admin update" on public.profiles;
create policy "profiles own update safe" on public.profiles
for update to authenticated
using (auth.uid() = id)
with check (
  auth.uid() = id
  and role = (select p.role from public.profiles p where p.id = auth.uid())
);
create policy "profiles admin update" on public.profiles
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Only admins may create/change/delete catalogue entries.
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

-- Requests: clients may create requests, but cannot alter vote counts or moderation status.
drop policy if exists "request owner update" on public.song_requests;
create policy "requests admin update" on public.song_requests
for update to authenticated
using (public.is_admin())
with check (public.is_admin());
create policy "requests admin delete" on public.song_requests
for delete to authenticated using (public.is_admin());

-- Storage: public read is intentional for published media, but uploads are scoped.
drop policy if exists "authenticated upload music" on storage.objects;
drop policy if exists "owner can update uploads" on storage.objects;
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

-- Prevent anonymous writes to sensitive objects by making the intended roles explicit.
revoke insert, update, delete on public.songs from anon, public;
revoke insert, update, delete on public.artists from anon, public;
revoke update, delete on public.artist_submissions from anon, public;

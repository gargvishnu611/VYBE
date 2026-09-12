-- VYBE database foundation for Supabase
-- Run this in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  username text unique,
  avatar_url text,
  role text not null default 'user' check (role in ('user','artist','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.artists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  name text not null,
  slug text unique not null,
  bio text,
  avatar_path text,
  website text,
  socials jsonb not null default '{}'::jsonb,
  genre text,
  language text,
  created_at timestamptz not null default now()
);

create table if not exists public.songs (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid references public.artists(id) on delete set null,
  title text not null,
  slug text unique not null,
  audio_path text,
  cover_path text,
  lyrics text,
  language text,
  genre text,
  mood text,
  tags text[] not null default '{}',
  bpm integer,
  duration_seconds integer,
  status text not null default 'draft' check (status in ('draft','submitted','published','unlisted','rejected')),
  source_type text not null default 'artist_upload' check (source_type in ('artist_upload','licensed_api','vybe_original','external')),
  source_url text,
  created_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.playlists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.playlist_songs (
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  song_id uuid not null references public.songs(id) on delete cascade,
  position integer not null default 0,
  added_at timestamptz not null default now(),
  primary key (playlist_id, song_id)
);

create table if not exists public.likes (
  user_id uuid not null references auth.users(id) on delete cascade,
  song_id uuid not null references public.songs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, song_id)
);

create table if not exists public.follows (
  user_id uuid not null references auth.users(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, artist_id)
);

create table if not exists public.listening_history (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade,
  song_id uuid references public.songs(id) on delete set null,
  played_seconds integer not null default 0,
  completed boolean not null default false,
  played_at timestamptz not null default now()
);

create table if not exists public.song_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  title text not null,
  artist text not null,
  reason text,
  region text,
  language text,
  votes integer not null default 1,
  status text not null default 'requested' check (status in ('requested','reviewing','approved','declined')),
  created_at timestamptz not null default now()
);

create table if not exists public.request_votes (
  request_id uuid not null references public.song_requests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (request_id, user_id)
);

create table if not exists public.artist_submissions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  artist_name text not null,
  contact_email text not null,
  song_title text not null,
  genre text,
  language text,
  description text,
  source_url text,
  audio_path text,
  artwork_path text,
  lyrics text,
  rights_confirmed boolean not null default false,
  status text not null default 'submitted' check (status in ('submitted','under_review','changes_required','approved','rejected')),
  reviewer_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists songs_status_idx on public.songs(status);
create index if not exists songs_title_idx on public.songs using gin (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(lyrics,'')));
create index if not exists requests_votes_idx on public.song_requests(votes desc);
create index if not exists history_user_idx on public.listening_history(user_id, played_at desc);

-- Automatically create a profile for every authenticated user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.email));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.artists enable row level security;
alter table public.songs enable row level security;
alter table public.playlists enable row level security;
alter table public.playlist_songs enable row level security;
alter table public.likes enable row level security;
alter table public.follows enable row level security;
alter table public.listening_history enable row level security;
alter table public.song_requests enable row level security;
alter table public.request_votes enable row level security;
alter table public.artist_submissions enable row level security;

-- Helper used only by policies. Admin email is stored in the JWT via the user's profile role.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

-- Profiles
create policy "profiles own read" on public.profiles for select using (auth.uid() = id or public.is_admin());
create policy "profiles own update" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- Public catalogue read for published tracks.
create policy "published songs are public" on public.songs for select using (status = 'published' or public.is_admin());
create policy "artists are public" on public.artists for select using (true);

-- Playlists and library
create policy "own playlists" on public.playlists for all using (auth.uid() = owner_id or public.is_admin()) with check (auth.uid() = owner_id or public.is_admin());
create policy "public playlists readable" on public.playlists for select using (is_public = true or auth.uid() = owner_id or public.is_admin());
create policy "own playlist songs" on public.playlist_songs for all using (exists (select 1 from public.playlists p where p.id = playlist_id and (p.owner_id = auth.uid() or public.is_admin()))) with check (exists (select 1 from public.playlists p where p.id = playlist_id and (p.owner_id = auth.uid() or public.is_admin())));
create policy "own likes" on public.likes for all using (auth.uid() = user_id or public.is_admin()) with check (auth.uid() = user_id or public.is_admin());
create policy "own follows" on public.follows for all using (auth.uid() = user_id or public.is_admin()) with check (auth.uid() = user_id or public.is_admin());
create policy "own history" on public.listening_history for all using (auth.uid() = user_id or public.is_admin()) with check (auth.uid() = user_id or public.is_admin());

-- Requests can be submitted publicly; only admins may modify moderation fields.
create policy "requests readable" on public.song_requests for select using (true);
create policy "requests insert" on public.song_requests for insert with check (user_id is null or user_id = auth.uid());
create policy "request owner update" on public.song_requests for update using (auth.uid() = user_id or public.is_admin()) with check (auth.uid() = user_id or public.is_admin());
create policy "request votes own" on public.request_votes for all using (auth.uid() = user_id or public.is_admin()) with check (auth.uid() = user_id or public.is_admin());

-- Artist submissions: anyone may submit metadata; audio uploads are handled by storage policies.
create policy "submissions insert" on public.artist_submissions for insert with check (owner_id is null or owner_id = auth.uid());
create policy "submissions own read" on public.artist_submissions for select using (owner_id = auth.uid() or public.is_admin());
create policy "submissions admin update" on public.artist_submissions for update using (public.is_admin()) with check (public.is_admin());

-- Storage buckets. Create them once; object-level policies below keep them practical for a public static site.
insert into storage.buckets (id, name, public) values ('music','music',true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('artwork','artwork',true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('artist-assets','artist-assets',true) on conflict (id) do nothing;

create policy "public read music" on storage.objects for select using (bucket_id in ('music','artwork','artist-assets'));
create policy "authenticated upload music" on storage.objects for insert to authenticated with check (bucket_id in ('music','artwork','artist-assets'));
create policy "owner can update uploads" on storage.objects for update to authenticated using (owner_id = auth.uid() or public.is_admin()) with check (owner_id = auth.uid() or public.is_admin());

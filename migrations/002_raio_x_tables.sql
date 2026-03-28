-- Enum definitions
create type public.persona_goal as enum ('sales', 'authority', 'growth');
create type public.media_type as enum ('IMAGE', 'CAROUSEL_ALBUM', 'VIDEO');
create type public.ig_connection_status as enum ('active', 'expired', 'disconnected');

-- instagram_connections table
create table public.instagram_connections (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  ig_user_id text not null,
  username text not null,
  access_token text not null,
  token_expires_at timestamp with time zone,
  status public.ig_connection_status default 'active' not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- brand_personas table
create table public.brand_personas (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  primary_goal public.persona_goal,
  content_niche text,
  tone_of_voice text,
  psychological_profile text,
  visual_preferences jsonb,
  last_analyzed_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- post_metrics table
create table public.post_metrics (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  ig_media_id text not null,
  media_type public.media_type not null,
  caption text,
  engagement_score numeric,
  metrics jsonb,
  posted_at timestamp with time zone not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS setup (Enable RLS on tables)
alter table public.instagram_connections enable row level security;
alter table public.brand_personas enable row level security;
alter table public.post_metrics enable row level security;

-- Policies for instagram_connections
create policy "Users can view their own Instagram connections." on public.instagram_connections
  for select using (auth.uid() = profile_id);

create policy "Users can insert their own Instagram connections." on public.instagram_connections
  for insert with check (auth.uid() = profile_id);

create policy "Users can update their own Instagram connections." on public.instagram_connections
  for update using (auth.uid() = profile_id);

-- Policies for brand_personas
create policy "Users can view their own brand personas." on public.brand_personas
  for select using (auth.uid() = profile_id);

create policy "Users can insert their own brand personas." on public.brand_personas
  for insert with check (auth.uid() = profile_id);

create policy "Users can update their own brand personas." on public.brand_personas
  for update using (auth.uid() = profile_id);

-- Policies for post_metrics
create policy "Users can view their own post metrics." on public.post_metrics
  for select using (auth.uid() = profile_id);

create policy "Users can insert their own post metrics." on public.post_metrics
  for insert with check (auth.uid() = profile_id);

create policy "Users can update their own post metrics." on public.post_metrics
  for update using (auth.uid() = profile_id);

-- Realtime Setup for brand_personas
alter publication supabase_realtime add table public.brand_personas;

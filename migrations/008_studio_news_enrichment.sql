alter table public.trend_topics
add column if not exists source_url text,
add column if not exists published_at timestamp with time zone,
add column if not exists source_type text default 'news';

create index if not exists idx_trend_topics_profile_created_at
  on public.trend_topics (profile_id, created_at desc);

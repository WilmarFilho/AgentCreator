-- Migration 006: Creator Objectives Table
-- Applied: 2026-03-31

CREATE TABLE public.creator_objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  business_type TEXT,
  target_audience TEXT,
  content_goals TEXT,
  monetization_strategy TEXT,
  brand_values TEXT,
  competitors TEXT,
  extra_notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  CONSTRAINT unique_profile_objectives UNIQUE (profile_id)
);

ALTER TABLE public.creator_objectives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own objectives"
  ON public.creator_objectives FOR ALL
  USING (true) WITH CHECK (true);

-- Migration: Create Competitor Analyses Table
-- Description: Table for caching OpenAI competitor strategy analyses to reduce redundant API calls and processing time.

CREATE TABLE IF NOT EXISTS public.competitor_analyses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  competitors_text TEXT NOT NULL,
  analysis_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Create a constraint so we don't duplicate the cache for the exact same competitors for the same profile
  CONSTRAINT unique_profile_competitors UNIQUE (profile_id, competitors_text)
);

-- Enable RLS (Row Level Security) - assuming profiles should only see their own analyses
ALTER TABLE public.competitor_analyses ENABLE ROW LEVEL SECURITY;

-- Policy to allow the service role to do everything
CREATE POLICY "Enable all access for service role" ON public.competitor_analyses
  AS PERMISSIVE FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy to allow authenticated users to view only their own profile's analyses if they query from client
CREATE POLICY "Users can view their own competitor analyses" ON public.competitor_analyses
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid()); -- Adjust the auth logic depending on how profile_id matches your users table

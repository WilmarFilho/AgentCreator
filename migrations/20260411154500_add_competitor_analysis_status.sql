-- Add competitor_analysis_status to track the scraping of competitor profiles
ALTER TABLE "public"."creator_objectives" 
ADD COLUMN IF NOT EXISTS "competitor_analysis_status" text DEFAULT 'idle'::text;

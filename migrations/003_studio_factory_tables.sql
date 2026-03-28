-- Migration: 003_studio_factory_tables
-- Creates tables for Intelligence (Trends) and Carousel Factory

-- 1. Trend Topics (Intelligence Phase)
CREATE TABLE IF NOT EXISTS public.trend_topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    source TEXT DEFAULT 'OpenAI AI Trend Suggestion',
    topic_title TEXT NOT NULL,
    context_summary TEXT NOT NULL,
    relevance_score INTEGER DEFAULT 85,
    status TEXT DEFAULT 'suggested', -- 'suggested', 'used'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.trend_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own trend topics"
    ON public.trend_topics
    FOR ALL
    USING (auth.uid() = profile_id);

-- 2. Design Templates
CREATE TABLE IF NOT EXISTS public.design_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    design_schema JSONB DEFAULT '{}'::jsonb,
    base_constraints JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true
);

-- Note: Design templates are global and readable by anyone connected to the app
ALTER TABLE public.design_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view design templates"
    ON public.design_templates
    FOR SELECT
    USING (true);

-- 3. Generated Carousels (Factory Phase)
CREATE TABLE IF NOT EXISTS public.generated_carousels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    trend_topic_id UUID REFERENCES public.trend_topics(id) ON DELETE SET NULL,
    template_id UUID REFERENCES public.design_templates(id),
    main_caption TEXT,
    status TEXT DEFAULT 'draft', -- 'draft', 'generating_copy', 'ready'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.generated_carousels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own generated carousels"
    ON public.generated_carousels
    FOR ALL
    USING (auth.uid() = profile_id);

-- Trigger for updated_at in generated_carousels
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.generated_carousels
  FOR EACH ROW EXECUTE PROCEDURE moddatetime (updated_at);

-- 4. Carousel Slides
CREATE TABLE IF NOT EXISTS public.carousel_slides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    carousel_id UUID NOT NULL REFERENCES public.generated_carousels(id) ON DELETE CASCADE,
    slide_order INTEGER NOT NULL,
    copy_text TEXT NOT NULL,
    ai_image_prompt TEXT,
    generated_image_url TEXT,
    final_render_url TEXT
);

ALTER TABLE public.carousel_slides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own carousel slides via cascade but let's be explicit"
    ON public.carousel_slides
    FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM public.generated_carousels gc 
        WHERE gc.id = carousel_id AND gc.profile_id = auth.uid()
      )
    );

-- Insert starting dummy Design Templates
INSERT INTO public.design_templates (id, name, design_schema)
VALUES
    (gen_random_uuid(), 'O Minimalista', '{"theme": "dark", "layout": "centered", "font": "Poppins"}'::jsonb),
    (gen_random_uuid(), 'O Noticiário', '{"theme": "light", "layout": "news", "font": "Inter"}'::jsonb),
    (gen_random_uuid(), 'O Criador Autoridade', '{"theme": "brand", "layout": "bold", "font": "Outfit"}'::jsonb)
ON CONFLICT DO NOTHING;

-- Migration 004: Enable pgvector and create RAG tables
-- Applied: 2026-03-31

-- 1. Habilitar pgvector para embeddings
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- 2. Tabela de conteúdo extraído por post (imagens, transcrições, etc.)
CREATE TABLE public.post_content_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_metric_id UUID NOT NULL REFERENCES public.post_metrics(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id),
  content_type TEXT NOT NULL CHECK (content_type IN ('caption', 'image_analysis', 'video_transcription')),
  content_text TEXT NOT NULL,
  media_url TEXT,
  slide_index INTEGER,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- 3. Tabela RAG com embeddings vetoriais
CREATE TABLE public.profile_rag_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id),
  source_type TEXT NOT NULL CHECK (source_type IN ('caption', 'image_analysis', 'video_transcription', 'persona_summary')),
  source_post_id UUID REFERENCES public.post_metrics(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  embedding extensions.vector(1536),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- 4. Índice HNSW para busca de similaridade rápida
CREATE INDEX idx_rag_embedding ON public.profile_rag_documents
  USING hnsw (embedding extensions.vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 5. Índice para filtrar por profile_id
CREATE INDEX idx_rag_profile ON public.profile_rag_documents(profile_id);

-- 6. Função de busca RAG por similaridade
CREATE OR REPLACE FUNCTION match_profile_documents(
  query_embedding extensions.vector(1536),
  match_profile_id UUID,
  match_count INT DEFAULT 10,
  match_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  source_type TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.content,
    d.source_type,
    d.metadata,
    (1 - (d.embedding <=> query_embedding))::FLOAT AS similarity
  FROM public.profile_rag_documents d
  WHERE d.profile_id = match_profile_id
    AND 1 - (d.embedding <=> query_embedding) > match_threshold
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 7. RLS policies
ALTER TABLE public.post_content_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_rag_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on post_content_analysis"
  ON public.post_content_analysis FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on profile_rag_documents"
  ON public.profile_rag_documents FOR ALL
  USING (true) WITH CHECK (true);

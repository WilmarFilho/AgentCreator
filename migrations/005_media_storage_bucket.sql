-- Migration 005: Add media storage bucket and columns
-- Applied: 2026-03-31

-- 1. Adicionar coluna media_storage_path no post_metrics para referenciar o arquivo no bucket
ALTER TABLE public.post_metrics ADD COLUMN IF NOT EXISTS media_storage_path TEXT;

-- 2. Adicionar coluna thumbnail_storage_path no post_metrics (para videos/carrosseis)
ALTER TABLE public.post_metrics ADD COLUMN IF NOT EXISTS thumbnail_storage_path TEXT;

-- 3. Adicionar coluna storage_path no post_content_analysis para slides de carrossel
ALTER TABLE public.post_content_analysis ADD COLUMN IF NOT EXISTS storage_path TEXT;

-- 4. Criar bucket de storage para mídias do raio-x
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('raio-x-media', 'raio-x-media', true, 52428800)
ON CONFLICT (id) DO NOTHING;

-- 5. Policy para permitir leitura pública do bucket
CREATE POLICY "Public read access for raio-x-media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'raio-x-media');

-- 6. Policy para permitir upload com service role
CREATE POLICY "Service role upload for raio-x-media"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'raio-x-media');

-- 7. Policy para permitir delete com service role
CREATE POLICY "Service role delete for raio-x-media"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'raio-x-media');

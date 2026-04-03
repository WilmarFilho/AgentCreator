-- Update brand_personas table with new Raio-X fields
alter table public.brand_personas
add column subnichos jsonb,
add column pontos_fortes jsonb,
add column pontos_fracos jsonb,
add column fator_viralizacao numeric,
add column publico_alvo text,
add column posicionamento text;

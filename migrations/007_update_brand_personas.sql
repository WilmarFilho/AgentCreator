-- Update brand_personas table with new Raio-X fields
alter table public.brand_personas
add column subnichos jsonb,
add column pontos_fortes jsonb,
add column pontos_fracos jsonb,
add column fator_viralizacao numeric,
add column publico_alvo text,
add column posicionamento text;
add column resumo_psicologico text;
add column nicho_principal text;

drop column primary_goal;
drop column content_niche;
drop column tone_of_voice;
drop column psychological_profile;
drop column visual_preferences;


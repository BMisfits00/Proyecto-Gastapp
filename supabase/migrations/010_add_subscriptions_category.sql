-- =============================================
-- GASTAPP - Migración 010
-- Agrega categoría de sistema: 'Suscripciones'
-- =============================================

INSERT INTO public.categories (id, user_id, name, type, icon, color)
SELECT gen_random_uuid(), NULL, 'Suscripciones', 'expense', 'repeat', '#8B5CF6'
WHERE NOT EXISTS (
  SELECT 1 FROM public.categories WHERE LOWER(name) = 'suscripciones' AND (user_id IS NULL)
);

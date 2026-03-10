-- =============================================
-- GASTAPP - Seed: categorías del sistema
-- Ejecutar después de las migraciones
-- =============================================

INSERT INTO public.categories (id, user_id, name, type, icon, color) VALUES
  -- GASTOS
  (gen_random_uuid(), NULL, 'Comida',       'expense', 'fast-food',    '#FF6B6B'),
  (gen_random_uuid(), NULL, 'Transporte',   'expense', 'car',          '#FFB347'),
  (gen_random_uuid(), NULL, 'Alquiler',     'expense', 'home',         '#FF8C94'),
  (gen_random_uuid(), NULL, 'Ocio',         'expense', 'game-controller','#C084FC'),
  (gen_random_uuid(), NULL, 'Servicios',    'expense', 'flash',        '#60A5FA'),
  (gen_random_uuid(), NULL, 'Compras',      'expense', 'bag',          '#F472B6'),
  (gen_random_uuid(), NULL, 'Salud',        'expense', 'medical',      '#34D399'),
  (gen_random_uuid(), NULL, 'Educación',    'expense', 'school',       '#818CF8'),
  (gen_random_uuid(), NULL, 'Otros gastos', 'expense', 'ellipsis',     '#94A3B8'),
  -- INGRESOS
  (gen_random_uuid(), NULL, 'Sueldo',       'income',  'briefcase',    '#00D4AA'),
  (gen_random_uuid(), NULL, 'Freelance',    'income',  'laptop',       '#4ADE80'),
  (gen_random_uuid(), NULL, 'Inversiones',  'income',  'trending-up',  '#FBBF24'),
  (gen_random_uuid(), NULL, 'Otros ingresos','income', 'add-circle',   '#A78BFA')
ON CONFLICT DO NOTHING;

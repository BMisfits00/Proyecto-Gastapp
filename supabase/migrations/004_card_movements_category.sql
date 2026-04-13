-- =============================================
-- Agrega category_id a card_movements
-- =============================================

ALTER TABLE public.card_movements
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_card_movements_category_id ON public.card_movements(category_id);

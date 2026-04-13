-- =============================================
-- Permite a cada usuario ocultar categorías del sistema (user_id IS NULL)
-- sin afectar a otros usuarios ni violar las políticas RLS existentes.
-- =============================================

CREATE TABLE IF NOT EXISTS public.user_hidden_categories (
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, category_id)
);

ALTER TABLE public.user_hidden_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own hidden categories"
  ON public.user_hidden_categories
  FOR ALL
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =============================================
-- GASTAPP - Migración 009
-- Restricción UNIQUE en credit_cards (account_id, user_id)
-- =============================================

-- Si existen duplicados previos, mantener el más recientemente sincronizado
DELETE FROM public.credit_cards a
USING public.credit_cards b
WHERE a.account_id = b.account_id
  AND a.user_id = b.user_id
  AND a.synced_at < b.synced_at;

-- Agregar restricción unique si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'credit_cards_account_user_key'
  ) THEN
    ALTER TABLE public.credit_cards
      ADD CONSTRAINT credit_cards_account_user_key UNIQUE (account_id, user_id);
  END IF;
END $$;

-- =============================================
-- GASTAPP - Funciones RPC
-- =============================================

-- Actualizar balance de cuenta al crear transacción
CREATE OR REPLACE FUNCTION public.update_account_balance(
  p_account_id UUID,
  p_delta DECIMAL
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.accounts
  SET balance = balance + p_delta,
      updated_at = NOW()
  WHERE id = p_account_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recalcular balance de cuenta sumando todas sus transacciones
CREATE OR REPLACE FUNCTION public.recalc_account_balance(p_account_id UUID)
RETURNS DECIMAL AS $$
DECLARE
  v_balance DECIMAL;
BEGIN
  SELECT
    COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0)
  INTO v_balance
  FROM public.transactions
  WHERE account_id = p_account_id;

  UPDATE public.accounts SET balance = v_balance WHERE id = p_account_id;
  RETURN v_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- GASTAPP - Migración 006: Sincronización Automática y Atómica de Saldos
-- ============================================================================
-- Resuelve BUG-001:
-- 1. Al crear una transacción (INSERT), actualiza el balance de la cuenta automáticamente.
-- 2. Al eliminar una transacción (DELETE), revierte el saldo de la cuenta automáticamente.
-- 3. Al modificar una transacción (UPDATE), ajusta diferencias de monto o traslada
--    el saldo si se cambió de cuenta de origen/destino.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_account_balance_on_transaction()
RETURNS TRIGGER AS $$
DECLARE
  v_old_effect DECIMAL(15,2);
  v_new_effect DECIMAL(15,2);
  v_diff       DECIMAL(15,2);
BEGIN
  -- --------------------------------------------------------------------------
  -- CASO 1: INSERT (Nuevo movimiento)
  -- --------------------------------------------------------------------------
  IF (TG_OP = 'INSERT') THEN
    v_new_effect := CASE 
      WHEN NEW.type = 'income' THEN NEW.amount
      ELSE -NEW.amount
    END;

    UPDATE public.accounts
    SET balance = balance + v_new_effect,
        updated_at = NOW()
    WHERE id = NEW.account_id;

    RETURN NEW;

  -- --------------------------------------------------------------------------
  -- CASO 2: DELETE (Eliminación de movimiento)
  -- --------------------------------------------------------------------------
  ELSIF (TG_OP = 'DELETE') THEN
    -- Invertir el efecto previo:
    -- Si era ingreso (+amount), restar (-amount)
    -- Si era gasto (-amount), sumar (+amount)
    v_old_effect := CASE
      WHEN OLD.type = 'income' THEN -OLD.amount
      ELSE OLD.amount
    END;

    UPDATE public.accounts
    SET balance = balance + v_old_effect,
        updated_at = NOW()
    WHERE id = OLD.account_id;

    RETURN OLD;

  -- --------------------------------------------------------------------------
  -- CASO 3: UPDATE (Edición de monto, tipo o cuenta)
  -- --------------------------------------------------------------------------
  ELSIF (TG_OP = 'UPDATE') THEN
    -- Subcaso A: La transacción se mantiene en la misma cuenta
    IF (OLD.account_id = NEW.account_id) THEN
      v_old_effect := CASE WHEN OLD.type = 'income' THEN OLD.amount ELSE -OLD.amount END;
      v_new_effect := CASE WHEN NEW.type = 'income' THEN NEW.amount ELSE -NEW.amount END;
      v_diff := v_new_effect - v_old_effect;

      IF (v_diff <> 0) THEN
        UPDATE public.accounts
        SET balance = balance + v_diff,
            updated_at = NOW()
        WHERE id = NEW.account_id;
      END IF;

    -- Subcaso B: La transacción se movió a otra cuenta diferente
    ELSE
      -- 1. Revertir impacto en la cuenta anterior
      v_old_effect := CASE WHEN OLD.type = 'income' THEN -OLD.amount ELSE OLD.amount END;
      UPDATE public.accounts
      SET balance = balance + v_old_effect,
          updated_at = NOW()
      WHERE id = OLD.account_id;

      -- 2. Aplicar impacto en la nueva cuenta
      v_new_effect := CASE WHEN NEW.type = 'income' THEN NEW.amount ELSE -NEW.amount END;
      UPDATE public.accounts
      SET balance = balance + v_new_effect,
          updated_at = NOW()
      WHERE id = NEW.account_id;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Eliminar trigger preexistente si existiera y recrear
DROP TRIGGER IF EXISTS trg_sync_account_balance ON public.transactions;

CREATE TRIGGER trg_sync_account_balance
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.sync_account_balance_on_transaction();

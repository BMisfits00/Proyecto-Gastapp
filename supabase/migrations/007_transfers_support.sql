-- ============================================================================
-- GASTAPP - Migración 007: Soporte Integral para Transferencias entre Cuentas
-- ============================================================================
-- Agrega columna 'to_account_id' y extiende el trigger 'trg_sync_account_balance'
-- para débitos y créditos atómicos simultáneos en transferencias.
-- ============================================================================

ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS to_account_id UUID REFERENCES public.accounts(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_transactions_to_account_id ON public.transactions(to_account_id);

CREATE OR REPLACE FUNCTION public.sync_account_balance_on_transaction()
RETURNS TRIGGER AS $$
DECLARE
  v_old_effect DECIMAL(15,2);
  v_new_effect DECIMAL(15,2);
  v_diff       DECIMAL(15,2);
BEGIN
  -- --------------------------------------------------------------------------
  -- CASO 1: INSERT
  -- --------------------------------------------------------------------------
  IF (TG_OP = 'INSERT') THEN
    IF (NEW.type = 'transfer') THEN
      -- Restar de cuenta origen
      UPDATE public.accounts
      SET balance = balance - NEW.amount, updated_at = NOW()
      WHERE id = NEW.account_id;

      -- Sumar a cuenta destino
      IF (NEW.to_account_id IS NOT NULL) THEN
        UPDATE public.accounts
        SET balance = balance + NEW.amount, updated_at = NOW()
        WHERE id = NEW.to_account_id;
      END IF;

    ELSE
      v_new_effect := CASE WHEN NEW.type = 'income' THEN NEW.amount ELSE -NEW.amount END;
      UPDATE public.accounts
      SET balance = balance + v_new_effect, updated_at = NOW()
      WHERE id = NEW.account_id;
    END IF;

    RETURN NEW;

  -- --------------------------------------------------------------------------
  -- CASO 2: DELETE
  -- --------------------------------------------------------------------------
  ELSIF (TG_OP = 'DELETE') THEN
    IF (OLD.type = 'transfer') THEN
      -- Revertir origen (sumar de vuelta)
      UPDATE public.accounts
      SET balance = balance + OLD.amount, updated_at = NOW()
      WHERE id = OLD.account_id;

      -- Revertir destino (restar)
      IF (OLD.to_account_id IS NOT NULL) THEN
        UPDATE public.accounts
        SET balance = balance - OLD.amount, updated_at = NOW()
        WHERE id = OLD.to_account_id;
      END IF;

    ELSE
      v_old_effect := CASE WHEN OLD.type = 'income' THEN -OLD.amount ELSE OLD.amount END;
      UPDATE public.accounts
      SET balance = balance + v_old_effect, updated_at = NOW()
      WHERE id = OLD.account_id;
    END IF;

    RETURN OLD;

  -- --------------------------------------------------------------------------
  -- CASO 3: UPDATE
  -- --------------------------------------------------------------------------
  ELSIF (TG_OP = 'UPDATE') THEN
    -- 1. Revertir impacto anterior
    IF (OLD.type = 'transfer') THEN
      UPDATE public.accounts SET balance = balance + OLD.amount, updated_at = NOW() WHERE id = OLD.account_id;
      IF (OLD.to_account_id IS NOT NULL) THEN
        UPDATE public.accounts SET balance = balance - OLD.amount, updated_at = NOW() WHERE id = OLD.to_account_id;
      END IF;
    ELSE
      v_old_effect := CASE WHEN OLD.type = 'income' THEN -OLD.amount ELSE OLD.amount END;
      UPDATE public.accounts SET balance = balance + v_old_effect, updated_at = NOW() WHERE id = OLD.account_id;
    END IF;

    -- 2. Aplicar nuevo impacto
    IF (NEW.type = 'transfer') THEN
      UPDATE public.accounts SET balance = balance - NEW.amount, updated_at = NOW() WHERE id = NEW.account_id;
      IF (NEW.to_account_id IS NOT NULL) THEN
        UPDATE public.accounts SET balance = balance + NEW.amount, updated_at = NOW() WHERE id = NEW.to_account_id;
      END IF;
    ELSE
      v_new_effect := CASE WHEN NEW.type = 'income' THEN NEW.amount ELSE -NEW.amount END;
      UPDATE public.accounts SET balance = balance + v_new_effect, updated_at = NOW() WHERE id = NEW.account_id;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

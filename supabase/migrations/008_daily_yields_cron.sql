-- ==============================================================================
-- MIGRACIÓN 008: Cron Job y Función para Procesamiento de Rendimientos Diarios
-- ==============================================================================

-- 1. Habilitar extensión pg_cron en Supabase
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Función almacenada que itera sobre cuentas remuneradas activas
CREATE OR REPLACE FUNCTION public.fn_process_daily_yields()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  v_yield_amount DECIMAL(15,2);
  v_processed_count INT := 0;
  v_today DATE := CURRENT_DATE;
BEGIN
  -- Iterar sobre cuentas activas con rendimiento diario habilitado y saldo positivo
  FOR rec IN
    SELECT a.id AS account_id, a.user_id, a.balance, a.daily_yield_rate
    FROM public.accounts a
    WHERE a.is_active = TRUE
      AND a.has_daily_yield = TRUE
      AND a.daily_yield_rate > 0
      AND a.balance > 0
  LOOP
    -- Verificar idempotencia: evitar duplicados si ya se procesó hoy
    IF NOT EXISTS (
      SELECT 1 FROM public.daily_yields dy
      WHERE dy.account_id = rec.account_id AND dy.date = v_today
    ) THEN
      v_yield_amount := ROUND((rec.balance * rec.daily_yield_rate)::numeric, 2);

      IF v_yield_amount > 0 THEN
        -- 1. Registrar en tabla de auditoría daily_yields
        INSERT INTO public.daily_yields (
          user_id,
          account_id,
          date,
          balance,
          yield_rate,
          yield_amount
        ) VALUES (
          rec.user_id,
          rec.account_id,
          v_today,
          rec.balance,
          rec.daily_yield_rate,
          v_yield_amount
        );

        -- 2. Insertar movimiento de ingreso (el trigger trg_sync_account_balance actualizará el saldo de la cuenta)
        INSERT INTO public.transactions (
          user_id,
          account_id,
          type,
          amount,
          currency,
          description,
          date
        ) VALUES (
          rec.user_id,
          rec.account_id,
          'income',
          v_yield_amount,
          'ARS',
          'Acreditación de rendimiento diario',
          v_today
        );

        v_processed_count := v_processed_count + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'status', 'success',
    'processed_accounts', v_processed_count,
    'date', v_today
  );
END;
$$;

-- 3. Programación del Cron Job en pg_cron
-- Desprogramar si ya existiera una versión previa del job
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-yields-job') THEN
    PERFORM cron.unschedule('daily-yields-job');
  END IF;
END $$;

-- Programar ejecución diaria a las 06:00 UTC (03:00 AM hora de Argentina)
SELECT cron.schedule(
  'daily-yields-job',
  '0 6 * * *',
  'SELECT public.fn_process_daily_yields();'
);

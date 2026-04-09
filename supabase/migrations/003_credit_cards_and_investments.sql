-- =============================================
-- GASTAPP - Migración 003
-- Tarjetas de crédito, movimientos de tarjeta
-- y extensión de inversiones (plazos fijos)
-- =============================================

-- =============================================
-- TABLA: credit_cards
-- Tarjetas ligadas a una cuenta bancaria
-- =============================================
CREATE TABLE IF NOT EXISTS public.credit_cards (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id       UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  last_digits      TEXT NOT NULL,
  brand            TEXT NOT NULL,
  product          TEXT,
  holder           TEXT,
  due_date         DATE,
  closing_date     TEXT,
  consumption_ars  DECIMAL(15,2) NOT NULL DEFAULT 0,
  consumption_usd  DECIMAL(15,2) NOT NULL DEFAULT 0,
  min_payment      DECIMAL(15,2) NOT NULL DEFAULT 0,
  available_ars    DECIMAL(15,2) NOT NULL DEFAULT 0,
  available_usd    DECIMAL(15,2) NOT NULL DEFAULT 0,
  synced_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_credit_cards_account_id ON public.credit_cards(account_id);
CREATE INDEX idx_credit_cards_user_id    ON public.credit_cards(user_id);

-- =============================================
-- TABLA: card_movements
-- Consumos individuales de la tarjeta
-- =============================================
CREATE TABLE IF NOT EXISTS public.card_movements (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id     UUID REFERENCES public.credit_cards(id) ON DELETE CASCADE NOT NULL,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date        DATE NOT NULL,
  merchant    TEXT NOT NULL,
  amount      DECIMAL(15,2) NOT NULL,
  currency    TEXT NOT NULL DEFAULT 'ARS',
  installment TEXT,
  type        TEXT NOT NULL CHECK (type IN ('credit', 'instalments', 'debit')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_card_movements_card_id ON public.card_movements(card_id);
CREATE INDEX idx_card_movements_user_id ON public.card_movements(user_id);
CREATE INDEX idx_card_movements_date    ON public.card_movements(date DESC);

-- =============================================
-- EXTENSIÓN: investments
-- Campos específicos de plazos fijos
-- =============================================
ALTER TABLE public.investments
  ADD COLUMN IF NOT EXISTS tna            DECIMAL(8,4),
  ADD COLUMN IF NOT EXISTS term_days      INTEGER,
  ADD COLUMN IF NOT EXISTS maturity_date  DATE,
  ADD COLUMN IF NOT EXISTS gain_amount    DECIMAL(15,2);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================
ALTER TABLE public.credit_cards   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own credit cards" ON public.credit_cards
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users manage own card movements" ON public.card_movements
  FOR ALL USING (user_id = auth.uid());

-- =============================================
-- TRIGGER updated_at en credit_cards
-- =============================================
CREATE TRIGGER set_updated_at_credit_cards
  BEFORE UPDATE ON public.credit_cards
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

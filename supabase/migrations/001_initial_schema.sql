-- =============================================
-- GASTAPP - Esquema inicial de base de datos
-- =============================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- TABLA: profiles
-- Extiende auth.users con datos del perfil
-- =============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name   TEXT,
  avatar_url  TEXT,
  currency    TEXT NOT NULL DEFAULT 'ARS',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- TABLA: categories
-- Categorías de transacciones (sistema + usuario)
-- =============================================
CREATE TABLE IF NOT EXISTS public.categories (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  icon        TEXT,
  color       TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_categories_user_id ON public.categories(user_id);
CREATE INDEX idx_categories_type    ON public.categories(type);

-- =============================================
-- TABLA: accounts
-- Cuentas financieras del usuario
-- =============================================
CREATE TABLE IF NOT EXISTS public.accounts (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name              TEXT NOT NULL,
  type              TEXT NOT NULL CHECK (type IN ('bank', 'virtual_wallet', 'cash')),
  provider          TEXT,
  balance           DECIMAL(15,2) NOT NULL DEFAULT 0,
  currency          TEXT NOT NULL DEFAULT 'ARS',
  color             TEXT,
  icon              TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  has_daily_yield   BOOLEAN NOT NULL DEFAULT FALSE,
  daily_yield_rate  DECIMAL(8,6) NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_accounts_user_id ON public.accounts(user_id);

-- =============================================
-- TABLA: transactions
-- Registro de ingresos y gastos
-- =============================================
CREATE TABLE IF NOT EXISTS public.transactions (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  account_id  UUID REFERENCES public.accounts(id) ON DELETE RESTRICT NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  type        TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  amount      DECIMAL(15,2) NOT NULL CHECK (amount > 0),
  currency    TEXT NOT NULL DEFAULT 'ARS',
  description TEXT,
  date        DATE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transactions_user_id    ON public.transactions(user_id);
CREATE INDEX idx_transactions_account_id ON public.transactions(account_id);
CREATE INDEX idx_transactions_category_id ON public.transactions(category_id);
CREATE INDEX idx_transactions_date       ON public.transactions(date DESC);
CREATE INDEX idx_transactions_type       ON public.transactions(type);

-- =============================================
-- TABLA: investments
-- Inversiones del usuario
-- =============================================
CREATE TABLE IF NOT EXISTS public.investments (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  account_id      UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  name            TEXT NOT NULL,
  initial_amount  DECIMAL(15,2) NOT NULL CHECK (initial_amount >= 0),
  current_amount  DECIMAL(15,2) NOT NULL CHECK (current_amount >= 0),
  currency        TEXT NOT NULL DEFAULT 'ARS',
  started_at      DATE NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_investments_user_id ON public.investments(user_id);

-- =============================================
-- TABLA: daily_yields
-- Rendimientos diarios de billeteras virtuales
-- =============================================
CREATE TABLE IF NOT EXISTS public.daily_yields (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  account_id   UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  date         DATE NOT NULL,
  balance      DECIMAL(15,2) NOT NULL,
  yield_rate   DECIMAL(8,6) NOT NULL,
  yield_amount DECIMAL(15,2) NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, date)
);

CREATE INDEX idx_daily_yields_user_id    ON public.daily_yields(user_id);
CREATE INDEX idx_daily_yields_account_id ON public.daily_yields(account_id);
CREATE INDEX idx_daily_yields_date       ON public.daily_yields(date DESC);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

ALTER TABLE public.profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_yields ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "Users can view own profile"   ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- categories (sistema + propias)
CREATE POLICY "Users see system and own categories" ON public.categories
  FOR SELECT USING (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "Users manage own categories" ON public.categories
  FOR ALL USING (user_id = auth.uid());

-- accounts
CREATE POLICY "Users manage own accounts" ON public.accounts
  FOR ALL USING (user_id = auth.uid());

-- transactions
CREATE POLICY "Users manage own transactions" ON public.transactions
  FOR ALL USING (user_id = auth.uid());

-- investments
CREATE POLICY "Users manage own investments" ON public.investments
  FOR ALL USING (user_id = auth.uid());

-- daily_yields
CREATE POLICY "Users manage own daily yields" ON public.daily_yields
  FOR ALL USING (user_id = auth.uid());

-- =============================================
-- FUNCIÓN: actualizar updated_at automáticamente
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_accounts
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_transactions
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================
-- FUNCIÓN: crear perfil automático al registrarse
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- QUERIES ÚTILES (comentadas como referencia)
-- =============================================

-- Ahorro mensual:
-- SELECT
--   DATE_TRUNC('month', date) AS month,
--   SUM(CASE WHEN type='income'  THEN amount ELSE 0 END) AS income,
--   SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) AS expenses,
--   SUM(CASE WHEN type='income'  THEN amount ELSE -amount END) AS savings
-- FROM transactions WHERE user_id = $1
-- GROUP BY 1 ORDER BY 1 DESC;

-- Gastos por categoría (mes actual):
-- SELECT c.name, c.color, SUM(t.amount) AS total,
--   ROUND(SUM(t.amount)*100.0/SUM(SUM(t.amount)) OVER(),2) AS pct
-- FROM transactions t JOIN categories c ON t.category_id=c.id
-- WHERE t.user_id=$1 AND t.type='expense'
--   AND DATE_TRUNC('month',t.date)=DATE_TRUNC('month',CURRENT_DATE)
-- GROUP BY c.id ORDER BY total DESC;

-- Tasa de ahorro mensual:
-- SELECT ROUND((1 - SUM(CASE WHEN type='expense' THEN amount ELSE 0 END)
--   / NULLIF(SUM(CASE WHEN type='income' THEN amount ELSE 0 END),0))*100, 2)
-- FROM transactions WHERE user_id=$1
--   AND DATE_TRUNC('month',date)=DATE_TRUNC('month',CURRENT_DATE);

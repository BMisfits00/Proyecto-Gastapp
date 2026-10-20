// =============================================
// @gastapp/shared — Tipos compartidos entre
// la app mobile (Expo) y la web (Next.js)
// =============================================

export type AccountType      = 'bank' | 'virtual_wallet' | 'cash';
export type TransactionType  = 'income' | 'expense' | 'transfer';
export type CategoryType     = 'income' | 'expense';
export type CardMovementType = 'credit' | 'instalments' | 'debit';

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  provider: string | null;
  balance: number;
  currency: string;
  color: string | null;
  icon: string | null;
  is_active: boolean;
  has_daily_yield: boolean;
  daily_yield_rate: number;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  user_id: string | null;
  name: string;
  type: CategoryType;
  icon: string | null;
  color: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  account_id: string;
  to_account_id?: string | null;
  category_id: string | null;
  type: TransactionType;
  amount: number;
  currency: string;
  description: string | null;
  date: string;
  created_at: string;
  updated_at: string;
  // Joined
  account?: Account;
  to_account?: Account;
  category?: Category;
}

export interface Investment {
  id: string;
  user_id: string;
  account_id: string;
  name: string;
  type?: string;
  initial_amount: number;
  current_amount?: number;
  amount?: number;
  currency: string;
  yield_rate?: number | null;
  tna?: number | null;
  term_days?: number | null;
  start_date?: string;
  started_at?: string;
  end_date?: string | null;
  maturity_date?: string | null;
  gain_amount?: number | null;
  is_active?: boolean;
  created_at: string;
  account?: Account;
}

export interface CreditCard {
  id: string;
  user_id: string;
  account_id: string;
  last_digits: string;
  brand: string;
  product_name: string | null;
  product?: string | null;
  holder_name: string | null;
  holder?: string | null;
  due_date: string | null;
  closing_date: string | null;
  period_expenses_ars: number;
  consumption_ars?: number;
  period_expenses_usd: number;
  consumption_usd?: number;
  min_payment: number;
  available_credit: number;
  available_ars?: number;
  synced_at: string;
  created_at: string;
  updated_at: string;
  account?: Account;
}

export interface CardMovement {
  id: string;
  credit_card_id: string;
  user_id: string;
  date: string;
  merchant: string;
  amount: number;
  currency: string;
  installment: string | null;
  type: CardMovementType;
  category_id?: string | null;
  created_at: string;
  category?: Category;
}

// Métricas financieras calculadas (client-side)
export interface FinancialMetrics {
  totalBalance: number;
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
  savingsRate: number;
  leisureRatio: number;
}

export interface CategoryExpense {
  category_id: string;
  category_name: string;
  category_color: string;
  total: number;
  percentage: number;
}

export interface MonthlyData {
  month: string;
  label: string;
  income: number;
  expenses: number;
  savings: number;
}

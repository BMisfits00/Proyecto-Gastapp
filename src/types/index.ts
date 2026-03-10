// =============================================
// GASTAPP - Tipos TypeScript globales
// =============================================

export type AccountType = 'bank' | 'virtual_wallet' | 'cash';
export type TransactionType = 'income' | 'expense' | 'transfer';
export type CategoryType = 'income' | 'expense';

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  currency: string;
  created_at: string;
  updated_at: string;
}

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
  category?: Category;
}

export interface Investment {
  id: string;
  user_id: string;
  account_id: string;
  name: string;
  initial_amount: number;
  current_amount: number;
  currency: string;
  started_at: string;
  created_at: string;
  updated_at: string;
}

export interface DailyYield {
  id: string;
  user_id: string;
  account_id: string;
  date: string;
  balance: number;
  yield_rate: number;
  yield_amount: number;
  created_at: string;
}

export interface FinancialMetrics {
  totalBalance: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  savingsRate: number;
  leisureRatio: number;
  netSavings: number;
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

// Form types
export interface CreateTransactionInput {
  account_id: string;
  category_id: string | null;
  type: TransactionType;
  amount: number;
  currency: string;
  description: string;
  date: string;
}

export interface CreateAccountInput {
  name: string;
  type: AccountType;
  provider: string;
  balance: number;
  currency: string;
  color: string;
  has_daily_yield: boolean;
  daily_yield_rate: number;
}

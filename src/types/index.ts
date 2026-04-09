// =============================================
// GASTAPP Mobile — Tipos TypeScript
// Los tipos de dominio vienen de @gastapp/shared.
// Aquí solo se agregan tipos específicos de la app mobile.
// =============================================

export type {
  AccountType,
  TransactionType,
  CategoryType,
  CardMovementType,
  Account,
  Category,
  Transaction,
  Investment,
  CreditCard,
  CardMovement,
  FinancialMetrics,
  CategoryExpense,
  MonthlyData,
} from '@gastapp/shared';

// ─── Tipos específicos de la app mobile ──────────────────────────────────────

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  currency: string;
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

// Form types
export interface CreateTransactionInput {
  account_id: string;
  category_id: string | null;
  type: import('@gastapp/shared').TransactionType;
  amount: number;
  currency: string;
  description: string;
  date: string;
}

export interface CreateAccountInput {
  name: string;
  type: import('@gastapp/shared').AccountType;
  provider: string;
  balance: number;
  currency: string;
  color: string;
  has_daily_yield: boolean;
  daily_yield_rate: number;
}

import { Transaction, CategoryExpense, MonthlyData } from '../types';

// Calcula la tasa de ahorro mensual (0-100)
export function calcSavingsRate(income: number, expenses: number): number {
  if (income <= 0) return 0;
  return Math.max(0, Math.round(((income - expenses) / income) * 100));
}

// Calcula el ratio de gastos en ocio (0-100)
export function calcLeisureRatio(
  transactions: Transaction[],
  leisureCategoryName = 'Ocio'
): number {
  const expenses = transactions.filter((t) => t.type === 'expense');
  const total = expenses.reduce((sum, t) => sum + t.amount, 0);
  const leisure = expenses
    .filter((t) => t.category?.name === leisureCategoryName)
    .reduce((sum, t) => sum + t.amount, 0);
  if (total <= 0) return 0;
  return Math.round((leisure / total) * 100);
}

// Agrupa gastos por categoría con porcentaje
export function calcExpensesByCategory(
  transactions: Transaction[]
): CategoryExpense[] {
  const expenses = transactions.filter((t) => t.type === 'expense' && t.category);
  const total = expenses.reduce((sum, t) => sum + t.amount, 0);

  const map = new Map<string, CategoryExpense>();
  for (const t of expenses) {
    const cat = t.category!;
    const existing = map.get(cat.id);
    if (existing) {
      existing.total += t.amount;
    } else {
      map.set(cat.id, {
        category_id: cat.id,
        category_name: cat.name,
        category_color: cat.color ?? '#7B68EE',
        total: t.amount,
        percentage: 0,
      });
    }
  }

  return Array.from(map.values())
    .map((c) => ({
      ...c,
      percentage: total > 0 ? Math.round((c.total / total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

// Agrupa transacciones por mes para el gráfico de evolución
export function calcMonthlyData(
  transactions: Transaction[],
  months = 6
): MonthlyData[] {
  const result: MonthlyData[] = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    const monthly = transactions.filter((t) => t.date.startsWith(key));
    const income = monthly
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    const expenses = monthly
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    result.push({
      month: key,
      label: d.toLocaleDateString('es-AR', { month: 'short' }),
      income,
      expenses,
      savings: income - expenses,
    });
  }

  return result;
}

import { useMemo } from 'react';
import { Transaction } from '../types';
import { calcSavingsRate, calcLeisureRatio, calcExpensesByCategory, calcMonthlyData } from '../utils/calculations';

export function useMetrics(transactions: Transaction[] | undefined) {
  return useMemo(() => {
    if (!transactions || transactions.length === 0) {
      return {
        monthlyIncome: 0,
        monthlyExpenses: 0,
        savingsRate: 0,
        leisureRatio: 0,
        netSavings: 0,
        expensesByCategory: [],
      };
    }

    const income = transactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const expenses = transactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      monthlyIncome: income,
      monthlyExpenses: expenses,
      savingsRate: calcSavingsRate(income, expenses),
      leisureRatio: calcLeisureRatio(transactions),
      netSavings: income - expenses,
      expensesByCategory: calcExpensesByCategory(transactions),
    };
  }, [transactions]);
}

export function useMonthlyChartData(transactions: Transaction[] | undefined) {
  return useMemo(() => {
    if (!transactions) return [];
    return calcMonthlyData(transactions, 6);
  }, [transactions]);
}

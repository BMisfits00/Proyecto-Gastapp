import {
  calcSavingsRate,
  calcLeisureRatio,
  calcExpensesByCategory,
  calcMonthlyData,
} from '../calculations';
import { Transaction } from '../../types';

describe('Financial Calculations — Unit Test Suite', () => {
  describe('calcSavingsRate (TC-LED / TC-EDG)', () => {
    it('debe calcular correctamente la tasa de ahorro estándar', () => {
      expect(calcSavingsRate(100000, 60000)).toBe(40);
      expect(calcSavingsRate(200000, 150000)).toBe(25);
    });

    it('debe retornar 0 si los gastos superan o igualan a los ingresos', () => {
      expect(calcSavingsRate(50000, 60000)).toBe(0);
      expect(calcSavingsRate(50000, 50000)).toBe(0);
    });

    it('debe retornar 0 si los ingresos son cero o negativos (caso borde TC-EDG-01)', () => {
      expect(calcSavingsRate(0, 10000)).toBe(0);
      expect(calcSavingsRate(-5000, 10000)).toBe(0);
    });
  });

  describe('calcLeisureRatio', () => {
    it('debe calcular el porcentaje de gastos en ocio sobre el total de gastos', () => {
      const mockTransactions: Transaction[] = [
        {
          id: '1',
          user_id: 'u1',
          account_id: 'a1',
          category_id: 'c1',
          type: 'expense',
          amount: 20000,
          currency: 'ARS',
          description: 'Cine',
          date: '2026-10-15',
          created_at: '',
          updated_at: '',
          category: { id: 'c1', user_id: null, name: 'Ocio', type: 'expense', color: '#fff', icon: 'film', is_active: true, created_at: '' },
        },
        {
          id: '2',
          user_id: 'u1',
          account_id: 'a1',
          category_id: 'c2',
          type: 'expense',
          amount: 80000,
          currency: 'ARS',
          description: 'Supermercado',
          date: '2026-10-16',
          created_at: '',
          updated_at: '',
          category: { id: 'c2', user_id: null, name: 'Alimentación', type: 'expense', color: '#fff', icon: 'cart', is_active: true, created_at: '' },
        },
      ];

      expect(calcLeisureRatio(mockTransactions)).toBe(20);
    });

    it('debe retornar 0 si no hay gastos', () => {
      expect(calcLeisureRatio([])).toBe(0);
    });
  });

  describe('calcExpensesByCategory (TC-EDG-05)', () => {
    it('debe agrupar gastos por categoría y ordenar de mayor a menor', () => {
      const mockTransactions: Transaction[] = [
        {
          id: '1',
          user_id: 'u1',
          account_id: 'a1',
          category_id: 'c1',
          type: 'expense',
          amount: 15000,
          currency: 'ARS',
          description: '',
          date: '2026-10-10',
          created_at: '',
          updated_at: '',
          category: { id: 'c1', user_id: null, name: 'Comida', type: 'expense', color: '#f00', icon: 'fast-food', is_active: true, created_at: '' },
        },
        {
          id: '2',
          user_id: 'u1',
          account_id: 'a1',
          category_id: 'c1',
          type: 'expense',
          amount: 35000,
          currency: 'ARS',
          description: '',
          date: '2026-10-12',
          created_at: '',
          updated_at: '',
          category: { id: 'c1', user_id: null, name: 'Comida', type: 'expense', color: '#f00', icon: 'fast-food', is_active: true, created_at: '' },
        },
        {
          id: '3',
          user_id: 'u1',
          account_id: 'a1',
          category_id: 'c2',
          type: 'expense',
          amount: 50000,
          currency: 'ARS',
          description: '',
          date: '2026-10-14',
          created_at: '',
          updated_at: '',
          category: { id: 'c2', user_id: null, name: 'Alquiler', type: 'expense', color: '#00f', icon: 'home', is_active: true, created_at: '' },
        },
      ];

      const result = calcExpensesByCategory(mockTransactions);
      expect(result).toHaveLength(2);
      expect(result[0].total).toBe(50000);
      expect(result[0].percentage).toBe(50);
      expect(result[1].total).toBe(50000);
      expect(result[1].percentage).toBe(50);
    });
  });

  describe('calcMonthlyData (TC-EDG-03 / Fechas)', () => {
    it('debe generar exactamente N meses en el histórico', () => {
      const result = calcMonthlyData([], 6);
      expect(result).toHaveLength(6);
      expect(result[5].month).toMatch(/^\d{4}-\d{2}$/);
    });
  });
});

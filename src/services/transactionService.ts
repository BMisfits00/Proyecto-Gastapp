import { supabase } from '../lib/supabase';
import { Transaction, CreateTransactionInput } from '../types';

export const transactionService = {
  // Obtener transacciones del mes actual
  async getMonthly(userId: string, year: number, month: number): Promise<Transaction[]> {
    const from = `${year}-${String(month).padStart(2, '0')}-01`;
    const to = new Date(year, month, 0).toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('transactions')
      .select('*, account:accounts(id,name,color,currency), category:categories(id,name,color,icon)')
      .eq('user_id', userId)
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: false });

    if (error) throw error;
    return data as Transaction[];
  },

  // Obtener todas las transacciones con paginación
  async getAll(userId: string, page = 0, pageSize = 20): Promise<Transaction[]> {
    const { data, error } = await supabase
      .from('transactions')
      .select('*, account:accounts(id,name,color,currency), category:categories(id,name,color,icon)')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) throw error;
    return data as Transaction[];
  },

  // Crear transacción
  async create(userId: string, input: CreateTransactionInput): Promise<Transaction> {
    const { data, error } = await supabase
      .from('transactions')
      .insert({ ...input, user_id: userId })
      .select('*, account:accounts(id,name,color,currency), category:categories(id,name,color,icon)')
      .single();

    if (error) throw error;

    // Actualizar balance de cuenta
    const delta = input.type === 'income' ? input.amount : -input.amount;
    await supabase.rpc('update_account_balance', {
      p_account_id: input.account_id,
      p_delta: delta,
    });

    return data as Transaction;
  },

  // Eliminar transacción
  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (error) throw error;
  },

  // Obtener últimos 6 meses (para gráficos)
  async getLast6Months(userId: string): Promise<Transaction[]> {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    const from = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, '0')}-01`;

    const { data, error } = await supabase
      .from('transactions')
      .select('*, category:categories(id,name,color,icon)')
      .eq('user_id', userId)
      .gte('date', from)
      .order('date', { ascending: true });

    if (error) throw error;
    return data as Transaction[];
  },
};

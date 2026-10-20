import { supabase } from '../lib/supabase';
import { Transaction, CreateTransactionInput } from '../types';

export const transactionService = {
  // Obtener transacciones del mes actual de forma determinista (sin desfase horario)
  async getMonthly(userId: string, year: number, month: number): Promise<Transaction[]> {
    const padMonth = String(month).padStart(2, '0');
    const from = `${year}-${padMonth}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const to = `${year}-${padMonth}-${String(lastDay).padStart(2, '0')}`;

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

  // Crear transacción (el trigger en DB 'trg_sync_account_balance' actualiza el saldo de forma atómica)
  async create(userId: string, input: CreateTransactionInput): Promise<Transaction> {
    const { data, error } = await supabase
      .from('transactions')
      .insert({ ...input, user_id: userId })
      .select('*, account:accounts(id,name,color,currency), category:categories(id,name,color,icon)')
      .single();

    if (error) throw error;
    return data as Transaction;
  },

  // Actualizar transacción (el trigger en DB sincroniza diferencias de saldo o cambio de cuenta)
  async update(id: string, input: Partial<CreateTransactionInput>): Promise<Transaction> {
    const { data, error } = await supabase
      .from('transactions')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*, account:accounts(id,name,color,currency), category:categories(id,name,color,icon)')
      .single();

    if (error) throw error;
    return data as Transaction;
  },

  // Eliminar transacción (el trigger en DB 'trg_sync_account_balance' revierte el saldo automáticamente)
  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (error) throw error;
  },

  // Obtener últimos 6 meses (para gráficos) sin rollover de fin de mes
  async getLast6Months(userId: string): Promise<Transaction[]> {
    const now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth() - 5; // 0-indexed
    if (month < 0) {
      year -= 1;
      month += 12;
    }
    const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;

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

import { supabase } from '../lib/supabase';
import { Account, CreateAccountInput } from '../types';

export const accountService = {
  async getAll(userId: string): Promise<Account[]> {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data as Account[];
  },

  async create(userId: string, input: CreateAccountInput): Promise<Account> {
    const { data, error } = await supabase
      .from('accounts')
      .insert({ ...input, user_id: userId })
      .select()
      .single();

    if (error) throw error;
    return data as Account;
  },

  async update(id: string, input: Partial<CreateAccountInput>): Promise<Account> {
    const { data, error } = await supabase
      .from('accounts')
      .update(input)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Account;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('accounts')
      .update({ is_active: false })
      .eq('id', id);
    if (error) throw error;
  },

  // Balance total sumando todas las cuentas
  getTotalBalance(accounts: Account[]): number {
    return accounts.reduce((sum, a) => sum + a.balance, 0);
  },
};

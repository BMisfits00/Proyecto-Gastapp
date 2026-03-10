import { supabase } from '../lib/supabase';
import { Category } from '../types';

export const categoryService = {
  async getAll(userId: string): Promise<Category[]> {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .or(`user_id.is.null,user_id.eq.${userId}`)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) throw error;
    return data as Category[];
  },

  async create(userId: string, name: string, type: 'income' | 'expense', color: string): Promise<Category> {
    const { data, error } = await supabase
      .from('categories')
      .insert({ user_id: userId, name, type, color })
      .select()
      .single();

    if (error) throw error;
    return data as Category;
  },
};

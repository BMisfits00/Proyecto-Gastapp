import { supabase } from '../lib/supabase';
import { Category } from '../types';

export const categoryService = {
  async getAll(userId: string): Promise<Category[]> {
    const { data: hidden } = await supabase
      .from('user_hidden_categories')
      .select('category_id')
      .eq('user_id', userId);

    const hiddenIds = (hidden ?? []).map((h: { category_id: string }) => h.category_id);

    let query = supabase
      .from('categories')
      .select('*')
      .or(`user_id.is.null,user_id.eq.${userId}`)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (hiddenIds.length > 0) {
      query = query.not('id', 'in', `(${hiddenIds.join(',')})`);
    }

    const { data, error } = await query;
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

  async hide(userId: string, categoryId: string): Promise<void> {
    const { error } = await supabase
      .from('user_hidden_categories')
      .upsert({ user_id: userId, category_id: categoryId });
    if (error) throw error;
  },

  async unhide(userId: string, categoryId: string): Promise<void> {
    const { error } = await supabase
      .from('user_hidden_categories')
      .delete()
      .eq('user_id', userId)
      .eq('category_id', categoryId);
    if (error) throw error;
  },

  async delete(userId: string, categoryId: string): Promise<void> {
    // Solo se pueden eliminar categorías propias del usuario (user_id = userId).
    // Las del sistema (user_id IS NULL) se ocultan con hide().
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', categoryId)
      .eq('user_id', userId);
    if (error) throw error;
  },
};

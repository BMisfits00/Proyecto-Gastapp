import { supabase } from '../lib/supabase';
import { CreditCard, CardMovement } from '../types';

export const creditCardService = {
  async getByAccount(accountId: string): Promise<CreditCard | null> {
    const { data, error } = await supabase
      .from('credit_cards')
      .select('*')
      .eq('account_id', accountId)
      .maybeSingle();

    if (error) throw error;
    return data as CreditCard | null;
  },

  async getMovements(cardId: string): Promise<CardMovement[]> {
    const { data, error } = await supabase
      .from('card_movements')
      .select('*, category:categories(id,name,color,icon)')
      .eq('card_id', cardId)
      .order('date', { ascending: false });

    if (error) throw error;
    return data as CardMovement[];
  },

  async assignCategory(
    movementId: string,
    categoryId: string | null,
    merchant: string,
    cardId: string,
  ): Promise<void> {
    const { error } = await supabase
      .from('card_movements')
      .update({ category_id: categoryId })
      .eq('id', movementId);
    if (error) throw error;

    // Auto-asignar la misma categoría a movimientos del mismo comercio sin categoría
    if (categoryId) {
      const { error: err2 } = await supabase
        .from('card_movements')
        .update({ category_id: categoryId })
        .eq('card_id', cardId)
        .eq('merchant', merchant)
        .is('category_id', null);
      if (err2) throw err2;
    }
  },

  async upsertCard(
    userId: string,
    accountId: string,
    card: Omit<CreditCard, 'id' | 'user_id' | 'account_id' | 'created_at' | 'updated_at'>
  ): Promise<CreditCard> {
    const existing = await this.getByAccount(accountId);

    if (existing) {
      const { data, error } = await supabase
        .from('credit_cards')
        .update({ ...card, synced_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      return data as CreditCard;
    }

    const { data, error } = await supabase
      .from('credit_cards')
      .insert({ ...card, user_id: userId, account_id: accountId })
      .select()
      .single();
    if (error) throw error;
    return data as CreditCard;
  },

  async replaceMovements(
    userId: string,
    cardId: string,
    movements: Omit<CardMovement, 'id' | 'card_id' | 'user_id' | 'created_at'>[]
  ): Promise<void> {
    await supabase.from('card_movements').delete().eq('card_id', cardId);

    if (movements.length === 0) return;

    const rows = movements.map((m) => ({ ...m, card_id: cardId, user_id: userId }));
    const { error } = await supabase.from('card_movements').insert(rows);
    if (error) throw error;
  },
};

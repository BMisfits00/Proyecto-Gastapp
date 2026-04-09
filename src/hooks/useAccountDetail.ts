import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { creditCardService } from '../services/creditCardService';
import { Transaction, Investment, CreditCard, CardMovement } from '../types';
import { useAuthContext } from '../contexts/AuthContext';

// Transacciones filtradas por cuenta
export function useAccountTransactions(accountId: string, type?: 'income' | 'expense') {
  const { user } = useAuthContext();

  return useQuery({
    queryKey: ['account-transactions', accountId, type],
    queryFn: async (): Promise<Transaction[]> => {
      let query = supabase
        .from('transactions')
        .select('*, category:categories(id,name,color,icon)')
        .eq('account_id', accountId)
        .eq('user_id', user!.id)
        .order('date', { ascending: false });

      if (type) query = query.eq('type', type);

      const { data, error } = await query;
      if (error) throw error;
      return data as Transaction[];
    },
    enabled: !!user && !!accountId,
  });
}

// Tarjeta de crédito de la cuenta
export function useAccountCreditCard(accountId: string) {
  return useQuery({
    queryKey: ['credit-card', accountId],
    queryFn: () => creditCardService.getByAccount(accountId),
    enabled: !!accountId,
  });
}

// Movimientos de tarjeta
export function useCardMovements(cardId: string | undefined) {
  return useQuery({
    queryKey: ['card-movements', cardId],
    queryFn: () => creditCardService.getMovements(cardId!),
    enabled: !!cardId,
  });
}

// Inversiones (plazos fijos) de la cuenta
export function useAccountInvestments(accountId: string) {
  const { user } = useAuthContext();

  return useQuery({
    queryKey: ['account-investments', accountId],
    queryFn: async (): Promise<Investment[]> => {
      const { data, error } = await supabase
        .from('investments')
        .select('*')
        .eq('account_id', accountId)
        .eq('user_id', user!.id)
        .order('started_at', { ascending: false });

      if (error) throw error;
      return data as Investment[];
    },
    enabled: !!user && !!accountId,
  });
}

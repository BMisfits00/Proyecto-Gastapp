import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { transactionService } from '../services/transactionService';
import { useAuthContext } from '../contexts/AuthContext';
import { CreateTransactionInput } from '../types';

export function useMonthlyTransactions(year?: number, month?: number) {
  const { user } = useAuthContext();
  const now = new Date();
  const y = year ?? now.getFullYear();
  const m = month ?? now.getMonth() + 1;

  return useQuery({
    queryKey: ['transactions', 'monthly', user?.id, y, m],
    queryFn: () => transactionService.getMonthly(user!.id, y, m),
    enabled: !!user,
  });
}

export function useAllTransactions(page = 0) {
  const { user } = useAuthContext();

  return useQuery({
    queryKey: ['transactions', 'all', user?.id, page],
    queryFn: () => transactionService.getAll(user!.id, page),
    enabled: !!user,
  });
}

// Hook de paginación infinita para el feed de movimientos
export function useInfiniteTransactions(pageSize = 20) {
  const { user } = useAuthContext();

  return useInfiniteQuery({
    queryKey: ['transactions', 'infinite', user?.id],
    queryFn: ({ pageParam = 0 }) => transactionService.getAll(user!.id, pageParam, pageSize),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.length === pageSize ? allPages.length : undefined;
    },
    enabled: !!user,
  });
}

export function useLast6MonthsTransactions() {
  const { user } = useAuthContext();

  return useQuery({
    queryKey: ['transactions', '6months', user?.id],
    queryFn: () => transactionService.getLast6Months(user!.id),
    enabled: !!user,
  });
}

export function useCreateTransaction() {
  const { user } = useAuthContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTransactionInput) =>
      transactionService.create(user!.id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CreateTransactionInput> }) =>
      transactionService.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => transactionService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

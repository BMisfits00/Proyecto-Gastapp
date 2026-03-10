import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { accountService } from '../services/accountService';
import { useAuthContext } from '../contexts/AuthContext';
import { CreateAccountInput } from '../types';

export function useAccounts() {
  const { user } = useAuthContext();

  return useQuery({
    queryKey: ['accounts', user?.id],
    queryFn: () => accountService.getAll(user!.id),
    enabled: !!user,
  });
}

export function useCreateAccount() {
  const { user } = useAuthContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateAccountInput) =>
      accountService.create(user!.id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => accountService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

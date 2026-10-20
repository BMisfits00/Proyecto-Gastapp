import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { yieldService } from '../services/yieldService';
import { useAuthContext } from '../contexts/AuthContext';

export function useAccountDailyYields(accountId: string) {
  return useQuery({
    queryKey: ['daily-yields', accountId],
    queryFn: () => yieldService.getByAccount(accountId),
    enabled: !!accountId,
  });
}

export function useRegisterDailyYield() {
  const { user } = useAuthContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      accountId,
      balance,
      yieldRate,
    }: {
      accountId: string;
      balance: number;
      yieldRate: number;
    }) => yieldService.registerYield(user!.id, accountId, balance, yieldRate),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['daily-yields', variables.accountId] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

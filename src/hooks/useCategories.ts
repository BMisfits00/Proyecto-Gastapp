import { useQuery } from '@tanstack/react-query';
import { categoryService } from '../services/categoryService';
import { useAuthContext } from '../contexts/AuthContext';

export function useCategories(type?: 'income' | 'expense') {
  const { user } = useAuthContext();

  const query = useQuery({
    queryKey: ['categories', user?.id],
    queryFn: () => categoryService.getAll(user!.id),
    enabled: !!user,
  });

  const filtered = type
    ? query.data?.filter((c) => c.type === type)
    : query.data;

  return { ...query, data: filtered };
}

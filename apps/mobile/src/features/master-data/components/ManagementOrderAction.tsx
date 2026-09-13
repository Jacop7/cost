import { useRouter } from 'expo-router';
import { OrderChangeAction } from '@/components/kit/OrderChangeAction';

export function ManagementOrderAction({ kind }: { kind: 'ingredient' | 'material' | 'recipe' }) {
  const router = useRouter();
  return <OrderChangeAction itemLabel={kind === 'recipe' ? '메뉴' : kind === 'ingredient' ? '재료' : '부자재'}
    onCategories={() => router.push(`/recipes/manage-order?kind=${kind}&target=category`)}
    onItems={() => router.push(`/recipes/manage-order?kind=${kind}&target=item`)} />;
}

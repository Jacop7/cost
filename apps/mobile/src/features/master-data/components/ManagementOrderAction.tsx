import { useRouter } from 'expo-router';
import { OrderChangeAction } from '@/components/kit/OrderChangeAction';

export function ManagementOrderAction({ kind }: { kind: 'ingredient' | 'material' | 'recipe' }) {
  const router = useRouter();
  const itemLabel = kind === 'recipe' ? '메뉴' : kind === 'ingredient' ? '재료' : '부자재';
  return <OrderChangeAction itemLabel={itemLabel} actionLabel={`${itemLabel} 설정 메뉴 열기`}
    onCategories={() => router.push(`/recipes/manage-order?kind=${kind}&target=category`)}
    onItems={() => router.push(`/recipes/manage-order?kind=${kind}&target=item`)} />;
}

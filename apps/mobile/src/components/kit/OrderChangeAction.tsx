import { HeaderOverflowAction } from './HeaderOverflowAction';

export function OrderChangeAction({ onCategories, onItems, itemLabel }: { onCategories: () => void; onItems: () => void; itemLabel: string }) {
  return <HeaderOverflowAction label={`${itemLabel} 관리 메뉴 열기`} items={[
      { label: '카테고리 편집', onPress: onCategories },
      { label: `${itemLabel} 목록 편집`, onPress: onItems },
    ]} />;
}

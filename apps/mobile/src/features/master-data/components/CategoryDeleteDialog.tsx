import { ConfirmDialog } from '@/components/kit/ConfirmDialog';
import { DeleteBlockedContent } from '@/components/kit/DeleteBlockedContent';
import type { CategoryKind } from '../hooks';

export function CategoryDeleteDialog({ name, kind, usedCount, blocked = false, loading = false, onCancel, onConfirm }: {
  name: string; kind: CategoryKind; usedCount?: number; blocked?: boolean; loading?: boolean;
  onCancel: () => void; onConfirm: () => void;
}) {
  const inUse = blocked || (usedCount ?? 0) > 0;
  const label = kind === 'recipe' ? '메뉴' : kind === 'ingredient' ? '재료' : '부자재';
  return <ConfirmDialog visible title={inUse ? '현재, 삭제가 불가능한 카테고리입니다' : '삭제하시겠습니까?'}
    message={inUse ? undefined : `${name}\n삭제 시, 복구가 불가합니다.`}
    kind={inUse ? 'primary' : 'danger'} confirmText={inUse ? '확인' : '삭제'} cancelText={inUse ? null : '취소'}
    closeLabel={inUse ? '삭제 안내 닫기' : '삭제 확인 닫기'} loading={loading}
    onCancel={onCancel} onConfirm={inUse ? onCancel : onConfirm}>
    {inUse ? <DeleteBlockedContent name={name} description="카테고리가 사용 중이에요."
      instruction={`연결된 ${label}를 다른 카테고리로 옮겨 주세요.`}
      linkedLabel={`연결된 ${label}`} count={usedCount} /> : null}
  </ConfirmDialog>;
}

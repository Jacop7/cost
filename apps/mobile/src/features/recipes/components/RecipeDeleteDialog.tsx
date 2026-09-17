import { useEffect, useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/kit/ConfirmDialog';
import { useBusinessDay } from '@/features/business-day/businessDay';
import { useDeleteRecipe } from '../hooks';

/** 상세 삭제도 목록 편집과 같은 서버 영업 상태·판본 검증을 사용한다. */
export function RecipeDeleteDialog({ target, onClose, onDeleted }: {
  target: { id: string; name: string; revision: string };
  onClose: () => void;
  onDeleted: () => void;
}) {
  const business = useBusinessDay();
  const remove = useDeleteRecipe();
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const blocked = business.isError || business.isLoading || !business.data
    ? '영업 상태 확인 후 삭제할 수 있어요.'
    : business.data.status === 'open' || business.data.status === 'break'
      ? '영업 종료 후 삭제할 수 있어요.' : null;
  const removeTarget = async () => {
    if (blocked || busy.current) return;
    busy.current = true;
    try {
      await remove.mutateAsync({ id: target.id, revision: target.revision });
      if (mounted.current) onDeleted();
    } catch (reason) {
      if (mounted.current) setError(reason instanceof Error ? reason.message : '다시 시도해 주세요.');
    } finally { busy.current = false; }
  };
  const notice = error ?? blocked;
  return <ConfirmDialog visible title={error ? '삭제하지 못했어요' : blocked ? '삭제할 수 없어요' : '삭제하시겠습니까?'}
    message={`${target.name}\n${notice ?? '삭제 시, 복구가 불가합니다.'}`}
    kind={notice ? 'primary' : 'danger'} confirmText={notice ? '확인' : '삭제'} cancelText={notice ? null : '취소'}
    closeLabel="메뉴 삭제 확인 닫기" loading={remove.isPending}
    onCancel={onClose} onConfirm={notice ? onClose : () => { void removeTarget(); }} />;
}

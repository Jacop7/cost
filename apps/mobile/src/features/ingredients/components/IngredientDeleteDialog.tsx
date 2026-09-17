import { useEffect, useState } from 'react';
import { ConfirmDialog } from '@/components/kit/ConfirmDialog';
import { DeleteBlockedContent } from '@/components/kit/DeleteBlockedContent';
import { checkIngredientDeletion } from '../deleteCheck';

/** Every delete entry checks the same server-owned links; the mutation rechecks. */
export function IngredientDeleteDialog({ id, name, loading = false, onCancel, onConfirm }: {
  id: string; name: string; loading?: boolean; onCancel: () => void; onConfirm: () => void;
}) {
  const [state, setState] = useState<{ canDelete: boolean; menuNames: string[] } | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let current = true;
    setState(null); setError(false);
    checkIngredientDeletion(id).then(value => { if (current) setState(value); }, () => { if (current) setError(true); });
    return () => { current = false; };
  }, [id]);
  const allowed = state?.canDelete === true;
  const checking = !state && !error;
  return <ConfirmDialog visible title={checking ? '연결된 메뉴 확인 중' : allowed ? '삭제하시겠습니까?' : '현재, 삭제가 불가능한 식재료입니다'}
    message={checking ? '잠시만 기다려 주세요.' : error ? '연결된 메뉴를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.'
      : allowed ? `${name}\n삭제 시, 복구가 불가합니다.`
        : undefined}
    kind={allowed ? 'danger' : 'primary'} confirmText={allowed ? '삭제' : '확인'} cancelText={allowed ? '취소' : null}
    loading={loading} onCancel={onCancel} onConfirm={allowed ? onConfirm : onCancel}>
    {!checking && !error && !allowed && state ? <DeleteBlockedContent name={name}
      description="재료가 사용 중이에요." instruction="아래 메뉴에서 먼저 제거해 주세요."
      linkedLabel="사용 중인 메뉴" count={state.menuNames.length} names={state.menuNames} /> : null}
  </ConfirmDialog>;
}

import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { ConfirmDialog } from '@/components/kit/ConfirmDialog';
import { useBusinessEditConfirmation } from '@/features/business-day/useBusinessEditConfirmation';
import { useDeactivateMaterial, type MaterialRow } from '@/features/master-data/hooks';

/** 부자재 목록·상세가 같은 수정 진입 확인과 삭제 계약을 사용한다. */
export function useMaterialActions(onDeleted?: () => void) {
  const router = useRouter();
  const edit = useBusinessEditConfirmation('부자재');
  const deactivate = useDeactivateMaterial();
  const [deleting, setDeleting] = useState<MaterialRow | null>(null);
  const busy = useRef(false);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  return {
    isPending: deactivate.isPending,
    edit: (material: MaterialRow) => edit.request(() =>
      router.push({ pathname: '/recipes/material-edit', params: { id: material.id } })),
    remove: setDeleting,
    dialogs: <>
      {edit.dialog}
      <ConfirmDialog visible={deleting !== null} title="부자재 삭제"
        message={deleting && deleting.usedCount > 0 ? `이 부자재를 쓰는 메뉴가 ${deleting.usedCount}개 있어요. 목록에서만 사라지고 기존 메뉴의 금액은 그대로 남아요.` : '목록에서 사라져요.'}
        loading={deactivate.isPending} onCancel={() => { if (!busy.current) setDeleting(null); }}
        onConfirm={() => {
          if (!deleting || busy.current || deactivate.isPending) return;
          busy.current = true;
          deactivate.mutate(deleting.id, {
            onSuccess: () => { if (active.current) { setDeleting(null); onDeleted?.(); } },
            onError: error => { if (active.current) Alert.alert('삭제하지 못했어요', error instanceof Error ? error.message : '잠시 후 다시 시도해 주세요'); },
            onSettled: () => { busy.current = false; },
          });
        }} />
    </>,
  };
}

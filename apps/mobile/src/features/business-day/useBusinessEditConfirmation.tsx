import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { ConfirmDialog } from '@/components/kit/ConfirmDialog';
import { useBusinessDay } from './businessDay';

export const BUSINESS_EDIT_MESSAGE = '현재 영업 중이므로, 수정 사항은 영업 종료 후 반영됩니다.';

/** Confirm entering an editor while the server's opening basis is frozen. */
export function useBusinessEditConfirmation(subject: '식재료' | '메뉴' | '부자재' | '고정지출') {
  const businessDay = useBusinessDay();
  const [open, setOpen] = useState(false);
  const action = useRef<(() => void) | null>(null);
  useEffect(() => () => { action.current = null; }, []);
  const cancel = () => { action.current = null; setOpen(false); };
  const request = (next: () => void) => {
    const status = businessDay.data?.status;
    if (!status || businessDay.isError) {
      Alert.alert('영업 상태를 확인하지 못했어요', '잠시 후 다시 시도해 주세요.');
      void businessDay.refetch();
      return;
    }
    if (status === 'open' || status === 'break') { action.current = next; setOpen(true); }
    else next();
  };
  const confirm = () => { const next = action.current; cancel(); next?.(); };
  return { request, dialog: open ? <ConfirmDialog visible kind="primary"
    title={`${subject}${subject === '식재료' || subject === '메뉴' || subject === '부자재' ? '를' : '을'} 수정하시겠습니까?`}
    message={BUSINESS_EDIT_MESSAGE} confirmText="수정" closeLabel="수정 확인 닫기"
    onCancel={cancel} onConfirm={confirm} /> : null };
}

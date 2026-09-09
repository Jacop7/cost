import { useRef, useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/kit';
import { ConfirmDialog } from '@/components/kit/ConfirmDialog';
import { useRevertStockEvent } from '../stockRevert';
import { showToast } from '@/lib/toast';
import { space } from '@/theme/tokens';
import { historyRowStyles } from '@/components/history/historyRowStyles';

/** A server-authorized action belongs below its source row, never to list order. */
export function StockRevertAction({ eventId, ingredientId, action }: {
  eventId: string; ingredientId: string; action: '입고' | '차감' | '폐기'; quantity: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  const mutation = useRevertStockEvent(ingredientId);
  const confirm = () => {
    if (submitting.current) return;
    submitting.current = true;
    mutation.mutate(eventId, {
      onSuccess: () => { setOpen(false); showToast(`${action} 취소가 완료됐어요.`); },
      onError: e => { setOpen(false); setError(e instanceof Error ? e.message : '취소하지 못했어요.'); },
      onSettled: () => { submitting.current = false; },
    });
  };
  return <>
    <View style={{ paddingHorizontal: historyRowStyles.spacing.paddingHorizontal, paddingBottom: space.md }}>
      <Button kind="gray" size="sm" full disabled={mutation.isPending} onPress={() => setOpen(true)}>{action} 취소</Button>
    </View>
    <ConfirmDialog visible={open} title={`${action}${action === '차감' ? '을' : '를'} 취소할까요?`}
      message="재고와 기준 단가가 다시 계산됩니다."
      confirmText={`${action} 취소`} cancelText="닫기" loading={mutation.isPending}
      onCancel={() => { if (!submitting.current) setOpen(false); }}
      onConfirm={confirm} />
    <ConfirmDialog visible={error !== null} title="취소하지 못했어요" message={error ?? ''}
      confirmText="확인" cancelText="" onConfirm={() => setError(null)} onCancel={() => setError(null)} />
  </>;
}

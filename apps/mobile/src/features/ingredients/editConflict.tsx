import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { Button } from '@/components/kit/Button';
import { COLOR, TYPE, space } from '@/theme/tokens';
import type { IngredientDetail } from './hooks';

type ReadLatest = () => Promise<{ data?: IngredientDetail | null; error?: unknown }>;
type Conflict = { loading: boolean; latest: IngredientDetail | null; error: string | null };

/** Conflict recovery never writes or silently rebases an open draft. */
export function useIngredientEditConflict(id: string | undefined, readLatest: ReadLatest) {
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const blocked = useRef(false);
  const pending = useRef(false);
  const generation = useRef(0);
  const active = useRef(true);
  const currentId = useRef(id);
  currentId.current = id;
  const read = useRef(readLatest);
  read.current = readLatest;
  useEffect(() => {
    active.current = true;
    generation.current++;
    blocked.current = false; pending.current = false; setConflict(null);
    return () => { active.current = false; generation.current++; };
  }, [id]);

  const refresh = async () => {
    if (!active.current || currentId.current !== id || pending.current) return;
    blocked.current = true; pending.current = true;
    const ticket = generation.current;
    setConflict({ loading: true, latest: null, error: null });
    try {
      const result = await read.current();
      if (ticket !== generation.current) return;
      if (result.error) throw result.error;
      if (!result.data || result.data.id !== id) throw new Error('식재료를 찾을 수 없어요. 삭제 여부를 확인해 주세요.');
      setConflict({ loading: false, latest: result.data, error: null });
    } catch (error) {
      if (ticket !== generation.current) return;
      setConflict({ loading: false, latest: null,
        error: error instanceof Error ? error.message : '최신 내용을 불러오지 못했어요. 다시 시도해 주세요.' });
    } finally {
      if (ticket === generation.current) pending.current = false;
    }
  };
  return {
    conflict, refresh,
    isBlocked: () => blocked.current,
    handleError: (error: unknown) => {
      if ((error as { code?: string } | null)?.code !== '40001') return false;
      void refresh(); return true;
    },
    accept: (apply: (latest: IngredientDetail) => void) => {
      if (pending.current || !conflict?.latest) return;
      apply(conflict.latest);
      blocked.current = false; setConflict(null);
    },
  };
}

export function EditConflictNotice({ recovery, children, onAccept }: {
  recovery: ReturnType<typeof useIngredientEditConflict>;
  children?: ReactNode;
  onAccept: (latest: IngredientDetail) => void;
}) {
  const state = recovery.conflict;
  if (!state) return null;
  return <View accessibilityRole="alert" style={{ gap: space.sm, paddingVertical: space.md }}>
    <Text style={{ ...TYPE.caption, color: COLOR.text.primary }}>다른 곳에서 수정됐어요</Text>
    <Text style={{ ...TYPE.captionSm, color: COLOR.text.secondary }}>
      입력한 내용은 보존했습니다. 최신 내용을 확인한 뒤 계속 수정하고 저장해 주세요.
    </Text>
    {state.loading ? <Text style={{ ...TYPE.captionSm, color: COLOR.text.secondary }}>최신 내용을 불러오는 중…</Text> : null}
    {state.error ? <Text style={{ ...TYPE.captionSm, color: COLOR.status.negative }}>{state.error}</Text> : null}
    {state.latest ? children : null}
    <Button kind="gray" size="md" loading={state.loading} onPress={() => void recovery.refresh()}>최신 내용 다시 불러오기</Button>
    {state.latest ? <Button kind="primary" size="md" onPress={() => recovery.accept(onAccept)}>확인 후 계속 수정</Button> : null}
  </View>;
}

/** Fields covered by the server CAS; compare normalized values, not display units. */
export const ingredientEditBaseline = (d: IngredientDetail) => ({
  name: d.name, category_id: d.categoryId, base_unit: d.baseUnit, per_volume: d.perVolume,
  purchase_price: d.purchasePrice ?? null, safety_stock: d.safetyStock, min_order_qty: d.minOrderQty,
  default_vendor_id: d.defaultVendorId, memo: d.memo,
});

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Text, TextInput, View } from 'react-native';
import { Button } from '@/components/kit/Button';
import { Sheet } from '@/components/kit/Sheet';
import { COLOR, COMPONENT, TYPE, space } from '@/theme/tokens';
import type { RecipeDetail } from './hooks';
import { useRecipeScope } from './useRecipeScope';
import { isRecipeRevisionConflict, recipeRevision } from './writeContract';
import type { RecipeIntent } from './intentStorage';

export function useRecipeEditorSession(id: string | undefined) {
  const scope = useRecipeScope(); const scopeKey = JSON.stringify(scope);
  const active = useRef<object | null>(null);
  useLayoutEffect(() => {
    active.current = {}; return () => { active.current = null; };
  }, [scopeKey, id]);
  useFocusEffect(useCallback(() => {
    active.current = {}; return () => { active.current = null; };
  }, [scopeKey, id]));
  return { scopeKey, id, capture: () => active.current,
    isCurrent: (ticket: object | null) => ticket !== null && active.current === ticket };
}
type Session = ReturnType<typeof useRecipeEditorSession>;
type ReadLatest = () => Promise<{ data?: RecipeDetail | null; error?: unknown }>;
type Conflict = { loading: boolean; latest: RecipeDetail | null; error: string | null; basis: string; strict: boolean };
export function useRecipeEditRecovery(session: Session, readLatest: ReadLatest) {
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const pending = useRef(false); const blocked = useRef(false); const read = useRef(readLatest); read.current = readLatest;
  const generation = useRef(0);
  useEffect(() => {
    generation.current++; pending.current = false; blocked.current = false; setConflict(null);
    return () => { generation.current++; };
  }, [session.scopeKey, session.id]);
  useFocusEffect(useCallback(() => {
    generation.current++; pending.current = false; blocked.current = false; setConflict(null);
    return () => { generation.current++; pending.current = false; blocked.current = false; setConflict(null); };
  }, [session.scopeKey, session.id]));
  const refresh = async (basis: string, strict = true) => {
    const ticket = session.capture(); if (pending.current || !ticket || !session.id) return;
    blocked.current = true; pending.current = true; const version = generation.current;
    setConflict({ loading: true, latest: null, error: null, basis, strict });
    try {
      const result = await read.current();
      if (!session.isCurrent(ticket) || generation.current !== version) return;
      if (result.error) throw result.error;
      const latest = result.data;
      if (!latest || latest.id !== session.id) throw new Error('레시피를 찾을 수 없어요. 삭제 여부를 확인해 주세요.');
      const revision = BigInt(recipeRevision(latest.editRevision)), previous = BigInt(recipeRevision(basis));
      if (strict ? revision <= previous : revision < previous) throw new Error('최신 판본을 확인하지 못했어요. 다시 불러와 주세요.');
      setConflict({ loading: false, latest, error: null, basis, strict });
    } catch (error) {
      if (session.isCurrent(ticket) && generation.current === version) setConflict({ loading: false, latest: null, basis, strict,
        error: error instanceof Error ? error.message : '최신 내용을 불러오지 못했어요.' });
    } finally { if (generation.current === version) pending.current = false; }
  };
  return { conflict, refresh, isBlocked: () => blocked.current,
    handleError: (error: unknown, basis: string) => { if (!isRecipeRevisionConflict(error)) return false; void refresh(basis); return true; },
    accept: (apply: (latest: RecipeDetail) => void) => {
      if (pending.current || !conflict?.latest || !session.capture()) return;
      apply(conflict.latest); blocked.current = false; setConflict(null);
    } };
}
export function RecipeConflictNotice({ recovery, onAccept }: {
  recovery: ReturnType<typeof useRecipeEditRecovery>; onAccept: (latest: RecipeDetail) => void;
}) {
  const c = recovery.conflict; if (!c) return null;
  return <View style={{ padding: space.md, gap: space.sm }} accessibilityLiveRegion="polite">
    <Text style={{ ...TYPE.caption, color: COLOR.status.negative }}>
      {c.loading ? '최신 내용을 확인하고 있어요. 입력한 내용은 유지돼요.' : c.error ?? '다른 곳에서 변경된 내용을 확인해 주세요. 아직 다시 저장하지 않았어요.'}
    </Text>
    {c.latest ? <>
      <Text style={{ ...TYPE.caption, color: COLOR.text.primary }}>최신 메뉴: {c.latest.name} · 판매가 {c.latest.price}원 · {c.latest.baseServings}인분</Text>
      <Text style={{ ...TYPE.caption, color: COLOR.text.secondary }}>최신 메모: {c.latest.memo || '없음'} · {c.latest.active ? '판매 중' : '판매 중지'}</Text>
      <Text style={{ ...TYPE.caption, color: COLOR.text.secondary }}>최신 재료: {c.latest.lines.map(line => `${line.name} ${line.inputQty}${line.baseUnit === 'ea' ? '개' : line.baseUnit ?? ''}`).join(', ') || '없음'}</Text>
      <Text style={{ ...TYPE.caption, color: COLOR.text.secondary }}>최신 부자재: {c.latest.extras.map(extra => `${extra.name} ${extra.qty}개`).join(', ') || '없음'}</Text>
      <Text style={{ ...TYPE.caption, color: COLOR.text.secondary }}>내가 수정한 값은 유지하고 나머지는 최신 내용으로 갱신해요. 확인 후 저장을 다시 눌러 주세요.</Text>
      <Button kind="gray" onPress={() => recovery.accept(onAccept)}>최신 내용 확인</Button>
    </> : <Button kind="gray" disabled={c.loading} onPress={() => { void recovery.refresh(c.basis, c.strict); }}>최신 내용 다시 불러오기</Button>}
  </View>;
}
export function RecipePendingNotice({ intent, error, busy, onResume, onDiscardUnreadable }: {
  intent: RecipeIntent | null | undefined; error?: string | null; busy: boolean; onResume: () => void; onDiscardUnreadable?: () => void;
}) {
  if (!intent && !error) return null;
  return <View style={{ padding: space.md, gap: space.sm }} accessibilityLiveRegion="polite">
    <Text style={{ ...TYPE.caption, color: COLOR.status.negative }}>{error ?? (busy ? '저장 결과를 확인하고 있어요.' : '이전 저장 결과를 먼저 확인해 주세요. 입력 내용이 바뀌어도 이전 요청 그대로 확인해요.')}</Text>
    {intent ? <Button kind="gray" disabled={busy} onPress={onResume}>이전 저장 결과 확인</Button> : null}
    {!intent && error && onDiscardUnreadable ? <Button kind="gray" disabled={busy} onPress={onDiscardUnreadable}>확인 정보를 삭제하고 저장 계속하기</Button> : null}
  </View>;
}
/** A controlled draft lets the owner distinguish a submitted memo from later typing. */
export function RecipeMemoEditor({ visible, value, onChange, busy, blocked, onClose, onSave, recovery }: {
  visible: boolean; value: string; onChange: (value: string) => void; busy: boolean; blocked: boolean;
  onClose: () => void; onSave: () => void; recovery: React.ReactNode;
}) {
  return <Sheet visible={visible} title="메모 수정" onClose={() => { if (!busy) onClose(); }} footer={
    <View style={{ flexDirection: 'row', gap: space.sm }}>
      <Button kind="gray" disabled={busy} onPress={onClose} style={{ flex: 1 }}>취소</Button>
      <Button kind="primary" loading={busy} disabled={blocked} onPress={onSave} style={{ flex: 1 }}>완료</Button>
    </View>}>
    {recovery}
    <TextInput accessibilityLabel="메모" value={value} onChangeText={onChange} maxLength={100} multiline autoFocus
      placeholder="메모를 입력하세요" placeholderTextColor={COLOR.text.tertiary}
      style={{ ...TYPE.caption, color: COLOR.text.primary, borderWidth: COMPONENT.input.borderWidth, borderColor: COMPONENT.input.border.default,
        borderRadius: COMPONENT.input.radius, padding: space.md, minHeight: 106, textAlignVertical: 'top' }} />
    <Text style={{ ...TYPE.captionSm, color: COLOR.text.tertiary, textAlign: 'right' }}>{value.length} / 100</Text>
  </Sheet>;
}

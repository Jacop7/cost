import { useLayoutEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from '@/components/kit';
import { COLOR, TYPE, space } from '@/theme/tokens';
import { IngredientEditStatus } from './editConflict';
import type { BaseUnit, IngredientDetail, PurchaseOption } from './hooks';
import { mergeOptionDraft, optionDraftOf, optionFieldText, optionMergeFields, purchaseOptionRevision,
  type OptionBaseline, type OptionChoices, type OptionDraft } from './purchaseOptionEdit';

type ReadLatest = () => Promise<{ data?: IngredientDetail | null; error?: unknown }>;
type RecoveryState = { kind: 'loading' | 'error' | 'unavailable' | 'baseline' | 'resolve'; message: string; latest?: PurchaseOption };

export function usePurchaseOptionEditConflict(ingredientId: string | undefined, readLatest: ReadLatest) {
  const [baseline, setBaseline] = useState<OptionBaseline | null>(null);
  const baselineRef = useRef<OptionBaseline | null>(null);
  const [state, setState] = useState<RecoveryState | null>(null);
  const [choices, setChoices] = useState<OptionChoices>({});
  const active = useRef(true);
  const epoch = useRef(0);
  const blocked = useRef(false);
  const pending = useRef(false);
  const read = useRef(readLatest); read.current = readLatest;
  const renderedEpoch = epoch.current;
  useLayoutEffect(() => { active.current = true; return () => { active.current = false; epoch.current++; }; }, []);
  const ticket = () => epoch.current;
  const valid = (value: number) => active.current && epoch.current === value;
  const reset = () => {
    epoch.current++; blocked.current = false; pending.current = false;
    baselineRef.current = null; setBaseline(null); setState(null); setChoices({});
  };
  const initialize = (option: PurchaseOption, baseUnit: BaseUnit) => {
    const next = { option: { ...option }, baseUnit };
    baselineRef.current = next; setBaseline(next);
  };
  const unavailable = () => {
    blocked.current = true; setChoices({});
    setState({ kind: 'unavailable', message: '현재 구매 옵션을 찾을 수 없어요' });
  };
  const refresh = async () => {
    const base = baselineRef.current;
    if (!active.current || !base || pending.current) return;
    const token = ticket();
    blocked.current = true; pending.current = true; setChoices({});
    setState({ kind: 'loading', message: '최신 내용을 불러오는 중…' });
    try {
      const result = await read.current();
      if (!valid(token)) return;
      if (result.error) throw result.error;
      const detail = result.data;
      const latest = detail && detail.id === ingredientId ? detail.options.find(o => o.id === base.option.id) : undefined;
      if (!latest) { unavailable(); return; }
      if (!purchaseOptionRevision(latest.editRevision)) {
        setState({ kind: 'baseline', message: '최신 편집 정보를 받지 못했어요. 다시 불러오거나 앱 업데이트를 확인해 주세요.' }); return;
      }
      if (detail!.baseUnit !== base.baseUnit) {
        setState({ kind: 'baseline', message: '식재료 단위가 변경됐어요. 입력한 내용을 확인하고 구매 옵션을 다시 열어 주세요.' }); return;
      }
      setState({ kind: 'resolve', latest: { ...latest }, message: '최신 내용을 확인한 뒤 계속 수정해 주세요.' });
    } catch {
      if (valid(token)) setState({ kind: 'error', message: '최신 내용을 불러오지 못했어요. 다시 시도해 주세요.' });
    } finally { if (valid(token)) pending.current = false; }
  };
  return {
    baseline, state, choices, setChoices, reset, initialize, refresh, ticket, valid,
    isBlocked: () => blocked.current,
    unavailable,
    handleError: (error: unknown) => {
      const e = error as { code?: string; details?: string } | null;
      if (e?.code === 'P0002') { unavailable(); return true; }
      if (((e?.code === '45009' && e.details === 'REVISION_CONFLICT') || (e?.code === '40001' && e.details === 'OPTION_EDIT_CONFLICT')) || (e?.code === '22000' && ['OPTION_BASE_REQUIRED', 'OPTION_BASE_INVALID'].includes(e.details ?? ''))) {
        void refresh(); return true;
      }
      return false;
    },
    accept: (draft: OptionDraft, apply: (next: OptionDraft) => void) => {
      const latest = state?.latest;
      if (!valid(renderedEpoch) || !blocked.current || pending.current || !latest || !baselineRef.current) return;
      const merged = mergeOptionDraft(baselineRef.current, draft, latest, choices);
      if (!merged) return;
      apply(merged); initialize(latest, baselineRef.current.baseUnit);
      blocked.current = false; setState(null); setChoices({});
    },
  };
}

export function PurchaseOptionConflictNotice({ recovery, draft, onApply }: {
  recovery: ReturnType<typeof usePurchaseOptionEditConflict>; draft: OptionDraft; onApply: (next: OptionDraft) => void;
}) {
  const { state, baseline, choices } = recovery;
  if (!state) return null;
  const latest = state.latest;
  const fields = baseline && latest ? optionMergeFields(baseline, draft, latest) : [];
  const remote = baseline && latest ? optionDraftOf(latest, baseline.baseUnit) : null;
  const ready = fields.every(field => !field.conflict || choices[field.key]);
  return <View style={{ gap: space.sm, paddingVertical: space.md }}>
    <IngredientEditStatus message={state.message} error={state.kind !== 'resolve' && state.kind !== 'loading'}
      announcement={`입력한 내용은 보존했습니다. 확인 전에는 저장할 수 없어요. ${state.message}`} />
    <Text style={{ ...TYPE.caption, color: COLOR.text.secondary }}>입력한 내용은 보존했습니다. 최신 내용과 비교해 주세요.</Text>
    {remote ? fields.map(field => <View key={field.key} style={{ gap: space.xs }}>
      <Text style={{ ...TYPE.caption, color: COLOR.text.primary }}>{field.label}</Text>
      <Text style={{ ...TYPE.captionSm, color: COLOR.text.secondary }}>내 입력: {optionFieldText(draft, field.key)}</Text>
      <Text style={{ ...TYPE.captionSm, color: COLOR.text.secondary }}>최신 값: {optionFieldText(remote, field.key)}</Text>
      {field.conflict ? <View style={{ gap: space.xs }}>
        <Button kind={choices[field.key] === 'local' ? 'primary' : 'gray'} size="md"
          accessibilityLabel={`${field.label} 내 입력 유지${choices[field.key] === 'local' ? ', 선택됨' : ''}`}
          onPress={() => recovery.setChoices(old => ({ ...old, [field.key]: 'local' }))}>내 입력 유지</Button>
        <Button kind={choices[field.key] === 'latest' ? 'primary' : 'gray'} size="md"
          accessibilityLabel={`${field.label} 최신 값 사용${choices[field.key] === 'latest' ? ', 선택됨' : ''}`}
          onPress={() => recovery.setChoices(old => ({ ...old, [field.key]: 'latest' }))}>최신 값 사용</Button>
      </View> : null}
    </View>) : null}
    {baseline ? <Button kind="gray" size="md" loading={state.kind === 'loading'} onPress={() => void recovery.refresh()}>최신 내용 다시 불러오기</Button> : null}
    {latest ? <Button kind="primary" size="md" disabled={!ready} onPress={() => recovery.accept(draft, onApply)}>확인 후 계속 수정</Button> : null}
  </View>;
}

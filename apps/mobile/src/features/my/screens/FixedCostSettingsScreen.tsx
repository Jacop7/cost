import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, PanResponder, Pressable, ScrollView, Text, View } from 'react-native';
import type { ViewStyle } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import { ActionSheet, AppHeader, Button, Card, Icon, Input, Notice, QueryState, Select, Sheet } from '@/components/kit';
import { ConfirmDialog } from '@/components/kit/ConfirmDialog';
import { SelectionRow } from '@/components/kit/SelectionRow';
import { BusinessDateGate } from '@/features/business-day/components/BusinessDateGate';
import { useStoreLocalDate } from '@/features/business-day/businessDay';
import { safeBack } from '@/lib/nav';
import { COLOR, LAYOUT, T, TYPE, radius, space } from '@/theme/tokens';
import {
  useFixedCostBasis,
  useFixedCostConfiguration,
  useCancelFixedCostReentry,
  useSaveFixedCostSettings,
  type ChannelWeights,
  type FixedCostBasisMonths,
  type FixedCostItem,
} from '../hooks';
import { FIXED_COST_LABEL } from '../fixedCostView';
import { moveOrderItem } from '@/components/kit/DragOrderList';

type ConfigDraft = {
  key: string;
  label: string;
  mode: 'total' | 'detail';
  lines: ConfigDraftLine[];
  weights: ChannelWeights | null;
};

type ConfigDraftLine = {
  key: string;
  name: string;
};

let nextCustomKey = 0;
const newKey = () => `custom_${Date.now()}_${++nextCustomKey}`;
const newLineKey = () => `line_${Date.now()}_${++nextCustomKey}`;

const monthOffset = (month: string, offset: number) => {
  const year = Number(month.slice(0, 4));
  const value = Number(month.slice(5, 7));
  const date = new Date(Date.UTC(year, value - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
};

const completedMonthRange = (localMonth: string, count: FixedCostBasisMonths) => {
  const from = monthOffset(localMonth, -count);
  const to = monthOffset(localMonth, -1);
  const fromYear = from.slice(0, 4);
  const toYear = to.slice(0, 4);
  const fromLabel = `${Number(from.slice(5))}월`;
  const toLabel = `${Number(to.slice(5))}월`;
  if (from === to) return fromLabel;
  return fromYear === toYear
    ? `${fromLabel} ~ ${toLabel}`
    : `${fromYear}년 ${fromLabel} ~ ${toYear}년 ${toLabel}`;
};

const completedMonthRangeWithYear = (localMonth: string, count: FixedCostBasisMonths) => {
  const from = monthOffset(localMonth, -count);
  const to = monthOffset(localMonth, -1);
  const fromYear = from.slice(0, 4);
  const toYear = to.slice(0, 4);
  const fromMonth = Number(from.slice(5));
  const toMonth = Number(to.slice(5));
  if (from === to) return `${fromYear}년 ${fromMonth}월`;
  return fromYear === toYear
    ? `${fromYear}년 ${fromMonth}월 ~ ${toMonth}월`
    : `${fromYear}년 ${fromMonth}월 ~ ${toYear}년 ${toMonth}월`;
};

function DragReorderHandle({
  label,
  index,
  count,
  estimatedRowHeight,
  onMove,
  onDragState,
  orientation = 'vertical',
}: {
  label: string;
  index: number;
  count: number;
  estimatedRowHeight: number;
  onMove: (from: number, to: number) => void;
  onDragState?: (state: { source: number; target: number; dy: number } | null) => void;
  orientation?: 'vertical' | 'horizontal';
}) {
  const [dragging, setDragging] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const current = useRef({ index, count, estimatedRowHeight, onMove, onDragState });
  current.current = { index, count, estimatedRowHeight, onMove, onDragState };
  const startIndex = useRef(index);
  const targetIndex = useRef(index);
  const moved = useRef(false);
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => current.current.count > 1,
      onMoveShouldSetPanResponder: (_, gesture) =>
        current.current.count > 1 && Math.abs(gesture.dy) > 4,
      onPanResponderGrant: () => {
        startIndex.current = current.current.index;
        targetIndex.current = current.current.index;
        moved.current = false;
        setDragging(true);
        current.current.onDragState?.({
          source: current.current.index,
          target: current.current.index,
          dy: 0,
        });
      },
      onPanResponderMove: (_, gesture) => {
        if (Math.abs(gesture.dy) > 5) moved.current = true;
        const step = Math.max(56, current.current.estimatedRowHeight);
        const distance = Math.round(gesture.dy / step);
        const to = Math.max(
          0,
          Math.min(current.current.count - 1, startIndex.current + distance),
        );
        targetIndex.current = to;
        current.current.onDragState?.({ source: startIndex.current, target: to, dy: gesture.dy });
      },
      onPanResponderRelease: () => {
        if (moved.current && targetIndex.current !== startIndex.current) {
          current.current.onMove(startIndex.current, targetIndex.current);
        } else if (!moved.current) setActionsOpen(true);
        current.current.onDragState?.(null);
        setDragging(false);
      },
      onPanResponderTerminate: () => {
        current.current.onDragState?.(null);
        setDragging(false);
      },
      onPanResponderTerminationRequest: () => false,
    }),
  ).current;
  const move = (direction: -1 | 1) => {
    const to = Math.max(0, Math.min(count - 1, index + direction));
    if (to !== index) onMove(index, to);
  };

  return (
    <>
      <View
      {...responder.panHandlers}
      accessible
      focusable
      accessibilityRole="adjustable"
      accessibilityLabel={`${label} 순서 변경`}
      accessibilityHint="손잡이를 위아래로 드래그해 순서를 변경합니다"
      accessibilityState={{ disabled: count < 2 }}
      aria-valuemin={1}
      aria-valuemax={count}
      aria-valuenow={index + 1}
      aria-valuetext={`${count}개 중 ${index + 1}번째`}
      accessibilityActions={[
        { name: 'increment', label: '아래로 이동' },
        { name: 'decrement', label: '위로 이동' },
      ]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'increment') move(1);
        if (event.nativeEvent.actionName === 'decrement') move(-1);
      }}
      {...{
        onKeyDown: (event: { key: string; preventDefault: () => void }) => {
          if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
          event.preventDefault();
          move(event.key === 'ArrowUp' ? -1 : 1);
        },
      }}
      style={
        {
          width: orientation === 'horizontal' ? '100%' : 44,
          minHeight: 44,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: count < 2 ? 0.3 : 1,
          backgroundColor: dragging ? COLOR.action.primaryTint : 'transparent',
          borderRadius: radius.md,
          touchAction: 'none',
        } as unknown as ViewStyle
      }
    >
      <View style={orientation === 'horizontal' ? { transform: [{ rotate: '90deg' }] } : undefined}>
        <Icon name="grip" size={20} color={COLOR.text.tertiary} />
      </View>
      </View>
      {actionsOpen ? (
        <ActionSheet
          floating
          visible
          onClose={() => setActionsOpen(false)}
          items={[
            ...(index > 0
              ? [{ label: '위로 이동', onPress: () => move(-1) }]
              : []),
            ...(index < count - 1
              ? [{ label: '아래로 이동', onPress: () => move(1) }]
              : []),
          ]}
        />
      ) : null}
    </>
  );
}

const fromItem = (item: FixedCostItem): ConfigDraft => ({
  key: item.key,
  label: item.label ?? FIXED_COST_LABEL[item.key] ?? item.key,
  mode: item.mode,
  lines:
    item.mode === 'detail'
      ? item.lines.map((line, index) => ({ key: `${item.key}_line_${index}`, name: line.name }))
      : [],
  weights: item.weights,
});

const toItem = (item: ConfigDraft): FixedCostItem => ({
  key: item.key,
  label: item.label.trim(),
  mode: item.mode,
  total: 0,
  lines:
    item.mode === 'detail'
      ? item.lines.map((line) => ({ name: line.name.trim(), amount: 0 }))
      : [],
  weights: item.weights,
});

export default function FixedCostSettingsScreen() {
  return (
    <BusinessDateGate
      source={useStoreLocalDate()}
      title="고정 지출 설정"
      onBack={() => safeBack('/recipes/fixed-cost')}
    >
      {(localDate) => <FixedCostSettingsBody localMonth={localDate.slice(0, 7)} />}
    </BusinessDateGate>
  );
}

function FixedCostSettingsBody({ localMonth }: { localMonth: string }) {
  const router = useRouter();
  const basis = useFixedCostBasis(localMonth);
  const configuration = useFixedCostConfiguration(localMonth);
  const save = useSaveFixedCostSettings();
  const cancelReentry = useCancelFixedCostReentry();
  const saveBusy = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const [months, setMonths] = useState<FixedCostBasisMonths>(3);
  const [items, setItems] = useState<ConfigDraft[]>([]);
  const [original, setOriginal] = useState('');
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
  const [confirmSave, setConfirmSave] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmCancelReentry, setConfirmCancelReentry] = useState(false);
  const [basisOpen, setBasisOpen] = useState(false);
  const [cardDrag, setCardDrag] = useState<{
    key: string;
    source: number;
    target: number;
    dy: number;
    height: number;
  } | null>(null);
  const [lineDrag, setLineDrag] = useState<{
    itemKey: string;
    lineKey: string;
    source: number;
    target: number;
    dy: number;
  } | null>(null);

  useEffect(() => {
    if (loaded || !basis.data || !configuration.data) return;
    const nextItems = configuration.data.items.map(fromItem);
    setMonths(basis.data.basisMonths);
    setItems(nextItems);
    setOriginal(JSON.stringify({ months: basis.data.basisMonths, items: nextItems }));
    setLoaded(true);
  }, [basis.data, configuration.data, loaded]);

  const dirty = loaded && JSON.stringify({ months, items }) !== original;
  const itemConfigurationDirty =
    loaded &&
    JSON.stringify(items) !==
      JSON.stringify((configuration.data?.items ?? []).map(fromItem));
  const reentry = configuration.data?.reentry?.active ? configuration.data.reentry : null;
  const itemConfigurationValid = useMemo(() => {
    const labels = items.map((item) => item.label.trim().toLocaleLowerCase());
    if (!items.length || labels.some((label) => !label) || new Set(labels).size !== labels.length)
      return false;
    return items.every((item) => {
      if (item.mode === 'total') return true;
      const lines = item.lines.map((line) => line.name.trim().toLocaleLowerCase());
      return Boolean(lines.length && lines.every(Boolean) && new Set(lines).size === lines.length);
    });
  }, [items]);
  const openAdd = () => {
    setItems((current) => [
      ...current,
      { key: newKey(), label: '', mode: 'total', lines: [], weights: null },
    ]);
  };

  const onBack = () => (dirty ? setConfirmLeave(true) : safeBack('/recipes/fixed-cost'));
  const onSave = () => {
    if (
      !basis.data ||
      !configuration.data ||
      !dirty ||
      !itemConfigurationValid ||
      saveBusy.current
    )
      return;
    saveBusy.current = true;
    save.mutate(
      {
        months,
        items: items.map(toItem),
        baseSettingsRevision: basis.data.revision,
        baseConfigurationRevision: configuration.data.currentRevision,
      },
      {
        onSuccess: (result) => {
          if (result.reentryRequired && result.reentry?.nextMonth) {
            router.push(
              `/recipes/fixed-cost-edit?month=${result.reentry.nextMonth}&reentry=1` as Href,
            );
            return;
          }
          safeBack('/recipes/fixed-cost');
        },
        onError: (error) => {
          saveBusy.current = false;
          setConfirmSave(false);
          Alert.alert(
            '설정하지 못했어요',
            error instanceof Error ? error.message : '잠시 후 다시 시도해 주세요.',
          );
        },
      },
    );
  };

  const loading = basis.isLoading || configuration.isLoading;
  const error = basis.error ?? configuration.error;
  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader title="고정 지출 설정" onBack={onBack} />
      <QueryState
        isLoading={loading}
        error={error}
        isEmpty={false}
        onRetry={() => {
          void basis.refetch();
          void configuration.refetch();
        }}
        emptyTitle=""
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: space.lg,
            paddingTop: LAYOUT.scroll.start,
            paddingBottom: 32,
            gap: space.lg,
          }}
        >
          <View style={{ gap: space.sm }}>
            <Text style={{ ...TYPE.body, color: T.ink, fontWeight: '800' }}>고정 지출 기준</Text>
            <Select
              value={`당월 제외 최근 ${months}개월`}
              description={completedMonthRangeWithYear(localMonth, months)}
              accessibilityLabel={`고정 지출 기준 당월 제외 최근 ${months}개월 ${completedMonthRangeWithYear(localMonth, months)}`}
              expanded={basisOpen}
              onPress={() => {
                if (!reentry) setBasisOpen(true);
              }}
            />
          </View>

          <View
            testID="fixed-cost-settings-section-divider"
            style={{ height: 1, backgroundColor: T.line }}
          />

          {reentry ? (
            <Card>
              <Text style={{ ...TYPE.body, color: T.ink, fontWeight: '800' }}>
                항목 수정 진행 중
              </Text>
              <Text style={{ ...TYPE.caption, color: COLOR.text.tertiary, marginTop: space.xs }}>
                {reentry.completedCount}/{reentry.basisMonths}개월 입력 완료 · 기존 기준 사용 중
              </Text>
            </Card>
          ) : null}

          <View
            pointerEvents={reentry ? 'none' : 'auto'}
            style={{ gap: space.sm, opacity: reentry ? 0.72 : 1 }}
          >
            <View style={{ gap: space.sm }}>
              <Text style={{ ...TYPE.body, color: T.ink, fontWeight: '800' }}>
                고정 지출 항목 구성
              </Text>
              <Notice>
                수정 시 당월을 제외한 최근 {months}개월(
                {completedMonthRange(localMonth, months).replace(' ~ ', '~')})의 고정 지출 내역이 초기화되므로 다시 입력해 주셔야 합니다.
              </Notice>
            </View>

            {items.map((item, index) => {
              const estimatedCardHeight = 201 + item.lines.length * 60;
              const activeCard = cardDrag?.key === item.key;
              const cardShift = cardDrag && !activeCard
                ? cardDrag.source < index && index <= cardDrag.target
                  ? -(cardDrag.height + space.sm)
                  : cardDrag.target <= index && index < cardDrag.source
                    ? cardDrag.height + space.sm
                    : 0
                : 0;
              return (
              <View
                key={item.key}
                style={{
                  zIndex: activeCard ? 2 : 0,
                  transform: [{ translateY: activeCard ? cardDrag.dy : cardShift }],
                }}
              >
              <Card
                pad={0}
                style={{
                  overflow: 'hidden',
                  backgroundColor: activeCard ? COLOR.action.primaryTint : T.surface,
                }}
              >
                <DragReorderHandle
                  label={`${item.label || `고정 지출 항목 ${index + 1}`} 카드`}
                  index={index}
                  count={items.length}
                  estimatedRowHeight={estimatedCardHeight}
                  orientation="horizontal"
                  onMove={(from, to) => setItems((current) => moveOrderItem(current, from, to))}
                  onDragState={(state) =>
                    setCardDrag(
                      state
                        ? { key: item.key, ...state, height: estimatedCardHeight }
                        : null,
                    )
                  }
                />
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    minHeight: 64,
                    paddingLeft: space.lg,
                    paddingBottom: space.sm,
                  }}
                >
                  <View style={{ flex: 1, paddingVertical: space.sm }}>
                    <Input
                      value={item.label}
                      onChangeText={(label) =>
                        setItems((current) =>
                          current.map((currentItem, currentIndex) =>
                            currentIndex === index ? { ...currentItem, label } : currentItem,
                          ),
                        )
                      }
                      placeholder="고정 지출 항목명"
                      accessibilityLabel={`${item.label || `고정 지출 항목 ${index + 1}`} 항목명`}
                      variant="stacked"
                      error={
                        !item.label.trim() ||
                        items.some(
                          (other, otherIndex) =>
                            otherIndex !== index &&
                            other.label.trim().toLocaleLowerCase() ===
                              item.label.trim().toLocaleLowerCase(),
                        )
                      }
                    />
                  </View>
                  <Pressable
                    onPress={() => setDeleteIndex(index)}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.label || `고정 지출 항목 ${index + 1}`} 항목 삭제`}
                    style={{
                      width: 48,
                      minHeight: 48,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon name="trash" size={20} color={COLOR.text.tertiary} sw={1.8} />
                  </Pressable>
                </View>
                <View
                    style={{
                      paddingHorizontal: space.lg,
                      paddingVertical: space.lg,
                      borderTopWidth: 1,
                      borderTopColor: T.line2,
                      gap: space.md,
                    }}
                  >
                    {item.lines.map((line, lineIndex) => {
                      const activeLine =
                        lineDrag?.itemKey === item.key && lineDrag.lineKey === line.key;
                      const lineShift = lineDrag?.itemKey === item.key && !activeLine
                        ? lineDrag.source < lineIndex && lineIndex <= lineDrag.target
                          ? -(64 + space.md)
                          : lineDrag.target <= lineIndex && lineIndex < lineDrag.source
                            ? 64 + space.md
                            : 0
                        : 0;
                      return (
                      <View
                        key={line.key}
                        style={{
                          minHeight: 64,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: space.sm,
                          zIndex: activeLine ? 2 : 0,
                          borderRadius: radius.md,
                          backgroundColor: activeLine ? COLOR.action.primaryTint : 'transparent',
                          transform: [{ translateY: activeLine ? lineDrag.dy : lineShift }],
                        }}
                      >
                        <DragReorderHandle
                          label={`${item.label || `고정 지출 항목 ${index + 1}`} 세부 항목 ${lineIndex + 1}`}
                          index={lineIndex}
                          count={item.lines.length}
                          estimatedRowHeight={64}
                          onMove={(from, to) =>
                            setItems((current) =>
                              current.map((currentItem, currentIndex) =>
                                currentIndex === index
                                  ? {
                                      ...currentItem,
                                      lines: moveOrderItem(currentItem.lines, from, to),
                                    }
                                  : currentItem,
                              ),
                            )
                          }
                          onDragState={(state) =>
                            setLineDrag(
                              state
                                ? { itemKey: item.key, lineKey: line.key, ...state }
                                : null,
                            )
                          }
                        />
                        <View style={{ flex: 1 }}>
                          <Input
                            value={line.name}
                            onChangeText={(text) =>
                              setItems((current) =>
                                current.map((currentItem, currentIndex) =>
                                  currentIndex === index
                                    ? {
                                        ...currentItem,
                                        lines: currentItem.lines.map((old, oldIndex) =>
                                          oldIndex === lineIndex ? { ...old, name: text } : old,
                                        ),
                                      }
                                    : currentItem,
                                ),
                              )
                            }
                            placeholder="세부 항목을 입력하세요"
                            accessibilityLabel={`${item.label || `고정 지출 항목 ${index + 1}`} 세부 항목 ${lineIndex + 1}`}
                            variant="stacked"
                          />
                        </View>
                        <Pressable
                          onPress={() =>
                            setItems((current) =>
                              current.map((currentItem, currentIndex) => {
                                if (currentIndex !== index) return currentItem;
                                const lines = currentItem.lines.filter(
                                  (_, oldIndex) => oldIndex !== lineIndex,
                                );
                                return {
                                  ...currentItem,
                                  mode: lines.length ? 'detail' : 'total',
                                  lines,
                                };
                              }),
                            )
                          }
                          accessibilityRole="button"
                          accessibilityLabel={`${item.label || `고정 지출 항목 ${index + 1}`} 세부 항목 ${lineIndex + 1} 삭제`}
                          style={{
                            width: 44,
                            minHeight: 44,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Icon name="close" size={18} color={COLOR.text.tertiary} />
                        </Pressable>
                      </View>
                    )})}
                    <Pressable
                      onPress={() =>
                        setItems((current) =>
                          current.map((currentItem, currentIndex) =>
                            currentIndex === index
                              ? {
                                  ...currentItem,
                                  mode: 'detail',
                                  lines: [...currentItem.lines, { key: newLineKey(), name: '' }],
                                }
                              : currentItem,
                          ),
                        )
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`${item.label || `고정 지출 항목 ${index + 1}`} 지출 항목 추가`}
                      style={{
                        minHeight: 44,
                        borderTopWidth: 1,
                        borderTopColor: T.line2,
                        marginTop: space.sm,
                        marginHorizontal: -space.lg,
                        paddingHorizontal: space.lg,
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'row',
                        gap: space.xs,
                      }}
                    >
                      <Icon name="plus" size={16} color={COLOR.action.primary} />
                      <Text style={{ ...TYPE.caption, color: COLOR.text.link, fontWeight: '700' }}>
                        지출 항목 추가
                      </Text>
                    </Pressable>
                  </View>
              </Card>
              </View>
            )})}

            {!items.length ? (
              <Card>
                <Text style={{ ...TYPE.body, color: T.ink, fontWeight: '700' }}>
                  설정된 항목이 없어요.
                </Text>
                <Text style={{ ...TYPE.caption, color: COLOR.text.tertiary, marginTop: space.xs }}>
                  월별로 입력할 고정 지출 항목을 추가해 주세요.
                </Text>
              </Card>
            ) : null}

            <Pressable
              onPress={openAdd}
              accessibilityRole="button"
              accessibilityLabel="고정 지출 항목 추가"
              style={{
                minHeight: 52,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: space.xs,
                borderRadius: radius.md,
                borderWidth: 1,
                borderStyle: 'dashed',
                borderColor: COLOR.action.primary,
                backgroundColor: COLOR.action.primaryTint,
              }}
            >
              <Icon name="plus" size={18} color={COLOR.action.primary} sw={2.2} />
              <Text style={{ ...TYPE.caption, color: COLOR.text.link, fontWeight: '800' }}>
                항목 추가
              </Text>
            </Pressable>
          </View>

        </ScrollView>
      </QueryState>

      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: space.md,
          paddingBottom: LAYOUT.scroll.end,
          backgroundColor: T.surface,
          borderTopWidth: 1,
          borderTopColor: T.line2,
        }}
      >
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {reentry ? <Button
            kind="gray"
            size="lg"
            full
            style={{ flex: 1 }}
            disabled={cancelReentry.isPending}
            onPress={() => setConfirmCancelReentry(true)}
          >
            변경 중단
          </Button> : null}
          <Button
            kind="primary"
            size="lg"
            full
            style={{ flex: 1 }}
            disabled={
              reentry
                ? cancelReentry.isPending
                : !dirty || !itemConfigurationValid || save.isPending || loading || Boolean(error)
            }
            loading={save.isPending}
            onPress={() => {
              if (reentry?.nextMonth) {
                router.push(`/recipes/fixed-cost-edit?month=${reentry.nextMonth}&reentry=1` as Href);
              } else {
                setConfirmSave(true);
              }
            }}
          >
            {reentry ? '입력 계속' : '저장'}
          </Button>
        </View>
      </View>

      <ConfirmDialog
        visible={deleteIndex !== null}
        title="고정 지출 항목을 삭제할까요?"
        message={
          deleteIndex !== null
            ? `${items[deleteIndex]?.label ?? ''} 항목을 제외하면 선택 기간의 고정 지출을 다시 입력해야 합니다.`
            : ''
        }
        confirmText="삭제"
        kind="danger"
        onCancel={() => setDeleteIndex(null)}
        onConfirm={() => {
          if (deleteIndex !== null)
            setItems((current) => current.filter((_, index) => index !== deleteIndex));
          setDeleteIndex(null);
        }}
      />
      <Sheet
        visible={basisOpen}
        title="고정 지출 기준 선택"
        onClose={() => setBasisOpen(false)}
      >
        <Card pad={0} style={{ overflow: 'hidden' }}>
          {([1, 2, 3] as FixedCostBasisMonths[]).map((value, index) => (
            <SelectionRow
              key={value}
              label={`당월 제외 최근 ${value}개월`}
              description={completedMonthRangeWithYear(localMonth, value)}
              selected={months === value}
              last={index === 2}
              onPress={() => {
                setMonths(value);
                setBasisOpen(false);
              }}
            />
          ))}
        </Card>
      </Sheet>
      <ConfirmDialog
        visible={confirmSave}
        title="고정 지출 설정을 저장할까요?"
        message={
          itemConfigurationDirty
            ? `항목 구성을 저장한 뒤 당월 제외 최근 ${months}개월의 고정 지출을 다시 입력합니다.`
            : '고정 지출 계산 기간을 저장합니다.'
        }
        confirmText={itemConfigurationDirty ? `저장하고 ${months}개월 다시 입력` : '저장'}
        loading={save.isPending}
        onCancel={() => setConfirmSave(false)}
        onConfirm={onSave}
      />
      <ConfirmDialog
        visible={confirmLeave}
        title="설정을 나갈까요?"
        message="저장하지 않은 변경 내용은 사라집니다."
        confirmText="나가기"
        onCancel={() => setConfirmLeave(false)}
        onConfirm={() => safeBack('/recipes/fixed-cost')}
      />
      <ConfirmDialog
        visible={confirmCancelReentry}
        title="고정 지출 변경을 중단할까요?"
        message="지금까지 입력한 초안은 사라지고 기존 항목과 계산 기준을 계속 사용합니다."
        confirmText="변경 중단"
        kind="danger"
        loading={cancelReentry.isPending}
        onCancel={() => setConfirmCancelReentry(false)}
        onConfirm={() => {
          if (!reentry) return;
          cancelReentry.mutate(
            { sessionId: reentry.id, baseRevision: reentry.revision },
            {
              onSuccess: () => safeBack('/recipes/fixed-cost'),
              onError: (error) => {
                setConfirmCancelReentry(false);
                Alert.alert(
                  '변경을 중단하지 못했어요',
                  error instanceof Error ? error.message : '잠시 후 다시 시도해 주세요.',
                );
              },
            },
          );
        }}
      />
    </View>
  );
}

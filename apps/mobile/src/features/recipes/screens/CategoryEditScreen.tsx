/**
 * 카테고리 설정 — 식재료(MY-03a) · 레시피(RCP-12) · 부자재(RCP-12b)가 같은 화면을 쓴다.
 *
 * 세 화면을 따로 두면 "추가는 되는데 순서 변경은 안 되는" 식으로 기능이 갈라진다.
 * 종류(kind)만 다르고 하는 일은 같으므로 하나로 둔다.
 */
import { useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/kit/ConfirmDialog';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { type Href } from 'expo-router';
import { AppHeader, Badge, Button, Card, Field, Icon, Input, QueryState, Sheet } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { LAYOUT, COLOR, T, controlVisualHeight, space } from '@/theme/tokens';
import {
  useDeleteCategory,
  useReorderCategories,
  useSaveCategory,
  useSettingsLists,
  type CategoryKind,
  type CategoryRow,
} from '@/features/master-data/hooks';

const TITLE: Record<CategoryKind, string> = {
  ingredient: '식재료 카테고리',
  recipe: '레시피 카테고리',
  material: '부자재 카테고리',
};

const USED_LABEL: Record<CategoryKind, string> = {
  ingredient: '식재료',
  recipe: '메뉴',
  material: '부자재',
};

export function CategoryEditScreen({ kind, backTo }: { kind: CategoryKind; backTo: Href }) {
  const lists = useSettingsLists();
  const saveCategory = useSaveCategory();
  const deleteCategory = useDeleteCategory();
  const reorder = useReorderCategories();

  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [reordering, setReordering] = useState<CategoryRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [deleting, setDeleting] = useState<CategoryRow | null>(null);
  const deleteBusy = useRef(false);
  const reorderBusy = useRef(false);

  const rows =
    kind === 'ingredient' ? lists.data?.categories
    : kind === 'recipe' ? lists.data?.recipeCategories
    : lists.data?.materialCategories;
  const items = rows ?? [];

  const openAdd = () => { setEditing(null); setAdding(true); setName(''); };
  const openEdit = (c: CategoryRow) => { setEditing(c); setAdding(true); setName(c.name); };

  const submit = () => {
    const n = name.trim();
    if (n === '') return;
    saveCategory.mutate(
      {
        id: editing?.id,
        name: n,
        kind,
      },
      {
        onSuccess: () => { setAdding(false); setEditing(null); },
        onError: (e) => Alert.alert('저장하지 못했어요', e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요'),
      },
    );
  };

  const confirmDelete = (c: CategoryRow) => {
    if (kind !== 'ingredient') { setDeleting(c); return; }
    Alert.alert(`${c.name} 삭제`, `이 카테고리를 쓰는 ${USED_LABEL[kind]}가 있으면 지울 수 없어요.`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () =>
          deleteCategory.mutate(c.id, {
            onError: (e) => Alert.alert('삭제하지 못했어요', e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요'),
          }),
      },
    ]);
  };

  /** 순서 바꾸기 — 드래그 대신 위/아래 버튼. 터치 대상이 명확하고 실수로 섞이지 않는다. */
  const move = (index: number, dir: -1 | 1) => {
    if (kind !== 'ingredient' && (reorderBusy.current || reorder.isPending)) return;
    const next = [...items];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    const a = next[index]!;
    next[index] = next[j]!;
    next[j] = a;
    if (kind !== 'ingredient') reorderBusy.current = true;
    reorder.mutate(next.map((c) => c.id), {
      onSuccess: () => { reorderBusy.current = false; },
      onError: (e) => { reorderBusy.current = false; Alert.alert('순서를 바꾸지 못했어요', e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요'); },
    });
  };

  /** 두 28×20 버튼의 터치 영역이 겹치지 않도록 한 개의 44×44 진입점에서 방향 시트를 연다. */
  const chooseMove = (index: number, dir: -1 | 1) => {
    setReordering(null);
    move(index, dir);
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader
        title={TITLE[kind]}
        onBack={() => safeBack(backTo)}
        right={
          <Pressable
            onPress={openAdd}
            hitSlop={6}
            accessibilityRole="button" accessibilityLabel="카테고리 추가"
            style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="plus" size={24} color={COLOR.action.primary} />
          </Pressable>
        }
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: LAYOUT.scroll.end }}>
        <Text style={{ fontSize: 14, color: COLOR.text.tertiary, marginHorizontal: 4, marginBottom: space.sm }}>
          {kind === 'ingredient' ? '순서 변경 버튼으로 이동 · 이름을 탭하면 이름 수정' : '위·아래 화살표로 순서 변경 · 탭하면 이름 수정'}
        </Text>

        <QueryState
          isLoading={lists.isLoading}
          error={lists.error}
          isEmpty={items.length === 0}
          onRetry={() => void lists.refetch()}
          emptyTitle="등록된 카테고리가 없어요"
          emptyHint="오른쪽 위 + 로 추가해 주세요"
        >
          <Card pad={0} style={{ overflow: 'hidden' }}>
            {items.map((c, i) => (
              <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: kind === 'ingredient' ? space.sm : 0, paddingLeft: space.sm, paddingRight: 12, borderBottomWidth: i < items.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}>
                {kind === 'ingredient' ? <Pressable
                  onPress={() => setReordering(c)}
                  disabled={items.length < 2}
                  accessibilityRole="button"
                  accessibilityLabel={`${c.name} 순서 변경`}
                  accessibilityState={{ disabled: items.length < 2 }}
                  style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: items.length < 2 ? 0.25 : 1 }}
                >
                  <Icon name="swap" size={20} color={T.sub2} />
                </Pressable> : <View>
                  {([-1, 1] as const).map((direction) => {
                    const disabled = reorder.isPending || i + direction < 0 || i + direction >= items.length;
                    return <Pressable key={direction} onPress={() => move(i, direction)} disabled={disabled}
                      accessibilityRole="button" accessibilityLabel={`${c.name} ${direction < 0 ? '위로' : '아래로'} 이동`}
                      accessibilityState={{ disabled }}
                      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.3 : 1 }}>
                      <View style={{ transform: [{ rotate: direction < 0 ? '180deg' : '0deg' }] }}>
                        <Icon name="chevronDown" size={16} color={T.sub2} />
                      </View>
                    </Pressable>;
                  })}
                </View>}
                <Pressable onPress={() => openEdit(c)} accessibilityRole="button" accessibilityLabel={`${c.name} 수정`} style={{ flex: 1, minWidth: 0, paddingVertical: 4 }}>
                  <Text style={{ maxWidth: '100%', fontSize: 16, fontWeight: '600', color: T.ink }}>{c.name}</Text>
                  <Text style={{ fontSize: 14, color: COLOR.text.tertiary, marginTop: space.xs }}>
                    {USED_LABEL[kind]} {c.usedCount}개
                  </Text>
                </Pressable>
                <Pressable onPress={() => confirmDelete(c)} hitSlop={{ top: 6, bottom: 6, left: 4, right: 8 }} accessibilityRole="button" accessibilityLabel={`${c.name} 삭제`} style={{ width: controlVisualHeight.sm, height: controlVisualHeight.sm, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="close" size={19} color={COLOR.text.tertiary} />
                </Pressable>
              </View>
            ))}
          </Card>
        </QueryState>

        <Pressable
          onPress={openAdd}
          accessibilityRole="button" accessibilityLabel="카테고리 추가"
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs, paddingVertical: space.md, marginTop: 12, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: COLOR.action.primary, backgroundColor: COLOR.action.primaryTint }}
        >
          <Icon name="plus" size={18} color={COLOR.action.primary} sw={2.2} />
          <Text style={{ fontSize: 14, fontWeight: '700', color: COLOR.text.link }}>카테고리 추가</Text>
        </Pressable>
      </ScrollView>

      <Sheet
        visible={reordering !== null}
        onClose={() => setReordering(null)}
        title={reordering ? `${reordering.name} 순서 변경` : '순서 변경'}
        sub="이동할 방향을 골라 주세요."
        height={330}
      >
        {reordering ? (() => {
          const index = items.findIndex((item) => item.id === reordering.id);
          return (
            <View style={{ gap: space.sm }}>
              <Button kind="gray" size="lg" full icon="up" disabled={index <= 0} onPress={() => chooseMove(index, -1)}>
                위로 이동
              </Button>
              <Button kind="gray" size="lg" full icon="down" disabled={index < 0 || index >= items.length - 1} onPress={() => chooseMove(index, 1)}>
                아래로 이동
              </Button>
              <Button kind="ghost" size="lg" full onPress={() => setReordering(null)}>취소</Button>
            </View>
          );
        })() : null}
      </Sheet>

      <Sheet
        visible={adding}
        onClose={() => { setAdding(false); setEditing(null); }}
        title={editing ? '카테고리 수정' : '카테고리 추가'}
        height={kind === 'ingredient' ? 420 : undefined}
      >
        <Field label="이름" req variant={kind === 'ingredient' ? undefined : 'stacked'}>
          <Input variant={kind === 'ingredient' ? undefined : 'stacked'} value={name} onChangeText={setName} placeholder={kind === 'ingredient' ? '예) 농산(신선)' : '카테고리 이름'} accessibilityLabel="카테고리 이름" returnKeyType="done" onSubmitEditing={submit} />
        </Field>
        <View style={{ flexDirection: 'row', gap: space.sm, marginTop: 8 }}>
          <View style={{ flex: 1 }}><Button kind={kind === 'ingredient' ? 'ghost' : 'gray'} size="lg" full onPress={() => { setAdding(false); setEditing(null); }}>취소</Button></View>
          <View style={{ flex: kind === 'ingredient' ? 2 : 1 }}>
            <Button kind="primary" size="lg" full loading={saveCategory.isPending} disabled={name.trim() === ''} onPress={submit}>
              {editing ? '저장' : '추가'}
            </Button>
          </View>
        </View>
      </Sheet>
      <ConfirmDialog visible={deleting !== null} title="카테고리 삭제"
        message="이 카테고리를 사용하는 항목이 있으면 지울 수 없어요."
        loading={deleteCategory.isPending} onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting || deleteBusy.current || deleteCategory.isPending) return;
          deleteBusy.current = true;
          deleteCategory.mutate(deleting.id, {
            onSuccess: () => setDeleting(null),
            onError: (e) => Alert.alert('삭제하지 못했어요', e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요'),
            onSettled: () => { deleteBusy.current = false; },
          });
        }} />
    </View>
  );
}

/**
 * 카테고리 설정 — 식재료(MY-03a) · 레시피(RCP-12) · 부자재(RCP-12b)가 같은 화면을 쓴다.
 *
 * 세 화면을 따로 두면 "추가는 되는데 순서 변경은 안 되는" 식으로 기능이 갈라진다.
 * 종류(kind)만 다르고 하는 일은 같으므로 하나로 둔다.
 */
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { type Href } from 'expo-router';
import { AppHeader, Badge, Button, Card, Field, Icon, Input, QueryState, Sheet } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { T } from '@/theme/tokens';
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
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

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
    const next = [...items];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    const a = next[index]!;
    next[index] = next[j]!;
    next[j] = a;
    reorder.mutate(next.map((c) => c.id), {
      onError: (e) => Alert.alert('순서를 바꾸지 못했어요', e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요'),
    });
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
            <Icon name="plus" size={24} color={T.blue} />
          </Pressable>
        }
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 28 }}>
        <Text style={{ fontSize: 14, color: T.ter, marginHorizontal: 4, marginBottom: 10 }}>
          위·아래 화살표로 순서 변경 · 탭하면 {kind === 'ingredient' ? '이름·로스율' : '이름'} 수정
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
              <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingLeft: 10, paddingRight: 12, borderBottomWidth: i < items.length - 1 ? 1 : 0, borderBottomColor: T.line2 }}>
                <View style={{ gap: 2 }}>
                  <Pressable onPress={() => move(i, -1)} disabled={i === 0} hitSlop={4} accessibilityRole="button" accessibilityLabel={`${c.name} 위로`} style={{ width: 28, height: 20, alignItems: 'center', justifyContent: 'center', opacity: i === 0 ? 0.25 : 1 }}>
                    <Icon name="up" size={16} color={T.sub2} />
                  </Pressable>
                  <Pressable onPress={() => move(i, 1)} disabled={i === items.length - 1} hitSlop={4} accessibilityRole="button" accessibilityLabel={`${c.name} 아래로`} style={{ width: 28, height: 20, alignItems: 'center', justifyContent: 'center', opacity: i === items.length - 1 ? 0.25 : 1 }}>
                    <Icon name="down" size={16} color={T.sub2} />
                  </Pressable>
                </View>
                <Pressable onPress={() => openEdit(c)} accessibilityRole="button" accessibilityLabel={`${c.name} 수정`} style={{ flex: 1, minWidth: 0, paddingVertical: 4 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: T.ink }} numberOfLines={1}>{c.name}</Text>
                  <Text style={{ fontSize: 14, color: T.ter, marginTop: 2 }}>
                    {USED_LABEL[kind]} {c.usedCount}개
                  </Text>
                </Pressable>
                <Pressable onPress={() => confirmDelete(c)} hitSlop={4} accessibilityRole="button" accessibilityLabel={`${c.name} 삭제`} style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="close" size={19} color={T.ter} />
                </Pressable>
              </View>
            ))}
          </Card>
        </QueryState>

        <Pressable
          onPress={openAdd}
          accessibilityRole="button" accessibilityLabel="카테고리 추가"
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 15, marginTop: 12, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: T.blue, backgroundColor: T.blueTint }}
        >
          <Icon name="plus" size={18} color={T.blue} sw={2.2} />
          <Text style={{ fontSize: 14, fontWeight: '700', color: T.blue }}>카테고리 추가</Text>
        </Pressable>
      </ScrollView>

      <Sheet
        visible={adding}
        onClose={() => { setAdding(false); setEditing(null); }}
        title={editing ? '카테고리 수정' : '카테고리 추가'}
        height={kind === 'ingredient' ? 420 : 340}
      >
        <Field label="이름" req>
          <Input value={name} onChangeText={setName} placeholder="예) 농산(신선)" accessibilityLabel="카테고리 이름" returnKeyType="done" onSubmitEditing={submit} />
        </Field>
        <View style={{ flexDirection: 'row', gap: 9, marginTop: 8 }}>
          <View style={{ flex: 1 }}><Button kind="ghost" size="lg" full onPress={() => { setAdding(false); setEditing(null); }}>취소</Button></View>
          <View style={{ flex: 2 }}>
            <Button kind="primary" size="lg" full loading={saveCategory.isPending} disabled={name.trim() === ''} onPress={submit}>
              {editing ? '저장' : '추가'}
            </Button>
          </View>
        </View>
      </Sheet>
    </View>
  );
}

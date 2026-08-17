/**
 * 부자재 카테고리 설정 — 추가·수정·삭제(인라인 편집). 카테고리 허브에서 진입.
 * ⚠ 디자인 프로토타입(로컬 상태). 실제 저장은 데이터 연결 단계에서.
 */
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { AppHeader, Card, Icon, Input } from '@/components/kit';
import { safeBack } from '@/lib/nav';
import { T } from '@/theme/tokens';
import { MATERIAL_CATS } from '../demoData';

export default function MaterialCategoryScreen() {
  const [cats, setCats] = useState<string[]>(MATERIAL_CATS);
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState('');

  const startEdit = (i: number) => { setEditing(i); setDraft(cats[i] ?? ''); };
  const save = () => {
    if (editing == null) return;
    setCats((cs) => cs.map((c, k) => (k === editing ? draft.trim() || c : c)).filter((c) => c.trim()));
    setEditing(null);
  };
  const cancel = () => {
    if (editing != null && !(cats[editing] ?? '').trim()) setCats((cs) => cs.filter((_, k) => k !== editing));
    setEditing(null);
  };
  const remove = (i: number) => setCats((cs) => cs.filter((_, k) => k !== i));
  const add = () => { setCats((cs) => [...cs, '']); setEditing(cats.length); setDraft(''); };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AppHeader
        title="부자재 카테고리"
        onBack={() => safeBack('/my/categories')}
        right={
          <Pressable onPress={() => safeBack('/my/categories')} hitSlop={6} style={{ paddingHorizontal: 8, paddingVertical: 8 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: T.blue }}>완료</Text>
          </Pressable>
        }
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 }}>
        <Card pad={0} style={{ overflow: 'hidden' }}>
          {cats.map((c, i) => {
            const on = editing === i;
            return (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingLeft: 15, paddingRight: 12, borderBottomWidth: i < cats.length - 1 ? 1 : 0, borderBottomColor: T.line2, backgroundColor: on ? T.blueTint : T.surface }}>
                {on ? (
                  <>
                    <View style={{ flex: 1 }}><Input value={draft} placeholder="카테고리 이름" onChangeText={setDraft} /></View>
                    <Pressable onPress={cancel} style={{ paddingVertical: 9, paddingHorizontal: 12, borderWidth: 1, borderColor: T.line, backgroundColor: T.surface, borderRadius: 9 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: T.sub }}>취소</Text>
                    </Pressable>
                    <Pressable onPress={save} style={{ paddingVertical: 9, paddingHorizontal: 14, backgroundColor: T.blue, borderRadius: 9 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: T.onColor }}>저장</Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Icon name="grip" size={20} color={T.line3} />
                    <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: T.ink }}>{c}</Text>
                    <Pressable onPress={() => startEdit(i)} hitSlop={4} style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="edit" size={18} color={T.ter} sw={2} />
                    </Pressable>
                    <Pressable onPress={() => remove(i)} hitSlop={4} style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="close" size={19} color={T.ter} />
                    </Pressable>
                  </>
                )}
              </View>
            );
          })}
        </Card>
        <Pressable onPress={add} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 15, marginTop: 12, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: T.blue, backgroundColor: T.blueTint }}>
          <Icon name="plus" size={18} color={T.blue} sw={2.2} />
          <Text style={{ fontSize: 14, fontWeight: '700', color: T.blue }}>카테고리 추가</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

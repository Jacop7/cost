/**
 * ING-02 메모 편집 — 바텀시트 팝업. 상세 메모 카드의 '수정'에서 호출.
 * TextInput(멀티라인) · 글자수 카운트 · 취소/완료. ⚠ 프로토타입: 저장은 상위 로컬 상태에만 반영.
 */
import { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { Button, Sheet } from '@/components/kit';
import { T } from '@/theme/tokens';

export function MemoEditSheet({ visible, value, maxLength = 100, onClose, onSave }: {
  visible: boolean;
  value: string;
  maxLength?: number;
  onClose: () => void;
  onSave: (next: string) => void;
}) {
  const [draft, setDraft] = useState(value);

  // 열릴 때 현재 메모로 초기화.
  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  return (
    <Sheet visible={visible} onClose={onClose} title="메모 편집">
      <TextInput
        value={draft}
        onChangeText={setDraft}
        maxLength={maxLength}
        multiline
        autoFocus
        placeholder="메모를 입력하세요"
        placeholderTextColor={T.ter}
        style={{ backgroundColor: T.surface2, borderRadius: 12, padding: 14, fontSize: 16, lineHeight: 22, color: T.ink, minHeight: 100, textAlignVertical: 'top' }}
      />
      <Text style={{ textAlign: 'right', fontSize: 13, color: T.ter, marginTop: 8 }}>
        {draft.length} / {maxLength}
      </Text>

      <View style={{ flexDirection: 'row', gap: 9, marginTop: 16 }}>
        <Button kind="gray" size="lg" onPress={onClose} style={{ flex: 1 }}>
          취소
        </Button>
        <Button kind="primary" size="lg" onPress={() => onSave(draft.trim())} style={{ flex: 1.4 }}>
          완료
        </Button>
      </View>
    </Sheet>
  );
}

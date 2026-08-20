/**
 * 메모 편집 시트 — **식재료(ING-02)와 레시피(RCP-02)가 함께 쓴다**.
 *
 * 두 상세가 같은 자리에 같은 모양으로 메모를 보여 주므로 편집도 같아야 한다.
 * 한쪽만 전체 수정 폼으로 튀면 같은 일을 하는데 손이 달라진다.
 *
 * TextInput(멀티라인) · 글자수 카운트 · 취소/완료. 저장은 상위가 서버로 보낸다.
 */
import { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { Button, Sheet } from '@/components/kit';
import { T } from '@/theme/tokens';

export function MemoEditSheet({ visible, value, maxLength = 100, saving = false, onClose, onSave }: {
  visible: boolean;
  value: string;
  maxLength?: number;
  /** 서버 저장 중. 완료 버튼이 두 번 눌리지 않게 한다. */
  saving?: boolean;
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
        <Button kind="gray" size="lg" disabled={saving} onPress={onClose} style={{ flex: 1 }}>
          취소
        </Button>
        <Button kind="primary" size="lg" loading={saving} onPress={() => onSave(draft.trim())} style={{ flex: 1.4 }}>
          완료
        </Button>
      </View>
    </Sheet>
  );
}

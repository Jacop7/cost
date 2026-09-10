/**
 * 메모 편집 시트 — **식재료(ING-02)와 레시피(RCP-02)가 함께 쓴다**.
 *
 * 두 상세가 같은 자리에 같은 모양으로 메모를 보여 주므로 편집도 같아야 한다.
 * 한쪽만 전체 수정 폼으로 튀면 같은 일을 하는데 손이 달라진다.
 *
 * TextInput(멀티라인) · 글자수 카운트 · 취소/완료. 저장은 상위가 서버로 보낸다.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, Text, TextInput, View } from 'react-native';
import { Button } from './Button';
import { Sheet } from './Sheet';
import { COLOR, T, TYPE, space } from '@/theme/tokens';

export function MemoEditSheet({ visible, value, maxLength = 100, saving = false, saveDisabled = false, readOnly = false, onChange, onClose, onSave, children, recoveryContent }: {
  visible: boolean;
  value: string;
  maxLength?: number;
  /** 서버 저장 중. 완료 버튼이 두 번 눌리지 않게 한다. */
  saving?: boolean;
  saveDisabled?: boolean;
  readOnly?: boolean;
  /** 부모가 저장 중 수정·재조회 충돌을 구분해야 할 때 사용하는 제어형 초안. */
  onChange?: (next: string) => void;
  onClose: () => void;
  onSave: (next: string) => void;
  /** Inline recovery content; keeping the sheet mounted preserves the draft. */
  children?: ReactNode;
  /** Optional recovery before the input; existing consumers keep children below the counter. */
  recoveryContent?: ReactNode;
}) {
  const [draft, setDraft] = useState(value);
  const baseline = useRef(value);
  const dirty = useRef(false);
  const controlled = onChange !== undefined;
  const currentDraft = controlled ? value : draft;

  // 한 대상의 편집 세션에서만 초안을 보존한다. 소비처는 대상 ID를 key로 준다.
  // 재조회는 미수정 값만 갱신하며, 닫은 뒤 재열면 최신 서버 값으로 초기화한다.
  useEffect(() => {
    if (!visible) { dirty.current = false; return; }
    if (!controlled && !dirty.current) { baseline.current = value; setDraft(value); }
  }, [visible, value, controlled]);

  return (
    <Sheet visible={visible} onClose={() => { if (!saving) onClose(); }} title="메모 수정" footer={
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button kind="gray" size="md" disabled={saving} onPress={onClose} style={{ flex: 1 }}>취소</Button>
        <Button kind="primary" size="md" loading={saving} disabled={saveDisabled || readOnly} onPress={() => onSave(currentDraft.trim())} style={{ flex: 1 }}>완료</Button>
      </View>
    }>
      {recoveryContent}
      <TextInput
        accessibilityLabel="메모"
        value={currentDraft}
        onChangeText={(next) => {
          if (onChange) { onChange(next); return; }
          dirty.current = next !== baseline.current;
          setDraft(next);
        }}
        maxLength={maxLength}
        multiline
        autoFocus={!readOnly}
        editable={!readOnly}
        placeholder="메모를 입력하세요"
        placeholderTextColor={COLOR.text.tertiary}
        style={{ backgroundColor: T.surface2, borderRadius: 12, padding: space.md, ...TYPE.caption, fontWeight: '400', color: T.ink, minHeight: 106, textAlignVertical: 'top',
          ...(Platform.OS === 'web' ? { outlineColor: COLOR.action.primary, outlineWidth: 1 } : {}) }}
      />
      <Text style={{ textAlign: 'right', fontSize: 13, color: COLOR.text.tertiary, marginTop: 8 }}>
        {currentDraft.length} / {maxLength}
      </Text>
      {children}

    </Sheet>
  );
}

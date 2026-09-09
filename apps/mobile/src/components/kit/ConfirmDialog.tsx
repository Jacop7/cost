import { Modal, Pressable, Text, View } from 'react-native';
import { Button } from './Button';
import { T, TYPE, space, radius } from '@/theme/tokens';

/** 파괴적 작업의 명시적 확인. 취소/닫기는 쓰기를 호출하지 않는다. */
export function ConfirmDialog({ visible, title, message, loading = false, onCancel, onConfirm }: {
  visible: boolean; title: string; message: string; loading?: boolean;
  onCancel: () => void; onConfirm: () => void;
}) {
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { if (!loading) onCancel(); }}>
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: space.lg }}>
      <Pressable accessibilityRole="button" accessibilityLabel="삭제 확인 닫기" disabled={loading} onPress={onCancel}
        style={{ position: 'absolute', inset: 0, backgroundColor: T.scrim }} />
      <View accessibilityViewIsModal style={{ width: '100%', maxWidth: 340, backgroundColor: T.surface, borderRadius: radius.xl, overflow: 'hidden' }}>
        <View style={{ padding: space.lg, gap: space.md }}>
          <Text style={{ ...TYPE.header, textAlign: 'center', color: T.ink }}>{title}</Text>
          <Text style={{ ...TYPE.caption, fontWeight: '400', textAlign: 'center', color: T.sub }}>{message}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: space.sm, padding: space.md, borderTopWidth: 1, borderTopColor: T.line2 }}>
          <Button kind="gray" size="md" style={{ flex: 1 }} disabled={loading} onPress={onCancel}>취소</Button>
          <Button kind="danger" size="md" style={{ flex: 1 }} loading={loading} onPress={onConfirm}>삭제</Button>
        </View>
      </View>
    </View>
  </Modal>;
}

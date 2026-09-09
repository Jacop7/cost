import type { ReactNode } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { Button } from './Button';
import { T, TYPE, space, radius } from '@/theme/tokens';

/** 파괴적 작업의 명시적 확인. 취소/닫기는 쓰기를 호출하지 않는다. */
export function ConfirmDialog({ visible, title, message, children, loading = false, onCancel, onConfirm,
  confirmText = '삭제', cancelText = '취소', kind = 'danger', closeLabel = '삭제 확인 닫기' }: {
  visible: boolean; title: string; message?: string; children?: ReactNode; loading?: boolean;
  confirmText?: string; cancelText?: string | null; kind?: 'primary' | 'danger'; closeLabel?: string;
  onCancel: () => void; onConfirm: () => void;
}) {
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { if (!loading) onCancel(); }}>
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: space.lg }}>
      <Pressable accessibilityRole="button" accessibilityLabel={closeLabel} disabled={loading} onPress={onCancel}
        style={{ position: 'absolute', inset: 0, backgroundColor: T.scrim }} />
      <View accessibilityViewIsModal style={{ width: '100%', maxWidth: 340, backgroundColor: T.surface, borderRadius: radius.xl, overflow: 'hidden' }}>
        <View style={{ paddingTop: space.lg, paddingHorizontal: kind === 'primary' ? space.xl : space.lg, paddingBottom: space.md, gap: space.md }}>
          <Text style={{ ...TYPE.header, textAlign: 'center', color: T.ink }}>{title}</Text>
          {message ? <Text style={{ ...TYPE.caption, fontWeight: '400', textAlign: 'center', color: T.sub }}>{message}</Text> : null}
          {children}
        </View>
        <View style={{ flexDirection: 'row', gap: space.sm, paddingHorizontal: kind === 'primary' ? space.xl : space.md, paddingTop: kind === 'primary' ? space.xs : space.md, paddingBottom: space.lg, borderTopWidth: kind === 'primary' ? 0 : 1, borderTopColor: T.line2 }}>
          {cancelText ? <Button kind="gray" size="md" style={{ flex: 1 }} disabled={loading} onPress={onCancel}>{cancelText}</Button> : null}
          <Button kind={kind} size="md" style={{ flex: 1 }} loading={loading} onPress={onConfirm}>{confirmText}</Button>
        </View>
      </View>
    </View>
  </Modal>;
}

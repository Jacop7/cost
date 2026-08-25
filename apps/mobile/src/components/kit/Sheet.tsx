/**
 * Sheet — 바텀시트(ING-04 재고수정, ORD-03 입고확정 등). kit.jsx Sheet 이식.
 * 웹의 dim+blur 부모는 RN Modal + 반투명 backdrop 으로 대체.
 */
import { ReactElement, ReactNode } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { T } from '@/theme/tokens';
import { Button } from './index';

export function Sheet({ visible, onClose, children, title, sub, height, headerRight, scroll = true }: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  sub?: string;
  height?: number | string;
  headerRight?: ReactElement;
  scroll?: boolean; // false면 스크롤 없이 flex 컨테이너 (자체 레이아웃·하단 고정 버튼용)
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* 배경 탭으로 닫기. 스크린리더가 "닫기"로 읽을 수 있어야 하고, Android 하드웨어 back 은
          onRequestClose 가 같은 결과를 낸다(가이드 §9.12-8 — 두 경로의 결과를 일치시킨다). */}
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="닫기"
        style={{ flex: 1, backgroundColor: T.scrim }}
      />
      <View accessibilityViewIsModal style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: T.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, height: height as number | undefined, maxHeight: '90%', shadowColor: '#000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.15, shadowRadius: 40, elevation: 16 }}>
        <View style={{ alignItems: 'center', paddingTop: 10 }}>
          <View style={{ width: 38, height: 5, borderRadius: 3, backgroundColor: T.line }} />
        </View>
        {title ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: T.ink, letterSpacing: -0.4 }}>{title}</Text>
              {sub ? <Text style={{ fontSize: 16, color: T.sub2, marginTop: 3, fontWeight: '600' }}>{sub}</Text> : null}
            </View>
            {headerRight}
          </View>
        ) : null}
        {scroll ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 40 }}>{children}</ScrollView>
        ) : (
          <View style={{ flex: 1, paddingTop: 14 }}>{children}</View>
        )}
      </View>
    </Modal>
  );
}

/**
 * 확인 시트 — 프로토타입 `.sheet-actions` (취소 / 적용 2열).
 *
 * ⚠ `Alert.alert()` 을 쓰면 **웹에서 아무 일도 안 일어난다.**
 *   `react-native-web` 의 구현이 빈 함수다 —
 *       class Alert { static alert() {} }
 *   그래서 확인창이 필요한 버튼이 죽은 것처럼 보인다(실제로 '영업 시작'이 그랬다).
 *   프로토타입도 확인을 바텀시트로 하므로 앱도 이걸 쓴다.
 */
export function ConfirmSheet({
  visible, title, message, confirmText = '확인', cancelText = '취소', loading, onCancel, onConfirm,
}: {
  visible: boolean;
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Sheet visible={visible} onClose={onCancel} title={title} scroll={false}>
      {message ? (
        <Text style={{ fontSize: 15, lineHeight: 23, color: T.sub, marginTop: 2 }}>{message}</Text>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 18, marginBottom: 6 }}>
        <View style={{ flex: 1 }}>
          <Button kind="ghost" size="lg" full onPress={onCancel}>{cancelText}</Button>
        </View>
        <View style={{ flex: 1 }}>
          <Button kind="primary" size="lg" full loading={loading} onPress={onConfirm}>{confirmText}</Button>
        </View>
      </View>
    </Sheet>
  );
}

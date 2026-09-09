/**
 * Sheet — 바텀시트(ING-04 재고수정, ORD-03 입고확정 등). kit.jsx Sheet 이식.
 * 웹의 dim+blur 부모는 RN Modal + 반투명 backdrop 으로 대체.
 */
import { ReactElement, ReactNode } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LAYOUT, T, TYPE, radius, shadow, space } from '@/theme/tokens';
import { Button } from './Button';

export function Sheet({ visible, onClose, children, title, sub, height, headerRight, scroll = true, footer }: {
  footer?: ReactNode;
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  sub?: string;
  height?: number | string;
  headerRight?: ReactElement;
  scroll?: boolean; // false면 스크롤 없이 flex 컨테이너 (자체 레이아웃·하단 고정 버튼용)
}) {
  const insets = useSafeAreaInsets();
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
      <View accessibilityViewIsModal style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: T.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, height: height as number | undefined, maxHeight: '90%', ...shadow.sheet }}>
        <View style={{ alignItems: 'center', paddingTop: space.sm }}>
          <View style={{ width: 38, height: 5, borderRadius: radius.full, backgroundColor: T.line }} />
        </View>
        {title ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: T.ink, letterSpacing: TYPE.title.letterSpacing }}>{title}</Text>
              {sub ? <Text style={{ fontSize: 16, color: T.sub2, marginTop: space.xs, fontWeight: '600' }}>{sub}</Text> : null}
            </View>
            {headerRight}
          </View>
        ) : null}
        {scroll ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: space.md, paddingBottom: footer ? space.md : LAYOUT.scroll.end + insets.bottom }}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={{ flex: 1, paddingTop: space.md, paddingBottom: insets.bottom }}>{children}</View>
        )}
        {footer ? <View style={{ paddingHorizontal: 20, paddingTop: space.md, paddingBottom: space.lg + insets.bottom, borderTopWidth: 1, borderTopColor: T.line2 }}>{footer}</View> : null}
      </View>
    </Modal>
  );
}

/**
 * 확인 시트 — 프로토타입 `.sheet-actions` (취소 / 적용 2열).
 *
 * RNWeb 원본 Alert는 빈 함수지만 앱 루트의 WebAlertHost가 공용 Sheet로 보완한다.
 * 이 컴포넌트는 그 전역 보정에 의존하지 않고 앱의 공용 확인 UI를 제공한다.
 */
export function ConfirmSheet({
  visible, title, message, confirmText = '확인', cancelText = '취소', loading, onCancel, onConfirm, compact = false,
}: {
  visible: boolean;
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
  compact?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Sheet visible={visible} onClose={onCancel} title={title} scroll={compact} footer={compact ? (
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button kind="gray" size="md" disabled={loading} style={{ flex: 1 }} onPress={onCancel}>{cancelText}</Button>
        <Button kind="primary" size="md" loading={loading} style={{ flex: 1 }} onPress={onConfirm}>{confirmText}</Button>
      </View>
    ) : undefined}>
      {message ? (
        <Text style={{ fontSize: TYPE.body.fontSize, lineHeight: TYPE.body.lineHeight, color: T.sub, marginTop: space.xs }}>{message}</Text>
      ) : null}
      {!compact ? <View style={{ flexDirection: 'row', gap: 8, marginTop: space.lg, marginBottom: space.sm }}>
        <View style={{ flex: 1 }}>
          <Button kind="ghost" size="lg" full onPress={onCancel}>{cancelText}</Button>
        </View>
        <View style={{ flex: 1 }}>
          <Button kind="primary" size="lg" full loading={loading} onPress={onConfirm}>{confirmText}</Button>
        </View>
      </View> : null}
    </Sheet>
  );
}

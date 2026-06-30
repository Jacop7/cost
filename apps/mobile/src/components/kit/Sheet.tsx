/**
 * Sheet — 바텀시트(ING-04 재고수정, ORD-03 입고확정 등). kit.jsx Sheet 이식.
 * 웹의 dim+blur 부모는 RN Modal + 반투명 backdrop 으로 대체.
 */
import { ReactElement, ReactNode } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { T } from '@/theme/tokens';

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
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: T.scrim }} />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: T.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, height: height as number | undefined, maxHeight: '90%', shadowColor: '#000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.15, shadowRadius: 40, elevation: 16 }}>
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

import { Modal, Pressable, Text, View } from 'react-native';

import { COLOR, COMPONENT, T, radius } from '@/theme/tokens';

export interface ActionSheetItem {
  label: string;
  accessibilityLabel?: string;
  danger?: boolean;
  onPress: () => void;
}

/**
 * 짧은 행동 목록용 공용 시트.
 *
 * 기존 Expo 시각값은 유지하고, 배경 닫기 버튼과 행동 버튼만 형제로 분리한다.
 * 버튼 안에 버튼을 넣으면 웹 DOM과 보조기술의 클릭 경계가 모두 깨진다.
 */
export function ActionSheet({ visible, onClose, items, closeLabel = '닫기' }: {
  visible: boolean;
  onClose: () => void;
  items: ActionSheetItem[];
  closeLabel?: string;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="메뉴 닫기"
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: T.scrim }}
      />
      <View
        accessibilityViewIsModal
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: T.surface,
          borderTopLeftRadius: COMPONENT.actionSheet.sheetRadius,
          borderTopRightRadius: COMPONENT.actionSheet.sheetRadius,
          paddingHorizontal: COMPONENT.actionSheet.paddingHorizontal,
          paddingTop: COMPONENT.actionSheet.paddingTop,
          paddingBottom: COMPONENT.actionSheet.paddingBottom,
        }}
      >
        <View style={{ alignItems: 'center', paddingBottom: COMPONENT.actionSheet.handleGap }}>
          <View style={{ width: COMPONENT.actionSheet.handleWidth, height: COMPONENT.actionSheet.handleHeight, borderRadius: radius.full, backgroundColor: T.line }} />
        </View>
        <View style={{ backgroundColor: T.surface2, borderRadius: COMPONENT.actionSheet.groupRadius, overflow: 'hidden', marginBottom: COMPONENT.actionSheet.groupGap }}>
          {items.map((item, index) => (
            <Pressable
              key={item.label}
              onPress={() => { onClose(); item.onPress(); }}
              accessibilityRole="button"
              accessibilityLabel={item.accessibilityLabel ?? item.label}
              style={{ paddingVertical: COMPONENT.actionSheet.rowPaddingVertical, alignItems: 'center', borderTopWidth: index > 0 ? 1 : 0, borderTopColor: T.line }}
            >
              <Text style={{ fontSize: COMPONENT.actionSheet.textSize, fontWeight: COMPONENT.actionSheet.textWeight, color: item.danger ? COLOR.status.negative : T.ink }}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
          style={{ paddingVertical: COMPONENT.actionSheet.rowPaddingVertical, borderRadius: COMPONENT.actionSheet.groupRadius, backgroundColor: T.surface2, alignItems: 'center' }}
        >
          <Text style={{ fontSize: COMPONENT.actionSheet.textSize, fontWeight: COMPONENT.actionSheet.textWeight, color: T.ink }}>{closeLabel}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

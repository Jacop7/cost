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
export function ActionSheet({ visible, onClose, items, closeLabel = '닫기', floating = false }: {
  floating?: boolean;
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
          left: floating ? COMPONENT.actionSheet.floating.inset : 0,
          right: floating ? COMPONENT.actionSheet.floating.inset : 0,
          bottom: floating ? COMPONENT.actionSheet.floating.bottom : 0,
          backgroundColor: floating ? 'transparent' : T.surface,
          borderTopLeftRadius: COMPONENT.actionSheet.sheetRadius,
          borderTopRightRadius: COMPONENT.actionSheet.sheetRadius,
          paddingHorizontal: floating ? 0 : COMPONENT.actionSheet.paddingHorizontal,
          paddingTop: floating ? 0 : COMPONENT.actionSheet.paddingTop,
          paddingBottom: floating ? 0 : COMPONENT.actionSheet.paddingBottom,
        }}
      >
        {!floating ? <View style={{ alignItems: 'center', paddingBottom: COMPONENT.actionSheet.handleGap }}>
          <View style={{ width: COMPONENT.actionSheet.handleWidth, height: COMPONENT.actionSheet.handleHeight, borderRadius: radius.full, backgroundColor: T.line }} />
        </View> : null}
        <View style={{ backgroundColor: floating ? T.surface : T.surface2, borderRadius: COMPONENT.actionSheet.groupRadius, overflow: 'hidden', marginBottom: COMPONENT.actionSheet.groupGap }}>
          {items.map((item, index) => (
            <Pressable
              key={item.label}
              onPress={() => { onClose(); item.onPress(); }}
              accessibilityRole="button"
              accessibilityLabel={item.accessibilityLabel ?? item.label}
              style={{ minHeight: floating ? COMPONENT.actionSheet.floating.rowHeight : undefined, justifyContent: 'center', paddingVertical: floating ? 0 : COMPONENT.actionSheet.rowPaddingVertical, alignItems: 'center', borderTopWidth: index > 0 ? 1 : 0, borderTopColor: floating ? T.line2 : T.line }}
            >
              <Text style={{ fontSize: floating ? COMPONENT.actionSheet.floating.textSize : COMPONENT.actionSheet.textSize, fontWeight: COMPONENT.actionSheet.textWeight, color: item.danger ? COLOR.status.negative : T.ink }}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
          style={{ minHeight: floating ? COMPONENT.actionSheet.floating.rowHeight : undefined, justifyContent: 'center', paddingVertical: floating ? 0 : COMPONENT.actionSheet.rowPaddingVertical, borderRadius: COMPONENT.actionSheet.groupRadius, backgroundColor: floating ? T.surface : T.surface2, alignItems: 'center' }}
        >
          <Text style={{ fontSize: floating ? COMPONENT.actionSheet.floating.textSize : COMPONENT.actionSheet.textSize, fontWeight: COMPONENT.actionSheet.textWeight, color: floating ? COLOR.action.primary : T.ink }}>{closeLabel}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

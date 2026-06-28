// CategoryPickerSheet.tsx — 카테고리 선택 바텀시트 (추가·수정 공용)
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Sheet, Icon } from '../../../components/kit';
import { T } from '../../../theme/tokens';
import { categories } from '../demoData';

export function CategoryPickerSheet({
  visible,
  value,
  onSelect,
  onClose,
}: {
  visible: boolean;
  value?: string;
  onSelect: (c: string) => void;
  onClose: () => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} height={520} title="카테고리 선택">
      <View style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 30, gap: 8 }}>
        {categories.map((c) => {
          const on = value === c;
          return (
            <Pressable
              key={c}
              onPress={() => {
                onSelect(c);
                onClose();
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingVertical: 14,
                paddingHorizontal: 16,
                borderRadius: 12,
                backgroundColor: on ? T.blueTint : T.surface,
                borderWidth: 1,
                borderColor: on ? T.blue : T.line,
              }}
            >
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: on ? T.blue : T.ink2 }}>{c}</Text>
              {on ? <Icon name="check" size={17} color={T.blue} sw={2.4} /> : null}
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}

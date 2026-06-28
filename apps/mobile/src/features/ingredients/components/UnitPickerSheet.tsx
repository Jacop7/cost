// UnitPickerSheet.tsx — 단위 선택 바텀시트 (추가·수정·구매옵션 공용)
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Sheet, Icon } from '../../../components/kit';
import { T, FONT } from '../../../theme/tokens';

const UNIT_GROUPS: [string, string[]][] = [
  ['무게', ['kg', 'g']],
  ['부피', ['L', 'ml']],
  ['개수', ['박스', '개']],
];

// 기준단위 → 단위 그룹(부모단위+단위). 수정·구매옵션은 같은 그룹만 노출.
const GROUP_OF: Record<'g' | 'ml' | '개', string> = { g: '무게', ml: '부피', 개: '개수' };

export function UnitPickerSheet({
  visible,
  unit,
  onSelect,
  onClose,
  base,
}: {
  visible: boolean;
  unit: string;
  onSelect: (u: string) => void;
  onClose: () => void;
  base?: 'g' | 'ml' | '개'; // 지정 시 해당 그룹만 표시 (수정·구매옵션)
}) {
  const groups = base ? UNIT_GROUPS.filter(([label]) => label === GROUP_OF[base]) : UNIT_GROUPS;
  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 30 }}>
        <Text style={{ fontSize: 20, fontWeight: '800', letterSpacing: -0.4, marginBottom: 16, color: T.ink }}>
          단위 선택
        </Text>
        <View style={{ gap: 16 }}>
          {groups.map(([label, opts]) => (
            <View key={label}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: T.sub, marginBottom: 8 }}>{label}</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {opts.map((u) => {
                  const on = unit === u;
                  return (
                    <Pressable
                      key={u}
                      onPress={() => {
                        onSelect(u);
                        onClose();
                      }}
                      style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 5,
                        paddingVertical: 16,
                        paddingHorizontal: 4,
                        borderRadius: 12,
                        backgroundColor: on ? T.blueTint : T.surface,
                        borderWidth: 1,
                        borderColor: on ? T.blue : T.line,
                      }}
                    >
                      {on ? <Icon name="check" size={16} color={T.blue} sw={2.4} /> : null}
                      <Text style={{ fontSize: 16, fontWeight: '700', color: on ? T.blue : T.ink2 }}>{u}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      </View>
    </Sheet>
  );
}

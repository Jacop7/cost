import { ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { COLOR, T, TYPE, radius, space } from '@/theme/tokens';

/** 삭제 차단 안내의 대상·해결 방법·연결 정보를 동일한 위계로 표시한다. */
export function DeleteBlockedContent({ name, description, instruction, linkedLabel, count, names }: {
  name: string; description: string; instruction: string; linkedLabel: string;
  count?: number; names?: string[];
}) {
  const { height } = useWindowDimensions();
  return <View style={{ gap: space.xl }}>
    <Text style={{ ...TYPE.caption, fontWeight: '400', color: COLOR.text.secondary, textAlign: 'center' }}>
      <Text style={{ fontWeight: '700', color: COLOR.text.primary }}>{name}</Text> {description}{'\n'}
      {instruction}
    </Text>
    <View style={{ backgroundColor: T.bg, borderRadius: radius.md, paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: names?.length ? space.xs : space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingBottom: names?.length ? space.sm : 0 }}>
        <Text style={{ ...TYPE.captionSm, color: COLOR.text.secondary, flex: 1 }}>{linkedLabel}</Text>
        {count !== undefined ? <Text style={{ ...TYPE.captionSm, color: COLOR.text.primary }}>{count}개</Text> : null}
      </View>
      {names?.length ? <ScrollView style={{ maxHeight: height * 0.25 }}>
        {names.map((itemName, index) => <View key={`${index}-${itemName}`} style={{ flexDirection: 'row', gap: space.sm }}>
          <Text style={{ ...TYPE.caption, color: COLOR.text.primary, flex: 1, paddingVertical: space.sm,
            borderTopWidth: index === 0 ? 0 : 1, borderTopColor: T.line }}>{itemName}</Text>
        </View>)}
      </ScrollView> : null}
    </View>
  </View>;
}

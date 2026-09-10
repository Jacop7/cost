import { View } from 'react-native';
import { COLOR, radius } from '@/theme/tokens';
import { Icon, type IconName } from './Icon';

/** 상세의 메모·최근 수정 행이 공유하는 아이콘 표현. */
export function DetailRowIcon({ name }: { name: IconName }) {
  return (
    <View style={{ width: 22, height: 22, flexShrink: 0, borderRadius: radius.md,
      alignItems: 'center', justifyContent: 'center', backgroundColor: COLOR.action.primaryTint }}>
      <Icon name={name} size={14} color={COLOR.action.primary} sw={2.2} />
    </View>
  );
}

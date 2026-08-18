/**
 * SearchBar — 목록 화면 공용 검색 입력.
 *
 * 헤더의 검색 아이콘을 누르면 펼쳐지고, 비우고 닫으면 사라진다. 검색어는 화면이 소유하고
 * 여기서는 입력만 받는다(필터링 규칙은 화면마다 다르므로 상위에서 결정).
 *
 * 가이드 §9.8 — 검색 결과 0건과 최초 데이터 0건을 구분해야 하므로, 화면은 `query` 가 비었는지로
 * 두 상태를 갈라야 한다.
 */
import { Pressable, TextInput, View } from 'react-native';
import { Icon } from './Icon';
import { T } from '@/theme/tokens';

export function SearchBar({ value, onChange, placeholder, onClose, autoFocus = true }: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  /**
   * 닫기(X). 검색 모드를 끄고 목록을 원래대로 되돌린다.
   * 검색 전용 화면(부자재 검색 등)에는 끌 모드가 없으므로 생략할 수 있다 — 그때는 X 를 감춘다.
   */
  onClose?: () => void;
  autoFocus?: boolean;
}) {
  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 14 }}>
        <Icon name="search" size={19} color={T.ter} />
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={T.ter}
          autoFocus={autoFocus}
          returnKeyType="search"
          accessibilityLabel={placeholder}
          style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: '600', color: T.ink, padding: 0 }}
        />
        {/* 34×34 이라 hitSlop 5 로 최소 44×44 를 채운다(§9.6-1). */}
        {onClose ? (
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="검색 닫기"
            hitSlop={5}
            style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="close" size={18} color={T.ter} />
          </Pressable>
        ) : value !== '' ? (
          <Pressable
            onPress={() => onChange('')}
            accessibilityRole="button"
            accessibilityLabel="검색어 지우기"
            hitSlop={5}
            style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="close" size={18} color={T.ter} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

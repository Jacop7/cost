/**
 * 부족 확인 시트 — 프로토타입 `business-hours-negative-stock-flow.html` 의 `openStockWarning`.
 *
 * 기획안 §4.4. 재고가 모자라도 **막지 않는다.** 다만 알고 넘어갈 기회는 반드시 준다.
 *
 *   영업 시작   `현재 재고가 부족한 메뉴가 있어요`   [재고 확인] [그대로 영업 시작]
 *   판매        `판매 수량보다 재고가 부족해요`      [재고 확인] [그대로 판매]
 *
 * ⚠ 왼쪽이 `재고 확인`, 오른쪽이 `그대로 …` 다. 순서를 바꾸지 않는다 —
 *   프로토타입의 `.sheet-actions` 가 취소 자리에 `재고 확인` 을 둔다.
 *   '그대로'가 파란 버튼인 이유는 그게 **사장님이 하려던 일**이기 때문이다.
 *   부족은 사고가 아니라 상태다.
 *
 * ⚠ `Alert.alert()` 로 만들지 않는다. 웹에서 빈 함수라 아무 일도 안 일어난다
 *   (`react-native-web` 이 `static alert() {}`). 실제로 그것 때문에 영업 시작
 *   버튼이 죽은 것처럼 보였다.
 */
import { Text, View } from 'react-native';
import { Button, Sheet } from '@/components/kit';
import { T } from '@/theme/tokens';
import type { ShortageMode, ShortageRecipe } from '../hooks';

export function ShortageWarningSheet({
  visible, mode, recipes, loading, onCheck, onContinue, onClose,
}: {
  visible: boolean;
  mode: ShortageMode;
  recipes: ShortageRecipe[];
  loading?: boolean;
  /** `재고 확인` — 부족 목록 화면으로. */
  onCheck: () => void;
  /** `그대로 …` — 하려던 일을 그대로 한다. */
  onContinue: () => void;
  onClose: () => void;
}) {
  const start = mode === 'start';
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={start ? '현재 재고가 부족한 메뉴가 있어요' : '판매 수량보다 재고가 부족해요'}
      scroll={false}
    >
      <Text style={{ fontSize: 15, lineHeight: 23, color: T.sub, marginTop: 2 }}>
        재고를 확인하거나 그대로 {start ? '영업을 시작' : '판매'}할 수 있어요.
      </Text>

      {/*
        프로토타입 `.warning-list` — 메뉴 이름과 부족 재료 수만.
        ⚠ 여기에 재료를 다 늘어놓지 않는다. 자세한 건 `재고 확인` 이 할 일이고,
          시트가 길어지면 두 버튼이 화면 밖으로 밀린다.
      */}
      <View style={{ marginTop: 14, borderRadius: 12, backgroundColor: T.surface2, overflow: 'hidden' }}>
        {recipes.map((r, i) => (
          <View
            key={r.recipeId}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 8,
              paddingVertical: 11, paddingHorizontal: 13,
              borderBottomWidth: i < recipes.length - 1 ? 1 : 0, borderBottomColor: T.line2,
            }}
          >
            <Text style={{ flex: 1, fontSize: 15, fontWeight: '800', color: T.ink }} numberOfLines={1}>
              {r.name}
            </Text>
            <Text style={{ fontSize: 14, fontWeight: '800', color: T.red }}>
              부족 재료 {r.ingredients.length}개
            </Text>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 18, marginBottom: 6 }}>
        <View style={{ flex: 1 }}>
          <Button kind="ghost" size="lg" full onPress={onCheck}>재고 확인</Button>
        </View>
        <View style={{ flex: 1 }}>
          <Button kind="primary" size="lg" full loading={loading} onPress={onContinue}>
            {start ? '그대로 영업 시작' : '그대로 판매'}
          </Button>
        </View>
      </View>
    </Sheet>
  );
}

/** 판매 항목의 의미 키. 화면 언어와 저장소의 recipe 식별자는 별개다. */
export const MENU_ITEM_TERM = { key: 'menu.item', ko: '메뉴', en: 'Menu item' } as const;

/** 서버가 만든 이력 제목에만 사용한다. 이름·메모·변경 전후값에는 적용하지 않는다. */
export function menuSystemTitle(value: string): string {
  const titles: Record<string, string> = {
    '레시피 등록': '메뉴 등록',
    '레시피 수정': '메뉴 수정',
  };
  return Object.prototype.hasOwnProperty.call(titles, value) ? titles[value] ?? value : value;
}

/** 알려진 서버 안내만 표시용으로 번역한다. 오류 코드·상세와 원문 보고는 보존한다. */
export function menuSystemError(value: string): string {
  const messages: Record<string, string> = {
    '레시피 필수 입력 형식이 올바르지 않습니다': '메뉴 필수 입력 형식이 올바르지 않습니다',
    '판본을 포함한 레시피 상태 저장이 필요합니다': '판본을 포함한 메뉴 상태 저장이 필요합니다',
    '재료 입력 형식이 올바르지 않습니다': '식재료 입력 형식이 올바르지 않습니다',
    '재료 입력을 확인해 주세요': '식재료 입력을 확인해 주세요',
    '재료량 범위를 확인해 주세요': '식재료량 범위를 확인해 주세요',
    '이 매장의 재료가 아니에요': '이 매장의 식재료가 아니에요',
    '메뉴가 자기 자신을 재료로 쓸 수 없어요': '메뉴가 자기 자신을 식재료로 쓸 수 없어요',
  };
  if (Object.prototype.hasOwnProperty.call(messages, value)) return messages[value] ?? value;
  const stopped = /^(.*)은\(는\) 판매 중지된 메뉴예요\. 레시피에서 판매를 다시 켜 주세요$/s.exec(value);
  if (stopped) return `${stopped[1]}은(는) 판매 중지된 메뉴예요. 메뉴에서 판매를 다시 켜 주세요`;
  const snapshot = /^손익 스냅샷이 불완전합니다 \(레시피 ([0-9a-f-]+)\)$/i.exec(value);
  return snapshot ? `손익 스냅샷이 불완전합니다 (메뉴 ${snapshot[1]})` : value;
}

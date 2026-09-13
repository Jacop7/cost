/** 판매 항목의 의미 키. 화면 언어와 저장소의 recipe 식별자는 별개다. */
export const MENU_ITEM_TERM = { key: 'menu.item', ko: '메뉴', en: 'Menu item' } as const;

/** 서버가 만든 이력 제목에만 사용한다. 이름·메모·변경 전후값에는 적용하지 않는다. */
export function menuSystemTitle(value: string): string {
  const titles: Record<string, string> = {
    '레시피 등록': '메뉴 등록',
    '레시피 수정': '메뉴 수정',
    '고정지출 반영': '고정 지출 반영',
  };
  return Object.prototype.hasOwnProperty.call(titles, value) ? titles[value] ?? value : value;
}

/** 서버가 생성한 손익 원인의 표시만 바꾼다. 원장과 계산용 core 라벨은 보존한다. */
export function profitSystemLabel(key: string | null, label: string): string {
  if (key === 'material_cost' && ['재료비', '재료비'].includes(label)) return '재료 원가';
  if (key === 'fixed_cost' && label === '고정지출') return '고정 지출';
  if (key === 'fixed_rate' && label === '고정지출률') return '고정 지출률';
  if (key === 'fixed_items' && label === '고정지출 항목') return '고정 지출 항목';
  if (key === 'fixed_detail' && label === '고정지출 세부 설정') return '고정 지출 세부 설정';
  return label;
}

export function profitSystemSummary(key: string | null, summary: string | null): string | null {
  if (summary === null) return null;
  const match = /^(재료비|재료비|고정지출) ([0-9][0-9,.]*원 (?:증가|감소))$/.exec(summary);
  return match ? `${profitSystemLabel(key, match[1]!)} ${match[2]}` : summary;
}

/** 알려진 서버 안내만 표시용으로 번역한다. 오류 코드·상세와 원문 보고는 보존한다. */
export function menuSystemError(value: string): string {
  const messages: Record<string, string> = {
    '레시피 필수 입력 형식이 올바르지 않습니다': '메뉴 필수 입력 형식이 올바르지 않습니다',
    '판본을 포함한 레시피 상태 저장이 필요합니다': '판본을 포함한 메뉴 상태 저장이 필요합니다',
    '재료 입력 형식이 올바르지 않습니다': '재료 입력 형식이 올바르지 않습니다',
    '재료 입력을 확인해 주세요': '재료 입력을 확인해 주세요',
    '재료량 범위를 확인해 주세요': '재료량 범위를 확인해 주세요',
    '이 매장의 재료가 아니에요': '이 매장의 재료가 아니에요',
    '메뉴가 자기 자신을 재료로 쓸 수 없어요': '메뉴가 자기 자신을 재료로 쓸 수 없어요',
  };
  if (Object.prototype.hasOwnProperty.call(messages, value)) return messages[value] ?? value;
  const stopped = /^(.*)은\(는\) 판매 중지된 메뉴예요\. 레시피에서 판매를 다시 켜 주세요$/s.exec(value);
  if (stopped) return `${stopped[1]}은(는) 판매 중지된 메뉴예요. 메뉴에서 판매를 다시 켜 주세요`;
  const snapshot = /^손익 스냅샷이 불완전합니다 \(레시피 ([0-9a-f-]+)\)$/i.exec(value);
  return snapshot ? `손익 스냅샷이 불완전합니다 (메뉴 ${snapshot[1]})` : value;
}

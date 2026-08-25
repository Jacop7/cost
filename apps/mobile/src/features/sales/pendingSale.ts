/**
 * `재고 확인` 으로 건너갈 때 들고 가는 판매 묶음.
 *
 * 판매 판정은 **무엇을 얼마나 팔려는지**를 알아야 한다(0107). 그런데 부족 시트에서
 * `재고 확인` 을 누르면 화면이 바뀌므로 그 정보가 사라진다.
 *
 * ⚠ 결과를 들고 가지 않고 **입력을 들고 간다.** 재고 확인 화면은 그걸로 서버에
 *   다시 물어본다 — 재고를 추가하고 돌아오면 남은 부족량이 즉시 다시 계산돼야
 *   하기 때문이다(기획안 §4.4). 결과만 들고 가면 화면이 옛날 숫자로 굳는다.
 *
 * 라우트 파라미터로 실어 보내지 않는 이유: 메뉴가 스무 개면 URL 이 그만큼 길어지고,
 * 뒤로 가기·새로고침으로 깨질 수 있다. 한 번 쓰고 버리는 값이라 모듈 변수면 충분하다.
 */
import type { SaleItemInput } from './hooks';

interface PendingSale {
  date: string;
  items: SaleItemInput[];
}

let pending: PendingSale | null = null;

export const setPendingSale = (date: string, items: SaleItemInput[]): void => {
  pending = { date, items };
};

export const getPendingSale = (): PendingSale | null => pending;

/** 판매를 저장했거나 그만뒀으면 비운다. 남겨 두면 다음 `재고 확인` 이 옛 묶음을 잰다. */
export const clearPendingSale = (): void => {
  pending = null;
};

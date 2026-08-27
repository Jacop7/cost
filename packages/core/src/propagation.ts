/**
 * 전파 이벤트 E1~E12.
 * 권위 있는 실행은 packages/db 의 RPC(트랜잭션). 여기서는 각 이벤트의
 * 갱신 순서를 단일 정의로 명세해 앱 낙관적 업데이트·DB RPC·테스트가 공유한다.
 *
 * 전파 원칙:
 *  - 재고 변화는 append-only inventory_events 로 남고 현재 잔액은 그 합과 일치한다.
 *  - E7 발주는 기록일 뿐이며 입고(E1) 전 재고·단가를 바꾸지 않는다.
 *  - 판매(E8/E9)와 입고 취소(E11)도 원장을 지우지 않고 정방향·보정 이벤트를 쌓는다.
 */

/**
 * 전파 이벤트. **E6 은 없다** — ORD-04 레시피 계산기는 1차 범위 밖이라 지웠다(0060).
 * 번호는 당기지 않는다. E7 을 E6 으로 옮기면 지금까지 쓴 문서·주석·커밋의 번호가 전부 어긋난다.
 */
export type PropagationEvent =
  | 'E1' | 'E2' | 'E3' | 'E4' | 'E5' | 'E7'
  | 'E8' | 'E9' | 'E10' | 'E11' | 'E12';

export interface EventSpec {
  id: PropagationEvent;
  trigger: string; // 화면/액션
  /** 갱신 대상 — 실행 순서대로. RPC 트랜잭션이 이 순서로 처리. */
  steps: string[];
  atomic: boolean; // 트랜잭션 원자성 필요 여부
}

export const PROPAGATION: Record<PropagationEvent, EventSpec> = {
  E1: {
    id: 'E1',
    trigger: '입고 확정 (ORD-03)',
    steps: [
      '재고 총량 +입고량',
      '입고 원장과 주문 수령량 기록',
      '양 가중 기준 단가 재계산',
      '가격 추이 점 적재',
      '영향 레시피 손익 재계산(변동 시 주황 점)',
      '월 재료비 합산',
      '발주 카드 상태 이동·후보 해소',
    ],
    atomic: true,
  },
  E2: {
    id: 'E2',
    trigger: '폐기 (ING-05)',
    steps: [
      '폐기량 기록',
      '재고 원장과 현재 잔액 차감',
      '실측 로스율 표시값 갱신',
      '현재 기준단가 가격 추이 점과 영향 레시피 손익 추이 기록',
      '발주 후보 재계산',
    ],
    atomic: true,
  },
  E3: {
    id: 'E3',
    trigger: '레시피 저장/수정 (RCP-03)',
    steps: ['손익 재계산', '순이익률 추이 파랑 점(저장일)', '리스트 정렬·경고 뱃지 갱신'],
    atomic: true,
  },
  E4: {
    id: 'E4',
    trigger: '고정 지출 저장 (MY-05)',
    steps: [
      '고정지출률·1,000원당 재계산',
      '전 레시피 손익 재계산 + 회색 점 일괄',
      '월 손익 리포트 생성/갱신',
    ],
    atomic: true,
  },
  E5: {
    id: 'E5',
    trigger: '재고 수정·실사 (ING-05)',
    steps: ['목표 재고와 현재 잔액 차이 계산', '보정 원장 추가', '발주 후보 재계산'],
    atomic: true,
  },
  E7: {
    id: 'E7',
    trigger: '발주 등록 (ORD-02)',
    steps: [
      "'발주됨' 레코드 생성",
      '도착 대기 목록 추가(예정일 정렬)',
      "후보 상태 '주문함' 전환",
      // 재고·단가는 변동 없음
    ],
    atomic: true,
  },
  E8: {
    id: 'E8',
    trigger: '판매 증가분 소진',
    steps: ['그날 스냅샷 필요량 계산', '필요량 전량 consume 원장 추가', '음수 잔액 보존'],
    atomic: true,
  },
  E9: {
    id: 'E9',
    trigger: '판매 감소·취소',
    steps: ['기존 소진량과 목표량 대조', '반대 부호 보정 원장 추가', '재고 복구'],
    atomic: true,
  },
  E10: {
    id: 'E10',
    trigger: '판매 저장',
    steps: ['영업일·판본·상태 잠금', '메뉴·채널·조리폐기 목표 수량 저장', 'E8/E9 목표치 대조'],
    atomic: true,
  },
  E11: {
    id: 'E11',
    trigger: '입고 취소',
    steps: ['입고량 전량 보정 원장 추가', '주문 수령량 복구', '기준단가·가격 추이 재계산'],
    atomic: true,
  },
  E12: {
    id: 'E12',
    trigger: '미입고 발주 취소',
    steps: ['발주 상태 취소', '발주 후보 주문함 상태 해제'],
    atomic: true,
  },
};

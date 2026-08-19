/**
 * 전파 이벤트 E1~E7 — ⑦ 4장.
 * 권위 있는 실행은 packages/db 의 RPC(트랜잭션). 여기서는 각 이벤트의
 * 갱신 순서를 단일 정의로 명세해 앱 낙관적 업데이트·DB RPC·테스트가 공유한다.
 *
 * 전파 원칙:
 *  - 재고·단가·이력은 오직 E1·E2·E5 에서만 변한다 (E7 등록은 기록일 뿐).
 *  - 손익 영향 이벤트(E1~E4)는 순이익률 추이에 원인 색 점을 남긴다.
 */

/**
 * 전파 이벤트. **E6 은 없다** — ORD-04 레시피 계산기는 1차 범위 밖이라 지웠다(0060).
 * 번호는 당기지 않는다. E7 을 E6 으로 옮기면 지금까지 쓴 문서·주석·커밋의 번호가 전부 어긋난다.
 */
export type PropagationEvent = 'E1' | 'E2' | 'E3' | 'E4' | 'E5' | 'E7';

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
      'ING 뱃지 재판정',
      '구매 이력(=최근 주문) 추가',
      '평균·기준 단가 재계산',
      '가격 추이 점 적재',
      '영향 레시피 손익 재계산(변동 시 주황 점)',
      '월 재료비 합산',
      'ORD 카드 완료 이동·후보 해소',
      '(평균 ±15%) 급등 알림',
    ],
    atomic: true,
  },
  E2: {
    id: 'E2',
    trigger: '폐기 (ING-04)',
    steps: [
      '폐기량 기록',
      '실측 로스율 재계산',
      '기준 단가 보정',
      '영향 레시피 손익',
      '재고 개수 차감·뱃지',
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
    trigger: '고정 지출 저장 (MY-02)',
    steps: [
      '고정지출률·1,000원당 재계산',
      '전 레시피 손익 재계산 + 회색 점 일괄',
      '월 손익 리포트 생성/갱신',
    ],
    atomic: true,
  },
  E5: {
    id: 'E5',
    trigger: '재고 수정·실사 (ING-04)',
    steps: ['개수 보정', '뱃지 재판정', '(안전재고 미달/곧소진) 발주 후보 생성'],
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
};

# ING-BULK-INBOUND-PLAN-20260921 브라우저 독립검수 증거

- 대상: `docs/재료-일괄-입고-상세계획안.md`
- 검수일: 2026-09-21
- 검수 표면: Claude Cowork 브라우저 채팅
- 관측 모델: `Fable 5.1 중간`
- 채팅: `https://claude.ai/cowork/cse_01N6B7WyewbSWEy6NsiXP68R`
- 범위: 읽기 전용 계획·기존 계약 대조. 구현 및 시험 결과 없음.

## 1차 판정

판정은 `CHANGES_REQUIRED`였다. 다음 Finding이 제기됐다.

| ID | 등급 | 요지 | 반영 위치 |
|---|---:|---|---|
| BULK-INBOUND-PLAN-01 | P1 | 0116 GUC와 재고 실사 중 전체 거절·롤백 계약 누락 | §3.4, §4.3, §7 |
| BULK-INBOUND-PLAN-02 | P2 | 카드별 E1 멱등 키 미정 | §4.1, §4.4, §7 |
| BULK-INBOUND-PLAN-03 | P2 | 기존 store write scope보다 재료 잠금을 먼저 잡는 순서 충돌 | §4.3, §7 |
| BULK-INBOUND-PLAN-04 | P2 | batch closed table과 VOLATILE resolve 경합 계약 미완성 | §4.4, §7 |
| BULK-INBOUND-PLAN-05 | P2 | 화면의 `입고 후 단가`가 어느 서버 값인지 미고정 | §3.3, §4.5 |
| BULK-INBOUND-PLAN-06 | P3 | RPC owner·ACL·오류 코드 계약 보완 | §4.6 |
| BULK-INBOUND-PLAN-07 | P3 | FAB 선택 props, `N건` 문구, E1 무효화 합집합 보완 | §3.1, §3.4, §5.2 |

## 재검수 판정

수정본 재검수는 `READY`였다. BULK-INBOUND-PLAN-01~07은 모두 `CLOSED`로 판정됐다.
미해결 P0/P1/P2는 없다.

재검수에서 선택 개선 BULK-INBOUND-PLAN-08(P3)이 추가됐다. 서버 멱등 payload 판정과 앱 로컬
payload hash의 역할을 구분하라는 내용이었다. §4.4에 다음을 반영했다.

- 서버 멱등 payload 일치 판정은 PostgreSQL `jsonb` 동등 비교가 권위다.
- 앱 payload hash는 대기 건 표시·로컬 진단 전용이다.
- 앱 hash는 서버 멱등 판정이나 재전송 허용 판단에 사용하지 않는다.

최종 확인 응답은 `READY`, `findings: []`, BULK-INBOUND-PLAN-08 `CLOSED`였다.

## 한계

- 계획 단계 판정이며 구현 diff 검수가 아니다.
- DB migration, 앱 코드, 시험은 아직 작성하거나 실행하지 않았다.
- 최종 확인은 §4.4 변경 행만 다시 읽었고 나머지 절은 직전 READY 판정을 유지했다.

## Astra 교차검수

- 검수 모델: GPT-6 Astra
- 최초 판정: `CHANGES_REQUIRED`
- 검토 판본 SHA-256: `13BA8C0E2747613163A73B4113A0622AF0739FE3ADD19C4DB6CC13E4C402E33C`

Astra는 다음 필수 Finding 3건을 제기했다.

1. P1: 신규 receipt·closed 테이블의 RLS, 직접 접근 회수, 최소 ACL과 매장·actor 격리 누락
2. P2: 결제금액·입고량 입력 정밀도에 표시 전용 `unit_price_digits`를 적용하는 계약 충돌
3. P2: 메뉴·매출 원가의 최신값 시험이 영업 중·브레이크 시작 스냅샷과 과거 확정 손익 보존을
   구분하지 않음

계획안 §3.3, §4.4, §4.6, §7에 세 Finding과 다음 P3 시험 권고를 반영했다.

- 첫 카드 실행 뒤 두 번째 카드 실패를 주입하는 실제 트랜잭션 롤백 시험
- write/resolve 결과의 `ingredient_id`를 이용한 앱 재시작 후 캐시 무효화
- preview 요청 payload 판본과 지연 응답 무효화 시험

Astra 재검수 판정은 `READY`이며 남은 P0/P1/P2/P3 Finding은 없다. 재검수 판본 SHA-256은
`AC65BE33C9ECFF77BD8FECD002EE2CA78973F434439426CF6CCA1C4CB4041FCC`다. 이는 구현을 시작할 수
있는 계획안 판정이며 구현 완료나 시험 통과를 뜻하지 않는다.

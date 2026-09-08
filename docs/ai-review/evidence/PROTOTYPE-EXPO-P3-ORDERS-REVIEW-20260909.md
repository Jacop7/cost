# P3 발주 — 옵션 선택 안전 보정

- 대상: `7caebadcf7a2a13c1f32971f42375f8914b7280c`
- 기준: `62495ede24d166877df214172267c5a772c4af6a`
- 상태: **자체검수 PASS / Sol 내부검수 USAGE_LIMIT_BLOCKED / 배치 미종결**
- 화면: ORD-01 주문하기 시트. 발주 전체 레이아웃 적용 완료를 뜻하지 않는다.

## 변경과 증거

선택한 구매 옵션이 refetch에서 사라지면 기존 코드는 첫 옵션의 구매처·용량·금액으로
자동 대체할 수 있었다. 실제 화면·kit RNW/jsdom 시험으로 4개 중 1개 실패를 먼저 확인했다.
명시적으로 선택한 ID가 없어진 경우에는 발주 버튼을 비활성화하고 재선택을 안내한다.
처음 여는 경우의 첫 옵션 기본 선택은 유지하며 선택 표시·금액·payload가 같은 객체를 사용한다.
웹 버튼의 선택 상태는 `aria-pressed`로도 제공한다.

`ordersHomeParity.test.tsx` 5/5와 mobile typecheck PASS. 시험 범위는 서버 날짜 fixture,
3탭 건수·검색, E7 payload/성공 전후, 옵션 소실/재선택/동일 ID 갱신,
부분 입고 실패 재시도의 멱등키 유지다. 도메인 훅·RPC mutation·날짜·router·Alert와
native Modal을 격리했으며 실제 DB 저장·네이티브 조작·시각 회귀를 인증하지 않는다.
기존 앱 전체 568시험 결과를 이 커밋의 전체 재실행으로 승계하지 않는다.

## 검수 상태와 다음 행동

사용자 승인2026-09-09에 따라 일반 배치는 자체검수 뒤 별도 Sol high 검수·피드백 반영·재검수
PASS가 필수다. Astra는 공용 계약 변경 또는 Sol 미해결 반복 실패 등 고위험에만 추가하며,
단순 한도 우회를 위해 대체하지 않는다. Fable/Opus 공식검수·전체 게이트·네이티브 조건은 불변이다.

Sol에 위 exact SHA와 두 파일 diff, 관련 5시험의 읽기 전용 검수를 요청했으나 실행 서비스가
`You've hit your usage limit`을 반환했다. 검수 결과나 Findings가 생성된 것이 아니므로
PASS로 기록하지 않는다. 새 결제·usage reset·다른 모델 대체는 실행하지 않았다.
Sol 이용 가능 후 같은 제품 SHA를 재검수하고, 통과 뒤 발주 시각 작업을 이어간다.
새 발주 캡처 스크립트는 미추적 준비본이며 실행·검증 완료가 아니다.

## 재부팅 후 재개 — Sol 한도 복구

HEAD `1650a393ee8d22e95e06b44727c2aa5620dba61d`에서 Sol high가 제품 `7caebad`의
지정 두 파일 diff와 이후 동일성을 확인했다. 관련 5/5와 typecheck를 직접 실행해
**한정 PASS / Finding 없음**을 반환했다. 앞 usage-limit 차단은 해소됐으며 시각·네이티브·
실제 RPC/DB 또는 발주 전체 승인이 아니다. 주 작업자도 공용 탭 2개 포함 7/7을 재실행했다.
Docker 기존 8컨테이너와 8091 Expo를 복구했다. 볼륨 초기화·DB 쓰기는 수행하지 않았다.

첫 before 수집은 15패스 중 12개/15PNG, 주문 시트 3개 timeout으로 **FAIL**이다.
`before-20260909/orders-evidence.json`에 실패를 남겼다. 원인은 합성 ingredient_detail의
`last_change:null`이 실제 parseLastChange의 display_state 존재 계약을 깨뜨린 것.
브라우저 시트의 개발 오류 문구로 확인했고 `{display_state:null,has_history:false}`로
수집기 fixture만 고쳤다. 제품 결함 또는 정상 주문 시트 캡처로 인용하지 않는다.
